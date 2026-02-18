/**
 * Transaction History Component
 * Displays user's transaction history with filtering and export
 */

import React, { useState, useEffect } from "react";
import { getAuthToken } from "../services/backendApi";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  type: "charge" | "refund" | "adjustment";
  description: string;
  metadata?: any;
}

interface TransactionHistoryProps {
  onTransactionClick?: (transaction: Transaction) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  onTransactionClick,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [summary, setSummary] = useState<{
    totalSpent: number;
    spentLast30Days: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [filter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        setTransactions([]);
        return;
      }
      const params = new URLSearchParams();
      
      if (filter.status) params.append("status", filter.status);
      if (filter.type) params.append("type", filter.type);
      if (filter.startDate) params.append("startDate", filter.startDate);
      if (filter.endDate) params.append("endDate", filter.endDate);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/transactions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setTransactions(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setSummary(null);
        return;
      }
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/transactions/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    }
  };

  const exportTransactions = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        return;
      }
      const params = new URLSearchParams();
      
      if (filter.status) params.append("status", filter.status);
      if (filter.type) params.append("type", filter.type);
      if (filter.startDate) params.append("startDate", filter.startDate);
      if (filter.endDate) params.append("endDate", filter.endDate);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/transactions/export?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export transactions:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "text-green-600 bg-green-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "failed":
        return "text-red-600 bg-red-50";
      case "canceled":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return "✓";
      case "pending":
        return "⏳";
      case "failed":
        return "✗";
      case "canceled":
        return "⊘";
      default:
        return "•";
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Summary Cards */}
      {summary && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Spent</p>
              <p className="text-2xl font-bold text-blue-900">
                {summary.currency} {summary.totalSpent.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600 font-medium">Last 30 Days</p>
              <p className="text-2xl font-bold text-green-900">
                {summary.currency} {summary.spentLast30Days.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-4">
          <select
            value={filter.status || ""}
            onChange={(e) =>
              setFilter({ ...filter, status: e.target.value || undefined })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>

          <select
            value={filter.type || ""}
            onChange={(e) =>
              setFilter({ ...filter, type: e.target.value || undefined })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="charge">Charges</option>
            <option value="refund">Refunds</option>
          </select>

          <button
            onClick={exportTransactions}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No transactions yet</p>
            <p className="text-sm">
              Your payment history will appear here once you make a purchase.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onTransactionClick?.(transaction)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {transaction.type === "refund" && "-"}
                    {transaction.currency} {transaction.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        transaction.status
                      )}`}
                    >
                      {getStatusIcon(transaction.status)} {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                    View Details →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

/**
 * Transaction Detail Modal
 */
interface TransactionDetailProps {
  transaction: Transaction;
  onClose: () => void;
}

export const TransactionDetail: React.FC<TransactionDetailProps> = ({
  transaction,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Transaction ID</p>
              <p className="font-mono text-sm">{transaction.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">
                {new Date(transaction.date).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-xl font-bold">
                {transaction.currency} {transaction.amount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{transaction.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium capitalize">{transaction.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Description</p>
              <p className="font-medium">{transaction.description}</p>
            </div>
          </div>

          {transaction.metadata && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Additional Information</p>
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(transaction.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
