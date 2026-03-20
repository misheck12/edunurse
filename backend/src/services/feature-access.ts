/**
 * Feature Access Service
 * Checks if a user has access to specific features based on their subscription
 */

import { PrismaClient } from "@prisma/client";
import {
  getActiveSubscription,
  getPlanTier,
  PLAN_HIERARCHY,
  PlanTier,
} from "./subscription-helper.js";

// Feature keys matching the frontend
export type FeatureKey =
  | "lesson_generator"
  | "curriculum_ai"
  | "assignments"
  | "templates"
  | "drug_calculator"
  | "clinical_cases"
  | "procedures"
  | "flashcards"
  | "medical_terms"
  | "resources"
  | "clinical_logbook"
  | "nmc_exam_prep"
  | "osce_practice"
  | "career"
  | "export_pdf"
  | "export_docx"
  | "export_pptx"
  | "unlimited_generations"
  | "unlimited_exports";

// Re-export PlanTier from helper
export type { PlanTier } from "./subscription-helper.js";

// Default feature configuration (which features are available at each tier)
const DEFAULT_FEATURE_ACCESS: Record<FeatureKey, PlanTier> = {
  // Free tier features
  lesson_generator: "free",
  drug_calculator: "free",
  flashcards: "free",
  resources: "free",
  export_pdf: "free",

  // Pro tier features
  curriculum_ai: "pro",
  assignments: "pro",
  templates: "pro",
  clinical_cases: "pro",
  procedures: "pro",
  medical_terms: "pro",
  clinical_logbook: "pro",
  nmc_exam_prep: "pro",
  osce_practice: "pro",
  career: "pro",
  export_docx: "pro",
  export_pptx: "pro",

  // Premium tier features
  unlimited_generations: "premium",
  unlimited_exports: "premium",
};

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason: string;
  requiredPlan: PlanTier;
  currentPlan: PlanTier;
}

/**
 * Check if a user has access to a specific feature
 */
export async function checkFeatureAccess(
  prisma: PrismaClient,
  userId: string,
  feature: FeatureKey
): Promise<FeatureAccessResult> {
  // Get user with role check
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return {
      hasAccess: false,
      reason: "User not found or inactive",
      requiredPlan: DEFAULT_FEATURE_ACCESS[feature],
      currentPlan: "free",
    };
  }

  // Admins have access to everything
  if (user.role === "admin") {
    return {
      hasAccess: true,
      reason: "Admin access",
      requiredPlan: DEFAULT_FEATURE_ACCESS[feature],
      currentPlan: "premium",
    };
  }

  // Get active subscription
  const subscription = await prisma.subscription.findFirst({
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

  // No subscription - only free features
  if (!subscription) {
    const requiredPlan = DEFAULT_FEATURE_ACCESS[feature];
    const hasAccess = requiredPlan === "free";

    return {
      hasAccess,
      reason: hasAccess
        ? "Free feature available"
        : "Subscription required for this feature",
      requiredPlan,
      currentPlan: "free",
    };
  }

  const planCode = subscription.plan?.code || "free";
  const currentTier = getPlanTier(planCode);
  const limitsJson = subscription.plan?.limitsJson as Record<string, unknown> | null;

  // Check explicit feature list in plan limits
  if (limitsJson?.features && Array.isArray(limitsJson.features)) {
    const planFeatures = limitsJson.features as string[];
    if (planFeatures.includes(feature)) {
      return {
        hasAccess: true,
        reason: "Feature included in plan",
        requiredPlan: DEFAULT_FEATURE_ACCESS[feature],
        currentPlan: currentTier,
      };
    }
  }

  // Fall back to tier-based access
  const requiredPlan = DEFAULT_FEATURE_ACCESS[feature];
  const hasAccess = PLAN_HIERARCHY[currentTier] >= PLAN_HIERARCHY[requiredPlan];

  return {
    hasAccess,
    reason: hasAccess
      ? "Feature available at current tier"
      : `Upgrade to ${requiredPlan} plan required`,
    requiredPlan,
    currentPlan: currentTier,
  };
}

/**
 * Get all features available to a user
 */
export async function getUserFeatures(
  prisma: PrismaClient,
  userId: string
): Promise<FeatureKey[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return [];
  }

  // Admins have all features
  if (user.role === "admin") {
    return Object.keys(DEFAULT_FEATURE_ACCESS) as FeatureKey[];
  }

  // Get active subscription
  const subscription = await prisma.subscription.findFirst({
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

  if (!subscription) {
    // Return only free tier features
    return (Object.entries(DEFAULT_FEATURE_ACCESS) as [FeatureKey, PlanTier][])
      .filter(([_, tier]) => tier === "free")
      .map(([feature]) => feature);
  }

  const planCode = subscription.plan?.code || "free";
  const currentTier = getPlanTier(planCode);
  const limitsJson = subscription.plan?.limitsJson as Record<string, unknown> | null;

  // Check explicit feature list
  if (limitsJson?.features && Array.isArray(limitsJson.features)) {
    return limitsJson.features as FeatureKey[];
  }

  // Return features based on tier
  return (Object.entries(DEFAULT_FEATURE_ACCESS) as [FeatureKey, PlanTier][])
    .filter(([_, tier]) => PLAN_HIERARCHY[currentTier] >= PLAN_HIERARCHY[tier])
    .map(([feature]) => feature);
}

/**
 * Middleware factory to require a specific feature
 */
export function requireFeature(feature: FeatureKey) {
  return async (prisma: PrismaClient, userId: string): Promise<void> => {
    const result = await checkFeatureAccess(prisma, userId, feature);
    if (!result.hasAccess) {
      const error = new Error(result.reason) as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }
  };
}
