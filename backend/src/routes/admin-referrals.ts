/**
 * Admin Referral Routes
 * Ops dashboard endpoints for tracking the referral / affiliate programme
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const listReferralsSchema = paginationSchema.extend({
  referrerUserId: z.string().uuid().optional(),
  referredUserId: z.string().uuid().optional(),
  status: z.enum(["pending", "earned", "paid_out"]).optional(),
  search: z.string().optional(),
});

const updateReferralSchema = z.object({
  status: z.enum(["pending", "earned", "paid_out"]).optional(),
});

const adminReferralRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma as any;

  /* ─────── GET /admin/referrals/stats ─────── */
  app.get("/referrals/stats", async (request) => {
    await requireAdminUser(app, request);

    const [
      totalReferrals,
      pendingCount,
      earnedCount,
      paidOutCount,
      totalCommissionResult,
      pendingCommissionResult,
      paidOutCommissionResult,
      totalReferredUsers,
      topReferrersRaw,
    ] = await Promise.all([
      prisma.referral.count(),
      prisma.referral.count({ where: { status: "pending" } }),
      prisma.referral.count({ where: { status: "earned" } }),
      prisma.referral.count({ where: { status: "paid_out" } }),
      prisma.referral.aggregate({
        _sum: { commissionCents: true },
        where: { status: { in: ["earned", "paid_out"] } },
      }),
      prisma.referral.aggregate({
        _sum: { commissionCents: true },
        where: { status: "pending" },
      }),
      prisma.referral.aggregate({
        _sum: { commissionCents: true },
        where: { status: "paid_out" },
      }),
      prisma.user.count({ where: { referredByUserId: { not: null } } }),
      prisma.referral.groupBy({
        by: ["referrerUserId"],
        _sum: { commissionCents: true },
        _count: true,
        orderBy: { _sum: { commissionCents: "desc" } },
        take: 10,
      }),
    ]);

    // Enrich top referrers with user info
    const referrerIds = topReferrersRaw.map((r: any) => r.referrerUserId);
    const referrerUsers = referrerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: referrerIds } },
          select: { id: true, email: true, fullName: true, referralCode: true },
        })
      : [];
    const userMap = new Map(referrerUsers.map((u: any) => [u.id, u]));

    const topReferrers = topReferrersRaw.map((r: any) => {
      const u = userMap.get(r.referrerUserId) || {};
      return {
        userId: r.referrerUserId,
        email: (u as any).email ?? "—",
        fullName: (u as any).fullName ?? null,
        referralCode: (u as any).referralCode ?? null,
        referralCount: r._count,
        totalEarnedCents: r._sum.commissionCents ?? 0,
      };
    });

    return {
      totalReferrals,
      pendingCount,
      earnedCount,
      paidOutCount,
      totalCommissionCents: totalCommissionResult._sum.commissionCents ?? 0,
      pendingCommissionCents: pendingCommissionResult._sum.commissionCents ?? 0,
      paidOutCommissionCents: paidOutCommissionResult._sum.commissionCents ?? 0,
      totalReferredUsers,
      topReferrers,
    };
  });

  /* ─────── GET /admin/referrals ─────── */
  app.get("/referrals", async (request) => {
    await requireAdminUser(app, request);
    const query = listReferralsSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.referrerUserId) where.referrerUserId = query.referrerUserId;
    if (query.referredUserId) where.referredUserId = query.referredUserId;
    if (query.search) {
      where.OR = [
        { referrer: { email: { contains: query.search, mode: "insensitive" } } },
        { referrer: { fullName: { contains: query.search, mode: "insensitive" } } },
        { referred: { email: { contains: query.search, mode: "insensitive" } } },
        { referred: { fullName: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [total, items] = await prisma.$transaction([
      prisma.referral.count({ where }),
      prisma.referral.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          referrer: { select: { id: true, email: true, fullName: true, referralCode: true } },
          referred: { select: { id: true, email: true, fullName: true } },
          transaction: {
            select: { id: true, amountCents: true, currency: true, status: true, createdAt: true },
          },
        },
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  /* ─────── PATCH /admin/referrals/:id ─────── */
  app.patch("/referrals/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateReferralSchema.parse(request.body);

    const data: any = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === "paid_out") {
        data.paidOutAt = new Date();
      }
    }

    const updated = await prisma.referral.update({
      where: { id },
      data,
      include: {
        referrer: { select: { id: true, email: true, fullName: true } },
        referred: { select: { id: true, email: true, fullName: true } },
      },
    });

    return updated;
  });
};

export default adminReferralRoutes;
