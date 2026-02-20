import React, { useEffect, useState } from "react";
import {
  AdminUserListItem,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "../../src/services/backendApi";

const OpsUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"educator" | "admin">("educator");
  const [creating, setCreating] = useState(false);

  const loadUsers = async (searchValue?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminUsers({
        page: 1,
        pageSize: 100,
        search: searchValue?.trim() || undefined,
      });
      setUsers(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setNotice(null);
    setError(null);
    try {
      if (!newEmail.trim()) {
        throw new Error("Email is required.");
      }
      await createAdminUser({
        email: newEmail.trim(),
        fullName: newFullName.trim() || undefined,
        role: newRole,
        isActive: true,
      });
      setNewEmail("");
      setNewFullName("");
      setNewRole("educator");
      setNotice("User created.");
      await loadUsers(search);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const toggleRole = async (user: AdminUserListItem) => {
    setNotice(null);
    setError(null);
    try {
      const nextRole = user.role === "admin" ? "educator" : "admin";
      await updateAdminUser(user.id, { role: nextRole });
      setNotice(`${user.email} updated to ${nextRole}.`);
      await loadUsers(search);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update role.");
    }
  };

  const toggleActive = async (user: AdminUserListItem) => {
    setNotice(null);
    setError(null);
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      setNotice(`${user.email} ${user.isActive ? "deactivated" : "activated"}.`);
      await loadUsers(search);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update status.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Manage educator and admin accounts.</p>
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
        <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="user@edunurse.local"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newFullName}
            onChange={(event) => setNewFullName(event.target.value)}
            placeholder="Full name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as "educator" | "admin")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="educator">educator</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create User"}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Directory</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => void loadUsers(search)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Search
            </button>
          </div>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-slate-500">Loading users...</div>}
          {!loading && users.length === 0 && (
            <div className="text-sm text-slate-500">No users found.</div>
          )}
          {users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{user.fullName ?? "Unnamed User"}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{user.role}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {user.subscriptions?.[0]?.plan?.name ?? "n/a"}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => void toggleRole(user)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Make {user.role === "admin" ? "Educator" : "Admin"}
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => void toggleActive(user)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => void toggleActive(user)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OpsUsersPage;
