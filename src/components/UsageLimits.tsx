/**
 * Usage Limits Display Component
 * Shows user's current usage and remaining credits
 */

import React, { useState, useEffect } from "react";
import { getAuthToken } from "../services/backendApi";

interface UsageLimits {
  canGenerate: boolean;
  canExport: boolean;
  generationsRemaining: number | "unlimited";
  exportsRemaining: number | "unlimited";
  planType: "monthly_subscription" | "pay_as_you_go" | "none";
  message?: string;
}

interface UsageSummary {
  planType: string;
  planName: string;
  generationsUsed: number;
  generationsLimit: number | "unlimited";
  exportsUsed: number;
  exportsLimit: number | "unlimited";
  periodStart: Date | null;
  periodEnd: Date | null;
}

interface UsageLimitsProps {
  onUpgradeClick?: () => void;
}

export const UsageLimits: React.FC<UsageLimitsProps> = ({ onUpgradeClick }) => {
  const [limits, setLimits] = useState<UsageLimits | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
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

      const data = await response.json();
      if (data.success) {
        setLimits(data.data.limits);
        setSummary(data.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!limits || !summary) {
    return null;
  }

  const formatLimit = (value: number | "unlimited") => {
    return value === "unlimited" ? "∞" : value;
  };

  const getProgressColor = (used: number, limit: number | "unlimited") => {
    if (limit === "unlimited") return "bg-green-500";
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getProgressPercentage = (used: number, limit: number | "unlimited") => {
    if (limit === "unlimited") return 0;
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{summary.planName}</h3>
          {summary.planName === "Welcome Bonus" && (
            <p className="text-xs text-green-600 font-medium">
              🎉 Free trial - Try EduNurse!
            </p>
          )}
          {summary.periodEnd && summary.planName !== "Welcome Bonus" && (
            <p className="text-xs text-gray-500">
              {summary.planType === "monthly_subscription"
                ? `Renews ${new Date(summary.periodEnd).toLocaleDateString()}`
                : `Valid until ${new Date(summary.periodEnd).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {summary.planType !== "monthly_subscription" && onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            {summary.planName === "Welcome Bonus" ? "Subscribe" : "Upgrade"}
          </button>
        )}
      </div>

      {/* Generations */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium">Lesson Plans</span>
          <span className="text-sm text-gray-600">
            {summary.generationsUsed} / {formatLimit(summary.generationsLimit)}
          </span>
        </div>
        {summary.generationsLimit !== "unlimited" && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(
                summary.generationsUsed,
                summary.generationsLimit
              )}`}
              style={{
                width: `${getProgressPercentage(
                  summary.generationsUsed,
                  summary.generationsLimit
                )}%`,
              }}
            ></div>
          </div>
        )}
        {!limits.canGenerate && (
          <p className="text-xs text-red-600 mt-1">
            Generation limit reached
          </p>
        )}
      </div>

      {/* Exports */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium">Exports</span>
          <span className="text-sm text-gray-600">
            {summary.exportsUsed} / {formatLimit(summary.exportsLimit)}
          </span>
        </div>
        {summary.exportsLimit !== "unlimited" && summary.exportsLimit > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(
                summary.exportsUsed,
                summary.exportsLimit
              )}`}
              style={{
                width: `${getProgressPercentage(
                  summary.exportsUsed,
                  summary.exportsLimit
                )}%`,
              }}
            ></div>
          </div>
        )}
        {summary.planName === "Welcome Bonus" && (
          <p className="text-xs text-gray-500 mt-1">
            Exports available after first purchase
          </p>
        )}
        {!limits.canExport && summary.planName !== "Welcome Bonus" && (
          <p className="text-xs text-red-600 mt-1">Export limit reached</p>
        )}
      </div>

      {/* Welcome bonus info */}
      {summary.planName === "Welcome Bonus" && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800 font-medium mb-1">
            🎉 Welcome to EduNurse!
          </p>
          <p className="text-xs text-green-700 mb-2">
            You have {limits.generationsRemaining} free lesson plan generation
            {limits.generationsRemaining !== 1 ? 's' : ''} to try our platform.
          </p>
          <p className="text-xs text-orange-700 mb-2">
            ⚠️ Exports are not included in the welcome bonus. Subscribe to export your lesson plans.
          </p>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="mt-2 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 text-sm"
            >
              View Plans
            </button>
          )}
        </div>
      )}

      {/* No active plan warning */}
      {summary.planType === "none" && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            No active subscription. Subscribe to start creating lesson plans.
          </p>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="mt-2 w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700"
            >
              Subscribe Now
            </button>
          )}
        </div>
      )}

      {/* Low credits warning for PAYG */}
      {summary.planType === "pay_as_you_go" &&
        summary.generationsLimit !== "unlimited" &&
        summary.generationsUsed >= summary.generationsLimit * 0.8 && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
            <p className="text-sm text-orange-800">
              You're running low on credits. Consider purchasing more or
              upgrading to unlimited.
            </p>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="mt-2 w-full bg-orange-600 text-white py-2 rounded hover:bg-orange-700"
              >
                Get More Credits
              </button>
            )}
          </div>
        )}
    </div>
  );
};

/**
 * Compact usage badge for header/navbar
 */
export const UsageBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const [limits, setLimits] = useState<UsageLimits | null>(null);

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        return;
      }

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      if (!apiBaseUrl) {
        console.log("API base URL not configured");
        return;
      }

      const response = await fetch(
        `${apiBaseUrl}/payments/usage`,
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

  if (!limits) return null;

  const getBadgeColor = () => {
    if (limits.planType === "monthly_subscription") return "bg-green-100 text-green-800";
    if (limits.planType === "pay_as_you_go") {
      if (!limits.canGenerate || !limits.canExport) return "bg-red-100 text-red-800";
      if (
        limits.generationsRemaining !== "unlimited" &&
        limits.generationsRemaining <= 1
      )
        return "bg-yellow-100 text-yellow-800";
      return "bg-blue-100 text-blue-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const getBadgeText = () => {
    if (limits.planType === "monthly_subscription") return "Unlimited";
    if (limits.planType === "pay_as_you_go") {
      return `${limits.generationsRemaining} left`;
    }
    return "No plan";
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor()} hover:opacity-80 transition`}
    >
      {getBadgeText()}
    </button>
  );
};
