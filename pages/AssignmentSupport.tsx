import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookMarked,
  BookOpen,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  GraduationCap,
  HelpCircle,
  Library,
  Lightbulb,
  Link2,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  PenSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Shield,
  Sparkles,
  Target,
  Trash2,
  Upload,
  XCircle,
  MessageSquare,
} from "lucide-react";
import SEO from "../src/components/SEO";
import ChatPanel from "../components/ChatPanel";
import { useAuth } from "../src/context/AuthContext";
import {
  AssignmentSupportMessage,
  AssignmentSupportMode,
  AssignmentSupportResponse,
  CitationStyle,
  extractDocumentText,
  exportAssignmentDraft,
  getAssignmentSupport,
  getCurrentDevUserId,
} from "../src/services/backendApi";

type ThreadMessage = AssignmentSupportMessage & {
  id: string;
  createdAt: string;
  mode: AssignmentSupportMode;
};

type AssignmentSupportTurn = {
  id: string;
  createdAt: string;
  mode: AssignmentSupportMode;
  response: AssignmentSupportResponse;
};

type Reference = {
  id: string;
  type: "book" | "journal" | "website" | "other";
  title: string;
  authors: string;
  year: string;
  source: string;
  url?: string;
  notes?: string;
};

type SavedAssignmentSupportSession = {
  id: string;
  name: string;
  mode: AssignmentSupportMode;
  assignmentTitle: string;
  course: string;
  programme: string;
  studentGoal: string;
  assignmentInstructions: string;
  currentAttempt: string;
  followUp: string;
  thread: ThreadMessage[];
  turns: AssignmentSupportTurn[];
  // Enhanced fields
  wordCount: number | null;
  citationStyle: CitationStyle | null;
  markingCriteria: string;
  lecturerFeedback: string;
  dueDate: string;
  understandingScore: number;
  references: Reference[];
  createdAt: string;
  updatedAt: string;
};

const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "apa7", label: "APA 7th Edition" },
  { value: "harvard", label: "Harvard" },
  { value: "vancouver", label: "Vancouver" },
  { value: "mla", label: "MLA" },
  { value: "chicago", label: "Chicago" },
];

const createEmptySession = (): SavedAssignmentSupportSession => ({
  id: crypto.randomUUID(),
  name: "New Assignment",
  mode: "understand",
  assignmentTitle: "",
  course: "",
  programme: "",
  studentGoal: "",
  assignmentInstructions: "",
  currentAttempt: "",
  followUp: "",
  thread: [],
  turns: [],
  wordCount: null,
  citationStyle: null,
  markingCriteria: "",
  lecturerFeedback: "",
  dueDate: "",
  understandingScore: 0,
  references: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function buildStorageKey(userId?: string | null) {
  return `edunurse_assignment_support_sessions_v2_${userId ?? getCurrentDevUserId()}`;
}

function buildActiveSessionKey(userId?: string | null) {
  return `edunurse_assignment_support_active_${userId ?? getCurrentDevUserId()}`;
}

type SessionsStore = {
  sessions: SavedAssignmentSupportSession[];
  activeSessionId: string | null;
};

function readSessionsStore(storageKey: string): SessionsStore {
  if (typeof window === "undefined") return { sessions: [], activeSessionId: null };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { sessions: [], activeSessionId: null };
    const parsed = JSON.parse(raw) as Partial<SessionsStore>;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeSessionId: parsed.activeSessionId ?? null,
    };
  } catch {
    return { sessions: [], activeSessionId: null };
  }
}

function writeSessionsStore(storageKey: string, store: SessionsStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(store));
}

function formatModeLabel(mode: AssignmentSupportMode) {
  if (mode === "understand") return "Understand";
  if (mode === "practice") return "Practice";
  return "Final Draft";
}

function createMessage(
  role: "user" | "assistant",
  content: string,
  mode: AssignmentSupportMode,
): ThreadMessage {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    mode,
  };
}

function summarizeAssistantResponse(response: AssignmentSupportResponse) {
  if (response.draftResponse.trim()) {
    return `${response.coachingMessage}\n\nDraft support:\n${response.draftResponse}`;
  }
  return response.coachingMessage;
}

