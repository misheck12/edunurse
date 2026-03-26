/**
 * Payment Modal Component
 * Handles subscription and pay-as-you-go payments via Lenco
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  Smartphone,
  Star,
  Zap,
  Gift,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { getAuthToken, applyReferralCode } from "../services/backendApi";

interface Plan {
  code: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  features: string[];
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [plans, setPlans] = useState<{
    monthly_subscription?: Plan;
    pay_as_you_go?: Plan;
  }>({});
  const [selectedPlan, setSelectedPlan] = useState<
    "monthly_subscription" | "pay_as_you_go" | null
  >(null);
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralApplied, setReferralApplied] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      // Pre-fill referral code from URL if present
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) setReferralCode(ref);
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/payments/plans`
      );
      const data = await response.json();
      if (data.success) {
        setPlans(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    }
  };

  const handleApplyReferralCode = async () => {
    if (!referralCode.trim()) return;
    setReferralError(null);
    try {
      const res = await applyReferralCode(referralCode.trim());
      if (res.success) {
        setReferralApplied(true);
      } else {
        setReferralError(res.message || "Invalid code");
      }
    } catch (err: any) {
      setReferralError(err?.message || "Could not apply referral code");
    }
  };

  const initiatePayment = async () => {
    if (!selectedPlan || !phone) {
      setError("Please select a plan and enter your phone number");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        setError("Please sign in to continue.");
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/payments/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planType: selectedPlan,
            phone: phone,
            country: "ZM",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || `Payment failed: ${response.statusText}`);
        return;
      }

      if (data.success) {
        setPaymentReference(data.data.reference);
        setPaymentStatus("pending");
        pollPaymentStatus(data.data.reference);
      } else {
        setError(data.message || "Failed to initiate payment");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initiate payment. Please try again.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (reference: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPaymentStatus("timeout");
        return;
      }

      try {
        const token = getAuthToken();
        if (!token) {
          setPaymentStatus("failed");
          setError("Session expired. Please sign in again.");
          return;
        }
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/payments/verify/${reference}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const data = await response.json();

        if (data.success) {
          setPaymentStatus(data.data.status);

          if (data.data.status === "successful") {
            onSuccess?.();
            setTimeout(() => onClose(), 2000);
            return;
          } else if (data.data.status === "failed") {
            setError("Payment failed. Please try again.");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to verify payment:", err);
      }

      attempts++;
      setTimeout(poll, 5000);
    };

    poll();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Choose Your Plan
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Unlock powerful lesson planning tools
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {!paymentReference ? (
            <>
              {/* Plan Cards */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {/* Monthly Subscription – Popular */}
                {plans.monthly_subscription && (
                  <div
                    className={`relative border-2 rounded-xl p-5 cursor-pointer transition-all ${
                      selectedPlan === "monthly_subscription"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                        : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                    }`}
                    onClick={() => setSelectedPlan("monthly_subscription")}
                  >
                    {/* Popular badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                        <Star size={12} fill="currentColor" /> MOST POPULAR
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3 mt-2">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Zap size={18} className="text-blue-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {plans.monthly_subscription.name}
                      </h3>
                    </div>

                    <div className="mb-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        K{plans.monthly_subscription.price}
                      </span>
                      <span className="text-sm text-slate-500 ml-1">
                        /month
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-4">
                      {plans.monthly_subscription.description}
                    </p>

                    <ul className="space-y-2.5">
                      {plans.monthly_subscription.features.map(
                        (feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check
                              size={16}
                              className="text-green-500 mt-0.5 flex-shrink-0"
                            />
                            <span className="text-sm text-slate-700">
                              {feature}
                            </span>
                          </li>
                        )
                      )}
                    </ul>

                    {/* Selection indicator */}
                    {selectedPlan === "monthly_subscription" && (
                      <div className="absolute top-4 right-4">
                        <CheckCircle2
                          size={22}
                          className="text-blue-600"
                          fill="currentColor"
                          stroke="white"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Pay As You Go */}
                {plans.pay_as_you_go && (
                  <div
                    className={`relative border-2 rounded-xl p-5 cursor-pointer transition-all ${
                      selectedPlan === "pay_as_you_go"
                        ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100"
                        : "border-slate-200 hover:border-emerald-300 hover:shadow-md"
                    }`}
                    onClick={() => setSelectedPlan("pay_as_you_go")}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-emerald-100">
                        <Zap size={18} className="text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {plans.pay_as_you_go.name}
                      </h3>
                    </div>

                    <div className="mb-3">
                      <span className="text-3xl font-extrabold text-slate-900">
                        K{plans.pay_as_you_go.price}
                      </span>
                      <span className="text-sm text-slate-500 ml-1">
                        /one-time
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-4">
                      {plans.pay_as_you_go.description}
                    </p>

                    <ul className="space-y-2.5">
                      {plans.pay_as_you_go.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check
                            size={16}
                            className="text-green-500 mt-0.5 flex-shrink-0"
                          />
                          <span className="text-sm text-slate-700">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {selectedPlan === "pay_as_you_go" && (
                      <div className="absolute top-4 right-4">
                        <CheckCircle2
                          size={22}
                          className="text-emerald-600"
                          fill="currentColor"
                          stroke="white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Phone Number Input */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Smartphone size={15} />
                  Mobile Money Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0977 123 456"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  MTN, Airtel, or Zamtel — formats: 0977123456, +260977123456
                </p>
              </div>

              {/* Referral Code Input */}
              <div className="mb-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Gift size={15} className="text-purple-500" />
                  Referral Code
                  <span className="text-xs text-slate-400 font-normal">
                    (optional)
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferralError(null);
                      setReferralApplied(false);
                    }}
                    placeholder="e.g. EDU-A3K9X2"
                    disabled={referralApplied}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition disabled:bg-slate-50"
                  />
                  {!referralApplied && (
                    <button
                      onClick={handleApplyReferralCode}
                      disabled={!referralCode.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {referralApplied && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <Check size={12} /> Referral code applied!
                  </p>
                )}
                {referralError && (
                  <p className="text-xs text-red-600 mt-1.5">{referralError}</p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                  <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={initiatePayment}
                disabled={!selectedPlan || !phone || loading}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Smartphone size={18} />
                    Pay{" "}
                    {selectedPlan
                      ? `K${plans[selectedPlan]?.price ?? ""}`
                      : ""}{" "}
                    via Mobile Money
                  </>
                )}
              </button>
            </>
          ) : (
            /* Payment Status Screen */
            <div className="text-center py-10">
              {paymentStatus === "pending" ||
              paymentStatus === "pay-offline" ? (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-5">
                    <Smartphone size={36} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Check Your Phone
                  </h3>
                  <p className="text-slate-500 mb-4 max-w-sm mx-auto">
                    A payment prompt has been sent to your phone. Authorize the
                    payment to complete your purchase.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-blue-600 animate-pulse">
                    <Loader2 size={16} className="animate-spin" />
                    Waiting for confirmation…
                  </div>
                  <p className="text-xs text-slate-400 mt-4">
                    Ref: {paymentReference}
                  </p>
                </>
              ) : paymentStatus === "successful" ? (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-5">
                    <CheckCircle2 size={36} className="text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-green-700 mb-2">
                    Payment Successful!
                  </h3>
                  <p className="text-slate-500">
                    Your plan has been activated. Enjoy EduNurse!
                  </p>
                </>
              ) : paymentStatus === "failed" ? (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-5">
                    <XCircle size={36} className="text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-red-700 mb-2">
                    Payment Failed
                  </h3>
                  <p className="text-slate-500 mb-5">
                    Your payment could not be processed. Please try again.
                  </p>
                  <button
                    onClick={() => {
                      setPaymentReference(null);
                      setPaymentStatus(null);
                      setError(null);
                    }}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-5">
                    <Clock size={36} className="text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Payment Timeout
                  </h3>
                  <p className="text-slate-500 mb-5">
                    We couldn't verify your payment. Check your transaction
                    history.
                  </p>
                  <button
                    onClick={onClose}
                    className="rounded-xl bg-slate-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
