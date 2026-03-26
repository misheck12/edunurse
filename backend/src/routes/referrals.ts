/**
 * Referral / Affiliate Routes
 * Manage referral codes, track referrals, and show affiliate earnings
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import crypto from "crypto";

/** Generate a short human-friendly referral code: e.g. EDU-A3K9X2 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/I/1 confusion
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `EDU-${code}`;
}

/** Commission rate: 10 % of the transaction amount */
const COMMISSION_RATE = 0.1;

const applyCodeSchema = z.object({
  referralCode: z
    .string()
    .min(3, "Referral code is required")
    .transform((c) => c.trim().toUpperCase()),
});

const referralRoutes: FastifyPluginAsync = async (app) => {
  /* ───────────────────────── GET /referrals/my-code ───────────────────── */
  app.get("/my-code", async (request, reply) => {
    const userId = requireUserId(request);

    // Return existing code or generate a new one
    let user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, fullName: true },
    });

    if (!user) throw app.httpErrors.notFound("User not found");

    if (!user.referralCode) {
      // Generate and persist a unique code (retry once on collision)
      let code = generateReferralCode();
      try {
        await app.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
        });
      } catch {
        code = generateReferralCode();
        await app.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
        });
      }
      user = { ...user, referralCode: code };
    }

    return reply.code(200).send({
      success: true,
      data: {
        referralCode: user.referralCode,
        shareUrl: `${process.env.FRONTEND_URL ?? "https://edunurse.app"}/signup?ref=${user.referralCode}`,
      },
    });
  });

  /* ───────────────────────── GET /referrals/earnings ──────────────────── */
  app.get("/earnings", async (request, reply) => {
    const userId = requireUserId(request);

    // All referrals where this user is the referrer (earner)
    const referrals = await app.prisma.referral.findMany({
      where: { referrerUserId: userId },
      include: {
        referred: {
          select: { fullName: true, email: true, createdAt: true },
        },
        transaction: {
          select: { amountCents: true, currency: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Count of people who signed up via this user's code (even if no payment yet)
    const referredUsersCount = await app.prisma.user.count({
      where: { referredByUserId: userId },
    });

    const totalEarnedCents = referrals
      .filter((r) => r.status === "earned" || r.status === "paid_out")
      .reduce((sum, r) => sum + r.commissionCents, 0);

    const pendingCents = referrals
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + r.commissionCents, 0);

    const paidOutCents = referrals
      .filter((r) => r.status === "paid_out")
      .reduce((sum, r) => sum + r.commissionCents, 0);

    return reply.code(200).send({
      success: true,
      data: {
        totalEarnedCents,
        pendingCents,
        paidOutCents,
        currency: "ZMW",
        referredUsersCount,
        commissionRate: COMMISSION_RATE,
        referrals: referrals.map((r) => ({
          id: r.id,
          referredName: r.referred.fullName || "Anonymous",
          referredEmail: r.referred.email,
          commissionCents: r.commissionCents,
          currency: r.currency,
          status: r.status,
          transactionAmount: r.transaction
            ? r.transaction.amountCents / 100
            : null,
          createdAt: r.createdAt,
        })),
      },
    });
  });

  /* ───────────────────── POST /referrals/apply-code ──────────────────── */
  app.post("/apply-code", async (request, reply) => {
    const userId = requireUserId(request);
    const { referralCode } = applyCodeSchema.parse(request.body);

    // Find the user who owns this code
    const referrer = await app.prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });

    if (!referrer) {
      throw app.httpErrors.notFound("Invalid referral code");
    }

    if (referrer.id === userId) {
      throw app.httpErrors.badRequest("You cannot refer yourself");
    }

    // Check if this user already has a referrer
    const self = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { referredByUserId: true },
    });

    if (self?.referredByUserId) {
      throw app.httpErrors.conflict("You have already applied a referral code");
    }

    // Link the referral
    await app.prisma.user.update({
      where: { id: userId },
      data: { referredByUserId: referrer.id },
    });

    return reply.code(200).send({
      success: true,
      message:
        "Referral code applied! Your referrer will earn a commission on your next payment.",
    });
  });
};

export default referralRoutes;
