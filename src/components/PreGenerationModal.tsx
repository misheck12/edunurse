/**
 * Pre-Generation Modal
 * Shows before generation to confirm and display remaining credits
 */

import React from "react";
import { AlertCircle, Sparkles, Zap } from "lucide-react";
import { useUsage } from "../context/UsageContext";

interface PreGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onUpgrade: () => void;
}

export const PreGenerationModal: React.FC<PreGenerationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onUpgrade,
}) => {
  const { limits, isLoading: loading, refresh } = useUsage();

  // Refresh limits when modal opens
  React.useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  // Blocked - no credits
  if (limits && !limits.canGenerate) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Generation Limit Reached
            </h3>
            <p className="text-slate-600 mb-6">
              {limits.planType === "none"
                ? "You need an active subscription to generate lesson plans."
                : "You've used all your generation credits. Upgrade or purchase more to continue."}
            </p>

            <div className="space-y-3">
              <button
                onClick={onUpgrade}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                View Plans & Upgrade
              </button>
              <button
                onClick={onClose}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">Checking your credits...</p>
          </div>
        </div>
      </div>
    );
  }

  // Confirm generation
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Generate Lesson Plan?
          </h3>

          {limits?.planType === "monthly_subscription" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">
                ✨ Unlimited Plan Active
              </p>
              <p className="text-sm text-green-700 mt-1">
                You have unlimited generations with your subscription.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-slate-700 mb-2">
                This will use <span className="font-bold">1</span> of your{" "}
                <span className="font-bold">{limits?.generationsRemaining}</span>{" "}
                remaining generation{limits?.generationsRemaining !== 1 ? "s" : ""}.
              </p>
              {limits?.generationsRemaining === 1 && (
                <div className="flex items-center gap-2 text-orange-700 text-sm mt-2">
                  <Zap size={16} />
                  <span className="font-medium">This is your last generation!</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Confirm & Generate
            </button>

            {limits?.planType !== "monthly_subscription" && (
              <button
                onClick={onUpgrade}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-200 transition flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                Upgrade to Unlimited
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full text-slate-600 py-2 rounded-lg font-medium hover:text-slate-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
