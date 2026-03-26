import React, { useEffect, useState, useCallback } from "react";
import {
  Gift,
  Users,
  Wallet,
  TrendingUp,
  Search,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Crown,
  ArrowUpDown,
} from "lucide-react";
import {
  AdminReferralItem,
  AdminReferralStats,
  ListAdminReferralsResponse,
  getAdminReferralStats,
  listAdminReferrals,
  updateAdminReferral,
} from "../../src/services/backendApi";

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  earned: "bg-green-100 text-green-800",
  paid_out: "bg-blue-100 text-blue-800",
};

const OpsReferralsPage: React.FC = () => {
  const [stats, setStats] = useState<AdminReferralStats | null>(null);
  const [referrals, setReferrals] = useState<AdminReferralItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pending" | "earned" | "paid_out" | ""
  >("");
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getAdminReferralStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load referral stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: ListAdminReferralsResponse = await listAdminReferrals({
        page,
        pageSize: PAGE_SIZE,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      setReferrals(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  const handleStatusChange = async (
    referral: AdminReferralItem,
    newStatus: "pending" | "earned" | "paid_out"
  ) => {
    setNotice(null);
    setError(null);
    try {
      await updateAdminReferral(referral.id, { status: newStatus });
      setNotice(
        `Referral ${referral.id.slice(0, 8)}… updated to "${newStatus.replace("_", " ")}".`
      );
      await Promise.all([loadStats(), loadReferrals()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update referral.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const kwacha = (cents: number) => `K${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Gift size={22} className="text-purple-600" />
              Referrals
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track the affiliate programme — referrals, commissions, and payouts.
            </p>
          </div>
          <button
            onClick={() => {
              void loadStats();
              void loadReferrals();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards */}
      {stats && !statsLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Referrals"
            value={String(stats.totalReferrals)}
            icon={<Gift size={18} className="text-purple-500" />}
            bg="bg-purple-50 border-purple-200"
          />
          <StatCard
            label="Referred Users"
            value={String(stats.totalReferredUsers)}
            icon={<Users size={18} className="text-blue-500" />}
            bg="bg-blue-50 border-blue-200"
          />
          <StatCard
            label="Total Commission"
            value={kwacha(stats.totalCommissionCents)}
            icon={<Wallet size={18} className="text-green-500" />}
            bg="bg-green-50 border-green-200"
          />
          <StatCard
            label="Pending Payout"
            value={kwacha(stats.pendingCommissionCents)}
            icon={<TrendingUp size={18} className="text-amber-500" />}
            bg="bg-amber-50 border-amber-200"
          />
        </div>
      )}

      {/* Status breakdown */}
      {stats && !statsLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-800">
              {stats.pendingCount}
            </p>
            <p className="text-xs text-yellow-600 font-medium">Pending</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-800">
              {stats.earnedCount}
            </p>
            <p className="text-xs text-green-600 font-medium">Earned</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-800">
              {stats.paidOutCount}
            </p>
            <p className="text-xs text-blue-600 font-medium">Paid Out</p>
          </div>
        </div>
      )}

      {/* Top Referrers */}
      {stats && stats.topReferrers.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <Crown size={18} className="text-amber-500" />
            Top Referrers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2 text-right">Referrals</th>
                  <th className="px-3 py-2 text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {stats.topReferrers.map((r, i) => (
                  <tr
                    key={r.userId}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-500">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">
                        {r.fullName || "—"}
                      </p>
                      <p className="text-xs text-slate-500">{r.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        {r.referralCode || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {r.referralCount}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-green-700">
                      {kwacha(r.totalEarnedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Referrals Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ArrowUpDown size={16} />
            All Referrals
            <span className="text-sm font-normal text-slate-500">
              ({total})
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search user…"
                className="rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 w-48"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 py-2 px-3 text-xs outline-none focus:border-blue-500"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="earned">Earned</option>
              <option value="paid_out">Paid Out</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No referrals found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Referrer</th>
                  <th className="px-3 py-2">Referred</th>
                  <th className="px-3 py-2 text-right">Payment</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800 truncate max-w-[160px]">
                        {r.referrer.fullName || "—"}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">
                        {r.referrer.email}
                      </p>
                      {r.referrer.referralCode && (
                        <span className="font-mono text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                          {r.referrer.referralCode}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-800 truncate max-w-[160px]">
                        {r.referred.fullName || "—"}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">
                        {r.referred.email}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {r.transaction ? (
                        <>
                          <p className="font-medium">
                            {r.transaction.currency}{" "}
                            {(r.transaction.amountCents / 100).toFixed(2)}
                          </p>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              r.transaction.status === "succeeded"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {r.transaction.status}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">
                      {kwacha(r.commissionCents)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          STATUS_STYLES[r.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.status === "paid_out" ? "paid out" : r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          handleStatusChange(r, e.target.value as any)
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="earned">Earned</option>
                        <option value="paid_out">Paid Out</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

/* ───── Stat card helper ───── */
const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}> = ({ label, value, icon, bg }) => (
  <div className={`rounded-xl border p-4 ${bg}`}>
    <div className="flex items-center gap-2 mb-1">{icon}</div>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs font-medium text-slate-600">{label}</p>
  </div>
);

export default OpsReferralsPage;
