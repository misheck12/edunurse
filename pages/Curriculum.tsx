import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  BrainCircuit,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TreePine,
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

// ---------------------------------------------------------------------------
// Markdown-lite renderer (professional serif formatting for AI answers)
// ---------------------------------------------------------------------------

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold text-slate-900">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-blue-700" style={{ fontSize: "11px" }}>
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${elements.length}`} className="my-2 ml-5 list-disc space-y-1 text-slate-700" style={{ lineHeight: "1.7" }}>
        {listBuffer.map((item, i) => (<li key={i}>{inlineFormat(item)}</li>))}
      </ul>,
    );
    listBuffer = [];
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    elements.push(
      <pre key={`code-${elements.length}`} className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-slate-100" style={{ fontSize: "11px", fontFamily: "'Fira Code', 'Courier New', monospace", lineHeight: "1.6" }}>
        <code>{codeBuffer.join("\n")}</code>
      </pre>,
    );
    codeBuffer = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) { inCodeBlock = false; flushCode(); }
      else { flushList(); inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeBuffer.push(line); continue; }

    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.*)/);
    if (bulletMatch) { listBuffer.push(bulletMatch[1]); continue; }
    const numMatch = line.match(/^[\s]*\d+[.)]\s+(.*)/);
    if (numMatch) { listBuffer.push(numMatch[1]); continue; }
    flushList();

    const h2Match = line.match(/^##\s+(.*)/);
    if (h2Match) {
      elements.push(<h3 key={`h2-${elements.length}`} className="mt-4 mb-1 font-bold text-slate-900" style={{ fontSize: "15px" }}>{inlineFormat(h2Match[1])}</h3>);
      continue;
    }
    const h1Match = line.match(/^#\s+(.*)/);
    if (h1Match) {
      elements.push(<h2 key={`h1-${elements.length}`} className="mt-5 mb-2 border-b border-slate-200 pb-1 font-bold text-slate-900" style={{ fontSize: "18px" }}>{inlineFormat(h1Match[1])}</h2>);
      continue;
    }
    if (line.trim() === "") { elements.push(<div key={`br-${elements.length}`} className="h-2" />); continue; }
    elements.push(<p key={`p-${elements.length}`} className="text-slate-700" style={{ lineHeight: "1.7" }}>{inlineFormat(line)}</p>);
  }

  flushList();
  if (inCodeBlock) flushCode();
  return <>{elements}</>;
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
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null);

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
      setCopiedCitationId(citation.chunkId);
      setTimeout(() => setCopiedCitationId(null), 2000);
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
      <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50/60 to-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <BrainCircuit size={16} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-blue-700">Curriculum Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Source of Truth Explorer</h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse the indexed NMC curriculum hierarchy, inspect modules, and ask grounded AI questions with full citations.
            </p>
            {notice && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <Check size={12} />
                {notice}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadTree()}
            disabled={treeLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw size={15} className={treeLoading ? "animate-spin" : ""} />
            Refresh Tree
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="max-h-[50vh] w-full shrink-0 overflow-y-auto border-b border-slate-200 bg-white lg:max-h-none lg:w-96 lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filter Curriculum</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={programme}
                onChange={(event) => setProgramme(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Nursing">Nursing</option>
                <option value="Midwifery" disabled>Midwifery (coming soon)</option>
                <option value="Public Health Nursing" disabled>Public Health (coming soon)</option>
              </select>
              <select
                value={programmeLevel}
                onChange={(event) => setProgrammeLevel(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Diploma">Diploma</option>
                <option value="BSc" disabled>BSc (coming soon)</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="Year / Semester"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-1.5">
                <div className="relative flex-1">
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
                <button
                  type="button"
                  onClick={() => void loadTree()}
                  disabled={treeLoading}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  title="Search"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4">
            {treeLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                    <div className="mt-3 space-y-2">
                      <div className="ml-3 h-3 w-5/6 rounded bg-slate-100" />
                      <div className="ml-3 h-3 w-4/6 rounded bg-slate-100" />
                      <div className="ml-3 h-3 w-3/6 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
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
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <FileText size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sources</p>
                <p className="text-xl font-bold text-slate-900">{tree?.sourceCount ?? "–"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <TreePine size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hierarchy Nodes</p>
                <p className="text-xl font-bold text-slate-900">{tree?.nodeCount ?? "–"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Layers size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Version</p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {tree?.curriculumVersionId ? tree.curriculumVersionId.slice(0, 8) + "…" : "None"}
                </p>
              </div>
            </div>
          </div>

          <section className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Selected Node</h2>
              </div>
              <button
                type="button"
                onClick={sendToCreateWizard}
                disabled={!selectedNode}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={13} />
                Create Lesson Plan
              </button>
            </div>
            {!selectedNode && (
              <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
                <GitBranch size={32} className="mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No node selected</p>
                <p className="mt-1 text-xs text-slate-400">
                  Click any item in the curriculum tree to inspect its metadata and use it for lesson planning.
                </p>
              </div>
            )}
            {selectedNode && (
              <div className="mt-3 space-y-3 text-sm">
                {/* Breadcrumb */}
                {selectedDetail?.ancestors && selectedDetail.ancestors.length > 0 && (
                  <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {selectedDetail.ancestors.map((item, i) => (
                      <React.Fragment key={item.id}>
                        {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                        <span>{item.title}</span>
                      </React.Fragment>
                    ))}
                    <ChevronRight size={10} className="text-slate-300" />
                    <span className="font-semibold text-blue-700">{selectedNode.node.title}</span>
                  </nav>
                )}
                {/* Title + badges */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {nodeTypeLabel(selectedNode.node.nodeType)}
                    </span>
                    {selectedNode.node.code && (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {selectedNode.node.code}
                      </span>
                    )}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Depth {selectedNode.node.depth}
                    </span>
                    {selectedNode.node.children.length > 0 && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        {selectedNode.node.children.length} children
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {selectedNode.node.title}
                  </p>
                </div>
                {/* Metadata grid */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Source</p>
                    <p className="truncate text-xs font-medium text-slate-700">{selectedNode.sourceName}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Path</p>
                    <p className="truncate font-mono text-xs text-slate-600">{selectedNode.node.path}</p>
                  </div>
                  {metadata.courseTitle && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Course</p>
                      <p className="truncate text-xs font-medium text-slate-700">{String(metadata.courseTitle)}</p>
                    </div>
                  )}
                  {metadata.topic && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Topic</p>
                      <p className="truncate text-xs font-medium text-slate-700">{String(metadata.topic)}</p>
                    </div>
                  )}
                  {metadata.subtopic && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subtopic</p>
                      <p className="text-xs font-medium text-slate-700">{String(metadata.subtopic)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">Grounded Q&A</h2>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={strict}
                  onChange={() => setStrict((value) => !value)}
                  className="accent-blue-600"
                />
                Strict alignment
              </label>
            </div>
            <div className="relative">
              <textarea
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void askCurriculum();
                  }
                }}
                rows={3}
                placeholder="Ask a curriculum question, e.g. 'What are the learning objectives for unit 1.3 of Fundamentals of Nursing?'"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-[10px] text-slate-400">Press Ctrl + Enter to submit</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void askCurriculum()}
                disabled={queryLoading || queryText.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {queryLoading ? "Thinking…" : "Ask Curriculum"}
              </button>
              {queryError && (
                <p className="rounded-md bg-red-50 px-2.5 py-1 text-sm text-red-700">{queryError}</p>
              )}
            </div>

            {queryResult && (
              <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                {/* Status badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold capitalize text-slate-700">
                    {queryResult.mode === "no_context" ? "General" : queryResult.mode}
                  </span>
                  {queryResult.provider && (
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold capitalize text-blue-700">
                      {queryResult.provider}
                    </span>
                  )}
                  {queryResult.model && (
                    <span className="rounded-md bg-slate-50 px-2.5 py-1 font-mono text-slate-500">
                      {queryResult.model}
                    </span>
                  )}
                  {queryResult.blocked && (
                    <span className="rounded-md bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                      Blocked
                    </span>
                  )}
                </div>

                {/* System message */}
                {queryResult.message && (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    {queryResult.message}
                  </p>
                )}

                {/* AI answer — professional serif formatting */}
                {queryResult.answer && (
                  <div
                    className="chat-prose rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                    style={{ fontFamily: "'Times New Roman', Times, Georgia, serif", fontSize: '12px', lineHeight: '1.7' }}
                  >
                    {renderMarkdown(queryResult.answer)}
                  </div>
                )}

                {/* Citations */}
                {queryResult.citations.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <FileText size={13} className="text-slate-400" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Citations ({queryResult.citations.length})
                      </p>
                    </div>
                    <div className="space-y-2">
                      {queryResult.citations.slice(0, 8).map((citation) => (
                        <div
                          key={`${citation.chunkId}-${citation.sourceId}`}
                          className="group rounded-lg border border-slate-200 bg-white p-3 text-xs transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                        >
                          <div className="mb-1.5 flex items-center justify-between">
                            <p className="font-semibold text-slate-800">
                              {citation.sourceName ?? "Curriculum source"}
                              {citation.page ? <span className="ml-1 font-normal text-slate-500">(p.{citation.page})</span> : ""}
                            </p>
                            {citation.score != null && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                Score: {(citation.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-3 leading-relaxed text-slate-600" style={{ fontFamily: "'Times New Roman', Times, Georgia, serif" }}>
                            {citation.quoteSnippet}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void copyCitation(citation)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              {copiedCitationId === citation.chunkId ? (
                                <><Check size={11} className="text-emerald-600" /> Copied</>
                              ) : (
                                <><Copy size={11} /> Copy</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openCitationSource(citation.sourceId)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              <GitBranch size={11} />
                              Open in Tree
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {queryResult.citations.length === 0 && !queryResult.blocked && (
                  <p className="text-xs italic text-slate-400">No curriculum citations were retrieved for this query.</p>
                )}
              </div>
            )}
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Recent Queries</h2>
                {queryHistory.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {queryHistory.length}
                  </span>
                )}
              </div>
              {queryHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    writeQueryHistory([]);
                    setQueryHistory([]);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  Clear All
                </button>
              )}
            </div>
            {queryHistory.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-slate-200 py-6 text-center">
                <Clock size={24} className="mx-auto mb-1.5 text-slate-300" />
                <p className="text-sm text-slate-500">No queries yet</p>
                <p className="mt-0.5 text-xs text-slate-400">Your AI curriculum questions will appear here for quick replay.</p>
              </div>
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
                    className="group w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                      {item.question}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      <span>·</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium">
                        {item.result.mode}
                      </span>
                      {item.result.citations.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{item.result.citations.length} citations</span>
                        </>
                      )}
                    </div>
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
