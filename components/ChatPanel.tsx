/**
 * ChatPanel – A ChatGPT-style conversational AI interface with sidebar history.
 * Streams responses via SSE from the /chat backend endpoint.
 * Persists conversations server-side and lets users resume previous chats.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Sparkles,
  AlertCircle,
  CornerDownLeft,
  Copy,
  Check,
  Plus,
  MessageSquare,
  PenLine,
  Menu,
  X,
} from "lucide-react";
import { getAuthToken } from "../src/services/backendApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  context: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatPanelProps {
  /** Tailored system prompt context – defaults to "general" */
  context?: "clinical" | "pharmacology" | "general";
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer (bold, headings, lists, code)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = "";

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul
        key={`ul-${elements.length}`}
        className="my-2 ml-5 list-disc space-y-1 text-slate-700"
        style={{ lineHeight: '1.7' }}
      >
        {listBuffer.map((item, i) => (
          <li key={i}>{inlineFormat(item)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-slate-100"
        style={{ fontSize: '11px', fontFamily: "'Fira Code', 'Courier New', monospace", lineHeight: '1.6' }}
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>,
    );
    codeBuffer = [];
    codeLanguage = "";
  };

  for (const line of lines) {
    // Code fences
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.*)/);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^[\s]*\d+[.)]\s+(.*)/);
    if (numMatch) {
      listBuffer.push(numMatch[1]);
      continue;
    }

    flushList();

    // Headings
    const h2Match = line.match(/^##\s+(.*)/);
    if (h2Match) {
      elements.push(
        <h3
          key={`h2-${elements.length}`}
          className="mt-4 mb-1 font-bold text-slate-900"
          style={{ fontSize: '15px' }}
        >
          {inlineFormat(h2Match[1])}
        </h3>,
      );
      continue;
    }

    const h1Match = line.match(/^#\s+(.*)/);
    if (h1Match) {
      elements.push(
        <h2
          key={`h1-${elements.length}`}
          className="mt-5 mb-2 border-b border-slate-200 pb-1 font-bold text-slate-900"
          style={{ fontSize: '18px' }}
        >
          {inlineFormat(h1Match[1])}
        </h2>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={`p-${elements.length}`} className="text-slate-700" style={{ lineHeight: '1.7' }}>
        {inlineFormat(line)}
      </p>,
    );
  }

  flushList();
  if (inCodeBlock) flushCode();

  return <>{elements}</>;
}

/** Inline formatting: **bold**, *italic*, `code` */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-blue-700"
          style={{ fontSize: '11px' }}
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API = import.meta.env.VITE_API_BASE_URL;

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API}/chat/conversations`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = (await res.json()) as { conversations: Conversation[] };
  return data.conversations ?? [];
}

async function fetchConversation(id: string): Promise<{ conversation: { id: string; title: string; context: string; messages: ChatMessage[] } } | null> {
  const res = await fetch(`${API}/chat/conversations/${id}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as { conversation: { id: string; title: string; context: string; messages: ChatMessage[] } };
}

async function deleteConversation(id: string): Promise<boolean> {
  const res = await fetch(`${API}/chat/conversations/${id}`, { method: "DELETE", headers: authHeaders() });
  return res.ok;
}

