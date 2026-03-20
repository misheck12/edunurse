/**
 * Usage Limits Display Components
 * Uses shared types and context for consistent data
 */

import React from "react";
import { useUsage } from "../context/UsageContext";
import { formatLimit, getProgressColor, getProgressPercentage } from "../types/subscription";

interface UsageLimitsProps {
  onUpgradeClick?: () => void;
}

export const UsageLimits: React.FC<UsageLimitsProps> = ({ onUpgradeClick }) => {
  const { limits, summary, isLoading } = useUsage();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-slate-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!limits || !summary) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">{summary.planName}</h3>
          {summary.planName === "Welcome Bonus" && (
            <p className="text-xs text-green-600 font-medium">
              🎉 Free trial - Try EduNurse!
            </p>
          )}
          {summary.periodEnd && summary.planName !== "Welcome Bonus" && (
            <p className="text-xs text-slate-500">
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
          <span className="text-sm text-slate-500">
            {summary.generationsUsed} / {formatLimit(summary.generationsLimit)}
          </span>
        </div>
        {summary.generationsLimit !== "unlimited" && (
          <div className="w-full bg-slate-200 rounded-full h-2">
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
          <span className="text-sm text-slate-500">
            {summary.exportsUsed} / {formatLimit(summary.exportsLimit)}
          </span>
        </div>
        {summary.exportsLimit !== "unlimited" && summary.exportsLimit > 0 && (
          <div className="w-full bg-slate-200 rounded-full h-2">
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
          <p className="text-xs text-slate-500 mt-1">
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
            {limits.generationsRemaining !== 1 ? "s" : ""} to try our platform.
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
 * Compact usage badge for sidebar
 */
export const UsageBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { limits, isLoading } = useUsage();

  if (isLoading || !limits) return null;

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
    return "bg-slate-100 text-slate-700";
  };

  const getBadgeText = () => {
    if (limits.planType === "monthly_subscription") return "Pro";
    if (limits.planType === "pay_as_you_go") {
      return `${limits.generationsRemaining} left`;
    }
    return "Free";
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${getBadgeColor()} hover:opacity-80 transition w-full text-center`}
    >
      {getBadgeText()}
    </button>
  );
};

export default UsageLimits;
