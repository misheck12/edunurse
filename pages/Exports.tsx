import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  downloadExportFile,
  ExportJobListItem,
  listExportJobs,
} from "../src/services/backendApi";
import SEO from "../src/components/SEO";

const PAGE_SIZE = 20;

const Exports: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExportJobListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "queued" | "running" | "succeeded" | "failed">("all");
  const [format, setFormat] = useState<"all" | "pdf" | "docx" | "pptx">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listExportJobs({
        page,
        pageSize: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        format: format === "all" ? undefined : format,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, status, format]);

  useEffect(() => {
    const hasPending = items.some(
      (item) => item.status === "queued" || item.status === "running",
    );
    if (!hasPending) return;

    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const title = item.document?.title?.toLowerCase() ?? "";
      const topic = item.document?.topic?.toLowerCase() ?? "";
      const type = item.document?.documentType?.toLowerCase() ?? "";
      return (
        title.includes(term) ||
        topic.includes(term) ||
        type.includes(term) ||
        item.format.includes(term) ||
        item.status.includes(term)
      );
    });
  }, [items, search]);

  const handleDownload = async (item: ExportJobListItem) => {
    setDownloadingId(item.id);
    setError(null);
    try {
      await downloadExportFile(item.id, item.format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download file.");
    } finally {
      setDownloadingId(null);
    }
  };

  const statusClass = (value: ExportJobListItem["status"]) => {
    if (value === "succeeded") return "bg-emerald-100 text-emerald-700";
    if (value === "failed") return "bg-red-100 text-red-700";
    if (value === "running") return "bg-blue-100 text-blue-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-10">
      <SEO
        title="Exported Files"
        description="Download your exported lesson plans and documents in DOCX, PDF, and PPTX formats."
        canonicalPath="/exports"
        noIndex
      />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Exported Files</h1>
          <p className="mt-1 text-sm text-slate-500">
            Find generated DOCX, PDF, and PPTX files and download anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by document title/topic/type..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as typeof status);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={format}
            onChange={(event) => {
              setPage(1);
              setFormat(event.target.value as typeof format);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All Formats</option>
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
            <option value="pptx">PPTX</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Loading export history...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    No export files found.
                  </td>
                </tr>
              )}

              {!loading &&
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {item.document?.title ?? "Untitled document"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.document?.topic ?? "No topic"} | {item.document?.documentType ?? "Unknown type"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 uppercase">
                        <FileDown size={12} />
                        {item.format}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                      {item.errorMessage && (
                        <p className="mt-1 max-w-xs truncate text-[11px] text-red-600" title={item.errorMessage}>
                          {item.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.completedAt ? new Date(item.completedAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {item.document?.id && (
                          <button
                            type="button"
                            onClick={() => navigate(`/editor/${item.document!.id}`)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <span className="inline-flex items-center gap-1">
                              <ExternalLink size={12} />
                              Open Doc
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={item.status !== "succeeded" || downloadingId === item.id}
                          onClick={() => void handleDownload(item)}
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="inline-flex items-center gap-1">
                            {downloadingId === item.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                            Download
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} exports
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || loading}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={loading || page * PAGE_SIZE >= total}
              className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exports;

