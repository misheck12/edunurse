import React, { useEffect, useState } from "react";
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  listEmailCampaigns,
  createEmailCampaign,
  updateEmailCampaign,
  sendEmailCampaign,
  previewEmailCampaign,
  deleteEmailCampaign,
  getMarketingStats,
  type EmailTemplateItem,
  type EmailCampaignItem,
  type MarketingStats,
} from "../../src/services/backendApi";
import {
  Mail,
  FileText,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Send,
  Eye,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type TabState = "dashboard" | "templates" | "campaigns";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

/* ================================================================== */
/* OpsMarketingPage                                                   */
/* ================================================================== */

const OpsMarketingPage: React.FC = () => {
  const [tab, setTab] = useState<TabState>("dashboard");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearNotices = () => {
    setNotice(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* banner notices */}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check size={16} /> {notice}
          <button onClick={() => setNotice(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* header */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">
          <Mail size={24} className="mr-2 inline text-blue-600" />
          Email Marketing
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Create email templates, build campaigns, and reach your users.
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {([
          { key: "dashboard" as const, icon: <BarChart3 size={15} />, label: "Dashboard" },
          { key: "templates" as const, icon: <FileText size={15} />, label: "Templates" },
          { key: "campaigns" as const, icon: <Megaphone size={15} />, label: "Campaigns" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              clearNotices();
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* tab content */}
      {tab === "dashboard" && <DashboardPanel />}
      {tab === "templates" && (
        <TemplatesPanel
          onSuccess={(msg) => setNotice(msg)}
          onError={(msg) => setError(msg)}
        />
      )}
      {tab === "campaigns" && (
        <CampaignsPanel
          onSuccess={(msg) => setNotice(msg)}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
};

/* ================================================================== */
/* Dashboard Panel                                                     */
/* ================================================================== */

function DashboardPanel() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setStats(await getMarketingStats());
      } catch { /* best effort */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="mr-2 animate-spin" /> Loading…
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Total Campaigns", value: stats.totalCampaigns, icon: <Megaphone size={20} />, color: "text-blue-600 bg-blue-50" },
    { label: "Sent Campaigns", value: stats.sentCampaigns, icon: <CheckCircle2 size={20} />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Email Templates", value: stats.totalTemplates, icon: <FileText size={20} />, color: "text-violet-600 bg-violet-50" },
    { label: "Emails Delivered", value: stats.totalEmailsSent, icon: <Mail size={20} />, color: "text-cyan-600 bg-cyan-50" },
    { label: "Emails Failed", value: stats.totalEmailsFailed, icon: <AlertTriangle size={20} />, color: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <div className={`mx-auto mb-2 inline-flex rounded-full p-2 ${c.color}`}>{c.icon}</div>
          <div className="text-2xl font-bold text-slate-900">{c.value.toLocaleString()}</div>
          <div className="mt-0.5 text-xs text-slate-500">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Templates Panel                                                     */
/* ================================================================== */

function TemplatesPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailTemplateItem | null>(null);

  const load = async (p?: number) => {
    setLoading(true);
    try {
      const res = await listEmailTemplates({ page: p ?? page, pageSize: 25 });
      setTemplates(res.items);
      setTotal(res.total);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { void load(1); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteEmailTemplate(id);
      onSuccess("Template deleted.");
      void load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-3">
      {showForm || editing ? (
        <TemplateForm
          template={editing}
          onSaved={(msg) => {
            onSuccess(msg);
            setShowForm(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onError={onError}
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm text-slate-500">{total} templates</span>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} /> New Template
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading && templates.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="mr-2 animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                No email templates yet. Create one to get started.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="hidden px-4 py-3 md:table-cell">Category</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">{t.subject}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{t.category}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(t.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setEditing(t)} className="p-1 text-slate-400 hover:text-blue-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => void handleDelete(t.id)} className="ml-1 p-1 text-slate-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {total > 25 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <button
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); void load(p); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 25)}</span>
                <button
                  disabled={page * 25 >= total}
                  onClick={() => { const p = page + 1; setPage(p); void load(p); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Template Form (create / edit)                                       */
/* ================================================================== */

function TemplateForm({
  template,
  onSaved,
  onCancel,
  onError,
}: {
  template: EmailTemplateItem | null;
  onSaved: (msg: string) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody ?? "");
  const [category, setCategory] = useState(template?.category ?? "marketing");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      onError("Name, subject, and body are all required.");
      return;
    }
    setSaving(true);
    try {
      if (template) {
        await updateEmailTemplate(template.id, { name, subject, htmlBody, category });
        onSaved("Template updated.");
      } else {
        await createEmailTemplate({ name, subject, htmlBody, category: category as any });
        onSaved("Template created.");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed.");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{template ? "Edit" : "New"} Email Template</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Template Name</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Welcome Series — Day 1"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Subject Line</label>
          <input
            type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
          <select
            value={category} onChange={(e) => setCategory(e.target.value as "marketing" | "transactional" | "onboarding")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="marketing">Marketing</option>
            <option value="transactional">Transactional</option>
            <option value="onboarding">Onboarding</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">HTML Body</label>
        <p className="mb-1 text-[10px] text-slate-400">
          Use {"{{name}}"} for the user's name, {"{{email}}"} for their email.
        </p>
        <textarea
          value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)}
          rows={12}
          placeholder="<p>Hi {{name}},</p>&#10;<p>We have exciting news…</p>"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white">
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Saving…" : "Save Template"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Campaigns Panel                                                     */
/* ================================================================== */

function CampaignsPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<EmailCampaignItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmailCampaignItem | null>(null);

  const load = async (p?: number) => {
    setLoading(true);
    try {
      const res = await listEmailCampaigns({ page: p ?? page, pageSize: 25 });
      setCampaigns(res.items);
      setTotal(res.total);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { void load(1); }, []);

  const handleSend = async (id: string) => {
    if (!confirm("Send this campaign to all matching recipients? This cannot be undone.")) return;
    try {
      const result = await sendEmailCampaign(id);
      onSuccess(`Campaign sent: ${result.sent} delivered, ${result.failed} failed (${result.total} total).`);
      void load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Send failed.");
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const preview = await previewEmailCampaign(id);
      alert(`Audience size: ${preview.audienceCount} users\nSubject: ${preview.subject}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Preview failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await deleteEmailCampaign(id);
      onSuccess("Campaign deleted.");
      void load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-3">
      {showForm || editing ? (
        <CampaignForm
          campaign={editing}
          onSaved={(msg) => {
            onSuccess(msg);
            setShowForm(false);
            setEditing(null);
            void load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onError={onError}
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm text-slate-500">{total} campaigns</span>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} /> New Campaign
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading && campaigns.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="mr-2 animate-spin" /> Loading…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                No campaigns yet. Create one to start reaching your users.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="hidden px-4 py-3 md:table-cell">Recipients</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Sent / Failed</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.name}</div>
                        <div className="max-w-xs truncate text-[11px] text-slate-400">{c.subject}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell text-slate-600">{c.totalRecipients || "—"}</td>
                      <td className="hidden px-4 py-3 lg:table-cell text-xs text-slate-500">
                        {c.totalSent > 0 ? (
                          <span>
                            <span className="text-emerald-600">{c.totalSent}</span>
                            {c.totalFailed > 0 && (
                              <> / <span className="text-red-500">{c.totalFailed}</span></>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {c.sentAt ? formatDate(c.sentAt) : formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {(c.status === "draft" || c.status === "scheduled") && (
                          <>
                            <button onClick={() => void handlePreview(c.id)} className="p-1 text-slate-400 hover:text-blue-600" title="Preview audience">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => setEditing(c)} className="p-1 text-slate-400 hover:text-blue-600" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => void handleSend(c.id)} className="p-1 text-slate-400 hover:text-emerald-600" title="Send now">
                              <Send size={14} />
                            </button>
                            <button onClick={() => void handleDelete(c.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {c.status === "sent" && (
                          <span className="text-xs text-slate-400">Delivered</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {total > 25 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <button
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); void load(p); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 25)}</span>
                <button
                  disabled={page * 25 >= total}
                  onClick={() => { const p = page + 1; setPage(p); void load(p); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Campaign Form (create / edit)                                       */
/* ================================================================== */

function CampaignForm({
  campaign,
  onSaved,
  onCancel,
  onError,
}: {
  campaign: EmailCampaignItem | null;
  onSaved: (msg: string) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [htmlBody, setHtmlBody] = useState(campaign?.htmlBody ?? "");
  const af = (campaign?.audienceFilter ?? {}) as Record<string, string | undefined>;
  const [filterRole, setFilterRole] = useState(af.role ?? "all");
  const [filterTier, setFilterTier] = useState(af.planTier ?? "all");
  const [saving, setSaving] = useState(false);

  // Load templates for quick-fill
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  useEffect(() => {
    listEmailTemplates({ pageSize: 100 }).then((r) => setTemplates(r.items)).catch(() => {});
  }, []);

  const applyTemplate = (tpl: EmailTemplateItem) => {
    setSubject(tpl.subject);
    setHtmlBody(tpl.htmlBody);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      onError("Name, subject, and body are all required.");
      return;
    }
    setSaving(true);
    const audienceFilter: Record<string, string> = {};
    if (filterRole !== "all") audienceFilter.role = filterRole;
    if (filterTier !== "all") audienceFilter.planTier = filterTier;

    try {
      if (campaign) {
        await updateEmailCampaign(campaign.id, { name, subject, htmlBody, audienceFilter });
        onSaved("Campaign updated.");
      } else {
        await createEmailCampaign({ name, subject, htmlBody, audienceFilter });
        onSaved("Campaign created as draft.");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed.");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{campaign ? "Edit" : "New"} Campaign</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      {/* Quick template selector */}
      {templates.length > 0 && !campaign && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Start from Template</label>
          <select
            defaultValue=""
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) applyTemplate(tpl);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Select a template (optional) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Campaign Name</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. January Newsletter"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Subject Line</label>
        <input
          type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {/* Audience filters */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <Users size={13} /> Audience Targeting
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Role</label>
            <select
              value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All users</option>
              <option value="student">Students</option>
              <option value="educator">Educators</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Plan Tier</label>
            <select
              value={filterTier} onChange={(e) => setFilterTier(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All tiers</option>
              <option value="free">Free users</option>
              <option value="pro">Pro (Monthly Sub)</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">HTML Body</label>
        <p className="mb-1 text-[10px] text-slate-400">
          Use {"{{name}}"} and {"{{email}}"} as placeholders.
        </p>
        <textarea
          value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)}
          rows={10}
          placeholder="<p>Hi {{name}},</p>&#10;<p>We have something special for you…</p>"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white">
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Saving…" : campaign ? "Update Campaign" : "Create Draft"}
        </button>
      </div>
    </div>
  );
}

export default OpsMarketingPage;
