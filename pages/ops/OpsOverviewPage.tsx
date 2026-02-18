import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Database,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  AdminAiHealthResponse,
  AdminConnector,
  OpsCurriculumTopicsResponse,
  OpsOverviewResponse,
  getAdminAiHealth,
  getOpsOverview,
  listOpsCurriculumTopics,
  listAdminConnectors,
} from "../../src/services/backendApi";

const OpsOverviewPage: React.FC = () => {
  const [overview, setOverview] = useState<OpsOverviewResponse | null>(null);
  const [aiHealth, setAiHealth] = useState<AdminAiHealthResponse | null>(null);
  const [connectors, setConnectors] = useState<AdminConnector[]>([]);
  const [topics, setTopics] = useState<OpsCurriculumTopicsResponse | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [topicPage, setTopicPage] = useState(1);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicProgramme, setTopicProgramme] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, aiResponse, connectorsResponse] = await Promise.all([
        getOpsOverview({ days: 7 }),
        getAdminAiHealth({ probe: false }),
        listAdminConnectors({ page: 1, pageSize: 10 }),
      ]);

      setOverview(overviewResponse);
      setAiHealth(aiResponse);
      setConnectors(connectorsResponse.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load ops overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadTopics = async () => {
    setTopicsLoading(true);
    setTopicsError(null);
    try {
      const response = await listOpsCurriculumTopics({
        page: topicPage,
        pageSize: 20,
        search: topicSearch.trim() || undefined,
        programme: topicProgramme || undefined,
      });
      setTopics(response);
    } catch (loadError) {
      setTopicsError(loadError instanceof Error ? loadError.message : "Failed to load topics.");
    } finally {
      setTopicsLoading(false);
    }
  };

  useEffect(() => {
    void loadTopics();
  }, [topicPage, topicSearch, topicProgramme]);

  const aiStats = useMemo(() => {
    if (!aiHealth) return { configured: 0 };
    const providers = [
      aiHealth.providers.azure,
      aiHealth.providers.gemini,
      aiHealth.providers.deepseek,
    ];
    return {
      configured: providers.filter((provider) => provider.configured).length,
    };
  }, [aiHealth]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Operations Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          High-level health, queue, and connector signals for the last 7 days.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Generation Runs</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {overview?.generation.total ?? 0}
          </div>
          <p className="mt-1 text-xs text-slate-500">7-day volume</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Low Coverage Blocks</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {overview?.guardrails.lowCoverageBlocks ?? 0}
          </div>
          <p className="mt-1 text-xs text-slate-500">Guardrail enforcement</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Connectors</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {connectors.length}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {connectors.filter((item) => item.status === "active").length} active
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">AI Providers Ready</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{aiStats.configured}/3</div>
          <p className="mt-1 text-xs text-slate-500">Configured providers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Quick Navigation</h2>
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <Link
              to="/ops/users"
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900">Users</span>
                </div>
                <ArrowRight size={14} className="text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Manage educators and admins.</p>
            </Link>
            <Link
              to="/ops/connectors"
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900">Connectors</span>
                </div>
                <ArrowRight size={14} className="text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Sync and inspect ingestion connectors.</p>
            </Link>
            <Link
              to="/ops/transactions"
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900">Transactions</span>
                </div>
                <ArrowRight size={14} className="text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Monitor billing events and failures.</p>
            </Link>
            <Link
              to="/ops/services"
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900">Services</span>
                </div>
                <ArrowRight size={14} className="text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Switch platform services on/off.
              </p>
            </Link>
            <Link
              to="/ops/ai"
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900">AI Health</span>
                </div>
                <ArrowRight size={14} className="text-slate-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Provider availability and probe status.</p>
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Connector Snapshot</h2>
          </div>
          <div className="p-5">
            {connectors.length === 0 && (
              <div className="text-sm text-slate-500">No connectors configured yet.</div>
            )}
            {connectors.length > 0 && (
              <div className="space-y-2">
                {connectors.slice(0, 6).map((connector) => (
                  <div key={connector.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="text-sm font-medium text-slate-900">{connector.name}</div>
                    <div className="text-xs text-slate-500">
                      {connector.connectorType} | {connector.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Curriculum Topics</h2>
            <p className="text-xs text-slate-500">
              Topics extracted from indexed curriculum chunks.
            </p>
          </div>
          <button
            onClick={() => void loadTopics()}
            disabled={topicsLoading}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {topicsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              type="text"
              value={topicSearch}
              onChange={(event) => {
                setTopicSearch(event.target.value);
                setTopicPage(1);
              }}
              placeholder="Search topic..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={topicProgramme}
              onChange={(event) => {
                setTopicProgramme(event.target.value);
                setTopicPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All programmes</option>
              <option value="Nursing">Nursing</option>
              <option value="Midwifery">Midwifery</option>
            </select>
            <div className="flex items-center justify-end text-xs text-slate-500">
              Total topics: {topics?.total ?? 0}
            </div>
          </div>

          {topicsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {topicsError}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Chunks</th>
                  <th className="px-3 py-2">Subtopics</th>
                  <th className="px-3 py-2">Semesters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {!topicsLoading && (topics?.items.length ?? 0) === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={4}>
                      No topics found.
                    </td>
                  </tr>
                )}
                {topics?.items.map((item) => (
                  <tr key={item.topic}>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.topic}</td>
                    <td className="px-3 py-2 text-slate-700">{item.chunkCount}</td>
                    <td className="px-3 py-2 text-slate-700">{item.subtopicCount}</td>
                    <td className="px-3 py-2 text-slate-700">{item.semesterCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setTopicPage((prev) => Math.max(1, prev - 1))}
              disabled={topicPage <= 1 || topicsLoading}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">Page {topicPage}</span>
            <button
              onClick={() => setTopicPage((prev) => prev + 1)}
              disabled={
                topicsLoading ||
                !topics ||
                topicPage * (topics.pageSize || 20) >= (topics.total || 0)
              }
              className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OpsOverviewPage;
