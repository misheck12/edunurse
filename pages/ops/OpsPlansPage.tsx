import React, { useEffect, useState } from "react";
import {
  AdminPlan,
  createAdminPlan,
  listAdminPlans,
  updateAdminPlan,
} from "../../src/services/backendApi";

const OpsPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newGenerationLimit, setNewGenerationLimit] = useState("");
  const [newExportLimit, setNewExportLimit] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editGenerationLimit, setEditGenerationLimit] = useState("");
  const [editExportLimit, setEditExportLimit] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminPlans();
      setPlans(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setNotice(null);
    setError(null);
    try {
      if (!newCode.trim() || !newName.trim()) {
        throw new Error("Code and name are required.");
      }

      const priceCents = parseInt(newPrice) || 0;
      const generationLimit = newGenerationLimit.trim() === "" || newGenerationLimit === "unlimited" 
        ? "unlimited" 
        : parseInt(newGenerationLimit);
      const exportLimit = newExportLimit.trim() === "" || newExportLimit === "unlimited"
        ? "unlimited"
        : parseInt(newExportLimit);

      await createAdminPlan({
        code: newCode.trim(),
        name: newName.trim(),
        monthlyPriceCents: priceCents,
        limitsJson: {
          generations: generationLimit,
          exports: exportLimit,
        },
      });

      setNewCode("");
      setNewName("");
      setNewPrice("");
      setNewGenerationLimit("");
      setNewExportLimit("");
      setNotice("Plan created successfully.");
      await loadPlans();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create plan.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setEditCode(plan.code);
    setEditName(plan.name);
    setEditPrice((plan.monthlyPriceCents / 100).toString());
    
    const limits = plan.limitsJson as { generations?: number | "unlimited"; exports?: number | "unlimited" };
    setEditGenerationLimit(
      limits.generations === "unlimited" ? "unlimited" : (limits.generations?.toString() || "")
    );
    setEditExportLimit(
      limits.exports === "unlimited" ? "unlimited" : (limits.exports?.toString() || "")
    );
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setEditCode("");
    setEditName("");
    setEditPrice("");
    setEditGenerationLimit("");
    setEditExportLimit("");
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;

    setUpdating(true);
    setNotice(null);
    setError(null);
    try {
      const priceCents = parseInt(editPrice) * 100 || 0;
      const generationLimit = editGenerationLimit.trim() === "" || editGenerationLimit === "unlimited"
        ? "unlimited"
        : parseInt(editGenerationLimit);
      const exportLimit = editExportLimit.trim() === "" || editExportLimit === "unlimited"
        ? "unlimited"
        : parseInt(editExportLimit);

      await updateAdminPlan(editingPlan.id, {
        code: editCode.trim(),
        name: editName.trim(),
        monthlyPriceCents: priceCents,
        limitsJson: {
          generations: generationLimit,
          exports: exportLimit,
        },
      });

      setNotice("Plan updated successfully.");
      cancelEdit();
      await loadPlans();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update plan.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage subscription plans and pricing.
        </p>
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

      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Create Plan</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Plan Code
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(event) => setNewCode(event.target.value)}
              placeholder="e.g., BASIC_MONTHLY"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Plan Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g., Basic Plan"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Monthly Price (ZMW)
            </label>
            <input
              type="number"
              value={newPrice}
              onChange={(event) => setNewPrice(event.target.value)}
              placeholder="e.g., 50"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Generation Limit
            </label>
            <input
              type="text"
              value={newGenerationLimit}
              onChange={(event) => setNewGenerationLimit(event.target.value)}
              placeholder="e.g., 50 or unlimited"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Export Limit
            </label>
            <input
              type="text"
              value={newExportLimit}
              onChange={(event) => setNewExportLimit(event.target.value)}
              placeholder="e.g., 50 or unlimited"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "Creating..." : "Create Plan"}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Plan List</h2>
          <button
            onClick={() => void loadPlans()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        <div className="p-5">
          {loading && <div className="text-sm text-slate-500">Loading plans...</div>}
          {!loading && plans.length === 0 && (
            <div className="text-sm text-slate-500">No plans found.</div>
          )}
          {plans.length > 0 && (
            <div className="space-y-3">
              {plans.map((plan) => {
                const limits = plan.limitsJson as { generations?: number | "unlimited"; exports?: number | "unlimited" };
                const isEditing = editingPlan?.id === plan.id;

                return (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Code
                            </label>
                            <input
                              type="text"
                              value={editCode}
                              onChange={(event) => setEditCode(event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Price (ZMW)
                            </label>
                            <input
                              type="number"
                              value={editPrice}
                              onChange={(event) => setEditPrice(event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Generations
                            </label>
                            <input
                              type="text"
                              value={editGenerationLimit}
                              onChange={(event) => setEditGenerationLimit(event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Exports
                            </label>
                            <input
                              type="text"
                              value={editExportLimit}
                              onChange={(event) => setEditExportLimit(event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleUpdate()}
                            disabled={updating}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {updating ? "Saving..." : "Save Changes"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-base font-semibold text-slate-900">
                              {plan.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Code: {plan.code}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-slate-900">
                              K{(plan.monthlyPriceCents / 100).toFixed(2)}
                            </div>
                            <div className="text-xs text-slate-500">per month</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-xs text-slate-500">Generations</div>
                            <div className="text-sm font-medium text-slate-900">
                              {limits.generations === "unlimited"
                                ? "Unlimited"
                                : limits.generations || "0"}
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-xs text-slate-500">Exports</div>
                            <div className="text-sm font-medium text-slate-900">
                              {limits.exports === "unlimited"
                                ? "Unlimited"
                                : limits.exports || "0"}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => startEdit(plan)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Edit Plan
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OpsPlansPage;
