import React, { useEffect, useState } from "react";
import {
  sendAdminNotification,
  broadcastAdminNotification,
  getNotificationLogs,
  getNotificationStats,
  retryFailedNotification,
  type NotificationChannel,
  type NotificationLogItem,
  type NotificationStats,
} from "../../src/services/backendApi";
import {
  Mail,
  MessageSquare,
  Phone,
  Send,
  Users,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Megaphone,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type TabState = "compose" | "broadcast" | "logs";

const CHANNEL_META: Record<
  NotificationChannel,
  { label: string; icon: React.ReactNode; color: string; placeholder: string }
> = {
  email: {
    label: "Email",
    icon: <Mail size={16} />,
    color: "bg-blue-100 text-blue-700",
    placeholder: "user@example.com",
  },
  sms: {
    label: "SMS",
    icon: <Phone size={16} />,
    color: "bg-emerald-100 text-emerald-700",
    placeholder: "+260XXXXXXXXX",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: <MessageSquare size={16} />,
    color: "bg-green-100 text-green-700",
    placeholder: "+260XXXXXXXXX",
  },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/* ================================================================== */
/* OpsCommsPage                                                       */
/* ================================================================== */

const OpsCommsPage: React.FC = () => {
  const [tab, setTab] = useState<TabState>("compose");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* stats */
  const [stats, setStats] = useState<NotificationStats | null>(null);

  const loadStats = async () => {
    try {
      setStats(await getNotificationStats());
    } catch {
      /* best effort */
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const clearNotices = () => {
    setNotice(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* banner notices */}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Check size={16} /> {notice}
          <button onClick={() => setNotice(null)} className="ml-auto text-blue-400 hover:text-blue-600">
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

      {/* header + stats */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Send emails, SMS &amp; WhatsApp messages to users.
        </p>
        {stats && (
          <div className="mt-3 flex flex-wrap gap-3">
            <StatBadge icon={<Mail size={14} />} label="Emails sent" value={stats.emailSent} color="bg-blue-50 text-blue-700" />
            <StatBadge icon={<Phone size={14} />} label="SMS sent" value={stats.smsSent} color="bg-emerald-50 text-emerald-700" />
            <StatBadge icon={<MessageSquare size={14} />} label="WhatsApp sent" value={stats.whatsappSent} color="bg-green-50 text-green-700" />
            <StatBadge icon={<AlertTriangle size={14} />} label="Failed" value={stats.totalFailed} color="bg-red-50 text-red-600" />
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {([
          { key: "compose" as const, icon: <Send size={15} />, label: "Send Message" },
          { key: "broadcast" as const, icon: <Megaphone size={15} />, label: "Broadcast" },
          { key: "logs" as const, icon: <RefreshCw size={15} />, label: "Logs" },
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
      {tab === "compose" && (
        <ComposePanel
          onSuccess={(msg) => {
            setNotice(msg);
            void loadStats();
          }}
          onError={setError}
        />
      )}
      {tab === "broadcast" && (
        <BroadcastPanel
          onSuccess={(msg) => {
            setNotice(msg);
            void loadStats();
          }}
          onError={setError}
        />
      )}
      {tab === "logs" && <LogsPanel />}
    </div>
  );
};

/* ================================================================== */
/* StatBadge                                                          */
/* ================================================================== */

function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {icon} {value} {label}
    </span>
  );
}

/* ================================================================== */
/* Compose Panel — send to one recipient                              */
/* ================================================================== */

function ComposePanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [channel, setChannel] = useState<NotificationChannel>("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      if (!recipient.trim()) throw new Error("Recipient is required.");
      if (!body.trim()) throw new Error("Message body is required.");
      const result = await sendAdminNotification({
        channel,
        recipient: recipient.trim(),
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      if (result.success) {
        onSuccess(`${CHANNEL_META[channel].label} sent to ${recipient}`);
        setRecipient("");
        setSubject("");
        setBody("");
      } else {
        onError(result.error ?? "Send failed.");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const meta = CHANNEL_META[channel];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Send Message</h2>

      {/* channel selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Channel</label>
        <div className="flex gap-2">
          {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((ch) => {
            const m = CHANNEL_META[ch];
            return (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  channel === ch
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* recipient */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Recipient</label>
        <input
          type={channel === "email" ? "email" : "tel"}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={meta.placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* subject (email only) */}
      {channel === "email" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      {/* body */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Message {channel === "email" ? "(HTML supported)" : "(plain text)"}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "email" ? 8 : 4}
          placeholder={
            channel === "email"
              ? "<p>Hi there,</p>\n<p>We wanted to let you know…</p>"
              : "Hi! This is a message from EduNurse…"
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
        />
        {channel !== "email" && (
          <p className="mt-1 text-xs text-slate-400">
            SMS: max 160 chars per segment. WhatsApp: max 4096 chars.
            Current: {body.length} chars.
          </p>
        )}
      </div>

      <button
        onClick={() => void handleSend()}
        disabled={sending || !body.trim() || !recipient.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {sending ? "Sending…" : `Send via ${meta.label}`}
      </button>
    </div>
  );
}

/* ================================================================== */
/* Broadcast Panel — send to many users                               */
/* ================================================================== */

function BroadcastPanel({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [channel, setChannel] = useState<NotificationChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "student" | "educator" | "admin">("all");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleBroadcast = async () => {
    setSending(true);
    try {
      if (!body.trim()) throw new Error("Message body is required.");
      const result = await broadcastAdminNotification({
        channel,
        subject: subject.trim() || undefined,
        body: body.trim(),
        filterRole: filterRole === "all" ? undefined : filterRole,
      });
      onSuccess(
        `Broadcast complete: ${result.succeeded} sent, ${result.failed} failed (${result.total} total).`,
      );
      setBody("");
      setSubject("");
      setConfirm(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Broadcast failed.");
    } finally {
      setSending(false);
    }
  };

  const meta = CHANNEL_META[channel];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">
        <Megaphone size={20} className="mr-2 inline text-blue-600" />
        Broadcast Message
      </h2>
      <p className="text-sm text-slate-500">
        Send a message to all active users. SMS &amp; WhatsApp require users to have a phone number.
      </p>

      {/* channel */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-600">Channel</label>
        <div className="flex gap-2">
          {(Object.keys(CHANNEL_META) as NotificationChannel[]).map((ch) => {
            const m = CHANNEL_META[ch];
            return (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  channel === ch
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* audience filter */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Audience</label>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All active users</option>
          <option value="student">Students only</option>
          <option value="educator">Educators only</option>
          <option value="admin">Admins only</option>
        </select>
      </div>

      {/* subject */}
      {channel === "email" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Broadcast subject line"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* body */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Message {channel === "email" ? "(HTML supported)" : "(plain text)"}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "email" ? 8 : 4}
          placeholder="Write your broadcast message…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          disabled={!body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <Megaphone size={16} /> Prepare Broadcast
        </button>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="mb-3 text-sm font-medium text-amber-800">
            ⚠️ This will send a <strong>{meta.label}</strong> message to{" "}
            <strong>{filterRole === "all" ? "all active users" : `all ${filterRole}s`}</strong>.
            This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleBroadcast()}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? "Sending…" : "Confirm & Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Logs Panel — notification history                                  */
/* ================================================================== */

function LogsPanel() {
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<NotificationChannel | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "sent" | "failed">("all");

  const loadLogs = async (p?: number) => {
    setLoading(true);
    try {
      const res = await getNotificationLogs({
        page: p ?? page,
        pageSize: 25,
        channel: filterChannel === "all" ? undefined : filterChannel,
        status: filterStatus === "all" ? undefined : filterStatus,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch {
      /* best-effort */
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (logId: string) => {
    setRetrying(logId);
    try {
      const result = await retryFailedNotification(logId);
      if (result.success) {
        void loadLogs();
      }
    } catch { /* best-effort */ }
    setRetrying(null);
  };

  useEffect(() => {
    void loadLogs(1);
    setPage(1);
  }, [filterChannel, filterStatus]);

  return (
    <div className="space-y-3">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value as typeof filterChannel)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={() => void loadLogs()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
        <span className="ml-auto text-xs text-slate-500">{total} entries</span>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="mr-2 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No notifications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="hidden px-4 py-3 md:table-cell">Subject / Preview</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 lg:table-cell">User</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const meta = CHANNEL_META[log.channel];
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                        {log.recipient}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="max-w-xs truncate text-slate-600 text-xs">
                          {log.subject || log.body.replace(/<[^>]*>/g, "").slice(0, 80)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === "sent"
                              ? "bg-emerald-100 text-emerald-700"
                              : log.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.errorDetail && (
                          <div className="mt-0.5 max-w-xs truncate text-[10px] text-red-500">
                            {log.errorDetail}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell text-xs text-slate-500">
                        {log.user?.fullName || log.user?.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.status === "failed" && (
                          <button
                            onClick={() => void handleRetry(log.id)}
                            disabled={retrying === log.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            title="Retry this notification"
                          >
                            {retrying === log.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <button
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                void loadLogs(p);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {Math.ceil(total / 25)}
            </span>
            <button
              disabled={page * 25 >= total}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                void loadLogs(p);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OpsCommsPage;
