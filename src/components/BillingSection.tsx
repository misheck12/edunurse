/**
 * Billing Section Component
 * Comprehensive billing and subscription management for Settings page
 */

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  TrendingUp,
  Calendar,
  Download,
  Sparkles,
  Gift,
  Copy,
  Check,
  Users,
  Wallet,
  ExternalLink,
} from "lucide-react";
import {
  getAuthToken,
  getMyReferralCode,
  getReferralEarnings,
  ReferralEarningsData,
} from "../services/backendApi";
import { useUsage } from "../context/UsageContext";
import { formatLimit, getProgressColor, getProgressPercentage } from "../types/subscription";

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  metadata: any;
}

interface BillingSectionProps {
  onUpgradeClick: () => void;
}

export const BillingSection: React.FC<BillingSectionProps> = ({
  onUpgradeClick,
}) => {
  const { limits, summary, isLoading: usageLoading } = useUsage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Affiliate state
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<ReferralEarningsData | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchReferralData();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch recent transactions
      const transactionsResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/payments/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (transactionsResponse.status !== 401) {
        const transactionsData = await transactionsResponse.json();
        if (transactionsData.success) {
          setTransactions(transactionsData.data.slice(0, 5)); // Last 5 transactions
        }
      }
    } catch (err) {
      console.error("Failed to fetch billing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralData = async () => {
    try {
      const [codeRes, earningsRes] = await Promise.all([
        getMyReferralCode(),
        getReferralEarnings(),
      ]);
      if (codeRes.success && codeRes.data) {
        setReferralCode(codeRes.data.referralCode);
        setShareUrl(codeRes.data.shareUrl);
      }
      if (earningsRes.success && earningsRes.data) {
        setEarnings(earningsRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch referral data:", err);
    }
  };

  const copyToClipboard = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "code") {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    });
  };

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case "monthly_subscription":
        return "bg-green-100 text-green-800 border-green-200";
      case "pay_as_you_go":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  if (loading || usageLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-slate-200 rounded"></div>
          <div className="h-20 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-6 flex items-center gap-2">
        <CreditCard size={18} className="text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-900">
          Subscription & Billing
        </h2>
      </div>

      {/* Current Plan Card */}
      <div className="mb-6 rounded-lg border-2 border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-slate-900">
                {summary?.planName || "No Active Plan"}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPlanBadgeColor(
                  summary?.planType || "none"
                )}`}
              >
                {summary?.planType === "monthly_subscription"
                  ? "Active"
                  : summary?.planType === "pay_as_you_go"
                    ? "Credits"
                    : "Inactive"}
              </span>
            </div>

            {summary?.planName === "Welcome Bonus" && (
              <p className="text-sm text-green-600 font-medium mb-2">
                🎉 Free trial - Try EduNurse Pro!
              </p>
            )}

            {summary?.periodEnd && summary?.planName !== "Welcome Bonus" && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar size={14} />
                <span>
                  {summary?.planType === "monthly_subscription"
                    ? `Renews on ${new Date(summary.periodEnd).toLocaleDateString()}`
                    : `Valid until ${new Date(summary.periodEnd).toLocaleDateString()}`}
                </span>
              </div>
            )}
          </div>

          {summary?.planType !== "monthly_subscription" && (
            <button
              onClick={onUpgradeClick}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Sparkles size={16} />
              {summary?.planName === "Welcome Bonus" ? "Subscribe" : "Upgrade"}
            </button>
          )}
        </div>

        {/* Usage Progress Bars */}
        <div className="space-y-4">
          {/* Generations */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700">
                Lesson Plan Generations
              </span>
              <span className="text-sm font-bold text-slate-900">
                {summary?.generationsUsed} / {formatLimit(summary?.generationsLimit || 0)}
              </span>
            </div>
            {summary?.generationsLimit !== "unlimited" && (
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${getProgressColor(
                    summary?.generationsUsed || 0,
                    summary?.generationsLimit || 0
                  )}`}
                  style={{
                    width: `${getProgressPercentage(
                      summary?.generationsUsed || 0,
                      summary?.generationsLimit || 0
                    )}%`,
                  }}
                ></div>
              </div>
            )}
            {summary?.generationsLimit === "unlimited" && (
              <div className="text-xs text-green-600 font-medium">
                ✨ Unlimited generations
              </div>
            )}
            {!limits?.canGenerate && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                ⚠️ Generation limit reached
              </p>
            )}
          </div>

          {/* Exports */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700">
                Document Exports
              </span>
              <span className="text-sm font-bold text-slate-900">
                {summary?.exportsUsed} / {formatLimit(summary?.exportsLimit || 0)}
              </span>
            </div>
            {summary?.exportsLimit !== "unlimited" && summary?.exportsLimit !== 0 && (
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${getProgressColor(
                    summary?.exportsUsed || 0,
                    summary?.exportsLimit || 0
                  )}`}
                  style={{
                    width: `${getProgressPercentage(
                      summary?.exportsUsed || 0,
                      summary?.exportsLimit || 0
                    )}%`,
                  }}
                ></div>
              </div>
            )}
            {summary?.exportsLimit === "unlimited" && (
              <div className="text-xs text-green-600 font-medium">
                ✨ Unlimited exports
              </div>
            )}
            {summary?.planName === "Welcome Bonus" && (
              <p className="text-xs text-slate-500 mt-1">
                Exports available after first purchase
              </p>
            )}
            {!limits?.canExport && summary?.planName !== "Welcome Bonus" && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                ⚠️ Export limit reached
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      {summary?.planType !== "monthly_subscription" && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <TrendingUp size={20} className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-1">
                Upgrade to Unlimited
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                Get unlimited lesson plans, exports, and priority support for just K99/month.
              </p>
              <button
                onClick={onUpgradeClick}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-900">Recent Transactions</h4>
          {transactions.length > 0 && (
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
            <Download size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">No transactions yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Your payment history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {transaction.metadata?.planType === "monthly_subscription"
                      ? "Monthly Subscription"
                      : "Pay As You Go"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {transaction.currency} {transaction.amount.toFixed(2)}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      transaction.status === "succeeded"
                        ? "bg-green-100 text-green-700"
                        : transaction.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {transaction.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Affiliate & Earnings ─────────────────────────────────── */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={18} className="text-purple-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Affiliate & Earnings
          </h3>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Share your referral code with friends and earn{" "}
          <span className="font-bold text-purple-700">
            {earnings ? `${(earnings.commissionRate * 100).toFixed(0)}%` : "10%"} commission
          </span>{" "}
          on every payment they make!
        </p>

        {/* Referral Code + Share URL */}
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {/* Code */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
              Your Referral Code
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-lg font-bold text-purple-900 tracking-widest">
                {referralCode || "—"}
              </span>
              {referralCode && (
                <button
                  onClick={() => copyToClipboard(referralCode, "code")}
                  className="p-1.5 rounded-lg hover:bg-purple-200 transition text-purple-600"
                  title="Copy code"
                >
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* Share link */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
              Share Link
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm text-purple-800 truncate max-w-[200px]">
                {shareUrl || "—"}
              </span>
              {shareUrl && (
                <button
                  onClick={() => copyToClipboard(shareUrl, "link")}
                  className="p-1.5 rounded-lg hover:bg-purple-200 transition text-purple-600"
                  title="Copy link"
                >
                  {linkCopied ? <Check size={16} /> : <ExternalLink size={16} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Earnings Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <Wallet size={20} className="mx-auto text-green-600 mb-1" />
            <div className="text-xl font-bold text-green-800">
              K{((earnings?.totalEarnedCents ?? 0) / 100).toFixed(2)}
            </div>
            <span className="text-xs text-green-600 font-medium">
              Total Earned
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <TrendingUp size={20} className="mx-auto text-amber-600 mb-1" />
            <div className="text-xl font-bold text-amber-800">
              K{((earnings?.pendingCents ?? 0) / 100).toFixed(2)}
            </div>
            <span className="text-xs text-amber-600 font-medium">
              Pending
            </span>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <Users size={20} className="mx-auto text-blue-600 mb-1" />
            <div className="text-xl font-bold text-blue-800">
              {earnings?.referredUsersCount ?? 0}
            </div>
            <span className="text-xs text-blue-600 font-medium">
              Referred Users
            </span>
          </div>
        </div>

        {/* Recent Referral Earnings */}
        {earnings && earnings.referrals.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              Recent Referral Earnings
            </h4>
            <div className="space-y-2">
              {earnings.referrals.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {r.referredName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">
                      +K{(r.commissionCents / 100).toFixed(2)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "earned"
                          ? "bg-green-100 text-green-700"
                          : r.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {r.status === "paid_out" ? "paid out" : r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!earnings || earnings.referrals.length === 0) && (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
            <Gift size={28} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 font-medium">
              No referral earnings yet
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Share your code to start earning!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