async function renameConversation(id: string, title: string): Promise<boolean> {
  const res = await fetch(`${API}/chat/conversations/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  {
    label: "IV Drip Rate",
    text: "How do I calculate an IV drip rate for 1000ml Normal Saline over 8 hours using a 20 drops/ml giving set?",
  },
  {
    label: "Postpartum Hemorrhage",
    text: "What is the management of primary postpartum hemorrhage according to WHO guidelines?",
  },
  {
    label: "Drug Dosage",
    text: "Calculate the correct dose of paracetamol for a 12kg child (15mg/kg). What formulation and dose should I give?",
  },
  {
    label: "APGAR Scoring",
    text: "Explain APGAR scoring for newborns, including what each letter stands for and how to interpret the results.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatPanel: React.FC<ChatPanelProps> = ({
  context = "general",
}) => {
  // Conversation list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Current chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Editing title
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversations on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setLoadingHistory(false); return; }
    void fetchConversations().then((c) => {
      setConversations(c);
      setLoadingHistory(false);
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Load a conversation from the sidebar
  const loadConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);

    const data = await fetchConversation(id);
    if (data?.conversation) {
      setMessages(data.conversation.messages);
    }
  }, []);

  // Start a new chat
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* fallback */ }
  };

  // Send message
  const sendMessage = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || isStreaming) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: msgText,
      createdAt: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getAuthToken();
      if (!token) {
        setError("Please sign in to use the AI assistant.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setIsStreaming(false);
        return;
      }

      // Build message history for API (last 20 for context window)
      const allMsgs = [...messages, userMsg];
      const apiMessages = allMsgs.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          context,
          conversationId: activeConversationId ?? undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as Record<string, string>).message ?? `Request failed (${response.status})`,
        );
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr) as {
              content?: string;
              error?: string;
              conversationId?: string;
            };

            // Server sends conversationId in first chunk for new conversations
            if (parsed.conversationId && !activeConversationId) {
              setActiveConversationId(parsed.conversationId);
            }

            if (parsed.error) {
              setError(parsed.error);
              break;
            }

            if (parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + parsed.content }
                    : m,
                ),
              );
            }
          } catch { /* skip */ }
        }
      }

      // Refresh sidebar after a successful exchange
      void fetchConversations().then(setConversations);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message ?? "Failed to get a response.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id || m.content));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await deleteConversation(id);
    if (ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) startNewChat();
    }
  };

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    const ok = await renameConversation(id, editTitle.trim());
    if (ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editTitle.trim() } : c)),
      );
    }
    setEditingId(null);
  };

  const isEmpty = messages.length === 0;

  // Group conversations by date
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterdayStr = new Date(today.getTime() - 86400000).toDateString();
  const grouped = conversations.reduce<Record<string, Conversation[]>>((acc, c) => {
    const d = new Date(c.updatedAt).toDateString();
    const label =
      d === todayStr ? "Today" :
      d === yesterdayStr ? "Yesterday" :
      "Older";
    (acc[label] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex h-[calc(100dvh-12rem)] md:h-[calc(100dvh-10rem)] overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* ── Sidebar (desktop: always, mobile: overlay) ── */}
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <button
            onClick={startNewChat}
            className="flex flex-1 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-3">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-slate-400">No conversations yet</p>
          ) : (
            ["Today", "Yesterday", "Older"].map((label) =>
              grouped[label]?.length ? (
                <div key={label}>
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  {grouped[label].map((c) => (
                    <div
                      key={c.id}
                      onClick={() => void loadConversation(c.id)}
                      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        activeConversationId === c.id
                          ? "bg-blue-100 text-blue-800"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0 text-slate-400" />
                      {editingId === c.id ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => void handleRename(c.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") void handleRename(c.id); if (e.key === "Escape") setEditingId(null); }}
                          className="flex-1 rounded border border-blue-300 bg-white px-1 py-0.5 text-xs outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 truncate text-xs">{c.title}</span>
                      )}
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditTitle(c.title); }}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                          title="Rename"
                        >
                          <PenLine size={12} />
                        </button>
                        <button
                          onClick={(e) => void handleDeleteConversation(c.id, e)}
                          className="rounded p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null,
            )
          )}
        </nav>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <button
                onClick={startNewChat}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                New chat
              </button>
              <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-3">
              {conversations.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-slate-400">No conversations yet</p>
              ) : (
                ["Today", "Yesterday", "Older"].map((label) =>
                  grouped[label]?.length ? (
                    <div key={label}>
                      <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                      {grouped[label].map((c) => (
                        <div
                          key={c.id}
                          onClick={() => void loadConversation(c.id)}
                          className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                            activeConversationId === c.id
                              ? "bg-blue-100 text-blue-800"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <MessageSquare size={14} className="shrink-0 text-slate-400" />
                          <span className="flex-1 truncate text-xs">{c.title}</span>
                          <button
                            onClick={(e) => void handleDeleteConversation(c.id, e)}
                            className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null,
                )
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">EduNurse AI</h3>
          </div>
          {activeConversationId && (
            <button
              onClick={startNewChat}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Plus size={14} />
              New chat
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            /* Welcome / empty state */
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">
                EduNurse AI
              </h2>
              <p className="mb-8 max-w-md text-center text-slate-500">
                Your AI study companion for nursing &amp; midwifery. Ask me
                anything about clinical procedures, drug calculations, exam
                preparation, and more.
              </p>

              <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => void sendMessage(s.text)}
                    className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:shadow-md"
                  >
                    <p className="mb-1 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                      {s.label}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {s.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="mx-auto max-w-3xl space-y-1 px-4 py-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group flex gap-3 rounded-xl px-4 py-4 ${
                    msg.role === "user" ? "justify-end" : ""
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`relative min-w-0 max-w-[85%] ${
                      msg.role === "user"
                        ? "rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-white"
                        : "flex-1"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    ) : msg.content ? (
                      <div
                        className="chat-prose"
                        style={{ fontFamily: "'Times New Roman', Times, Georgia, serif", fontSize: '12px', lineHeight: '1.7' }}
                      >
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking…
                      </div>
                    )}

                    {/* Copy button for assistant messages */}
                    {msg.role === "assistant" && msg.content && (
                      <button
                        onClick={() => void copyToClipboard(msg.content, msg.id)}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Something went wrong</p>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="safe-bottom border-t border-slate-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask anything about nursing, clinical procedures, drug calculations…"
                disabled={isStreaming}
                className="w-full resize-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-12 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={isStreaming || !input.trim()}
                className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-400">
            <CornerDownLeft className="mr-1 inline h-3 w-3" />
            Enter to send · Shift+Enter for new line · AI can make mistakes
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