function SectionList(props: {
  title: string;
  items: string[];
  tone?: "blue" | "emerald" | "amber" | "slate";
}) {
  const { title, items, tone = "slate" } = props;
  if (items.length === 0) return null;

  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm ${toneClass}`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

const AssignmentSupport: React.FC = () => {
  const { user } = useAuth();
  const storageKey = useMemo(() => buildStorageKey(user?.id), [user?.id]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"support" | "chat">("support");
  const [hydrated, setHydrated] = useState(false);
  const [sessions, setSessions] = useState<SavedAssignmentSupportSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  
  // Current session state
  const [mode, setMode] = useState<AssignmentSupportMode>("understand");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [course, setCourse] = useState("");
  const [programme, setProgramme] = useState("");
  const [studentGoal, setStudentGoal] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [currentAttempt, setCurrentAttempt] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [turns, setTurns] = useState<AssignmentSupportTurn[]>([]);
  
  // New enhanced fields
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [citationStyle, setCitationStyle] = useState<CitationStyle | null>(null);
  const [markingCriteria, setMarkingCriteria] = useState("");
  const [lecturerFeedback, setLecturerFeedback] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [understandingScore, setUnderstandingScore] = useState(0);
  const [references, setReferences] = useState<Reference[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showReferencesPanel, setShowReferencesPanel] = useState(false);
  const [newReference, setNewReference] = useState<Partial<Reference>>({ type: "book" });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIntegrityPanel, setShowIntegrityPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<"brief" | "references" | "attempt">("brief");
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for voice support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setVoiceSupported(Boolean(SpeechRecognition));
    }
  }, []);

  // Load sessions from storage
  useEffect(() => {
    const store = readSessionsStore(storageKey);
    if (store.sessions.length === 0) {
      // Create initial session
      const initial = createEmptySession();
      setSessions([initial]);
      setActiveSessionId(initial.id);
    } else {
      setSessions(store.sessions);
      setActiveSessionId(store.activeSessionId ?? store.sessions[0]?.id ?? null);
    }
    setHydrated(true);
  }, [storageKey]);

  // Load active session data
  useEffect(() => {
    if (!hydrated || !activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    
    setMode(session.mode);
    setAssignmentTitle(session.assignmentTitle);
    setCourse(session.course);
    setProgramme(session.programme);
    setStudentGoal(session.studentGoal);
    setAssignmentInstructions(session.assignmentInstructions);
    setCurrentAttempt(session.currentAttempt);
    setFollowUp(session.followUp);
    setThread(session.thread);
    setTurns(session.turns);
    setWordCount(session.wordCount);
    setCitationStyle(session.citationStyle);
    setMarkingCriteria(session.markingCriteria);
    setLecturerFeedback(session.lecturerFeedback);
    setDueDate(session.dueDate);
    setUnderstandingScore(session.understandingScore);
    setReferences(session.references || []);
  }, [hydrated, activeSessionId, sessions]);

  // Save current session
  const saveCurrentSession = useCallback(() => {
    if (!hydrated || !activeSessionId) return;
    
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              name: assignmentTitle || "Untitled Assignment",
              mode,
              assignmentTitle,
              course,
              programme,
              studentGoal,
              assignmentInstructions,
              currentAttempt,
              followUp,
              thread,
              turns,
              wordCount,
              citationStyle,
              markingCriteria,
              lecturerFeedback,
              dueDate,
              understandingScore,
              references,
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      writeSessionsStore(storageKey, { sessions: updated, activeSessionId });
      return updated;
    });
  }, [
    hydrated, activeSessionId, storageKey, mode, assignmentTitle, course, programme,
    studentGoal, assignmentInstructions, currentAttempt, followUp, thread, turns,
    wordCount, citationStyle, markingCriteria, lecturerFeedback, dueDate, understandingScore, references,
  ]);

  // Auto-save on changes
  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(saveCurrentSession, 1000);
    return () => clearTimeout(timeout);
  }, [hydrated, saveCurrentSession]);

  const latestTurn = turns[turns.length - 1] ?? null;
  const estimatedReadiness = latestTurn?.response.estimatedReadiness ?? understandingScore;
  const canSubmit = assignmentInstructions.trim().length >= 10 && !loading;
  const canGenerateProfessional = estimatedReadiness >= 50;
  const hasReferences = references.length > 0;

  const sendSupportRequest = async (
    selectedMode: AssignmentSupportMode,
    quickPrompt?: string,
  ) => {
    setError(null);
    setNotice(null);

    if (assignmentInstructions.trim().length < 10) {
      setError("Paste the assignment brief first so the tutor has enough context.");
      return;
    }

    // Block draft mode if understanding is too low - require 50% for professional draft
    if (selectedMode === "draft" && estimatedReadiness < 50 && thread.length < 2) {
      setError(
        "Before generating a professional assignment, please work through the Understand and Practice steps first. " +
        "You need at least 50% understanding to unlock draft generation. Current: " + estimatedReadiness + "%"
      );
      setMode("understand");
      return;
    }

    const messageText = (quickPrompt ?? followUp).trim();
    const nextThread = [...thread];

    if (messageText) {
      nextThread.push(createMessage("user", messageText, selectedMode));
      setThread(nextThread.slice(-20));
      if (!quickPrompt) {
        setFollowUp("");
      }
    }

    setLoading(true);
    try {
      // Prepare references for the API
      const referencesForApi = references.map(ref => ({
        type: ref.type,
        title: ref.title,
        authors: ref.authors,
        year: ref.year,
        source: ref.source,
        url: ref.url || undefined,
        notes: ref.notes || undefined,
      }));

      const response = await getAssignmentSupport({
        mode: selectedMode,
        assignmentTitle: assignmentTitle.trim() || undefined,
        assignmentInstructions: assignmentInstructions.trim(),
        course: course.trim() || undefined,
        programme: programme.trim() || undefined,
        studentGoal: studentGoal.trim() || undefined,
        currentAttempt: currentAttempt.trim() || undefined,
        messages: nextThread
          .slice(-20)
          .map(({ role, content }) => ({ role, content })),
        // Enhanced fields
        wordCount: wordCount ?? undefined,
        citationStyle: citationStyle ?? undefined,
        markingCriteria: markingCriteria.trim() || undefined,
        lecturerFeedback: lecturerFeedback.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        understandingScore: estimatedReadiness,
        // Student-provided references
        references: referencesForApi.length > 0 ? referencesForApi : undefined,
      });

      const assistantEntry = createMessage(
        "assistant",
        summarizeAssistantResponse(response),
        selectedMode,
      );

      setThread([...nextThread, assistantEntry].slice(-20));
      setTurns((previous) => [
        ...previous.slice(-9),
        {
          id: assistantEntry.id,
          createdAt: assistantEntry.createdAt,
          mode: selectedMode,
          response,
        },
      ]);
      setMode(response.suggestedMode);
      setUnderstandingScore(response.estimatedReadiness);
      
      // More informative notices based on readiness
      if (response.estimatedReadiness >= 50 && selectedMode === "draft") {
        setNotice(
          `🎉 Professional assignment generated! Your understanding is at ${response.estimatedReadiness}%. ` +
          "Review the draft, add your personal insights, and customize before submission."
        );
      } else if (response.readyForDraft) {
        setNotice(
          `Great progress! Your understanding is at ${response.estimatedReadiness}%. ` +
          `${response.estimatedReadiness >= 50 ? "You can now generate a professional draft!" : "Keep practicing to unlock professional draft generation at 50%."}`
        );
      } else {
        setNotice(
          `Understanding: ${response.estimatedReadiness}%. ` +
          `${response.estimatedReadiness < 50 ? `Need ${50 - response.estimatedReadiness}% more to unlock professional draft. ` : ""}` +
          `Next step: ${formatModeLabel(response.suggestedMode)}.`
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Assignment support failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setMode("understand");
    setAssignmentTitle("");
    setCourse("");
    setProgramme("");
    setStudentGoal("");
    setAssignmentInstructions("");
    setCurrentAttempt("");
    setFollowUp("");
    setThread([]);
    setTurns([]);
    setWordCount(null);
    setCitationStyle(null);
    setMarkingCriteria("");
    setLecturerFeedback("");
    setDueDate("");
    setUnderstandingScore(0);
    setReferences([]);
    setError(null);
    setNotice("Assignment support session cleared. Start fresh!");
  };

  // Reference management
  const addReference = () => {
    if (!newReference.title?.trim() || !newReference.authors?.trim()) {
      setError("Please provide at least the title and authors for the reference.");
      return;
    }
    
    const ref: Reference = {
      id: crypto.randomUUID(),
      type: newReference.type || "book",
      title: newReference.title.trim(),
      authors: newReference.authors.trim(),
      year: newReference.year?.trim() || new Date().getFullYear().toString(),
      source: newReference.source?.trim() || "",
      url: newReference.url?.trim(),
      notes: newReference.notes?.trim(),
    };
    
    setReferences((prev) => [...prev, ref]);
    setNewReference({ type: "book" });
    setNotice(`Reference added: "${ref.title}"`);
  };

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((ref) => ref.id !== id));
  };

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PDF or Word document (.pdf, .docx)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);
    setError(null);
    
    try {
      const result = await extractDocumentText(file);
      setAssignmentInstructions(result.text);
      setNotice(`Document uploaded successfully! Extracted ${result.characterCount.toLocaleString()} characters.`);
      
      // Try to extract title from filename
      if (!assignmentTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setAssignmentTitle(nameWithoutExt);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error 
          ? uploadError.message 
          : "Failed to extract text from document. Please try pasting the content manually."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Export draft handler
  const handleExportDraft = async () => {
    if (!latestTurn?.response.draftResponse.trim()) {
      setError("No draft available to export. Complete the draft step first.");
      return;
    }

    setExporting(true);
    setError(null);
    
    try {
      const blob = await exportAssignmentDraft({
        title: assignmentTitle || "Assignment Draft",
        content: latestTurn.response.draftResponse,
        citationStyle: citationStyle ?? undefined,
      });
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(assignmentTitle || "Assignment_Draft").slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}_draft.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setNotice("Draft exported to Word document. Remember to review and personalize it!");
    } catch (exportError) {
      setError(
        exportError instanceof Error 
          ? exportError.message 
          : "Failed to export draft."
      );
    } finally {
      setExporting(false);
    }
  };

  // Voice input handlers
  const startVoiceInput = () => {
    if (!voiceSupported) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setFollowUp((prev) => prev + " " + transcript.trim());
    };
    
    recognition.onerror = () => {
      setIsRecording(false);
      setNotice("Voice input stopped.");
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setNotice("Listening... Speak your response.");
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // Session management
  const createNewSession = () => {
    const newSession = createEmptySession();
    setSessions((prev) => {
      const updated = [...prev, newSession];
      writeSessionsStore(storageKey, { sessions: updated, activeSessionId: newSession.id });
      return updated;
    });
    setActiveSessionId(newSession.id);
    setShowSessionManager(false);
    setNotice("New assignment session created!");
  };

  const switchSession = (sessionId: string) => {
    saveCurrentSession();
    setActiveSessionId(sessionId);
    setSessions((prev) => {
      writeSessionsStore(storageKey, { sessions: prev, activeSessionId: sessionId });
      return prev;
    });
    setShowSessionManager(false);
  };

  const deleteSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      setError("Cannot delete the only session. Create a new one first.");
      return;
    }
    
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      const newActiveId = sessionId === activeSessionId 
        ? updated[0]?.id ?? null 
        : activeSessionId;
      writeSessionsStore(storageKey, { sessions: updated, activeSessionId: newActiveId });
      if (sessionId === activeSessionId) {
        setActiveSessionId(newActiveId);
      }
      return updated;
    });
    setNotice("Session deleted.");
  };

  const copyDraft = async () => {
    if (!latestTurn?.response.draftResponse.trim()) return;
    try {
      await navigator.clipboard.writeText(latestTurn.response.draftResponse);
      setNotice("Draft copied to clipboard.");
    } catch {
      setNotice("Unable to copy the draft.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SEO
        title="Assignment Support"
        description="Share an assignment brief, learn it step by step with AI guidance, and build a final assignment draft with confidence."
        canonicalPath="/assignment-support"
      />

      {/* View Switcher */}
      <div className="mb-6 flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            onClick={() => setView("support")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              view === "support"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <GraduationCap size={16} />
            Assignment Support
          </button>
          <button
            onClick={() => setView("chat")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              view === "chat"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <MessageSquare size={16} />
            AI Assistant
          </button>
        </div>
      </div>

      {view === "chat" ? (
        <ChatPanel context="general" />
      ) : (
      <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        onChange={(e) => void handleFileUpload(e)}
        className="hidden"
      />

      {/* Academic Integrity Panel */}
      {showIntegrityPanel && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-amber-800">How This Tool Works</h3>
                <button
                  type="button"
                  onClick={() => setShowIntegrityPanel(false)}
                  className="text-amber-600 hover:text-amber-800"
                >
                  <XCircle size={18} />
                </button>
              </div>
              <p className="mt-1 text-sm text-amber-700">
                <strong>Step 1:</strong> Prove you understand the assignment through guided questions. 
                <strong> Step 2:</strong> Add your research sources and references. 
                <strong> Step 3:</strong> Once you reach <span className="font-bold">50% understanding</span>, the tool will generate a professional assignment incorporating your sources.
                Your references will be properly cited in your chosen citation style.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Tracker - Enhanced */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Step 1: Understand */}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "understand" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                  : estimatedReadiness >= 30 
                    ? "bg-green-100 text-green-700" 
                    : "bg-slate-100 text-slate-500"
              }`}>
                {estimatedReadiness >= 30 ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                <span>1. Understand</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
              
              {/* Step 2: Practice */}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "practice" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                  : estimatedReadiness >= 50 
                    ? "bg-green-100 text-green-700" 
                    : "bg-slate-100 text-slate-500"
              }`}>
                {estimatedReadiness >= 50 ? <CheckCircle2 size={14} /> : <ClipboardCheck size={14} />}
                <span>2. Practice</span>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
              
              {/* Step 3: Draft - Unlocked at 50% */}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "draft" 
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-200" 
                  : estimatedReadiness >= 50 
                    ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700" 
                    : "bg-slate-100 text-slate-400"
              }`}>
                {estimatedReadiness >= 50 ? (
                  <>
                    <Sparkles size={14} />
                    <span>3. Professional Draft</span>
                    <Award size={14} />
                  </>
                ) : (
                  <>
                    <PenSquare size={14} />
                    <span>3. Draft (50% to unlock)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Understanding Score - Enhanced */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target size={16} className={estimatedReadiness >= 50 ? "text-green-500" : "text-slate-400"} />
              <span className="text-sm text-slate-600">Understanding:</span>
              <div className="h-3 w-32 overflow-hidden rounded-full bg-slate-200">
                <div 
                  className={`h-full transition-all duration-500 ${
                    estimatedReadiness >= 50 ? "bg-gradient-to-r from-green-500 to-emerald-500" : 
                    estimatedReadiness >= 30 ? "bg-amber-500" : "bg-red-400"
                  }`}
                  style={{ width: `${estimatedReadiness}%` }}
                />
                {/* 50% marker */}
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 h-3 w-0.5 bg-slate-400" style={{ left: '50%' }} />
                </div>
              </div>
              <span className={`text-sm font-bold ${estimatedReadiness >= 50 ? "text-green-600" : "text-slate-700"}`}>
                {estimatedReadiness}%
              </span>
              {estimatedReadiness >= 50 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                  Draft Unlocked!
                </span>
              )}
            </div>

            {/* Session Manager Button */}
            <button
              type="button"
              onClick={() => setShowSessionManager(!showSessionManager)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileText size={14} />
              Sessions ({sessions.length})
              <ChevronDown size={14} className={`transition-transform ${showSessionManager ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Session Manager Dropdown */}
        {showSessionManager && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createNewSession}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <RefreshCw size={14} />
                New Session
              </button>
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => switchSession(session.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      session.id === activeSessionId
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {session.name || "Untitled"}
                  </button>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="Delete session"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header with main actions */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <BrainCircuit size={14} />
              Assignment Support
            </div>
            <h1 className="text-3xl font-bold text-slate-900">
              Learn it first, then write it well
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              This tutor helps you <strong>understand</strong> your assignment before writing.
              Work through each step to build genuine comprehension, then get help structuring your own ideas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void sendSupportRequest("understand", "Explain this assignment in simpler words and break down what it is asking me to do.")}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <BookOpen size={15} />
              Explain It
            </button>
            <button
              type="button"
              onClick={() => void sendSupportRequest("practice", "Coach me with questions so I can prove I understand before we draft.")}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <ClipboardCheck size={15} />
              Quiz Me
            </button>
            <button
              type="button"
              onClick={() => void sendSupportRequest("draft", `Create a professional assignment draft using my understanding and ${references.length > 0 ? `the ${references.length} references I provided` : "academic sources"}. Properly cite all sources in ${citationStyle || "APA"} format.`)}
              disabled={!canSubmit || estimatedReadiness < 50}
              title={estimatedReadiness < 50 ? `Need 50% understanding (currently ${estimatedReadiness}%)` : "Generate professional assignment with citations"}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                estimatedReadiness >= 50
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-200 hover:from-purple-700 hover:to-blue-700"
                  : "bg-slate-300 text-slate-500"
              }`}
            >
              {estimatedReadiness >= 50 ? (
                <>
                  <Sparkles size={15} />
                  Generate Professional Draft
                  {references.length > 0 && <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">{references.length} refs</span>}
                </>
              ) : (
                <>
                  <PenSquare size={15} />
                  Draft (Need {50 - estimatedReadiness}% more)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {(error || notice) && (
        <div className="mb-6 space-y-3">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{notice}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Assignment Brief
                </h2>
                <p className="text-sm text-slate-500">
                  Share the task exactly as your lecturer gave it.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Upload
                </button>
                <button
                  type="button"
                  onClick={clearSession}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={13} />
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Assignment Title
                </span>
                <input
                  value={assignmentTitle}
                  onChange={(event) => setAssignmentTitle(event.target.value)}
                  placeholder="e.g. Factors contributing to maternal mortality"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Course / Module
                  </span>
                  <input
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    placeholder="e.g. Midwifery Care II"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Programme
                  </span>
                  <input
                    value={programme}
                    onChange={(event) => setProgramme(event.target.value)}
                    placeholder="e.g. Diploma Nursing"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  What do you want help with most?
                </span>
                <input
                  value={studentGoal}
                  onChange={(event) => setStudentGoal(event.target.value)}
                  placeholder="e.g. I want help structuring my argument and using simpler language."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Assignment Instructions
                </span>
                <textarea
                  value={assignmentInstructions}
                  onChange={(event) => setAssignmentInstructions(event.target.value)}
                  rows={9}
                  placeholder="Paste the full assignment question, marking guide, or lecturer instructions here."
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Your Current Attempt
                </span>
                <textarea
                  value={currentAttempt}
                  onChange={(event) => setCurrentAttempt(event.target.value)}
                  rows={6}
                  placeholder="Paste your rough answer if you want the tutor to coach or improve it."
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <GraduationCap size={16} />
                  Advanced Options
                </span>
                <ChevronDown size={16} className={`transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`} />
              </button>

              {showAdvancedOptions && (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Target Word Count
                      </span>
                      <input
                        type="number"
                        value={wordCount ?? ""}
                        onChange={(event) => setWordCount(event.target.value ? parseInt(event.target.value, 10) : null)}
                        placeholder="e.g. 2000"
                        min={100}
                        max={20000}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        Citation Style
                      </span>
                      <select
                        value={citationStyle ?? ""}
                        onChange={(event) => setCitationStyle(event.target.value as CitationStyle || null)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Not specified</option>
                        {CITATION_STYLES.map((style) => (
                          <option key={style.value} value={style.value}>{style.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Calendar size={14} />
                      Due Date
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Marking Criteria / Rubric
                    </span>
                    <textarea
                      value={markingCriteria}
                      onChange={(event) => setMarkingCriteria(event.target.value)}
                      rows={4}
                      placeholder="Paste the marking rubric or grading criteria if available."
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                      <MessageCircle size={14} />
                      Previous Lecturer Feedback
                    </span>
                    <textarea
                      value={lecturerFeedback}
                      onChange={(event) => setLecturerFeedback(event.target.value)}
                      rows={3}
                      placeholder="Paste any feedback from previous assignments you'd like the tutor to help address."
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              )}

              {/* References Section */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
                <button
                  type="button"
                  onClick={() => setShowReferencesPanel(!showReferencesPanel)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Library size={16} className="text-purple-600" />
                    <span className="font-semibold text-slate-700">Your Sources & References</span>
                    {references.length > 0 && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                        {references.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showReferencesPanel ? "rotate-180" : ""}`} />
                </button>
                
                <p className="mt-1 text-xs text-slate-500">
                  Add your research sources. These will be cited in your professional draft.
                </p>

                {showReferencesPanel && (
                  <div className="mt-4 space-y-4">
                    {/* Add Reference Form */}
                    <div className="rounded-lg border border-purple-200 bg-white p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-700">
                        <Plus size={14} />
                        Add New Reference
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <select
                          value={newReference.type}
                          onChange={(e) => setNewReference({...newReference, type: e.target.value as Reference["type"]})}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                        >
                          <option value="book">📚 Book</option>
                          <option value="journal">📄 Journal Article</option>
                          <option value="website">🌐 Website</option>
                          <option value="other">📁 Other</option>
                        </select>
                        <input
                          value={newReference.year}
                          onChange={(e) => setNewReference({...newReference, year: e.target.value})}
                          placeholder="Year (e.g. 2023)"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                        />
                      </div>
                      <input
                        value={newReference.title}
                        onChange={(e) => setNewReference({...newReference, title: e.target.value})}
                        placeholder="Title of source *"
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                      <input
                        value={newReference.authors}
                        onChange={(e) => setNewReference({...newReference, authors: e.target.value})}
                        placeholder="Authors (e.g. Smith, J. & Brown, K.) *"
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                      <input
                        value={newReference.source}
                        onChange={(e) => setNewReference({...newReference, source: e.target.value})}
                        placeholder="Publisher / Journal Name"
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                      {newReference.type === "website" && (
                        <input
                          value={newReference.url || ""}
                          onChange={(e) => setNewReference({...newReference, url: e.target.value})}
                          placeholder="URL (for websites)"
                          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                        />
                      )}
                      <textarea
                        value={newReference.notes || ""}
                        onChange={(e) => setNewReference({...newReference, notes: e.target.value})}
                        placeholder="Key points from this source you want to use..."
                        rows={2}
                        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                      />
                      <button
                        type="button"
                        onClick={addReference}
                        disabled={!newReference.title.trim() || !newReference.authors.trim()}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <BookMarked size={14} />
                        Add Reference
                      </button>
                    </div>

                    {/* References List */}
                    {references.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">
                          Your References ({references.length})
                        </div>
                        {references.map((ref) => (
                          <div key={ref.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {ref.type === "book" && "📚"}
                                  {ref.type === "journal" && "📄"}
                                  {ref.type === "website" && "🌐"}
                                  {ref.type === "other" && "📁"}
                                </span>
                                <span className="text-xs font-semibold text-slate-800">{ref.title}</span>
                                <span className="text-xs text-slate-400">({ref.year})</span>
                              </div>
                              <div className="text-xs text-slate-500">{ref.authors}</div>
                              {ref.source && <div className="text-xs italic text-slate-400">{ref.source}</div>}
                              {ref.url && (
                                <a href={ref.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                  <Link2 size={10} />
                                  {ref.url.slice(0, 40)}...
                                </a>
                              )}
                              {ref.notes && (
                                <div className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-600">
                                  <strong>Notes:</strong> {ref.notes}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeReference(ref.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {references.length === 0 && (
                      <div className="rounded-lg border border-dashed border-purple-200 bg-white p-4 text-center">
                        <Library size={24} className="mx-auto mb-2 text-purple-300" />
                        <p className="text-xs text-slate-500">
                          No references added yet. Add your research sources to get properly cited content.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Help Mode
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose how you want the tutor to support you right now.
            </p>

            <div className="mt-4 space-y-3">
              {(["understand", "practice", "draft"] as AssignmentSupportMode[]).map(
                (item) => {
                  const isLocked = item === "draft" && estimatedReadiness < 50;
                  const canGeneratePro = item === "draft" && estimatedReadiness >= 50;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => !isLocked && setMode(item)}
                      disabled={isLocked}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        mode === item
                          ? item === "draft" && canGeneratePro
                            ? "border-purple-500 bg-gradient-to-r from-purple-50 to-blue-50"
                            : "border-blue-500 bg-blue-50"
                          : isLocked
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                            : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item === "understand" && <BookOpen size={16} className="text-blue-600" />}
                          {item === "practice" && <ClipboardCheck size={16} className="text-amber-600" />}
                          {item === "draft" && canGeneratePro && <Sparkles size={16} className="text-purple-600" />}
                          {item === "draft" && !canGeneratePro && <PenSquare size={16} className="text-slate-400" />}
                          <p className="text-sm font-semibold text-slate-900">
                            {item === "draft" && canGeneratePro ? "✨ Professional Draft" : formatModeLabel(item)}
                          </p>
                        </div>
                        {item === "understand" && estimatedReadiness >= 30 && (
                          <CheckCircle2 size={16} className="text-green-500" />
                        )}
                        {item === "practice" && estimatedReadiness >= 50 && (
                          <CheckCircle2 size={16} className="text-green-500" />
                        )}
                        {item === "draft" && estimatedReadiness >= 50 && (
                          <div className="flex items-center gap-1">
                            <Award size={16} className="text-purple-500" />
                            <span className="text-xs font-bold text-purple-600">Unlocked!</span>
                          </div>
                        )}
                        {isLocked && (
                          <span className="text-xs text-slate-400">Need 50% understanding</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item === "understand" &&
                          "Break down the task, decode keywords, and explain the concepts."}
                        {item === "practice" &&
                          "Get coached with questions and step-by-step reasoning."}
                        {item === "draft" && canGeneratePro &&
                          "Generate a professional assignment with your sources properly cited!"}
                        {item === "draft" && !canGeneratePro &&
                          "Complete understanding questions to unlock professional draft generation."}
                      </p>
                    </button>
                  );
                },
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Live Tutor Session
                </h2>
                <p className="text-sm text-slate-500">
                  Ask follow-up questions as you learn. The tutor keeps the thread.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Current mode: {formatModeLabel(mode)}
              </div>
            </div>

            <div className="mb-4 max-h-[340px] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {thread.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  Start with <span className="font-semibold text-slate-700">Understand</span>
                  {" "}to unpack the brief, then move into practice and drafting.
                </div>
              )}

              {thread.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-3xl rounded-xl px-4 py-3 text-sm shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide">
                    <span className="font-semibold">
                      {message.role === "user" ? "You" : "Tutor"}
                    </span>
                    <span className={message.role === "user" ? "text-blue-100" : "text-slate-400"}>
                      {formatModeLabel(message.mode)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={followUp}
                  onChange={(event) => setFollowUp(event.target.value)}
                  rows={4}
                  placeholder="Ask a follow-up, answer the tutor's questions, or request feedback on your draft..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceInput : startVoiceInput}
                    className={`absolute right-3 top-3 rounded-lg p-2 transition-colors ${
                      isRecording 
                        ? "bg-red-100 text-red-600 hover:bg-red-200" 
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    title={isRecording ? "Stop recording" : "Voice input"}
                  >
                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void sendSupportRequest(mode)}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  Continue Session
                </button>
                <button
                  type="button"
                  onClick={() => void sendSupportRequest("practice", "Use a few checking questions to test if I really understand this assignment.")}
                  disabled={!canSubmit || loading}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Practice Me
                </button>
                <button
                  type="button"
                  onClick={() => void sendSupportRequest("draft", `Generate a professional assignment${references.length > 0 ? ` using my ${references.length} references` : ""}. Cite sources in ${citationStyle || "APA"} format.`)}
                  disabled={!canSubmit || loading || estimatedReadiness < 50}
                  title={estimatedReadiness < 50 ? `Need 50% understanding to unlock (currently ${estimatedReadiness}%)` : "Generate professional assignment with citations"}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                    estimatedReadiness >= 50
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md hover:from-purple-700 hover:to-blue-700"
                      : "border border-slate-300 text-slate-500"
                  }`}
                >
                  {estimatedReadiness >= 50 ? (
                    <>
                      <Sparkles size={15} />
                      Generate Professional Draft
                    </>
                  ) : (
                    <>
                      <PenSquare size={15} />
                      Draft ({50 - estimatedReadiness}% more)
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Tutor Guidance
                </h2>
                <p className="text-sm text-slate-500">
                  Structured coaching, comprehension checks, and learning support.
                </p>
              </div>
              {latestTurn && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                    Stage: {formatModeLabel(latestTurn.response.stage)}
                  </span>
                  <span className={`rounded-full px-3 py-1 font-semibold ${
                    latestTurn.response.estimatedReadiness >= 50 
                      ? "bg-green-50 text-green-700"
                      : latestTurn.response.estimatedReadiness >= 30 
                        ? "bg-amber-50 text-amber-700" 
                        : "bg-red-50 text-red-700"
                  }`}>
                    Understanding: {latestTurn.response.estimatedReadiness}%
                    {latestTurn.response.estimatedReadiness >= 50 && " ✓ Draft Ready"}
                  </span>
                  {references.length > 0 && (
                    <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700">
                      📚 {references.length} References
                    </span>
                  )}
                </div>
              )}
            </div>

            {!latestTurn && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                <HelpCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p>Your tutor response will appear here after the first request.</p>
                <p className="mt-1 text-xs">Start with "Explain It" to understand your assignment.</p>
              </div>
            )}

            {latestTurn && (
              <div className="space-y-5">
                {/* Coaching Message */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-slate-50 p-4">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {latestTurn.response.coachingMessage}
                  </p>
                </div>

                {/* Main guidance sections */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SectionList
                    title="Learning Focus"
                    items={latestTurn.response.learningFocus}
                    tone="blue"
                  />
                  <SectionList
                    title="Check Questions"
                    items={latestTurn.response.checkQuestions}
                    tone="amber"
                  />
                  <SectionList
                    title="Outline"
                    items={latestTurn.response.outline}
                    tone="slate"
                  />
                  <SectionList
                    title="Next Steps"
                    items={latestTurn.response.nextSteps}
                    tone="emerald"
                  />
                </div>

                {/* Enhanced pedagogy sections */}
                {(latestTurn.response.conceptsExplained?.length > 0 ||
                  latestTurn.response.commonMistakes?.length > 0 ||
                  latestTurn.response.reflectionPrompts?.length > 0) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <GraduationCap size={16} />
                      Learning Support
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <SectionList
                        title="Concepts Explained"
                        items={latestTurn.response.conceptsExplained || []}
                        tone="blue"
                      />
                      <SectionList
                        title="Common Mistakes to Avoid"
                        items={latestTurn.response.commonMistakes || []}
                        tone="amber"
                      />
                      <SectionList
                        title="Reflection Prompts"
                        items={latestTurn.response.reflectionPrompts || []}
                        tone="emerald"
                      />
                    </div>
                  </div>
                )}

                {/* Paraphrasing tips and resources */}
                {(latestTurn.response.paraphrasingTips?.length > 0 ||
                  latestTurn.response.suggestedResources?.length > 0) && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SectionList
                      title="Paraphrasing Tips"
                      items={latestTurn.response.paraphrasingTips || []}
                      tone="blue"
                    />
                    <SectionList
                      title="Research Directions"
                      items={latestTurn.response.suggestedResources || []}
                      tone="slate"
                    />
                  </div>
                )}

                {/* Understanding indicators */}
                {latestTurn.response.understandingIndicators?.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
                      <Target size={16} />
                      Signs You Understand
                    </h3>
                    <ul className="space-y-1">
                      {latestTurn.response.understandingIndicators.map((indicator, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-green-700">
                          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                          <span>{indicator}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Draft section with export */}
                {latestTurn.response.draftResponse.trim() && (
                  <div className="rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Draft Scaffold
                        </p>
                        <p className="text-xs text-slate-500">
                          This is a starting point. Rewrite in your own words before submission.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyDraft()}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Copy size={13} />
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExportDraft()}
                          disabled={exporting}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                          Export DOCX
                        </button>
                      </div>
                    </div>
                    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
                      <p className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertTriangle size={14} />
                        <strong>Important:</strong> This draft requires significant editing. Add your own examples, verify claims, and rewrite in your voice.
                      </p>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {latestTurn.response.draftResponse}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default AssignmentSupport;
