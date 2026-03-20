import React, { useEffect, useState } from "react";
import {
  AdminUserListItem,
  AdminPlan,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  resetUserPassword,
  listAdminPlans,
  createAdminSubscription,
  updateAdminSubscription,
} from "../../src/services/backendApi";
import {
  Key,
  Edit2,
  UserPlus,
  Search,
  ChevronLeft,
  Shield,
  ShieldOff,
  Crown,
  X,
  Check,
  Loader2,
  FileText,
  Download,
  CreditCard,
  Sparkles,
  AlertTriangle,
  Eye,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type ViewState =
  | { kind: "list" }
  | { kind: "detail"; user: AdminUserListItem }
  | { kind: "create" };

type ModalState =
  | null
  | { kind: "resetPassword"; user: AdminUserListItem }
  | { kind: "assignPlan"; user: AdminUserListItem }
  | { kind: "confirmDeactivate"; user: AdminUserListItem };

function planBadge(user: AdminUserListItem) {
  const sub = user.subscriptions?.[0];
  if (!sub?.plan) return { label: "No plan", color: "bg-slate-100 text-slate-600" };
  if (sub.status === "canceled")
    return { label: `${sub.plan.name} (canceled)`, color: "bg-red-100 text-red-700" };
  if (sub.status === "past_due")
    return { label: `${sub.plan.name} (past due)`, color: "bg-amber-100 text-amber-700" };
  return { label: sub.plan.name, color: "bg-blue-100 text-blue-700" };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 truncate">{label}</div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* OpsUsersPage                                                       */
/* ================================================================== */

const OpsUsersPage: React.FC = () => {
  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [modal, setModal] = useState<ModalState>(null);

  /* list state */
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "educator" | "admin">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  /* plans cache */
  const [plans, setPlans] = useState<AdminPlan[]>([]);

  /* notices */
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearNotices = () => {
    setNotice(null);
    setError(null);
  };

  /* ---- loaders ---- */
  const loadUsers = async (searchValue?: string, p?: number) => {
    setLoading(true);
    clearNotices();
    try {
      const res = await listAdminUsers({
        page: p ?? page,
        pageSize: 50,
        search: searchValue?.trim() || undefined,
        role: filterRole === "all" ? undefined : filterRole,
        isActive: filterActive === "all" ? undefined : filterActive === "active",
      });
      setUsers(res.items);
      setTotal(res.total);

      /* keep detail-view in sync */
      if (view.kind === "detail") {
        const fresh = res.items.find((u) => u.id === view.user.id);
        if (fresh) setView({ kind: "detail", user: fresh });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      setPlans(await listAdminPlans());
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadPlans();
  }, []);

  useEffect(() => {
    void loadUsers(search, 1);
    setPage(1);
  }, [filterRole, filterActive]);

  /* ================================================================ */
  /* LIST VIEW                                                        */
  /* ================================================================ */

  const renderList = () => (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total} user{total !== 1 ? "s" : ""} — manage accounts, plans &amp; access.
          </p>
        </div>
        <button
          onClick={() => setView({ kind: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus size={16} /> New User
        </button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadUsers(search)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          <option value="educator">Educator</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => void loadUsers(search)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="mr-2 animate-spin" /> Loading users…
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="hidden px-4 py-3 md:table-cell">Docs</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const pb = planBadge(user);
                  return (
                    <tr key={user.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {user.fullName ?? "—"}
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.role === "admin" && <Shield size={11} />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pb.color}`}
                        >
                          {pb.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                        {user._count?.documents ?? 0}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setView({ kind: "detail", user })}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          <Eye size={13} /> View <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <button
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                void loadUsers(search, p);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <button
              disabled={page * 50 >= total}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                void loadUsers(search, p);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ================================================================ */
  /* DETAIL VIEW                                                      */
  /* ================================================================ */

  const renderDetail = (user: AdminUserListItem) => {
    const pb = planBadge(user);
    const activeSub = user.subscriptions?.[0];

    return (
      <div className="space-y-4">
        {/* back */}
        <button
          onClick={() => {
            setView({ kind: "list" });
            void loadUsers(search);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ChevronLeft size={16} /> Back to users
        </button>

        {/* header card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-lg font-bold text-white">
                {(user.fullName ?? user.email)?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {user.fullName ?? "Unnamed User"}
                </h2>
                <p className="text-sm text-slate-500">{user.email}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {user.role === "admin" ? <Shield size={11} /> : null}
                    {user.role}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pb.color}`}
                  >
                    <Crown size={11} className="mr-1" /> {pb.label}
                  </span>
                </div>
              </div>
            </div>

            {/* action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setModal({ kind: "assignPlan", user })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Crown size={14} /> Assign Plan
              </button>
              <button
                onClick={() => setModal({ kind: "resetPassword", user })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"
              >
                <Key size={14} /> Reset Password
              </button>
              {user.isActive ? (
                <button
                  onClick={() => setModal({ kind: "confirmDeactivate", user })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                >
                  <ShieldOff size={14} /> Deactivate
                </button>
              ) : (
                <button
                  onClick={async () => {
                    clearNotices();
                    try {
                      await updateAdminUser(user.id, { isActive: true });
                      setNotice("User activated.");
                      await loadUsers(search);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Activation failed.");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <Check size={14} /> Activate
                </button>
              )}
            </div>
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<FileText size={18} />} label="Documents" value={user._count?.documents ?? 0} />
          <StatCard icon={<Sparkles size={18} />} label="Generations" value={user._count?.generationRuns ?? 0} />
          <StatCard icon={<Download size={18} />} label="Exports" value={user._count?.exportJobs ?? 0} />
          <StatCard icon={<CreditCard size={18} />} label="Transactions" value={user._count?.transactions ?? 0} />
        </div>

        {/* personal details */}
        <PersonalDetailsCard
          user={user}
          onSaved={() => void loadUsers(search)}
        />

        {/* subscription */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
            Current Subscription
          </h3>
          {activeSub ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Plan</div>
                <div className="font-medium text-slate-800">{activeSub.plan?.name ?? "Unknown"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Status</div>
                <div
                  className={`font-medium ${
                    activeSub.status === "active"
                      ? "text-emerald-600"
                      : activeSub.status === "canceled"
                        ? "text-red-600"
                        : "text-amber-600"
                  }`}
                >
                  {activeSub.status}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No subscription assigned.</p>
          )}
        </div>

        {/* role toggle */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
            Account Role
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700">
              Current: <strong>{user.role}</strong>
            </span>
            <button
              onClick={async () => {
                clearNotices();
                const next = user.role === "admin" ? "educator" : "admin";
                try {
                  await updateAdminUser(user.id, { role: next });
                  setNotice(`Role changed to ${next}.`);
                  await loadUsers(search);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Role update failed.");
                }
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              Switch to {user.role === "admin" ? "Educator" : "Admin"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /* CREATE VIEW                                                      */
  /* ================================================================ */

  const renderCreate = () => (
    <CreateUserForm
      onCancel={() => setView({ kind: "list" })}
      onCreated={async () => {
        await loadUsers(search);
        setView({ kind: "list" });
        setNotice("User created successfully.");
      }}
    />
  );

  /* ================================================================ */
  /* MODALS                                                           */
  /* ================================================================ */

  const renderModal = () => {
    if (!modal) return null;

    if (modal.kind === "resetPassword") {
      return (
        <ResetPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onDone={(msg) => {
            setNotice(msg);
            setModal(null);
          }}
          onError={setError}
        />
      );
    }

    if (modal.kind === "assignPlan") {
      return (
        <AssignPlanModal
          user={modal.user}
          plans={plans}
          onClose={() => setModal(null)}
          onDone={async (msg) => {
            setNotice(msg);
            setModal(null);
            await loadUsers(search);
          }}
          onError={setError}
        />
      );
    }

    if (modal.kind === "confirmDeactivate") {
      return (
        <ConfirmModal
          title="Deactivate User"
          message={`Are you sure you want to deactivate ${modal.user.email}? They will lose access to the platform.`}
          confirmLabel="Deactivate"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            clearNotices();
            try {
              await updateAdminUser(modal.user.id, { isActive: false });
              setNotice(`${modal.user.email} has been deactivated.`);
              setModal(null);
              await loadUsers(search);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Deactivation failed.");
              setModal(null);
            }
          }}
        />
      );
    }

    return null;
  };

  /* ================================================================ */
  /* RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-4">
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

      {view.kind === "list" && renderList()}
      {view.kind === "detail" && renderDetail(view.user)}
      {view.kind === "create" && renderCreate()}
      {renderModal()}
    </div>
  );
};

/* ================================================================== */
/* PersonalDetailsCard                                                */
/* ================================================================== */

function PersonalDetailsCard({
  user,
  onSaved,
}: {
  user: AdminUserListItem;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phoneNumber ?? "");
  const [nrc, setNrc] = useState(user.nrc ?? "");
  const [school, setSchool] = useState(user.school ?? "");
  const [studentNumber, setStudentNumber] = useState(user.studentNumber ?? "");
  const [information, setInformation] = useState(user.information ?? "");

  useEffect(() => {
    setFullName(user.fullName ?? "");
    setEmail(user.email);
    setPhone(user.phoneNumber ?? "");
    setNrc(user.nrc ?? "");
    setSchool(user.school ?? "");
    setStudentNumber(user.studentNumber ?? "");
    setInformation(user.information ?? "");
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await updateAdminUser(user.id, {
        fullName: fullName.trim() || null,
        email: email.trim(),
        phoneNumber: phone.trim() || null,
        nrc: nrc.trim() || null,
        school: school.trim() || null,
        studentNumber: studentNumber.trim() || null,
        information: information.trim() || null,
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: "Full Name", value: fullName, set: setFullName, type: "text" },
    { label: "Email", value: email, set: setEmail, type: "email" },
    { label: "Phone Number", value: phone, set: setPhone, type: "tel" },
    { label: "NRC", value: nrc, set: setNrc, type: "text" },
    { label: "School / Institution", value: school, set: setSchool, type: "text" },
    { label: "Student Number", value: studentNumber, set: setStudentNumber, type: "text" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Personal Details
        </h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Additional Information
            </label>
            <textarea
              value={information}
              onChange={(e) => setInformation(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            { label: "Full Name", value: user.fullName },
            { label: "Email", value: user.email },
            { label: "Phone Number", value: user.phoneNumber },
            { label: "NRC", value: user.nrc },
            { label: "School / Institution", value: user.school },
            { label: "Student Number", value: user.studentNumber },
            { label: "Additional Info", value: user.information },
            { label: "Joined", value: formatDate(user.createdAt) },
          ].map((f) => (
            <div key={f.label}>
              <div className="text-xs text-slate-500">{f.label}</div>
              <div className="text-sm font-medium text-slate-800">{f.value || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* CreateUserForm                                                     */
/* ================================================================== */

function CreateUserForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"educator" | "admin">("educator");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setErr(null);
    try {
      if (!email.trim()) throw new Error("Email is required.");
      await createAdminUser({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        role,
        isActive: true,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
      >
        <ChevronLeft size={16} /> Back
      </button>
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Create New User</h2>
        {err && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="educator">Educator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ResetPasswordModal                                                 */
/* ================================================================== */

function ResetPasswordModal({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUserListItem;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await resetUserPassword(user.id, pw);
      onDone(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Password reset failed.");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Reset Password</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Set a new password for <strong>{user.email}</strong>
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Min 8 characters"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          minLength={8}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || pw.length < 8}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* AssignPlanModal                                                    */
/* ================================================================== */

function AssignPlanModal({
  user,
  plans,
  onClose,
  onDone,
  onError,
}: {
  user: AdminUserListItem;
  plans: AdminPlan[];
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const activeSub = user.subscriptions?.[0];
  const [selectedPlanId, setSelectedPlanId] = useState(
    activeSub?.plan?.id ?? plans[0]?.id ?? "",
  );
  const [status, setStatus] = useState<"active" | "trialing" | "past_due" | "canceled">(
    "active",
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (!selectedPlanId) throw new Error("Select a plan.");
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);

      if (activeSub) {
        await updateAdminSubscription(activeSub.id, { planId: selectedPlanId, status });
      } else {
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        await createAdminSubscription({
          userId: user.id,
          planId: selectedPlanId,
          provider: "manual",
          status,
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: end.toISOString(),
        });
      }

      await onDone(
        `Plan "${selectedPlan?.name ?? "unknown"}" assigned to ${user.email}.`,
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Plan assignment failed.");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Assign Plan</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          {activeSub ? (
            <>
              Change plan for <strong>{user.email}</strong> (current:{" "}
              {activeSub.plan?.name ?? "unknown"})
            </>
          ) : (
            <>
              Assign a plan to <strong>{user.email}</strong>
            </>
          )}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {plans.length === 0 && <option value="">No plans available</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — K{(p.monthlyPriceCents / 100).toFixed(2)}/mo
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !selectedPlanId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Assigning…" : "Assign Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ConfirmModal                                                       */
/* ================================================================== */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-6 text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OpsUsersPage;
