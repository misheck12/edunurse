/**
 * Usage Limits Service
 * Enforces generation and export limits based on user's subscription/payment
 */

import { PrismaClient } from "@prisma/client";

export interface UsageLimits {
  canGenerate: boolean;
  canExport: boolean;
  generationsRemaining: number | "unlimited";
  exportsRemaining: number | "unlimited";
  planType: "monthly_subscription" | "pay_as_you_go" | "none";
  message?: string;
}

export interface UsageCheckResult {
  allowed: boolean;
  message: string;
  limits: UsageLimits;
}

export interface ExportLimitContext {
  format: "pdf" | "docx" | "pptx";
  documentId?: string;
  documentVersionId?: string;
}

const WELCOME_BONUS_GENERATIONS = 2;
const WELCOME_BONUS_EXPORTS = 1;

function toFiniteNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function readPlanLimit(
  limitsJson: unknown,
  keys: string[],
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
    const parsed = toFiniteNonNegativeNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return "unlimited";
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function resolveThreeFormatBundleAllowance(
  prisma: PrismaClient,
  userId: string,
  context: ExportLimitContext,
  limits: UsageLimits,
): Promise<UsageCheckResult | null> {
  if (!context.documentVersionId) {
    return null;
  }

  let bundleEligible = false;
  let periodStart: Date | null = null;

  const activeSubscription = await prisma.subscription.findFirst({
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

  if (activeSubscription) {
    const exportLimit = readPlanLimit(activeSubscription.plan?.limitsJson, [
      "monthlyExports",
      "exports_per_month",
      "monthly_exports",
      "exports",
    ]);
    const isFreePlan =
      (activeSubscription.plan?.code ?? "").toLowerCase() === "free";
    bundleEligible = isFreePlan || exportLimit === 1;
    periodStart = activeSubscription.currentPeriodStart ?? getCurrentMonthStart();
  } else {
    // Welcome-bonus/no-subscription users can still export all 3 formats
    // for the first exported document version.
    const paygPurchaseCount = await prisma.transaction.count({
      where: {
        userId,
        status: "succeeded",
        metadataJson: {
          path: ["planType"],
          equals: "pay_as_you_go",
        },
      },
    });
    bundleEligible = paygPurchaseCount === 0;
  }

  if (!bundleEligible) {
    return null;
  }

  const timeFilter = periodStart ? { createdAt: { gte: periodStart } } : {};

  const sameFormatAlreadyExported = await prisma.exportJob.findFirst({
    where: {
      userId,
      documentVersionId: context.documentVersionId,
      format: context.format,
      status: "succeeded",
      ...timeFilter,
    },
    select: { id: true },
  });

  if (sameFormatAlreadyExported) {
    return {
      allowed: true,
      message: "Export already exists for this format.",
      limits: {
        ...limits,
        canExport: true,
      },
    };
  }

  const firstSucceededExport = await prisma.exportJob.findFirst({
    where: {
      userId,
      status: "succeeded",
      ...timeFilter,
    },
    orderBy: { createdAt: "asc" },
    select: { documentVersionId: true },
  });

  if (
    !firstSucceededExport ||
    firstSucceededExport.documentVersionId !== context.documentVersionId
  ) {
    return null;
  }

  const usedFormats = await prisma.exportJob.findMany({
    where: {
      userId,
      documentVersionId: context.documentVersionId,
      status: "succeeded",
      ...timeFilter,
    },
    distinct: ["format"],
    select: { format: true },
  });

  const usedFormatSet = new Set(usedFormats.map((row) => row.format));
  if (!usedFormatSet.has(context.format) && usedFormatSet.size < 3) {
    const remainingAfterGrant = Math.max(0, 3 - (usedFormatSet.size + 1));
    return {
      allowed: true,
      message: "Format bundle: additional export format allowed.",
      limits: {
        ...limits,
        canExport: true,
        exportsRemaining: remainingAfterGrant,
      },
    };
  }

  return null;
}

/**
 * Check if user can perform a generation
 */
export async function checkGenerationLimit(
  prisma: PrismaClient,
  userId: string
): Promise<UsageCheckResult> {
  const limits = await getUserLimits(prisma, userId);

  if (!limits.canGenerate) {
    return {
      allowed: false,
      message:
        limits.planType === "none"
          ? "No active subscription. Please subscribe to generate lesson plans."
          : "Generation limit reached. Please upgrade your plan or purchase more credits.",
      limits,
    };
  }

  return {
    allowed: true,
    message: "Generation allowed",
    limits,
  };
}

/**
 * Check if user can perform an export
 */
export async function checkExportLimit(
  prisma: PrismaClient,
  userId: string,
  context?: ExportLimitContext,
): Promise<UsageCheckResult> {
  const limits = await getUserLimits(prisma, userId);

  if (!limits.canExport) {
    if (context) {
      const bundleAllowance = await resolveThreeFormatBundleAllowance(
        prisma,
        userId,
        context,
        limits,
      );
      if (bundleAllowance) {
        return bundleAllowance;
      }
    }

    // Special message for welcome bonus users
    if (limits.message?.includes("Welcome bonus")) {
      return {
        allowed: false,
        message:
          "Welcome bonus export used. Subscribe or purchase credits for more exports.",
        limits,
      };
    }
    
    return {
      allowed: false,
      message:
        limits.planType === "none"
          ? "No active subscription. Please subscribe to export lesson plans."
          : "Export limit reached. Please upgrade your plan or purchase more credits.",
      limits,
    };
  }

  return {
    allowed: true,
    message: "Export allowed",
    limits,
  };
}

/**
 * Get user's current usage limits
 */
export async function getUserLimits(
  prisma: PrismaClient,
  userId: string
): Promise<UsageLimits> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return {
      canGenerate: false,
      canExport: false,
      generationsRemaining: 0,
      exportsRemaining: 0,
      planType: "none",
      message: "User not found or inactive.",
    };
  }

  // Superadmin bypass: no billing gates.
  // Keep planType as monthly_subscription to stay compatible with existing UI.
  if (user.role === "admin") {
    return {
      canGenerate: true,
      canExport: true,
      generationsRemaining: "unlimited",
      exportsRemaining: "unlimited",
      planType: "monthly_subscription",
      message: "Superadmin account: unlimited access.",
    };
  }

  // Check for active subscription.
  // Accept null currentPeriodEnd as active for development/free plans that do not set cycle windows.
  const activeSubscription = await prisma.subscription.findFirst({
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

  if (activeSubscription) {
    const periodStart =
      activeSubscription.currentPeriodStart ?? getCurrentMonthStart();
    const generationCount = await prisma.generationRun.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: periodStart,
        },
      },
    });
    const exportCount = await prisma.exportJob.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: periodStart,
        },
      },
    });

    const generationLimit = readPlanLimit(activeSubscription.plan?.limitsJson, [
      "monthlyGenerations",
      "generations_per_month",
      "monthly_generations",
      "generations",
    ]);
    const exportLimit = readPlanLimit(activeSubscription.plan?.limitsJson, [
      "monthlyExports",
      "exports_per_month",
      "monthly_exports",
      "exports",
    ]);

    const canGenerate =
      generationLimit === "unlimited" ? true : generationCount < generationLimit;
    const canExport =
      exportLimit === "unlimited" ? true : exportCount < exportLimit;

    const generationsRemaining =
      generationLimit === "unlimited"
        ? "unlimited"
        : Math.max(0, generationLimit - generationCount);
    const exportsRemaining =
      exportLimit === "unlimited"
        ? "unlimited"
        : Math.max(0, exportLimit - exportCount);

    return {
      canGenerate,
      canExport,
      generationsRemaining,
      exportsRemaining,
      planType: "monthly_subscription",
    };
  }

  // Check for pay-as-you-go credits (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const paygTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: "succeeded",
      metadataJson: {
        path: ["planType"],
        equals: "pay_as_you_go",
      },
      processedAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  // Count total generations (all time)
  const totalGenerationCount = await prisma.generationRun.count({
    where: {
      userId,
      status: "succeeded",
    },
  });
  const totalExportCount = await prisma.exportJob.count({
    where: {
      userId,
      status: "succeeded",
    },
  });

  // NEW USER BONUS: free starter credits before first payment.
  if (
    paygTransactions.length === 0 &&
    totalGenerationCount === 0 &&
    totalExportCount === 0
  ) {
    return {
      canGenerate: true,
      canExport: true,
      generationsRemaining: WELCOME_BONUS_GENERATIONS,
      exportsRemaining: WELCOME_BONUS_EXPORTS,
      planType: "pay_as_you_go",
      message: `Welcome bonus: ${WELCOME_BONUS_GENERATIONS} free lesson plan generations and ${WELCOME_BONUS_EXPORTS} free export`,
    };
  }

  // Check if user is still using their welcome bonus (has not paid yet).
  if (paygTransactions.length === 0) {
    const generationsRemaining = Math.max(
      0,
      WELCOME_BONUS_GENERATIONS - totalGenerationCount,
    );
    const exportsRemaining = Math.max(
      0,
      WELCOME_BONUS_EXPORTS - totalExportCount,
    );
    const hasWelcomeEntitlement = generationsRemaining > 0 || exportsRemaining > 0;

    if (hasWelcomeEntitlement) {
      const parts: string[] = [];
      if (generationsRemaining > 0) {
        parts.push(
          `${generationsRemaining} free generation${generationsRemaining > 1 ? "s" : ""} remaining`,
        );
      }
      if (exportsRemaining > 0) {
        parts.push(
          `${exportsRemaining} free export${exportsRemaining > 1 ? "s" : ""} remaining`,
        );
      }

      return {
        canGenerate: generationsRemaining > 0,
        canExport: exportsRemaining > 0,
        generationsRemaining,
        exportsRemaining,
        planType: "pay_as_you_go",
        message: `Welcome bonus: ${parts.join(" | ")}`,
      };
    }
  }

  // No PAYG purchases and welcome bonus exhausted
  if (paygTransactions.length === 0) {
    return {
      canExport: false,
      canGenerate: false,
      generationsRemaining: 0,
      exportsRemaining: 0,
      planType: "none",
      message: "Free trial used. Please subscribe or purchase credits to continue.",
    };
  }

  // Count usage for PAYG (2 generations + 2 exports per purchase)
  const totalCredits = paygTransactions.length * 2; // 2 per purchase

  // Count generations in last 30 days
  const generationCount = await prisma.generationRun.count({
    where: {
      userId,
      status: "succeeded",
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  // Count exports in last 30 days
  const exportCount = await prisma.exportJob.count({
    where: {
      userId,
      status: "succeeded",
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  const generationsRemaining = Math.max(0, totalCredits - generationCount);
  const exportsRemaining = Math.max(0, totalCredits - exportCount);

  return {
    canGenerate: generationsRemaining > 0,
    canExport: exportsRemaining > 0,
    generationsRemaining,
    exportsRemaining,
    planType: "pay_as_you_go",
  };
}

/**
 * Record a generation usage
 */
export async function recordGenerationUsage(
  prisma: PrismaClient,
  userId: string,
  generationRunId: string
): Promise<void> {
  // Usage is already tracked via GenerationRun table
  // This function is for future extensibility (e.g., separate usage tracking table)
  const limits = await getUserLimits(prisma, userId);

  if (limits.planType === "pay_as_you_go" && limits.generationsRemaining === 0) {
    throw new Error("Generation limit exceeded");
  }
}

/**
 * Record an export usage
 */
export async function recordExportUsage(
  prisma: PrismaClient,
  userId: string,
  exportJobId: string
): Promise<void> {
  // Usage is already tracked via ExportJob table
  // This function is for future extensibility
  const limits = await getUserLimits(prisma, userId);

  if (limits.planType === "pay_as_you_go" && limits.exportsRemaining === 0) {
    throw new Error("Export limit exceeded");
  }
}

/**
 * Get usage summary for display
 */
export async function getUsageSummary(
  prisma: PrismaClient,
  userId: string
): Promise<{
  planType: string;
  planName: string;
  generationsUsed: number;
  generationsLimit: number | "unlimited";
  exportsUsed: number;
  exportsLimit: number | "unlimited";
  periodStart: Date | null;
  periodEnd: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  if (user?.role === "admin" && user.isActive) {
    const [generationsUsed, exportsUsed] = await Promise.all([
      prisma.generationRun.count({
        where: {
          userId,
          status: "succeeded",
        },
      }),
      prisma.exportJob.count({
        where: {
          userId,
          status: "succeeded",
        },
      }),
    ]);

    return {
      planType: "monthly_subscription",
      planName: "Superadmin",
      generationsUsed,
      generationsLimit: "unlimited",
      exportsUsed,
      exportsLimit: "unlimited",
      periodStart: null,
      periodEnd: null,
    };
  }

  const limits = await getUserLimits(prisma, userId);

  if (limits.planType === "monthly_subscription") {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      include: {
        plan: true,
      },
    });

    const periodStart = subscription?.currentPeriodStart ?? getCurrentMonthStart();
    const periodEnd = subscription?.currentPeriodEnd || null;

    const generationsUsed = await prisma.generationRun.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: periodStart,
        },
      },
    });

    const exportsUsed = await prisma.exportJob.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: periodStart,
        },
      },
    });

    const generationLimit = readPlanLimit(subscription?.plan?.limitsJson, [
      "monthlyGenerations",
      "generations_per_month",
      "monthly_generations",
      "generations",
    ]);
    const exportLimit = readPlanLimit(subscription?.plan?.limitsJson, [
      "monthlyExports",
      "exports_per_month",
      "monthly_exports",
      "exports",
    ]);

    return {
      planType: "monthly_subscription",
      planName: subscription?.plan.name || "Monthly Subscription",
      generationsUsed,
      generationsLimit: generationLimit,
      exportsUsed,
      exportsLimit: exportLimit,
      periodStart,
      periodEnd,
    };
  }

  if (limits.planType === "pay_as_you_go") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const paygCount = await prisma.transaction.count({
      where: {
        userId,
        status: "succeeded",
        metadataJson: {
          path: ["planType"],
          equals: "pay_as_you_go",
        },
        processedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Check if user is on welcome bonus (no purchases, using starter credits)
    const totalGenerationCount = await prisma.generationRun.count({
      where: {
        userId,
        status: "succeeded",
      },
    });
    const totalExportCount = await prisma.exportJob.count({
      where: {
        userId,
        status: "succeeded",
      },
    });

    const isWelcomeBonus =
      paygCount === 0 &&
      (totalGenerationCount < WELCOME_BONUS_GENERATIONS ||
        totalExportCount < WELCOME_BONUS_EXPORTS);

    if (isWelcomeBonus) {
      return {
        planType: "pay_as_you_go",
        planName: "Welcome Bonus",
        generationsUsed: totalGenerationCount,
        generationsLimit: WELCOME_BONUS_GENERATIONS,
        exportsUsed: totalExportCount,
        exportsLimit: WELCOME_BONUS_EXPORTS,
        periodStart: null,
        periodEnd: null,
      };
    }

    const totalCredits = paygCount * 2;

    const generationsUsed = await prisma.generationRun.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const exportsUsed = await prisma.exportJob.count({
      where: {
        userId,
        status: "succeeded",
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    return {
      planType: "pay_as_you_go",
      planName: "Pay As You Go",
      generationsUsed,
      generationsLimit: totalCredits,
      exportsUsed,
      exportsLimit: totalCredits,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  return {
    planType: "none",
    planName: "No Active Plan",
    generationsUsed: 0,
    generationsLimit: 0,
    exportsUsed: 0,
    exportsLimit: 0,
    periodStart: null,
    periodEnd: null,
  };
}
