/**
 * Shared Subscription & Usage Types
 * Single source of truth for subscription-related types across the frontend
 */

// Plan tiers
export type PlanTier = "free" | "pro" | "premium";

// Feature keys - must match backend feature-access.ts
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

// Usage limits returned from /payments/usage
export interface UsageLimits {
  canGenerate: boolean;
  canExport: boolean;
  generationsRemaining: number | "unlimited";
  exportsRemaining: number | "unlimited";
  planType: "monthly_subscription" | "pay_as_you_go" | "none";
  message?: string;
}

// Usage summary for display
export interface UsageSummary {
  planType: string;
  planName: string;
  generationsUsed: number;
  generationsLimit: number | "unlimited";
  exportsUsed: number;
  exportsLimit: number | "unlimited";
  periodStart: Date | null;
  periodEnd: Date | null;
}

// Subscription data from /subscriptions/current
export interface SubscriptionData {
  id: string;
  planName: string;
  planCode: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  monthlyPrice: number;
  currency: string;
  limits: Record<string, unknown>;
}

// Feature configuration for access control
export interface FeatureConfig {
  key: FeatureKey;
  name: string;
  description: string;
  minPlan: PlanTier;
}

// Plan hierarchy for tier comparison
export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

/**
 * Determine plan tier from plan code string
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
 * Format a limit value for display
 */
export function formatLimit(value: number | "unlimited"): string {
  return value === "unlimited" ? "∞" : String(value);
}

/**
 * Get progress bar color based on usage percentage
 */
export function getProgressColor(used: number, limit: number | "unlimited"): string {
  if (limit === "unlimited") return "bg-green-500";
  const percentage = (used / limit) * 100;
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

/**
 * Calculate progress percentage
 */
export function getProgressPercentage(used: number, limit: number | "unlimited"): number {
  if (limit === "unlimited") return 0;
  return Math.min((used / limit) * 100, 100);
}
