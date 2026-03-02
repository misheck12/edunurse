import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  CurriculumTreeNode,
  CurriculumTreeNodeLookupResponse,
  CurriculumTreeResponse,
  CurriculumQueryResponse,
  getAuthToken,
  getCurrentDevUserId,
  getCurriculumTree,
  getCurriculumTreeNode,
  queryCurriculum,
} from "../src/services/backendApi";
import SEO from "../src/components/SEO";

type SelectedTreeNode = {
  sourceId: string;
  sourceName: string;
  node: CurriculumTreeNode;
};

type QueryHistoryItem = {
  id: string;
  createdAt: string;
  question: string;
  programme: string;
  programmeLevel: string;
  year?: string;
  selectedPath?: string;
  result: Pick<
    CurriculumQueryResponse,
    "mode" | "blocked" | "message" | "answer" | "provider" | "model" | "citations"
  >;
};

function asString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nodeTypeLabel(nodeType: string) {
  return nodeType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getHistoryStorageKey() {
  const token = getAuthToken();
  if (token && token.length > 16) {
    return `edunurse_curriculum_query_history_${token.slice(0, 16)}`;
  }
  return `edunurse_curriculum_query_history_${getCurrentDevUserId()}`;
}

function readQueryHistory() {
  if (typeof window === "undefined") return [] as QueryHistoryItem[];
  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueryHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10);
  } catch {
    return [];
  }
}

function writeQueryHistory(items: QueryHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getHistoryStorageKey(),
    JSON.stringify(items.slice(0, 10)),
  );
}

