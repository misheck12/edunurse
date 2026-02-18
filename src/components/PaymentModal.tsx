/**
 * Payment Modal Component
 * Handles subscription and pay-as-you-go payments via Lenco
 */

import React, { useState, useEffect } from "react";
import { getAuthToken } from "../services/backendApi";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
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
        // Handle HTTP error responses
        setError(data.message || `Payment failed: ${response.statusText}`);
        return;
      }

      if (data.success) {
        setPaymentReference(data.data.reference);
        setPaymentStatus("pending");
        // Start polling for payment status
        pollPaymentStatus(data.data.reference);
      } else {
        setError(data.message || "Failed to initiate payment");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initiate payment. Please try again.";
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (reference: string) => {
    const maxAttempts = 60; // Poll for 5 minutes (every 5 seconds)
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
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          setPaymentStatus(data.data.status);

          if (data.data.status === "successful") {
            onSuccess?.();
            setTimeout(() => {
              onClose();
            }, 2000);
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
      setTimeout(poll, 5000); // Poll every 5 seconds
    };

    poll();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!paymentReference ? (
          <>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {plans.monthly_subscription && (
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                    selectedPlan === "monthly_subscription"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                  onClick={() => setSelectedPlan("monthly_subscription")}
                >
                  <h3 className="text-xl font-bold mb-2">
                    {plans.monthly_subscription.name}
                  </h3>
                  <div className="text-3xl font-bold mb-2">
                    {plans.monthly_subscription.currency}{" "}
                    {plans.monthly_subscription.price}
                    <span className="text-sm text-gray-600">/month</span>
                  </div>
                  <p className="text-gray-600 mb-4">
                    {plans.monthly_subscription.description}
                  </p>
                  <ul className="space-y-2">
                    {plans.monthly_subscription.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plans.pay_as_you_go && (
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition ${
                    selectedPlan === "pay_as_you_go"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                  onClick={() => setSelectedPlan("pay_as_you_go")}
                >
                  <h3 className="text-xl font-bold mb-2">
                    {plans.pay_as_you_go.name}
                  </h3>
                  <div className="text-3xl font-bold mb-2">
                    {plans.pay_as_you_go.currency} {plans.pay_as_you_go.price}
                    <span className="text-sm text-gray-600">/one-time</span>
                  </div>
                  <p className="text-gray-600 mb-4">
                    {plans.pay_as_you_go.description}
                  </p>
                  <ul className="space-y-2">
                    {plans.pay_as_you_go.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Mobile Money Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0977123456 or +260977123456"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your Zambian mobile money number (MTN, Airtel, or Zamtel)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supported formats: 0977123456, +260977123456, or 260977123456
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={initiatePayment}
              disabled={!selectedPlan || !phone || loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {loading ? "Processing..." : "Proceed to Payment"}
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            {paymentStatus === "pending" || paymentStatus === "pay-offline" ? (
              <>
                <div className="text-6xl mb-4">📱</div>
                <h3 className="text-xl font-bold mb-2">
                  Check Your Phone
                </h3>
                <p className="text-gray-600 mb-4">
                  A payment prompt has been sent to your mobile phone.
                  <br />
                  Please authorize the payment to complete your purchase.
                </p>
                <div className="animate-pulse text-blue-600">
                  Waiting for payment confirmation...
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Reference: {paymentReference}
                </p>
              </>
            ) : paymentStatus === "successful" ? (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold mb-2 text-green-600">
                  Payment Successful!
                </h3>
                <p className="text-gray-600">
                  Your payment has been processed successfully.
                </p>
              </>
            ) : paymentStatus === "failed" ? (
              <>
                <div className="text-6xl mb-4">❌</div>
                <h3 className="text-xl font-bold mb-2 text-red-600">
                  Payment Failed
                </h3>
                <p className="text-gray-600 mb-4">
                  Your payment could not be processed. Please try again.
                </p>
                <button
                  onClick={() => {
                    setPaymentReference(null);
                    setPaymentStatus(null);
                    setError(null);
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">⏱️</div>
                <h3 className="text-xl font-bold mb-2">Payment Timeout</h3>
                <p className="text-gray-600 mb-4">
                  We couldn't verify your payment. Please check your transaction
                  history.
                </p>
                <button
                  onClick={onClose}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
