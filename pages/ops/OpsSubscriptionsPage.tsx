import React, { useEffect, useState } from "react";
import {
  AdminPlan,
  AdminSubscription,
  AdminUserListItem,
  createAdminSubscription,
  listAdminPlans,
  listAdminSubscriptions,
  listAdminUsers,
  updateAdminSubscription,
} from "../../src/services/backendApi";

const OpsSubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newPlanId, setNewPlanId] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subscriptionResponse, userResponse, planResponse] = await Promise.all([
        listAdminSubscriptions({ page: 1, pageSize: 100 }),
        listAdminUsers({ page: 1, pageSize: 100 }),
        listAdminPlans(),
      ]);
      setSubscriptions(subscriptionResponse.items);
      setUsers(userResponse.items);
      setPlans(planResponse);

      if (!newUserId && userResponse.items.length > 0) {
        setNewUserId(userResponse.items[0].id);
      }
      if (!newPlanId && planResponse.length > 0) {
        setNewPlanId(planResponse[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load subscriptions.");
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
      if (!newUserId || !newPlanId) {
        throw new Error("Select user and plan.");
      }
      await createAdminSubscription({
        userId: newUserId,
        planId: newPlanId,
        status: "active",
      });
      setNotice("Subscription created.");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Failed to create subscription.",
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleCancelAtPeriodEnd = async (subscription: AdminSubscription) => {
    setError(null);
    setNotice(null);
    try {
      await updateAdminSubscription(subscription.id, {
        cancelAtPeriodEnd: !subscription.cancelAtPeriodEnd,
      });
      setNotice(`Subscription ${subscription.id.slice(0, 8)} updated.`);
      await loadData();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update subscription.",
      );
    }
  };

  const updateSubscriptionStatus = async (
    subscription: AdminSubscription,
    newStatus: "active" | "canceled"
  ) => {
    setError(null);
    setNotice(null);
    try {
      await updateAdminSubscription(subscription.id, {
        status: newStatus,
      });
      setNotice(
        `Subscription ${newStatus === "active" ? "activated" : "deactivated"} for ${subscription.user?.email ?? subscription.userId}`
      );
      await loadData();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Failed to update subscription status.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">Manage user plans and lifecycle states.</p>
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
        <h2 className="text-lg font-semibold text-slate-900">Create Subscription</h2>
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
          <select
            value={newPlanId}
            onChange={(event) => setNewPlanId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Select plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.code})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create Subscription"}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Subscription List</h2>
          <button
            onClick={() => void loadData()}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-slate-500">Loading subscriptions...</div>}
          {!loading && subscriptions.length === 0 && (
            <div className="text-sm text-slate-500">No subscriptions found.</div>
          )}
          {subscriptions.length > 0 && (
            <div className="space-y-2">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-lg border border-slate-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-sm font-medium text-slate-800 truncate">
                          {subscription.user?.email ?? subscription.userId}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            subscription.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : subscription.status === "canceled"
                              ? "bg-red-100 text-red-700"
                              : subscription.status === "trialing"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {subscription.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mb-2">
                        Plan: {subscription.plan?.name ?? subscription.planId}
                      </div>
                      <div className="text-xs text-slate-500">
                        Cancel at period end: {subscription.cancelAtPeriodEnd ? "Yes" : "No"}
                      </div>
                      {subscription.currentPeriodStart && (
                        <div className="text-xs text-slate-500 mt-1">
                          Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} -{" "}
                          {subscription.currentPeriodEnd
                            ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                            : "N/A"}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {subscription.status === "active" ? (
                        <button
                          onClick={() => void updateSubscriptionStatus(subscription, "canceled")}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => void updateSubscriptionStatus(subscription, "active")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => void toggleCancelAtPeriodEnd(subscription)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 whitespace-nowrap"
                      >
                        Toggle Auto-Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OpsSubscriptionsPage;
