import React, { useEffect, useState } from "react";
import {
  AdminTransaction,
  AdminUserListItem,
  createAdminTransaction,
  listAdminTransactions,
  listAdminUsers,
  updateAdminTransaction,
} from "../../src/services/backendApi";

const OpsTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newProvider, setNewProvider] = useState("manual");
  const [newType, setNewType] = useState<"charge" | "refund" | "adjustment">("charge");
  const [newStatus, setNewStatus] = useState<
    "pending" | "succeeded" | "failed" | "canceled"
  >("pending");
  const [newAmountCents, setNewAmountCents] = useState(0);
  const [newCurrency, setNewCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transactionResponse, userResponse] = await Promise.all([
        listAdminTransactions({ page: 1, pageSize: 100 }),
        listAdminUsers({ page: 1, pageSize: 100 }),
      ]);
      setTransactions(transactionResponse.items);
      setUsers(userResponse.items);
      if (!newUserId && userResponse.items.length > 0) {
        setNewUserId(userResponse.items[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      if (!newUserId) {
        throw new Error("Select a user.");
      }
      await createAdminTransaction({
        userId: newUserId,
        provider: newProvider.trim() || "manual",
        transactionType: newType,
        status: newStatus,
        amountCents: newAmountCents,
        currency: newCurrency.toUpperCase(),
      });
      setNewAmountCents(0);
      setNotice("Transaction recorded.");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to record transaction.",
      );
    } finally {
      setCreating(false);
    }
  };

  const markSucceeded = async (transaction: AdminTransaction) => {
    setError(null);
    setNotice(null);
    try {
      await updateAdminTransaction(transaction.id, {
        status: "succeeded",
        processedAt: new Date().toISOString(),
        errorMessage: null,
      });
      setNotice(`Transaction ${transaction.id.slice(0, 8)} marked as succeeded.`);
      await loadData();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update transaction.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">Track billing transactions and outcomes.</p>
      </div>

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

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Record Transaction</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={newUserId}
            onChange={(event) => setNewUserId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newProvider}
            onChange={(event) => setNewProvider(event.target.value)}
            placeholder="provider"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={newType}
            onChange={(event) =>
              setNewType(event.target.value as "charge" | "refund" | "adjustment")
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="charge">charge</option>
            <option value="refund">refund</option>
            <option value="adjustment">adjustment</option>
          </select>
          <select
            value={newStatus}
            onChange={(event) =>
              setNewStatus(
                event.target.value as "pending" | "succeeded" | "failed" | "canceled",
              )
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="pending">pending</option>
            <option value="succeeded">succeeded</option>
            <option value="failed">failed</option>
            <option value="canceled">canceled</option>
          </select>
          <input
            type="number"
            value={newAmountCents}
            onChange={(event) => setNewAmountCents(Number(event.target.value) || 0)}
            placeholder="amount cents"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <input
          type="text"
          value={newCurrency}
          onChange={(event) => setNewCurrency(event.target.value)}
          placeholder="currency"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "Recording..." : "Record Transaction"}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
          <button
            onClick={() => void loadData()}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-slate-500">Loading transactions...</div>}
          {!loading && transactions.length === 0 && (
            <div className="text-sm text-slate-500">No transactions found.</div>
          )}
          {transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-800">
                      {transaction.user?.email ?? transaction.userId}
                    </div>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {transaction.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {transaction.transactionType} | {transaction.amountCents} {transaction.currency} |{" "}
                    {transaction.provider}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </div>
                  {transaction.status !== "succeeded" && (
                    <div className="mt-2">
                      <button
                        onClick={() => void markSucceeded(transaction)}
                        className="rounded border border-slate-300 px-2.5 py-1.5 text-xs hover:bg-slate-50"
                      >
                        Mark Succeeded
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OpsTransactionsPage;
