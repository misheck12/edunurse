/**
 * Upgrade Banner Component
 * Contextual banners shown throughout the app to encourage upgrades
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Zap, TrendingUp, X } from "lucide-react";
import { getAuthToken } from "../services/backendApi";

interface UsageLimits {
  canGenerate: boolean;
  canExport: boolean;
  generationsRemaining: number | "unlimited";
  exportsRemaining: number | "unlimited";
  planType: "monthly_subscription" | "pay_as_you_go" | "none";
  message?: string;
}

interface UpgradeBannerProps {
  onUpgradeClick: () => void;
  variant?: "dashboard" | "library" | "editor" | "minimal";
  dismissible?: boolean;
  dismissTtlMinutes?: number;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({
  onUpgradeClick,
  variant = "dashboard",
  dismissible = true,
  dismissTtlMinutes = 20,
}) => {
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const dismissStorageKey = `banner-dismissed-${variant}`;

  useEffect(() => {
    void fetchLimits();
    if (!dismissible) {
      sessionStorage.removeItem(dismissStorageKey);
      setDismissed(false);
      return;
    }

    const stored = sessionStorage.getItem(dismissStorageKey);
    if (stored) {
      try {
        const payload = JSON.parse(stored) as { until?: number };
        const until = typeof payload.until === "number" ? payload.until : 0;
        if (until > Date.now()) {
          setDismissed(true);
          return;
        }
      } catch {
        // Ignore malformed session values and treat as not dismissed.
      }
      sessionStorage.removeItem(dismissStorageKey);
    }

    setDismissed(false);
  }, [dismissStorageKey, dismissible]);

  const fetchLimits = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/payments/usage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        return;
      }

      const data = await response.json();
      if (data.success) {
        setLimits(data.data.limits);
      }
    } catch (err) {
      console.error("Failed to fetch limits:", err);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    const until = Date.now() + Math.max(1, dismissTtlMinutes) * 60_000;
    sessionStorage.setItem(dismissStorageKey, JSON.stringify({ until }));
  };

  if (!limits || dismissed) return null;

  // Don't show banner for monthly subscribers
  if (limits.planType === "monthly_subscription") return null;

  // Dashboard variant - Welcome bonus or low credits
  if (variant === "dashboard") {
    if (limits.planType === "none") {
      return (
        <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 mb-6 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={24} />
                <h3 className="text-xl font-bold">Welcome to EduNurse Pro!</h3>
              </div>
              <p className="text-blue-50 mb-4">
                Start creating professional lesson plans with AI assistance. Choose a plan to get started.
              </p>
              <button
                onClick={onUpgradeClick}
                className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                View Plans
              </button>
            </div>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white hover:text-blue-100"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      );
    }

    // Welcome bonus active
    if (limits.message?.includes("Welcome bonus")) {
      return (
        <div className="relative bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={24} />
                <h3 className="text-xl font-bold">🎉 {limits.generationsRemaining} Free Generations!</h3>
              </div>
              <p className="text-green-50 mb-4">
                Try EduNurse Pro with {limits.generationsRemaining} free lesson plan generation{limits.generationsRemaining !== 1 ? 's' : ''}. 
                Love it? Upgrade to unlimited for just K99/month.
              </p>
              <button
                onClick={onUpgradeClick}
                className="bg-white text-green-600 px-6 py-2 rounded-lg font-semibold hover:bg-green-50 transition"
              >
                See Plans
              </button>
            </div>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white hover:text-green-100"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      );
    }

    // Low credits warning
    if (
      limits.planType === "pay_as_you_go" &&
      limits.generationsRemaining !== "unlimited" &&
      limits.generationsRemaining <= 1
    ) {
      return (
        <div className="relative bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 mb-6 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={24} />
                <h3 className="text-xl font-bold">Running Low on Credits!</h3>
              </div>
              <p className="text-orange-50 mb-4">
                You have {limits.generationsRemaining} generation{limits.generationsRemaining !== 1 ? 's' : ''} remaining. 
                Upgrade to unlimited or purchase more credits to keep creating.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onUpgradeClick}
                  className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white hover:text-orange-100"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      );
    }

    if (limits.planType === "pay_as_you_go") {
      return (
        <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={24} />
                <h3 className="text-xl font-bold">Keep Momentum with Unlimited</h3>
              </div>
              <p className="text-blue-50 mb-4">
                You currently have{" "}
                <span className="font-semibold">{String(limits.generationsRemaining)}</span>{" "}
                generation credits remaining. Upgrade for unlimited lesson plan creation.
              </p>
              <button
                onClick={onUpgradeClick}
                className="bg-white text-blue-700 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                Upgrade Plan
              </button>
            </div>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white hover:text-blue-100"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  // Library variant - Show value proposition
  if (variant === "library") {
    if (limits.planType !== "monthly_subscription") {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={18} className="text-blue-600" />
                <h4 className="font-semibold text-blue-900">Unlock Unlimited Creation</h4>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Create unlimited lesson plans, OSCE stations, and assessments for just K99/month.
              </p>
              <button
                onClick={onUpgradeClick}
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 transition"
              >
                Upgrade to Unlimited
              </button>
            </div>
            {dismissible && (
              <button onClick={handleDismiss} className="text-blue-400 hover:text-blue-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  // Editor variant - compact sticky upsell for non-unlimited plans.
  if (variant === "editor" && limits.planType !== "monthly_subscription") {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Upgrade available:</span> unlock unlimited
            generations and exports while editing.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUpgradeClick}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Upgrade
            </button>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="text-amber-600 hover:text-amber-800"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Minimal variant - Small inline prompt
  if (variant === "minimal") {
    if (limits.planType !== "monthly_subscription") {
      return (
        <div className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
          <Sparkles size={14} />
          <span>Upgrade for unlimited access</span>
          <button
            onClick={onUpgradeClick}
            className="font-semibold hover:underline"
          >
            View Plans →
          </button>
        </div>
      );
    }
  }

  return null;
};
