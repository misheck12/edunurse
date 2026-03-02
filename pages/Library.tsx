import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Calendar,
  LayoutGrid,
  List,
  FileText,
  ClipboardList,
  MoreHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BackendDocumentType,
  DocumentListItem,
  listDocuments,
} from "../src/services/backendApi";
import { UpgradeBanner } from "../src/components/UpgradeBanner";
import { PaymentModal } from "../src/components/PaymentModal";
import SEO from "../src/components/SEO";

const PAGE_SIZE = 20;

const TYPE_OPTIONS: Array<"All Types" | BackendDocumentType> = [
  "All Types",
  "Lesson Plan",
  "OSCE Station",
  "Clinical Plan",
  "Assessment Tool",
  "Scheme of Work",
];

const Library: React.FC = () => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"All Types" | BackendDocumentType>(
    "All Types",
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listDocuments({
          page,
          pageSize: PAGE_SIZE,
          documentType: typeFilter === "All Types" ? undefined : typeFilter,
        });

        if (!mounted) return;
        setDocs(response.items);
        setTotal(response.total);
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load library.";
        setError(message);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [page, typeFilter]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;

    return docs.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.topic.toLowerCase().includes(q) ||
        doc.programme.toLowerCase().includes(q) ||
        doc.documentType.toLowerCase().includes(q)
      );
    });
  }, [docs, search]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "final":
        return "bg-emerald-500";
      default:
        return "bg-amber-500";
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const handleOpen = (documentId: string) => {
    navigate(`/editor/${documentId}`);
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <SEO
        title="My Documents"
        description="Browse and manage your lesson plans, OSCE stations, clinical teaching plans, and assessment documents."
        canonicalPath="/library"
        noIndex
      />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          My Documents Library
        </h1>
        <p className="text-slate-500">
          Manage and organize your lesson plans and OSCE stations.
        </p>
      </div>

      {/* Upgrade Banner */}
      <UpgradeBanner
        onUpgradeClick={() => setShowPaymentModal(true)}
        variant="library"
        dismissible={false}
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(
                  e.target.value as "All Types" | BackendDocumentType,
                );
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <Calendar size={16} /> Date Range
            </button>
            <div className="hidden border-l border-slate-200 lg:mx-2 lg:block"></div>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button className="p-1.5 bg-white rounded shadow-sm text-blue-600">
                <List size={18} />
              </button>
              <button className="p-1.5 text-slate-500 hover:text-slate-700">
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4 w-12">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Programme</th>
              <th className="px-6 py-4">Last Edited</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={7}>
                  Loading documents...
                </td>
              </tr>
            )}

            {!isLoading && filteredDocs.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-500" colSpan={7}>
                  No documents found.
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded ${
                          doc.documentType === "Lesson Plan"
                            ? "bg-blue-50 text-blue-600"
                            : doc.documentType === "Assessment Tool"
                              ? "bg-purple-50 text-purple-600"
                              : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {doc.documentType === "Lesson Plan" ? (
                          <FileText size={18} />
                        ) : (
                          <ClipboardList size={18} />
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => handleOpen(doc.id)}
                          className="font-medium text-slate-900 hover:text-blue-700 text-left"
                        >
                          {doc.title}
                        </button>
                        <p className="text-xs text-slate-500">
                          Topic: {doc.topic}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        doc.documentType === "Lesson Plan"
                          ? "bg-blue-100 text-blue-800"
                          : doc.documentType === "Assessment Tool"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {doc.documentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {doc.programme}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDate(doc.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(doc.status)}`}
                      ></div>
                      <span className="text-xs text-slate-500 capitalize">
                        {doc.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleOpen(doc.id)}
                        className="text-xs px-2.5 py-1.5 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Open
                      </button>
                      <button className="text-slate-400 hover:text-slate-600">
                        <MoreHorizontal size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, total)} of {total} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 text-sm disabled:opacity-60"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading || page * PAGE_SIZE >= total}
              className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-50 text-sm disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Library;
