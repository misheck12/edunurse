/**
 * Feature Gate Component
 * Protects features based on user's subscription plan
 */

import React, { useState, useEffect, createContext, useContext } from "react";
import { Crown, Sparkles, ArrowRight, X } from "lucide-react";
import { getAuthToken } from "../services/backendApi";
import { PaymentModal } from "./PaymentModal";
import type { FeatureKey, PlanTier, FeatureConfig } from "../types/subscription";
import { PLAN_HIERARCHY, getPlanTier } from "../types/subscription";

// Re-export types for backward compatibility
export type { FeatureKey, PlanTier, FeatureConfig };

// Default feature configuration
export const FEATURE_CONFIG: Record<FeatureKey, FeatureConfig> = {
  // Free tier features
  lesson_generator: {
    key: "lesson_generator",
    name: "Lesson Generator",
    description: "Create AI-powered lesson plans",
    minPlan: "free",
  },
  drug_calculator: {
    key: "drug_calculator",
    name: "Drug Calculator",
    description: "Practice drug dosage calculations",
    minPlan: "free",
  },
  flashcards: {
    key: "flashcards",
    name: "Flashcards",
    description: "Study with spaced repetition flashcards",
    minPlan: "free",
  },
  resources: {
    key: "resources",
    name: "Resources",
    description: "Access learning resources",
    minPlan: "free",
  },

  // Pro tier features
  curriculum_ai: {
    key: "curriculum_ai",
    name: "Curriculum AI",
    description: "AI-powered curriculum planning and analysis",
    minPlan: "pro",
  },
  assignments: {
    key: "assignments",
    name: "Assignment Studio",
    description: "Guided assignment writing with teaching, quizzes, and draft generation",
    minPlan: "pro",
  },
  templates: {
    key: "templates",
    name: "Templates",
    description: "Access premium document templates",
    minPlan: "pro",
  },
  clinical_cases: {
    key: "clinical_cases",
    name: "Clinical Cases",
    description: "Interactive clinical case simulations",
    minPlan: "pro",
  },
  procedures: {
    key: "procedures",
    name: "Procedure Checklists",
    description: "Step-by-step nursing procedures",
    minPlan: "pro",
  },
  medical_terms: {
    key: "medical_terms",
    name: "Medical Terminology",
    description: "Learn medical terminology",
    minPlan: "pro",
  },
  clinical_logbook: {
    key: "clinical_logbook",
    name: "Clinical Logbook",
    description: "Track clinical placements and skills",
    minPlan: "pro",
  },
  nmc_exam_prep: {
    key: "nmc_exam_prep",
    name: "NMC Exam Prep",
    description: "Prepare for NMC licensing exams",
    minPlan: "pro",
  },
  osce_practice: {
    key: "osce_practice",
    name: "OSCE Practice",
    description: "Practice for OSCE examinations",
    minPlan: "pro",
  },
  career: {
    key: "career",
    name: "Career Services",
    description: "Job placement and career guidance",
    minPlan: "pro",
  },
  export_pdf: {
    key: "export_pdf",
    name: "PDF Export",
    description: "Export documents as PDF",
    minPlan: "free",
  },
  export_docx: {
    key: "export_docx",
    name: "Word Export",
    description: "Export documents as Word files",
    minPlan: "pro",
  },
  export_pptx: {
    key: "export_pptx",
    name: "PowerPoint Export",
    description: "Export documents as presentations",
    minPlan: "pro",
  },
  unlimited_generations: {
    key: "unlimited_generations",
    name: "Unlimited Generations",
    description: "Generate unlimited lesson plans",
    minPlan: "premium",
  },
  unlimited_exports: {
    key: "unlimited_exports",
    name: "Unlimited Exports",
    description: "Export unlimited documents",
    minPlan: "premium",
  },
};

interface SubscriptionState {
  isLoading: boolean;
  planCode: string;
  planTier: PlanTier;
  planName: string;
  features: FeatureKey[];
  isActive: boolean;
}

interface FeatureAccessContextType {
  subscription: SubscriptionState;
  hasFeature: (feature: FeatureKey) => boolean;
  canAccessFeature: (feature: FeatureKey) => boolean;
  refreshSubscription: () => Promise<void>;
}

const FeatureAccessContext = createContext<FeatureAccessContextType | null>(null);

export const useFeatureAccess = () => {
  const context = useContext(FeatureAccessContext);
  if (!context) {
    throw new Error("useFeatureAccess must be used within FeatureAccessProvider");
  }
  return context;
};

interface FeatureAccessProviderProps {
  children: React.ReactNode;
}

