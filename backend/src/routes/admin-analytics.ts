/**
 * Admin Analytics Routes
 * Provides business metrics and analytics for administrators
 */

import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";

const adminAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  // Middleware to check admin role
  app.addHook("onRequest", async (request) => {
    const userRole = request.user?.role;
    if (userRole !== "admin") {
      throw app.httpErrors.forbidden("Admin access required");
    }
  });

  /**
   * GET /admin/analytics/overview
   * Get high-level business metrics
   */
  app.get("/overview", async (request, reply) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total users
    const totalUsers = await app.prisma.user.count();
    const newUsersLast30Days = await app.prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    const newUsersLast7Days = await app.prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    // Active subscriptions
    const activeSubscriptions = await app.prisma.subscription.count({
      where: {
        status: "active",
        currentPeriodEnd: { gte: now },
      },
    });

    // Revenue (last 30 days)
    const revenueResult = await app.prisma.transaction.aggregate({
      where: {
        status: "succeeded",
        processedAt: { gte: thirtyDaysAgo },
      },
      _sum: {
        amountCents: true,
      },
    });
    const revenueLast30Days = (revenueResult._sum.amountCents || 0) / 100;

    // Generations (last 30 days)
    const generationsLast30Days = await app.prisma.generationRun.count({
      where: {
        status: "succeeded",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Exports (last 30 days)
    const exportsLast30Days = await app.prisma.exportJob.count({
      where: {
        status: "succeeded",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Conversion rate (users who paid after using welcome bonus)
    const usersWithGenerations = await app.prisma.user.count({
      where: {
        generationRuns: {
          some: {
            status: "succeeded",
          },
        },
      },
    });

    const usersWithPayments = await app.prisma.user.count({
      where: {
        transactions: {
          some: {
            status: "succeeded",
          },
        },
      },
    });

    const conversionRate =
      usersWithGenerations > 0
        ? ((usersWithPayments / usersWithGenerations) * 100).toFixed(2)
        : "0.00";

    // Failed payments (last 30 days)
    const failedPayments = await app.prisma.transaction.count({
      where: {
        status: "failed",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return reply.code(200).send({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newLast30Days: newUsersLast30Days,
          newLast7Days: newUsersLast7Days,
        },
        subscriptions: {
          active: activeSubscriptions,
        },
        revenue: {
          last30Days: revenueLast30Days,
          currency: "ZMW",
        },
        usage: {
          generationsLast30Days,
          exportsLast30Days,
        },
        conversion: {
          rate: `${conversionRate}%`,
          usersWithGenerations,
          usersWithPayments,
        },
        payments: {
          failedLast30Days: failedPayments,
        },
      },
    });
  });

  /**
   * GET /admin/analytics/users
   * Get detailed user analytics
   */
  app.get("/users", async (request, reply) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Users by plan type
    const usersByPlan = await app.prisma.$queryRaw<
      Array<{ plan_type: string; count: bigint }>
    >`
      SELECT 
        CASE 
          WHEN s.id IS NOT NULL THEN 'monthly_subscription'
          WHEN t.id IS NOT NULL THEN 'pay_as_you_go'
          ELSE 'free'
        END as plan_type,
        COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id 
        AND s.status = 'active' 
        AND s.current_period_end >= NOW()
      LEFT JOIN transactions t ON u.id = t.user_id 
        AND t.status = 'succeeded'
        AND t.metadata_json->>'planType' = 'pay_as_you_go'
        AND t.processed_at >= NOW() - INTERVAL '30 days'
      GROUP BY plan_type
    `;

    // Active users (generated in last 30 days)
    const activeUsers = await app.prisma.user.count({
      where: {
        generationRuns: {
          some: {
            createdAt: { gte: thirtyDaysAgo },
          },
        },
      },
    });

    // Churned users (had subscription, now cancelled)
    const churnedUsers = await app.prisma.subscription.count({
      where: {
        status: "canceled",
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    return reply.code(200).send({
      success: true,
      data: {
        byPlanType: usersByPlan.map((row) => ({
          planType: row.plan_type,
          count: Number(row.count),
        })),
        activeUsers,
        churnedUsers,
      },
    });
  });

  /**
   * GET /admin/analytics/revenue
   * Get revenue analytics
   */
  app.get("/revenue", async (request, reply) => {
    // Revenue by month (last 12 months)
    const revenueByMonth = await app.prisma.$queryRaw<
      Array<{ month: string; revenue: number; transaction_count: bigint }>
    >`
      SELECT 
        TO_CHAR(processed_at, 'YYYY-MM') as month,
        SUM(amount_cents) / 100.0 as revenue,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE status = 'succeeded'
        AND processed_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(processed_at, 'YYYY-MM')
      ORDER BY month DESC
    `;

    // Revenue by plan type
    const revenueByPlan = await app.prisma.$queryRaw<
      Array<{ plan_type: string; revenue: number; count: bigint }>
    >`
      SELECT 
        metadata_json->>'planType' as plan_type,
        SUM(amount_cents) / 100.0 as revenue,
        COUNT(*) as count
      FROM transactions
      WHERE status = 'succeeded'
        AND processed_at >= NOW() - INTERVAL '30 days'
      GROUP BY metadata_json->>'planType'
    `;

    // Average revenue per user
    const totalRevenue = await app.prisma.transaction.aggregate({
      where: { status: "succeeded" },
      _sum: { amountCents: true },
    });

    const totalUsers = await app.prisma.user.count();
    const arpu = totalUsers > 0 ? (totalRevenue._sum.amountCents || 0) / 100 / totalUsers : 0;

    return reply.code(200).send({
      success: true,
      data: {
        byMonth: revenueByMonth.map((row) => ({
          month: row.month,
          revenue: Number(row.revenue),
          transactionCount: Number(row.transaction_count),
        })),
        byPlanType: revenueByPlan.map((row) => ({
          planType: row.plan_type,
          revenue: Number(row.revenue),
          count: Number(row.count),
        })),
        arpu: arpu.toFixed(2),
        currency: "ZMW",
      },
    });
  });

  /**
   * GET /admin/analytics/usage
   * Get usage analytics
   */
  app.get("/usage", async (request, reply) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Generations by day (last 30 days)
    const generationsByDay = await app.prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM generation_runs
      WHERE status = 'succeeded'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Exports by format
    const exportsByFormat = await app.prisma.exportJob.groupBy({
      by: ["format"],
      where: {
        status: "succeeded",
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    // Average generations per user
    const totalGenerations = await app.prisma.generationRun.count({
      where: { status: "succeeded" },
    });
    const usersWithGenerations = await app.prisma.user.count({
      where: {
        generationRuns: {
          some: { status: "succeeded" },
        },
      },
    });
    const avgGenerationsPerUser =
      usersWithGenerations > 0 ? (totalGenerations / usersWithGenerations).toFixed(2) : "0.00";

    // Popular topics
    const popularTopics = await app.prisma.$queryRaw<
      Array<{ topic: string; count: bigint }>
    >`
      SELECT 
        input_json->>'topic' as topic,
        COUNT(*) as count
      FROM generation_runs
      WHERE status = 'succeeded'
        AND created_at >= NOW() - INTERVAL '30 days'
        AND input_json->>'topic' IS NOT NULL
      GROUP BY input_json->>'topic'
      ORDER BY count DESC
      LIMIT 10
    `;

    return reply.code(200).send({
      success: true,
      data: {
        generationsByDay: generationsByDay.map((row) => ({
          date: row.date,
          count: Number(row.count),
        })),
        exportsByFormat: exportsByFormat.map((row) => ({
          format: row.format,
          count: row._count,
        })),
        avgGenerationsPerUser,
        popularTopics: popularTopics.map((row) => ({
          topic: row.topic,
          count: Number(row.count),
        })),
      },
    });
  });

  /**
   * GET /admin/analytics/cohorts
   * Get cohort analysis
   */
  app.get("/cohorts", async (request, reply) => {
    // User cohorts by signup month
    const cohorts = await app.prisma.$queryRaw<
      Array<{
        cohort_month: string;
        total_users: bigint;
        converted_users: bigint;
        conversion_rate: number;
      }>
    >`
      WITH user_cohorts AS (
        SELECT 
          u.id,
          TO_CHAR(u.created_at, 'YYYY-MM') as cohort_month,
          CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END as converted
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id 
          AND t.status = 'succeeded'
        WHERE u.created_at >= NOW() - INTERVAL '12 months'
      )
      SELECT 
        cohort_month,
        COUNT(*) as total_users,
        SUM(converted) as converted_users,
        ROUND(SUM(converted)::numeric / COUNT(*) * 100, 2) as conversion_rate
      FROM user_cohorts
      GROUP BY cohort_month
      ORDER BY cohort_month DESC
    `;

    return reply.code(200).send({
      success: true,
      data: cohorts.map((row) => ({
        cohortMonth: row.cohort_month,
        totalUsers: Number(row.total_users),
        convertedUsers: Number(row.converted_users),
        conversionRate: `${row.conversion_rate}%`,
      })),
    });
  });
};

export default adminAnalyticsRoutes;
