/**
 * Subscription Helper
 * Shared subscription lookup logic to avoid duplication across services
 */

import { PrismaClient, Plan, Subscription } from "@prisma/client";

export type SubscriptionWithPlan = Subscription & { plan: Plan | null };

/**
 * Find user's active subscription with plan details
 * Used by both usage-limits.ts and feature-access.ts
 */
export async function getActiveSubscription(
  prisma: PrismaClient,
  userId: string
): Promise<SubscriptionWithPlan | null> {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: "active",
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
    },
    include: {
      plan: true,
    },
    orderBy: {
      currentPeriodEnd: "desc",
    },
  });
}

/**
 * Get current month start date for period-based queries
 */
export function getCurrentMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Plan tier type
 */
export type PlanTier = "free" | "pro" | "premium";

/**
 * Plan tier hierarchy for comparisons
 */
export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

/**
 * Get plan tier from plan code string
 */
export function getPlanTier(planCode: string): PlanTier {
  const code = (planCode || "").toLowerCase();
  if (code.includes("premium") || code.includes("unlimited")) {
    return "premium";
  }
  if (code.includes("pro") || code.includes("monthly")) {
    return "pro";
  }
  return "free";
}

/**
 * Safe record helper for JSON parsing
 */
export function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Read a numeric limit from plan limitsJson
 * Returns "unlimited" for -1 or missing values
 */
export function readPlanLimit(
  limitsJson: unknown,
  keys: string[]
): number | "unlimited" {
  if (!limitsJson || typeof limitsJson !== "object" || Array.isArray(limitsJson)) {
    return "unlimited";
  }

  const record = limitsJson as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value === -1 || value === "-1") {
      return "unlimited";
    }
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }

  return "unlimited";
}