export const FeatureAccessProvider: React.FC<FeatureAccessProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionState>({
    isLoading: true,
    planCode: "free",
    planTier: "free",
    planName: "Free Plan",
    features: [],
    isActive: false,
  });

  const fetchSubscription = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setSubscription(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/subscriptions/current`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      
      if (data.success && data.data) {
        const planCode = (data.data.planCode || "free").toLowerCase();
        const planTier = getPlanTier(planCode);
        const features = extractFeatures(data.data.limits || {});

        setSubscription({
          isLoading: false,
          planCode,
          planTier,
          planName: data.data.planName || "Free Plan",
          features,
          isActive: true,
        });
      } else {
        // No active subscription - use free tier
        setSubscription({
          isLoading: false,
          planCode: "free",
          planTier: "free",
          planName: "Free Plan",
          features: getDefaultFeatures("free"),
          isActive: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      setSubscription(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const extractFeatures = (limits: Record<string, unknown>): FeatureKey[] => {
    const features: FeatureKey[] = [];
    
    // Extract feature flags from limits
    if (limits.features && Array.isArray(limits.features)) {
      features.push(...(limits.features as FeatureKey[]));
    }

    return features;
  };

  const getDefaultFeatures = (tier: PlanTier): FeatureKey[] => {
    return Object.entries(FEATURE_CONFIG)
      .filter(([_, config]) => PLAN_HIERARCHY[config.minPlan] <= PLAN_HIERARCHY[tier])
      .map(([key]) => key as FeatureKey);
  };

  const hasFeature = (feature: FeatureKey): boolean => {
    // Check explicit feature list first
    if (subscription.features.includes(feature)) {
      return true;
    }

    // Fall back to plan tier check
    const config = FEATURE_CONFIG[feature];
    if (!config) return false;

    return PLAN_HIERARCHY[subscription.planTier] >= PLAN_HIERARCHY[config.minPlan];
  };

  const canAccessFeature = (feature: FeatureKey): boolean => {
    if (subscription.isLoading) return true; // Allow access while loading
    return hasFeature(feature);
  };

  return (
    <FeatureAccessContext.Provider
      value={{
        subscription,
        hasFeature,
        canAccessFeature,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </FeatureAccessContext.Provider>
  );
};

// Feature Gate Component
interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}) => {
  const { canAccessFeature, subscription } = useFeatureAccess();

  if (subscription.isLoading) {
    return <>{children}</>;
  }

  if (canAccessFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} />;
  }

  return null;
};

// Upgrade Prompt Component
interface UpgradePromptProps {
  feature: FeatureKey;
  inline?: boolean;
  onClose?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature, inline = false, onClose }) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const config = FEATURE_CONFIG[feature];

  if (inline) {
    return (
      <>
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Lock className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            {config.name} requires a {config.minPlan} plan.
          </span>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-800 underline"
          >
            Upgrade
          </button>
        </div>
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mb-6">
            <Crown className="w-8 h-8 text-amber-600" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Upgrade to Unlock
          </h2>

          <p className="text-slate-600 mb-6">
            <span className="font-semibold text-amber-600">{config.name}</span> is a{" "}
            {config.minPlan === "premium" ? "Premium" : "Pro"} feature.{" "}
            {config.description}
          </p>

          <div className="bg-slate-50 rounded-xl p-6 mb-6 text-left">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {config.minPlan === "premium" ? "Premium" : "Pro"} Plan includes:
            </h3>
            <ul className="space-y-2">
              {config.minPlan === "pro" && (
                <>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    500 lesson generations per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    250 document exports per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    Clinical Cases & OSCE Practice
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    NMC Exam Preparation
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    Career placement services
                  </li>
                </>
              )}
              {config.minPlan === "premium" && (
                <>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    Unlimited generations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    Unlimited exports
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    Priority support
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-green-500">✓</span>
                    All Pro features included
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
            >
              <Crown className="w-5 h-5" />
              Upgrade Now
              <ArrowRight className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Maybe Later
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Starting at K25/month. Cancel anytime.
          </p>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
      />
    </>
  );
};

// Locked Feature Badge (for sidebar items)
interface LockedBadgeProps {
  feature: FeatureKey;
  className?: string;
}

export const LockedBadge: React.FC<LockedBadgeProps> = ({ feature, className = "" }) => {
  const { canAccessFeature, subscription } = useFeatureAccess();
  
  if (subscription.isLoading || canAccessFeature(feature)) {
    return null;
  }

  const config = FEATURE_CONFIG[feature];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
        config.minPlan === "premium"
          ? "bg-purple-100 text-purple-700"
          : "bg-amber-100 text-amber-700"
      } ${className}`}
      title={`${config.minPlan === "premium" ? "Premium" : "Pro"} feature`}
    >
      <Crown className="w-2.5 h-2.5" />
      {config.minPlan === "premium" ? "Premium" : "Pro"}
    </span>
  );
};

// Hook for checking feature access
export const useHasFeature = (feature: FeatureKey): boolean => {
  const { canAccessFeature, subscription } = useFeatureAccess();
  if (subscription.isLoading) return true;
  return canAccessFeature(feature);
};

// Feature-locked modal for showing upgrade prompt
interface FeatureLockedModalProps {
  feature: FeatureKey;
  isOpen: boolean;
  onClose: () => void;
}

export const FeatureLockedModal: React.FC<FeatureLockedModalProps> = ({
  feature,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
        <UpgradePrompt feature={feature} onClose={onClose} />
      </div>
    </div>
  );
};

export default FeatureGate;
