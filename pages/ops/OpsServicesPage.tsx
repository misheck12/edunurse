import React, { useEffect, useState } from "react";
import {
  AdminServiceControlItem,
  listAdminServiceControls,
  updateAdminServiceControl,
} from "../../src/services/backendApi";

const OpsServicesPage: React.FC = () => {
  const [items, setItems] = useState<AdminServiceControlItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadServiceControls = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await listAdminServiceControls();
      setItems(payload.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load service controls.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServiceControls();
  }, []);

  const toggleService = async (item: AdminServiceControlItem) => {
    const nextEnabled = !item.enabled;
    let reason: string | null | undefined = item.reason ?? null;

    if (!nextEnabled) {
      reason = window.prompt(
        `Disable "${item.label}" reason (optional, shown to users):`,
        item.reason ?? "",
      );
      if (reason === null) {
        return;
      }
      reason = reason.trim() || null;
    } else {
      reason = null;
    }

    setSavingKey(item.key);
    setNotice(null);
    try {
      await updateAdminServiceControl(item.key, {
        enabled: nextEnabled,
        reason,
      });
      setNotice(
        `${item.label} ${nextEnabled ? "enabled" : "disabled"} successfully.`,
      );
      await loadServiceControls();
    } catch (saveError) {
      setNotice(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update service state.",
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Service Controls</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enable or disable platform services and Studio document offerings in real time.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Services</h2>
          <button
            onClick={() => void loadServiceControls()}
            disabled={loading}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="space-y-3 p-5">
          {loading && items.length === 0 && (
            <div className="text-sm text-slate-500">Loading service controls...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-sm text-slate-500">No services configured.</div>
          )}
          {items.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-slate-200 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  {item.reason && !item.enabled && (
                    <p className="mt-2 text-xs text-amber-700">
                      Reason: {item.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void toggleService(item)}
                  disabled={savingKey === item.key}
                  className={`rounded px-3 py-2 text-xs font-medium text-white disabled:opacity-60 ${
                    item.enabled
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {savingKey === item.key
                    ? "Saving..."
                    : item.enabled
                    ? "Disable"
                    : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default OpsServicesPage;
