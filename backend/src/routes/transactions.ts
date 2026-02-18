/**
 * Transactions Routes
 * Handles transaction viewing, filtering, and management
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const transactionFilterSchema = z.object({
  status: z.enum(["pending", "succeeded", "failed", "canceled"]).optional(),
  type: z.enum(["charge", "refund", "adjustment"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const transactionRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /transactions
   * Get user's transactions with filtering
   */
  app.get("/", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const query = transactionFilterSchema.parse(request.query);

    const where: any = { userId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.transactionType = query.type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      app.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
      }),
      app.prisma.transaction.count({ where }),
    ]);

    return reply.code(200).send({
      success: true,
      data: transactions.map((t) => ({
        id: t.id,
        date: t.processedAt || t.createdAt,
        amount: t.amountCents / 100,
        currency: t.currency,
        status: t.status,
        type: t.transactionType,
        provider: t.provider,
        externalId: t.externalTransactionId,
        description: getTransactionDescription(t.metadataJson as any),
        metadata: t.metadataJson,
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    });
  });

  /**
   * GET /transactions/:id
   * Get detailed transaction information
   */
  app.get("/:id", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const { id } = request.params as { id: string };

    const transaction = await app.prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!transaction) {
      throw app.httpErrors.notFound("Transaction not found");
    }

    return reply.code(200).send({
      success: true,
      data: {
        id: transaction.id,
        date: transaction.processedAt || transaction.createdAt,
        amount: transaction.amountCents / 100,
        currency: transaction.currency,
        status: transaction.status,
        type: transaction.transactionType,
        provider: transaction.provider,
        externalId: transaction.externalTransactionId,
        description: getTransactionDescription(transaction.metadataJson as any),
        errorMessage: transaction.errorMessage,
        processedAt: transaction.processedAt,
        createdAt: transaction.createdAt,
        metadata: transaction.metadataJson,
        subscription: transaction.subscription
          ? {
              id: transaction.subscription.id,
              planName: transaction.subscription.plan.name,
              status: transaction.subscription.status,
            }
          : null,
      },
    });
  });

  /**
   * GET /transactions/summary
   * Get transaction summary statistics
   */
  app.get("/summary", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Total spent (all time)
    const totalSpentResult = await app.prisma.transaction.aggregate({
      where: {
        userId,
        status: "succeeded",
        transactionType: "charge",
      },
      _sum: {
        amountCents: true,
      },
    });

    // Spent last 30 days
    const last30DaysResult = await app.prisma.transaction.aggregate({
      where: {
        userId,
        status: "succeeded",
        transactionType: "charge",
        processedAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amountCents: true,
      },
    });

    // Transaction counts by status
    const statusCounts = await app.prisma.transaction.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    });

    // Recent transactions
    const recentTransactions = await app.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return reply.code(200).send({
      success: true,
      data: {
        totalSpent: (totalSpentResult._sum.amountCents || 0) / 100,
        spentLast30Days: (last30DaysResult._sum.amountCents || 0) / 100,
        currency: "ZMW",
        statusCounts: statusCounts.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          date: t.processedAt || t.createdAt,
          amount: t.amountCents / 100,
          status: t.status,
          description: getTransactionDescription(t.metadataJson as any),
        })),
      },
    });
  });

  /**
   * GET /transactions/export
   * Export transactions as CSV
   */
  app.get("/export", async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const query = transactionFilterSchema.parse(request.query);

    const where: any = { userId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.type) {
      where.transactionType = query.type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const transactions = await app.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Generate CSV
    const csvHeader = "Date,Amount,Currency,Status,Type,Description,Reference\n";
    const csvRows = transactions
      .map((t) => {
        const date = (t.processedAt || t.createdAt).toISOString();
        const amount = (t.amountCents / 100).toFixed(2);
        const description = getTransactionDescription(t.metadataJson as any);
        const reference = (t.metadataJson as any)?.reference || "";
        return `${date},${amount},${t.currency},${t.status},${t.transactionType},"${description}",${reference}`;
      })
      .join("\n");

    const csv = csvHeader + csvRows;

    return reply
      .code(200)
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", 'attachment; filename="transactions.csv"')
      .send(csv);
  });
};

/**
 * Helper function to generate transaction description
 */
function getTransactionDescription(metadata: any): string {
  if (!metadata) return "Payment";

  if (metadata.planType === "monthly_subscription") {
    return "Monthly Subscription";
  }

  if (metadata.planType === "pay_as_you_go") {
    return "Pay As You Go - 2 Credits";
  }

  return "Payment";
}

export default transactionRoutes;