function TreeNodeItem(props: {
  node: CurriculumTreeNode;
  sourceId: string;
  sourceName: string;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (node: SelectedTreeNode) => void;
}) {
  const { node, sourceId, sourceName, expanded, selectedPath, onToggle, onSelect } =
    props;
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1.5 ${
          isSelected ? "bg-blue-50" : "hover:bg-slate-50"
        }`}
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={() => hasChildren && onToggle(node.path)}
          className={`h-5 w-5 rounded text-slate-500 ${
            hasChildren ? "hover:bg-slate-200" : "opacity-40"
          }`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="block h-3 w-3 rounded-full border border-slate-300" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect({ sourceId, sourceName, node })}
          className={`flex-1 truncate text-left text-sm ${
            isSelected ? "font-semibold text-blue-700" : "text-slate-700"
          }`}
          title={`${node.code ?? ""} ${node.title}`.trim()}
        >
          {node.code ? `${node.code} ` : ""}
          {node.title}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4 space-y-1 border-l border-slate-200 pl-2">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              sourceId={sourceId}
              sourceName={sourceName}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const Curriculum: React.FC = () => {
  const navigate = useNavigate();
  const [programme, setProgramme] = useState("Nursing");
  const [programmeLevel, setProgrammeLevel] = useState("Diploma");
  const [year, setYear] = useState("");
  const [search, setSearch] = useState("");
  const [queryText, setQueryText] = useState("");
  const [strict, setStrict] = useState(true);

  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [tree, setTree] = useState<CurriculumTreeResponse | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<SelectedTreeNode | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<CurriculumTreeNodeLookupResponse | null>(null);

  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<CurriculumQueryResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const metadata = useMemo(
    () => (selectedNode?.node.metadataJson ?? {}) as Record<string, unknown>,
    [selectedNode],
  );

  useEffect(() => {
    setQueryHistory(readQueryHistory());
  }, []);

  const loadTree = async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const response = await getCurriculumTree({
        programme,
        programmeLevel,
        year: year || undefined,
        search: search || undefined,
      });
      setTree(response);
    } catch (error) {
      setTreeError(
        error instanceof Error ? error.message : "Failed to load curriculum tree.",
      );
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    void loadTree();
  }, [programme, programmeLevel, year]);

  const loadNodeDetail = async (node: SelectedTreeNode) => {
    setSelectedNode(node);
    setSelectedDetail(null);
    try {
      const detail = await getCurriculumTreeNode({
        sourceId: node.sourceId,
        programme,
        programmeLevel,
        path: node.node.path,
      });
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    }
  };

  const togglePath = (path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const askCurriculum = async () => {
    if (!queryText.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const result = await queryCurriculum({
        programme,
        programmeLevel,
        year: year || undefined,
        course:
          asString(metadata.courseTitle) ||
          asString(metadata.course) ||
          (selectedNode?.node.nodeType === "course" ? selectedNode.node.title : undefined),
        topic:
          asString(metadata.topic) ||
          (selectedNode?.node.nodeType === "unit" ? selectedNode.node.title : undefined),
        subtopic:
          asString(metadata.subtopic) ||
          (selectedNode?.node.nodeType === "section" ? selectedNode.node.title : undefined),
        unit:
          asString(metadata.unit) ||
          (selectedNode?.node.nodeType === "unit" ? selectedNode.node.code ?? undefined : undefined),
        section:
          asString(metadata.section) ||
          (selectedNode?.node.nodeType === "section" ||
          selectedNode?.node.nodeType === "subsection"
            ? selectedNode.node.code ?? undefined
            : undefined),
        strictCurriculumAlignment: strict,
        question: queryText.trim(),
      });
      setQueryResult(result);

      const historyItem: QueryHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        question: queryText.trim(),
        programme,
        programmeLevel,
        year: year || undefined,
        selectedPath: selectedNode?.node.path,
        result: {
          mode: result.mode,
          blocked: result.blocked,
          message: result.message,
          answer: result.answer,
          provider: result.provider,
          model: result.model,
          citations: result.citations.slice(0, 8),
        },
      };
      setQueryHistory((previous) => {
        const next = [historyItem, ...previous].slice(0, 10);
        writeQueryHistory(next);
        return next;
      });
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : "Query failed.");
    } finally {
      setQueryLoading(false);
    }
  };

  const copyCitation = async (citation: CurriculumQueryResponse["citations"][number]) => {
    const value = [
      `${citation.sourceName ?? "Curriculum source"}${citation.page ? ` (p.${citation.page})` : ""}`,
      citation.quoteSnippet,
      `chunk: ${citation.chunkId}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Citation copied.");
      setTimeout(() => setNotice(null), 1800);
    } catch {
      setNotice("Unable to copy citation.");
      setTimeout(() => setNotice(null), 1800);
    }
  };

  const openCitationSource = async (citationSourceId: string) => {
    if (!tree) return;
    const sourceItem = tree.items.find((item) => item.source.id === citationSourceId);
    if (!sourceItem || sourceItem.roots.length === 0) {
      setNotice("No source node found for this citation.");
      setTimeout(() => setNotice(null), 1800);
      return;
    }

    const candidate =
      (queryResult?.node &&
      "sourceId" in queryResult.node &&
      queryResult.node.sourceId === citationSourceId
        ? sourceItem.roots.find((node) => node.path === queryResult.node?.path)
        : undefined) ?? sourceItem.roots[0];

    setExpandedPaths((previous) => new Set(previous).add(candidate.path));
    await loadNodeDetail({
      sourceId: sourceItem.source.id,
      sourceName: sourceItem.source.name,
      node: candidate,
    });
    setNotice("Opened citation source node.");
    setTimeout(() => setNotice(null), 1800);
  };

  const sendToCreateWizard = () => {
    const params = new URLSearchParams();
    params.set("source", "curriculum");
    params.set("programme", programme);
    params.set("programmeLevel", programmeLevel);
    if (year.trim()) params.set("semester", year.trim());
    const courseTitle =
      asString(metadata.courseTitle) ||
      asString(metadata.course) ||
      (selectedNode?.node.nodeType === "course" ? selectedNode.node.title : "");
    if (courseTitle) params.set("course", courseTitle);
    const topicTitle =
      asString(metadata.topic) ||
      (selectedNode?.node.nodeType === "unit" ? selectedNode.node.title : "");
    if (topicTitle) params.set("topic", topicTitle);
    const subtopicTitle =
      asString(metadata.subtopic) ||
      (selectedNode?.node.nodeType === "section" ? selectedNode.node.title : "");
    if (subtopicTitle) params.set("subtopic", subtopicTitle);
    const minorTopicTitle =
      asString(metadata.minorTopic) ||
      (selectedNode?.node.nodeType === "subsection"
        ? selectedNode.node.title
        : "");
    if (minorTopicTitle) params.set("minorTopic", minorTopicTitle);
    params.set("documentType", "Theory Lesson Plan");
    navigate(`/create?${params.toString()}`);
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col overflow-hidden">
      <SEO
        title="Curriculum Intelligence"
        description="Explore the indexed nursing and midwifery curriculum. Browse topics, subtopics, and run AI-powered Q&A with curriculum citations."
        canonicalPath="/curriculum"
        keywords="nursing curriculum explorer, midwifery syllabus, curriculum intelligence, Zambia nursing"
      />
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-blue-700">
              <BrainCircuit size={16} />
              <span className="font-semibold">Curriculum Intelligence Center</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Source of Truth Explorer</h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse indexed curriculum hierarchy and run grounded Q&A with citations.
            </p>
            {notice && <p className="mt-1 text-xs text-blue-700">{notice}</p>}
          </div>
          <button
            type="button"
            onClick={() => void loadTree()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="max-h-[45vh] w-full shrink-0 overflow-y-auto border-b border-slate-200 bg-white lg:max-h-none lg:w-96 lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={programme}
                onChange={(event) => setProgramme(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option>Nursing</option>
                <option>Midwifery</option>
                <option>Public Health Nursing</option>
              </select>
              <select
                value={programmeLevel}
                onChange={(event) => setProgrammeLevel(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option>Diploma</option>
                <option>BSc</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="Year / Semester"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void loadTree();
                    }
                  }}
                  placeholder="Search title/code"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4">
            {treeLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading curriculum hierarchy...
              </div>
            )}
            {treeError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {treeError}
              </div>
            )}
            {!treeLoading && !treeError && tree && (
              <div className="space-y-4">
                {tree.items.map((item) => (
                  <div key={item.source.id} className="rounded-lg border border-slate-200">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {item.source.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.source.programme ?? "Programme not tagged"}
                      </p>
                    </div>
                    <div className="space-y-1 p-2">
                      {item.roots.length === 0 && (
                        <p className="px-2 py-1 text-xs text-slate-500">
                          No hierarchy nodes in this source.
                        </p>
                      )}
                      {item.roots.map((root) => (
                        <TreeNodeItem
                          key={root.path}
                          node={root}
                          sourceId={item.source.id}
                          sourceName={item.source.name}
                          expanded={expandedPaths}
                          selectedPath={selectedNode?.node.path ?? null}
                          onToggle={togglePath}
                          onSelect={(node) => void loadNodeDetail(node)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Sources</p>
              <p className="text-2xl font-bold text-slate-900">
                {tree?.sourceCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Hierarchy Nodes</p>
              <p className="text-2xl font-bold text-slate-900">{tree?.nodeCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Version</p>
              <p className="truncate text-sm font-semibold text-slate-800">
                {tree?.curriculumVersionId ?? "No active version"}
              </p>
            </div>
          </div>

          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Selected Node</h2>
              <button
                type="button"
                onClick={sendToCreateWizard}
                disabled={!selectedNode}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Send size={13} />
                Use In Create Wizard
              </button>
            </div>
            {!selectedNode && (
              <p className="mt-2 text-sm text-slate-500">
                Select a node from the left tree to inspect structured metadata.
              </p>
            )}
            {selectedNode && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {nodeTypeLabel(selectedNode.node.nodeType)}
                  </span>
                  {selectedNode.node.code && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {selectedNode.node.code}
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold text-slate-900">
                  {selectedNode.node.title}
                </p>
                <p className="text-xs text-slate-500">{selectedNode.node.path}</p>
                <p className="text-xs text-slate-500">
                  Source: {selectedNode.sourceName}
                </p>
                {selectedDetail?.ancestors && selectedDetail.ancestors.length > 0 && (
                  <p className="text-xs text-slate-600">
                    Breadcrumb:{" "}
                    {selectedDetail.ancestors
                      .map((item) => item.title)
                      .concat(selectedNode.node.title)
                      .join(" > ")}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Grounded Q&A</h2>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={strict}
                  onChange={() => setStrict((value) => !value)}
                />
                Strict alignment
              </label>
            </div>
            <textarea
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              rows={4}
              placeholder="Ask from curriculum context, e.g. 'List objectives under unit 1.3.1'"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void askCurriculum()}
                disabled={queryLoading || queryText.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Ask
              </button>
              {queryError && <p className="text-sm text-red-700">{queryError}</p>}
            </div>

            {queryResult && (
              <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">
                    Mode: {queryResult.mode}
                  </span>
                  {queryResult.provider && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                      Provider: {queryResult.provider}
                    </span>
                  )}
                  {queryResult.blocked && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                      blocked
                    </span>
                  )}
                </div>
                {queryResult.message && (
                  <p className="text-sm text-slate-600">{queryResult.message}</p>
                )}
                {queryResult.answer && (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {queryResult.answer}
                  </p>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    Citations ({queryResult.citations.length})
                  </p>
                  <div className="space-y-2">
                    {queryResult.citations.slice(0, 8).map((citation) => (
                      <div
                        key={`${citation.chunkId}-${citation.sourceId}`}
                        className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
                      >
                        <p className="mb-1 font-semibold">
                          {citation.sourceName ?? "Curriculum source"}
                          {citation.page ? ` (p.${citation.page})` : ""}
                        </p>
                        <p className="line-clamp-3">{citation.quoteSnippet}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyCitation(citation)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy size={11} />
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => void openCitationSource(citation.sourceId)}
                            className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Open Source Node
                          </button>
                        </div>
                      </div>
                    ))}
                    {queryResult.citations.length === 0 && (
                      <p className="text-xs text-slate-500">No citations returned.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Recent Query History</h2>
              <button
                type="button"
                onClick={() => {
                  writeQueryHistory([]);
                  setQueryHistory([]);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Clear
              </button>
            </div>
            {queryHistory.length === 0 && (
              <p className="text-sm text-slate-500">No saved queries yet.</p>
            )}
            {queryHistory.length > 0 && (
              <div className="space-y-2">
                {queryHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setQueryText(item.question);
                      setQueryResult({
                        curriculumVersionId: tree?.curriculumVersionId ?? "",
                        mode: item.result.mode,
                        blocked: item.result.blocked,
                        message: item.result.message,
                        answer: item.result.answer,
                        provider: item.result.provider,
                        model: item.result.model,
                        citations: item.result.citations,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.question}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString()} | {item.programme} |{" "}
                      {item.programmeLevel}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Curriculum;
