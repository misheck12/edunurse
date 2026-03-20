/**
 * Subscription Management Routes
 * Handles subscription cancellation, pause, resume, and billing history
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkFeatureAccess, getUserFeatures, FeatureKey } from "../services/feature-access.js";

const cancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

const subscriptionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /subscriptions/current
   * Get user's current subscription
   */
  app.get("/current", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const subscription = await app.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      include: {
        plan: true,
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });

    if (!subscription) {
      return reply.code(200).send({
        success: true,
        data: null,
        message: "No active subscription",
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        id: subscription.id,
        planName: subscription.plan.name,
        planCode: subscription.plan.code,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        monthlyPrice: subscription.plan.monthlyPriceCents / 100,
        currency: "ZMW",
        limits: subscription.plan.limitsJson,
      },
    });
  });

  /**
   * POST /subscriptions/cancel
   * Cancel subscription (at end of period)
   */
  app.post("/cancel", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const body = cancelSubscriptionSchema.parse(request.body);

    const subscription = await app.prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });

    if (!subscription) {
      throw app.httpErrors.notFound("No active subscription found");
    }

    // Mark for cancellation at period end
    await app.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      },
    });

    // Log cancellation reason
    app.log.info(
      {
        userId,
        subscriptionId: subscription.id,
        reason: body.reason,
        feedback: body.feedback,
      },
      "Subscription cancelled"
    );

    return reply.code(200).send({
      success: true,
      message: `Subscription will cancel on ${subscription.currentPeriodEnd?.toLocaleDateString()}`,
      data: {
        cancelAt: subscription.currentPeriodEnd,
      },
    });
  });

  /**
   * POST /subscriptions/reactivate
   * Reactivate a cancelled subscription
   */
  app.post("/reactivate", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const subscription = await app.prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
        cancelAtPeriodEnd: true,
      },
      orderBy: {
        currentPeriodEnd: "desc",
      },
    });

    if (!subscription) {
      throw app.httpErrors.notFound("No cancelled subscription found");
    }

    await app.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Subscription reactivated successfully",
    });
  });

  /**
   * GET /subscriptions/billing-history
   * Get billing history
   */
  app.get("/billing-history", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId,
        status: "succeeded",
      },
      orderBy: {
        processedAt: "desc",
      },
      take: 50,
    });

    return reply.code(200).send({
      success: true,
      data: transactions.map((t) => ({
        id: t.id,
        date: t.processedAt || t.createdAt,
        amount: t.amountCents / 100,
        currency: t.currency,
        type: t.transactionType,
        description:
          (t.metadataJson as any)?.planType === "monthly_subscription"
            ? "Monthly Subscription"
            : "Pay As You Go",
        reference: (t.metadataJson as any)?.reference,
      })),
    });
  });

  /**
   * GET /subscriptions/features
   * Get all features available to the current user
   */
  app.get("/features", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const features = await getUserFeatures(app.prisma, userId);

    return reply.code(200).send({
      success: true,
      data: {
        features,
      },
    });
  });

  /**
   * GET /subscriptions/features/:feature
   * Check if user has access to a specific feature
   */
  app.get<{
    Params: { feature: string };
  }>("/features/:feature", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const feature = request.params.feature as FeatureKey;
    const result = await checkFeatureAccess(app.prisma, userId, feature);

    return reply.code(200).send({
      success: true,
      data: result,
    });
  });
};

export default subscriptionRoutes;
