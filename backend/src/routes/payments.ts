/**
 * Payment Routes
 * Handles subscription and pay-as-you-go payments via Lenco
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import {
  initiateMobileMoneyPayment,
  verifyPayment,
  generatePaymentReference,
} from "../services/lenco-payment.js";
import { getUserLimits, getUsageSummary } from "../services/usage-limits.js";
import {
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail,
  sendLowCreditsWarningEmail,
} from "../services/email.js";

// Payment plans
const PLANS = {
  monthly_subscription: {
    code: "monthly_sub",
    name: "Monthly Subscription",
    price: 99, // K99
    currency: "ZMW",
    limits: {
      generations_per_month: -1, // unlimited
      exports_per_month: -1, // unlimited
    },
  },
  pay_as_you_go: {
    code: "payg",
    name: "Pay As You Go",
    price: 40, // K40
    currency: "ZMW",
    limits: {
      generations: 2,
      exports: 2,
    },
  },
} as const;

const initiatePaymentSchema = z.object({
  planType: z.enum(["monthly_subscription", "pay_as_you_go"]),
  phone: z.string().min(10, "Valid phone number required").transform((phone) => {
    // Remove spaces, dashes, and other non-numeric characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Handle Zambian phone numbers
    // Format: 0977123456 or +260977123456 or 260977123456
    if (cleaned.startsWith('+260')) {
      cleaned = cleaned.substring(4); // Remove +260
    } else if (cleaned.startsWith('260')) {
      cleaned = cleaned.substring(3); // Remove 260
    } else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1); // Remove leading 0
    }
    
    // Should now be 9 digits (e.g., 977123456)
    if (cleaned.length !== 9) {
      throw new Error('Invalid Zambian phone number format');
    }
    
    // Return in format Lenco expects (without country code, without leading 0)
    return cleaned;
  }),
  country: z.string().length(2, "2-letter country code required").default("ZM"),
});

const verifyPaymentSchema = z.object({
  reference: z.string().min(1),
});

const webhookSchema = z.object({
  event: z.string(),
  data: z.object({
    reference: z.string(),
    status: z.enum(["pending", "successful", "failed", "pay-offline"]),
    amount: z.string(),
    currency: z.string(),
    lencoReference: z.string(),
    reasonForFailure: z.string().optional().nullable(),
  }),
});

const paymentRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /payments/initiate
   * Initiate a payment for subscription or PAYG
   */
  app.post("/initiate", async (request, reply) => {
    const userId = requireUserId(request);

    const body = initiatePaymentSchema.parse(request.body);
    const plan = PLANS[body.planType];

    // Generate unique reference
    const reference = generatePaymentReference(
      userId,
      body.planType === "monthly_subscription" ? "subscription" : "payg"
    );

    try {
      // Initiate payment with Lenco
      const paymentResponse = await initiateMobileMoneyPayment({
        amount: plan.price,
        currency: plan.currency,
        phone: body.phone,
        country: body.country,
        reference,
        bearer: "customer", // customer pays the transaction fee
        metadata: {
          userId,
          planType: body.planType,
          planCode: plan.code,
        },
      });

      // Create transaction record
      const transaction = await app.prisma.transaction.create({
        data: {
          userId,
          provider: "lenco",
          externalTransactionId: paymentResponse.data.lencoReference,
          transactionType: "charge",
          status: paymentResponse.data.status === "successful" ? "succeeded" : "pending",
          amountCents: Math.round(plan.price * 100),
          currency: plan.currency,
          metadataJson: {
            reference,
            planType: body.planType,
            planCode: plan.code,
            phone: body.phone,
            country: body.country,
            lencoStatus: paymentResponse.data.status,
          },
        },
      });

      // If monthly subscription, create/update subscription record
      if (body.planType === "monthly_subscription") {
        // Find or create plan
        let planRecord = await app.prisma.plan.findUnique({
          where: { code: plan.code },
        });

        if (!planRecord) {
          planRecord = await app.prisma.plan.create({
            data: {
              code: plan.code,
              name: plan.name,
              monthlyPriceCents: plan.price * 100,
              limitsJson: plan.limits,
            },
          });
        }

        // Create subscription (will be activated on successful payment)
        await app.prisma.subscription.create({
          data: {
            userId,
            planId: planRecord.id,
            provider: "lenco",
            providerSubscriptionId: reference,
            status: "trialing", // will update to active on webhook
          },
        });
      }

      return reply.code(200).send({
        success: true,
        message: "Payment initiated. Please authorize on your mobile phone.",
        data: {
          reference,
          lencoReference: paymentResponse.data.lencoReference,
          amount: plan.price,
          currency: plan.currency,
          status: paymentResponse.data.status,
          transactionId: transaction.id,
          instructions:
            "Check your phone for a payment prompt. Authorize the payment to complete your purchase.",
        },
      });
    } catch (error) {
      app.log.error({ error, userId, planType: body.planType }, "Payment initiation failed");
      throw app.httpErrors.badRequest(
        error instanceof Error ? error.message : "Failed to initiate payment"
      );
    }
  });

  /**
   * GET /payments/verify/:reference
   * Verify payment status
   */
  app.get("/verify/:reference", async (request, reply) => {
    const userId = requireUserId(request);

    const { reference } = request.params as { reference: string };

    try {
      // Verify with Lenco
      const verification = await verifyPayment(reference);

      // Update transaction status
      const transaction = await app.prisma.transaction.findFirst({
        where: {
          userId,
          metadataJson: {
            path: ["reference"],
            equals: reference,
          },
        },
      });

      if (!transaction) {
        throw app.httpErrors.notFound("Transaction not found");
      }

      const newStatus =
        verification.data.status === "successful"
          ? "succeeded"
          : verification.data.status === "failed"
            ? "failed"
            : "pending";

      await app.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          processedAt: verification.data.completedAt
            ? new Date(verification.data.completedAt)
            : null,
          metadataJson: {
            ...(transaction.metadataJson as object),
            lencoStatus: verification.data.status,
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      // If successful and subscription, activate it
      if (verification.data.status === "successful") {
        const metadata = transaction.metadataJson as any;
        if (metadata.planType === "monthly_subscription") {
          await app.prisma.subscription.updateMany({
            where: {
              userId,
              providerSubscriptionId: reference,
            },
            data: {
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
          });
        }
      }

      return reply.code(200).send({
        success: true,
        data: {
          reference,
          status: verification.data.status,
          amount: verification.data.amount,
          currency: verification.data.currency,
          completedAt: verification.data.completedAt,
        },
      });
    } catch (error) {
      app.log.error({ error, reference }, "Payment verification failed");
      throw app.httpErrors.badRequest(
        error instanceof Error ? error.message : "Failed to verify payment"
      );
    }
  });

  /**
   * POST /payments/webhook
   * Handle Lenco webhook notifications
   * This endpoint receives payment status updates from Lenco
   */
  app.post("/webhook", async (request, reply) => {
    try {
      const payload = webhookSchema.parse(request.body);

      app.log.info({ webhook: payload }, "Received Lenco webhook");

      // Find transaction by reference
      const transaction = await app.prisma.transaction.findFirst({
        where: {
          metadataJson: {
            path: ["reference"],
            equals: payload.data.reference,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });

      if (!transaction) {
        app.log.warn({ reference: payload.data.reference }, "Transaction not found for webhook");
        return reply.code(200).send({ received: true });
      }

      const newStatus =
        payload.data.status === "successful"
          ? "succeeded"
          : payload.data.status === "failed"
            ? "failed"
            : "pending";

      // Update transaction
      const updatedTransaction = await app.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          processedAt: payload.data.status === "successful" ? new Date() : null,
          externalTransactionId: payload.data.lencoReference,
          metadataJson: {
            ...(transaction.metadataJson as object),
            lencoStatus: payload.data.status,
            webhookReceivedAt: new Date().toISOString(),
            webhookEvent: payload.event,
          },
        },
      });

      const metadata = transaction.metadataJson as any;

      // Handle successful payment
      if (payload.data.status === "successful") {
        app.log.info(
          { userId: transaction.userId, reference: payload.data.reference },
          "Payment successful"
        );

        // Activate subscription if monthly plan
        if (metadata.planType === "monthly_subscription") {
          const subscription = await app.prisma.subscription.updateMany({
            where: {
              userId: transaction.userId,
              providerSubscriptionId: payload.data.reference,
            },
            data: {
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          app.log.info(
            { userId: transaction.userId, reference: payload.data.reference },
            "Subscription activated via webhook"
          );
        }

        // Send payment confirmation email
        await sendPaymentConfirmationEmail(transaction.user.email, {
          userName: transaction.user.fullName || "Educator",
          planName:
            metadata.planType === "monthly_subscription"
              ? "Monthly Subscription"
              : "Pay As You Go",
          amount: transaction.amountCents / 100,
          currency: transaction.currency,
          reference: payload.data.reference,
        }).catch((err) => {
          app.log.error({ error: err }, "Failed to send payment confirmation email");
        });
      }

      // Handle failed payment
      if (payload.data.status === "failed") {
        app.log.warn(
          {
            userId: transaction.userId,
            reference: payload.data.reference,
            reason: payload.data.reasonForFailure,
          },
          "Payment failed"
        );

        // Send payment failed email
        await sendPaymentFailedEmail(
          transaction.user.email,
          transaction.user.fullName || "Educator",
          payload.data.reasonForFailure || "Payment could not be processed"
        ).catch((err) => {
          app.log.error({ error: err }, "Failed to send payment failed email");
        });
      }

      return reply.code(200).send({ received: true });
    } catch (error) {
      app.log.error({ error, body: request.body }, "Webhook processing failed");
      // Always return 200 to Lenco to prevent retries
      return reply.code(200).send({ received: true });
    }
  });

  /**
   * GET /payments/plans
   * Get available payment plans
   */
  app.get("/plans", async (request, reply) => {
    return reply.code(200).send({
      success: true,
      data: {
        monthly_subscription: {
          ...PLANS.monthly_subscription,
          description: "Unlimited lesson plan generations and exports per month",
          features: [
            "Unlimited lesson plan generations",
            "Unlimited exports (PDF, DOCX, PPTX)",
            "Priority support",
            "Access to all templates",
          ],
        },
        pay_as_you_go: {
          ...PLANS.pay_as_you_go,
          description: "Pay only for what you need",
          features: [
            "2 lesson plan generations",
            "2 exports (any format)",
            "Valid for 30 days",
            "No recurring charges",
          ],
        },
      },
    });
  });

  /**
   * GET /payments/history
   * Get user's payment history
   */
  app.get("/history", async (request, reply) => {
    const userId = requireUserId(request);

    const transactions = await app.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reply.code(200).send({
      success: true,
      data: transactions.map((t) => ({
        id: t.id,
        amount: t.amountCents / 100,
        currency: t.currency,
        status: t.status,
        type: t.transactionType,
        createdAt: t.createdAt,
        processedAt: t.processedAt,
        metadata: t.metadataJson,
      })),
    });
  });

  /**
   * GET /payments/usage
   * Get user's current usage and limits
   */
  app.get("/usage", async (request, reply) => {
    const userId = requireUserId(request);

    const [limits, summary] = await Promise.all([
      getUserLimits(app.prisma, userId),
      getUsageSummary(app.prisma, userId),
    ]);

    return reply.code(200).send({
      success: true,
      data: {
        limits,
        summary,
      },
    });
  });
};

export default paymentRoutes;
