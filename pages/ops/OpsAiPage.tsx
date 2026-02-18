import React, { useEffect, useMemo, useState } from "react";
import { Activity, BrainCircuit, Loader2 } from "lucide-react";
import {
  AdminAiHealthResponse,
  getAdminAiHealth,
} from "../../src/services/backendApi";

const OpsAiPage: React.FC = () => {
  const [aiHealth, setAiHealth] = useState<AdminAiHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAiHealth = async (probe: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminAiHealth({ probe, timeoutMs: 12000 });
      setAiHealth(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load AI health.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAiHealth(false);
  }, []);

  const stats = useMemo(() => {
    if (!aiHealth) return { configured: 0, healthy: 0 };
    const providers = [
      aiHealth.providers.azure,
      aiHealth.providers.gemini,
      aiHealth.providers.deepseek,
    ];
    return {
      configured: providers.filter((item) => item.configured).length,
      healthy: providers.filter((item) => item.probe?.ok).length,
    };
  }, [aiHealth]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">AI Health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Provider configuration and probe status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Configured</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{stats.configured}/3</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Healthy</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{stats.healthy}/3</div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BrainCircuit size={18} className="text-blue-600" />
            Provider Health
          </h2>
          <button
            onClick={() => void loadAiHealth(true)}
            disabled={loading}
            className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            Probe
          </button>
        </div>
        <div className="p-5">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {!aiHealth && loading && <div className="text-sm text-slate-500">Loading AI health...</div>}
          {aiHealth && (
            <div className="grid gap-4 md:grid-cols-3">
              {(["azure", "gemini", "deepseek"] as const).map((providerKey) => {
                const provider = aiHealth.providers[providerKey];
                return (
                  <div key={providerKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize text-slate-900">
                        {providerKey}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          provider.configured
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {provider.configured ? "configured" : "missing"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">model: {provider.model ?? "n/a"}</p>
                    {provider.probe && (
                      <p
                        className={`mt-2 rounded px-2 py-1 text-xs ${
                          provider.probe.ok
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {provider.probe.ok ? "probe ok" : "probe failed"} (
                        {provider.probe.latencyMs ?? 0} ms)
                      </p>
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

export default OpsAiPage;
