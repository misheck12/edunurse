import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
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
  ListChecks,
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
  Hash,
  type LucideIcon,
} from "lucide-react";
import SEO from "../src/components/SEO";
import ChatPanel from "../components/ChatPanel";
import { useAuth } from "../src/context/AuthContext";
import {
  AssignmentSupportMessage,
  AssignmentSupportMode,
  AssignmentSupportResponse,
  AssignmentQuestion,
  CitationStyle,
  PracticeQuestion,
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
  moduleCode: string;
  lecturerName: string;
  submissionDate: string;
  studentGoal: string;
  assignmentInstructions: string;
  currentAttempt: string;
  personalInsights: string;
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

type WorkflowStepState = "complete" | "current" | "available" | "locked";
type RecommendedActionKind = "upload" | "understand" | "practice" | "draft" | "export";

const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "apa7", label: "APA 7th Edition" },
  { value: "harvard", label: "Harvard" },
  { value: "vancouver", label: "Vancouver" },
  { value: "mla", label: "MLA" },
  { value: "chicago", label: "Chicago" },
];

const DOCUMENT_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const DOCUMENT_EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};
const REFERENCE_NOTES_LIMIT = 1800;
const REFERENCE_NOTES_PREVIEW_LIMIT = 180;

function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatSavedTime(value: string | null) {
  if (!value) return "Not saved yet";

  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Saved";
  }
}

function createReferenceId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

function getDocumentMimeType(file: File) {
  if (DOCUMENT_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_EXTENSION_TO_MIME[extension] ?? null;
}

function normaliseDocumentFile(file: File) {
  const mimeType = getDocumentMimeType(file);
  if (!mimeType) {
    return null;
  }

  if (file.type === mimeType) {
    return file;
  }

  return new File([file], file.name, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}

function buildReferenceNotesSnippet(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= REFERENCE_NOTES_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, REFERENCE_NOTES_LIMIT - 1).trimEnd()}…`;
}

function buildReferenceNotesPreview(text: string) {
  const normalized = text.trim();
  if (normalized.length <= REFERENCE_NOTES_PREVIEW_LIMIT) {
    return normalized;
  }
  return `${normalized.slice(0, REFERENCE_NOTES_PREVIEW_LIMIT - 1).trimEnd()}…`;
}

type DraftPreviewBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string };

const DRAFT_PREVIEW_HEADING_RE =
  /^(introduction|main discussion|discussion|main body|body|conclusion|recommendations|analysis|reference list|references|bibliography)$/i;

function parseDraftPreview(raw: string): DraftPreviewBlock[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("### ")) {
        return { kind: "h3", text: line.slice(4).trim() } as DraftPreviewBlock;
      }
      if (line.startsWith("## ")) {
        return { kind: "h2", text: line.slice(3).trim() } as DraftPreviewBlock;
      }
      if (line.startsWith("# ")) {
        return { kind: "h2", text: line.slice(2).trim() } as DraftPreviewBlock;
      }
      if (/^[-*]\s+/.test(line)) {
        return { kind: "bullet", text: line.replace(/^[-*]\s+/, "").trim() } as DraftPreviewBlock;
      }
      if (DRAFT_PREVIEW_HEADING_RE.test(line)) {
        return { kind: "h2", text: line } as DraftPreviewBlock;
      }
      if (/^\d+(\.\d+)*\s+[A-Z]/.test(line)) {
        return { kind: "h3", text: line } as DraftPreviewBlock;
      }
      return { kind: "paragraph", text: line } as DraftPreviewBlock;
    });
}

function extractYouTubeVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (hostname !== "youtube.com" && hostname !== "youtube-nocookie.com") {
    return null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if ((segments[0] === "shorts" || segments[0] === "embed") && segments[1]) {
    return segments[1];
  }

  return null;
}

function normaliseYouTubeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const videoId = extractYouTubeVideoId(parsed);
    if (!videoId) {
      return null;
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return null;
  }
}

const createEmptySession = (): SavedAssignmentSupportSession => ({
  id: crypto.randomUUID(),
  name: "New Assignment",
  mode: "understand",
  assignmentTitle: "",
  course: "",
  programme: "",
  moduleCode: "",
  lecturerName: "",
  submissionDate: "",
  studentGoal: "",
  assignmentInstructions: "",
  currentAttempt: "",
  personalInsights: "",
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

function getLoadingMessage(mode: AssignmentSupportMode): string {
  switch (mode) {
    case "understand":
      return "Your tutor is reading your brief and preparing a clear breakdown…";
    case "practice":
      return "Creating a personalised quiz to test your understanding…";
    case "draft":
      return "Writing your professional draft with academic citations…";
    default:
      return "Your tutor is working on it…";
  }
}

function SectionList(props: {
  title: string;
  items: string[];
  icon?: LucideIcon;
  tone?: "blue" | "emerald" | "amber" | "slate" | "purple";
}) {
  const { title, items, icon: Icon, tone = "slate" } = props;
  if (items.length === 0) return null;

  const styles = {
    blue:    { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400",    header: "text-blue-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400", header: "text-emerald-600" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400",   header: "text-amber-600" },
    slate:   { bg: "bg-slate-50",   text: "text-slate-700",   dot: "bg-slate-400",   header: "text-slate-600" },
    purple:  { bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400",  header: "text-purple-600" },
  };

  const s = styles[tone];

  return (
    <div className={`rounded-lg border border-slate-100 ${s.bg} p-3`}>
      <p className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${s.header}`}>
        {Icon && <Icon size={12} />}
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className={`flex items-start gap-2 text-xs leading-relaxed ${s.text}`}
          >
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const AssignmentSupport: React.FC = () => {
  const { user } = useAuth();
  const storageKey = useMemo(() => buildStorageKey(user?.id), [user?.id]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  const briefTextareaRef = useRef<HTMLTextAreaElement>(null);
  const skipAutosaveRef = useRef(true);

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
  const [moduleCode, setModuleCode] = useState("");
  const [lecturerName, setLecturerName] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [studentGoal, setStudentGoal] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [currentAttempt, setCurrentAttempt] = useState("");
  const [personalInsights, setPersonalInsights] = useState("");
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
  const [youtubeUrl, setYoutubeUrl] = useState("");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showIntegrityPanel, setShowIntegrityPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<"brief" | "references" | "attempt">("brief");
  const [isBriefDragActive, setIsBriefDragActive] = useState(false);
  const [showBriefGuide, setShowBriefGuide] = useState(true);
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Practice quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizChecked, setQuizChecked] = useState<Record<string, boolean>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizDismissed, setQuizDismissed] = useState(false);
  const [quizGrading, setQuizGrading] = useState(false);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<PracticeQuestion[]>([]);
  const [quizFeedback, setQuizFeedback] = useState<Record<string, { isCorrect: boolean; feedback: string }>>({});

  // Multi-question navigator state
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);

  // Pending auto-teach flag — set by file upload, consumed by effect
  const [pendingAutoTeach, setPendingAutoTeach] = useState(false);

  // Auto-advance flags for the automatic pipeline
  const [pendingAutoPractice, setPendingAutoPractice] = useState(false);
  const [pendingAutoDraft, setPendingAutoDraft] = useState(false);

  // Tutor guidance collapsible state
  const [showDeepLearning, setShowDeepLearning] = useState(false);

  // Check for voice support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setVoiceSupported(Boolean(SpeechRecognition));
    }
  }, []);

  // Auto-teach after file upload — fires after state has committed
  useEffect(() => {
    if (pendingAutoTeach && assignmentInstructions.trim().length >= 10 && !loading) {
      setPendingAutoTeach(false);
      void sendSupportRequest(
        "understand",
        "I just uploaded my assignment. Please read through it, identify all the key topics I need to understand, and explain what the question is really asking me to do."
      );
    }
  }, [pendingAutoTeach, assignmentInstructions, loading]);

  // Auto-advance: understand → practice (quiz the student after teaching)
  useEffect(() => {
    if (pendingAutoPractice && !loading) {
      setPendingAutoPractice(false);
      setNotice("📝 Starting your knowledge check…");
      void sendSupportRequest(
        "practice",
        "Now test my understanding with a quiz. Generate a mix of multiple-choice and short-answer questions based on the topics you just taught me."
      );
    }
  }, [pendingAutoPractice, loading]);

  // Auto-advance: practice grading → draft (generate assignment after good quiz)
  useEffect(() => {
    if (pendingAutoDraft && !loading) {
      setPendingAutoDraft(false);
      setQuizDismissed(true);
      setNotice("✨ Great quiz results! Generating your assignment draft…");
      void sendSupportRequest(
        "draft",
        `Generate a professional assignment draft based on my demonstrated understanding from the quiz.${
          references.length > 0 ? ` Use my ${references.length} references.` : ""
        } Cite in ${citationStyle || "APA"} format. Use clear academic section headings and a proper reference list.`
      );
    }
  }, [pendingAutoDraft, loading]);

  useEffect(() => {
    const textarea = briefTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 220), 520)}px`;
  }, [assignmentInstructions]);

  useEffect(() => {
    if (!assignmentInstructions.trim()) {
      setShowBriefGuide(true);
      return;
    }
    if (assignmentInstructions.trim().length >= 10) {
      setShowBriefGuide(false);
    }
  }, [assignmentInstructions]);

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
    setModuleCode(session.moduleCode ?? "");
    setLecturerName(session.lecturerName ?? "");
    setSubmissionDate(session.submissionDate ?? "");
    setStudentGoal(session.studentGoal);
    setAssignmentInstructions(session.assignmentInstructions);
    setCurrentAttempt(session.currentAttempt);
    setPersonalInsights(session.personalInsights ?? "");
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
    setYoutubeUrl("");
    setFocusQuestionId(null);
    setShowIntegrityPanel(true);
    setLastSavedAt(session.updatedAt ?? null);
    setSaveState(session.updatedAt ? "saved" : "idle");
    setShowBriefGuide(session.assignmentInstructions.trim().length < 10);
    skipAutosaveRef.current = true;
    resetQuiz();
  }, [hydrated, activeSessionId, sessions]);

  // Save current session
  const saveCurrentSession = useCallback(() => {
    if (!hydrated || !activeSessionId) return;
    const savedAt = new Date().toISOString();
    
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
              moduleCode,
              lecturerName,
              submissionDate,
              studentGoal,
              assignmentInstructions,
              currentAttempt,
              personalInsights,
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
              updatedAt: savedAt,
            }
          : s
      );
      writeSessionsStore(storageKey, { sessions: updated, activeSessionId });
      return updated;
    });
    setLastSavedAt(savedAt);
    setSaveState("saved");
  }, [
    hydrated, activeSessionId, storageKey, mode, assignmentTitle, course, programme,
    moduleCode, lecturerName, submissionDate,
    studentGoal, assignmentInstructions, currentAttempt, personalInsights, followUp, thread, turns,
    wordCount, citationStyle, markingCriteria, lecturerFeedback, dueDate, understandingScore, references,
  ]);

  // Auto-save on changes
  useEffect(() => {
    if (!hydrated || !activeSessionId) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    setSaveState("saving");
    const timeout = setTimeout(saveCurrentSession, 1000);
    return () => clearTimeout(timeout);
  }, [hydrated, activeSessionId, saveCurrentSession]);

  const latestTurn = turns[turns.length - 1] ?? null;
  const estimatedReadiness = latestTurn?.response.estimatedReadiness ?? understandingScore;
  const hasAssignmentBrief = assignmentInstructions.trim().length >= 10;
  const canSubmit = assignmentInstructions.trim().length >= 10 && !loading;
  const canGenerateProfessional = estimatedReadiness >= 50;
  const hasReferences = references.length > 0;
  const hasPersonalInsights = personalInsights.trim().length > 0;
  const hasDraft = Boolean(latestTurn?.response.draftResponse?.trim());
  const isDraftGenerating = loading && (mode === "draft" || pendingAutoDraft);
  const briefWordCount = useMemo(() => countWords(assignmentInstructions), [assignmentInstructions]);
  const briefCharacterCount = assignmentInstructions.trim().length;
  const personalInsightsLength = personalInsights.trim().length;
  const draftPreviewBlocks = useMemo(
    () => parseDraftPreview(latestTurn?.response.draftResponse ?? ""),
    [latestTurn?.response.draftResponse],
  );
  const personalizationChecklist = useMemo(
    () => [
      hasPersonalInsights
        ? "Check that the draft uses your notes and real examples accurately."
        : "Add at least one real class, placement, or ward example before submission.",
      currentAttempt.trim()
        ? "Blend in the strongest phrasing from your own draft where it sounds most like you."
        : "Rewrite the opening paragraph in your own wording so the final paper sounds like you.",
      lecturerFeedback.trim()
        ? "Confirm each lecturer feedback point is clearly addressed in the final version."
        : "Cross-check the final version against your rubric or lecturer expectations.",
      hasReferences
        ? "Verify every citation against the source you actually used."
        : "Add and verify real sources before you export the final paper.",
    ],
    [currentAttempt, hasPersonalInsights, hasReferences, lecturerFeedback],
  );

  // Practice quiz helpers — use saved questions so they persist during AI grading
  const practiceQuestions: PracticeQuestion[] = activeQuizQuestions.length > 0
    ? activeQuizQuestions
    : (latestTurn?.response.practiceQuestions ?? []);
  const hasPracticeQuiz = practiceQuestions.length > 0 && !quizDismissed;
  const answeredQuestionCount = useMemo(
    () =>
      practiceQuestions.filter((question) => (quizAnswers[question.id] ?? "").trim().length > 0)
        .length,
    [practiceQuestions, quizAnswers],
  );
  const quizProgressPercent =
    practiceQuestions.length > 0
      ? Math.round((answeredQuestionCount / practiceQuestions.length) * 100)
      : 0;
  const currentQuizQuestion = practiceQuestions[quizQuestionIndex] ?? null;
  const canSubmitQuiz =
    practiceQuestions.length > 0 &&
    answeredQuestionCount === practiceQuestions.length &&
    !loading &&
    !quizSubmitted;

  useEffect(() => {
    if (practiceQuestions.length === 0) {
      setQuizQuestionIndex(0);
      return;
    }
    setQuizQuestionIndex((current) => Math.min(current, practiceQuestions.length - 1));
  }, [practiceQuestions.length]);

  // Multi-question detection helpers
  const assignmentQuestions: AssignmentQuestion[] = latestTurn?.response.assignmentQuestions ?? [];
  const hasMultipleQuestions = assignmentQuestions.length > 1;
  const focusedQuestion = assignmentQuestions.find((q) => q.id === focusQuestionId) ?? null;

  // Topic coverage tracking
  const topicsCovered = latestTurn?.response.topicsCovered ?? [];
  const hasTopics = topicsCovered.length > 0;
  const coveredCount = topicsCovered.filter((t) => t.status === "covered").length;
  const inProgressCount = topicsCovered.filter((t) => t.status === "in_progress").length;
  const avgConfidence = topicsCovered.length > 0
    ? Math.round(topicsCovered.reduce((sum, t) => sum + t.confidence, 0) / topicsCovered.length)
    : 0;

  const quizScore = useMemo(() => {
    if (!quizSubmitted || practiceQuestions.length === 0) return null;
    let correct = 0;
    for (const q of practiceQuestions) {
      if (q.type === "mcq") {
        if ((quizAnswers[q.id] ?? "").toUpperCase() === q.correctAnswer.toUpperCase()) correct++;
      } else {
        // Short answer: use AI grading result
        if (quizFeedback[q.id]?.isCorrect) correct++;
      }
    }
    return { correct, total: practiceQuestions.length, pct: Math.round((correct / practiceQuestions.length) * 100) };
  }, [quizSubmitted, practiceQuestions, quizAnswers, quizFeedback]);

  const workflowSteps = useMemo(
    () => [
      {
        key: "brief",
        title: "Add brief",
        description: hasAssignmentBrief ? "Brief loaded and ready." : "Paste or upload the assignment question.",
        icon: FileText,
        state: (hasAssignmentBrief ? "complete" : "current") as WorkflowStepState,
      },
      {
        key: "understand",
        title: "Learn",
        description: estimatedReadiness >= 30
          ? `Understanding built to ${estimatedReadiness}%.`
          : "Get a clearer breakdown of what the task asks.",
        icon: BookOpen,
        state: (!hasAssignmentBrief
          ? "locked"
          : estimatedReadiness >= 30
            ? "complete"
            : mode === "understand" || !latestTurn
              ? "current"
              : "available") as WorkflowStepState,
      },
      {
        key: "practice",
        title: "Test",
        description: estimatedReadiness >= 50
          ? "Knowledge check completed."
          : "Use the quiz to confirm understanding.",
        icon: ClipboardCheck,
        state: (!hasAssignmentBrief
          ? "locked"
          : estimatedReadiness >= 50
            ? "complete"
            : estimatedReadiness >= 30 || mode === "practice" || hasPracticeQuiz
              ? "current"
              : "locked") as WorkflowStepState,
      },
      {
        key: "draft",
        title: "Generate draft",
        description: hasDraft
          ? "Draft ready to review and export."
          : canGenerateProfessional
            ? "Professional draft is unlocked."
            : "Unlocks at 50% readiness.",
        icon: Sparkles,
        state: (!hasAssignmentBrief
          ? "locked"
          : hasDraft
            ? "complete"
            : canGenerateProfessional || mode === "draft"
              ? "current"
              : "locked") as WorkflowStepState,
      },
    ],
    [canGenerateProfessional, estimatedReadiness, hasAssignmentBrief, hasDraft, hasPracticeQuiz, latestTurn, mode],
  );

  const nextStepHint = useMemo(() => {
    if (!hasAssignmentBrief) {
      return "Start by pasting the full brief or dropping in a PDF/Word document.";
    }
    if (loading) {
      return getLoadingMessage(mode);
    }
    if (!latestTurn) {
      return "Ask the tutor to break down the task before you move on to the quiz.";
    }
    if (estimatedReadiness < 30) {
      return "You are still in the learning phase — use Explain It to unpack the brief and key topics.";
    }
    if (estimatedReadiness < 50) {
      return "You are ready for a knowledge check. A stronger quiz score unlocks the professional draft.";
    }
    if (!hasDraft) {
      return "You have enough understanding to generate a polished draft with citations.";
    }
    return "Review the generated draft, personalise it, and export when ready.";
  }, [estimatedReadiness, hasAssignmentBrief, hasDraft, latestTurn, loading, mode]);

  const recommendedAction = useMemo(() => {
    if (!hasAssignmentBrief) {
      return {
        kind: "upload" as RecommendedActionKind,
        title: "Add your assignment brief",
        description: "Upload a PDF/Word brief or paste the question to unlock tutoring, topic detection, and draft generation.",
        actionLabel: uploading ? "Uploading…" : "Upload brief",
        secondaryLabel: "Paste into editor",
        icon: Upload,
        tone: "blue",
        disabled: uploading,
      };
    }

    if (canGenerateProfessional && hasDraft) {
      return {
        kind: "export" as RecommendedActionKind,
        title: "Review and export your draft",
        description: "Your draft is ready. Export it to Word, then personalise examples, tone, and final checks before submission.",
        actionLabel: exporting ? "Exporting…" : "Export Word draft",
        secondaryLabel: "Copy draft",
        icon: Download,
        tone: "emerald",
        disabled: exporting || !hasDraft,
      };
    }

    if (canGenerateProfessional) {
      return {
        kind: "draft" as RecommendedActionKind,
        title: "Generate your professional draft",
        description: "You have reached draft-ready understanding. Generate a first version using your brief, notes, references, and citation style.",
        actionLabel: isDraftGenerating ? "Generating draft…" : "Generate draft",
        secondaryLabel: hasPersonalInsights
          ? "Your own notes are attached"
          : hasReferences
            ? `${references.length} source${references.length === 1 ? "" : "s"} attached`
            : "No sources or personal notes attached yet",
        icon: Sparkles,
        tone: "purple",
        disabled: loading || !canGenerateProfessional,
      };
    }

    if (estimatedReadiness >= 30 || hasPracticeQuiz) {
      return {
        kind: "practice" as RecommendedActionKind,
        title: "Take the knowledge check",
        description: "Use the quiz to prove understanding, get feedback, and push your readiness above the draft threshold.",
        actionLabel: loading && mode === "practice" ? "Building quiz…" : "Start quiz",
        secondaryLabel: `${estimatedReadiness}% readiness • target 50%`,
        icon: ClipboardCheck,
        tone: "amber",
        disabled: !canSubmit || loading,
      };
    }

    return {
      kind: "understand" as RecommendedActionKind,
      title: "Break down the assignment",
      description: "Let the tutor explain what the brief is really asking, surface the key topics, and prepare you for the quiz.",
      actionLabel: loading && mode === "understand" ? "Explaining…" : "Explain it",
      secondaryLabel: focusedQuestion
        ? `Focused on question ${focusedQuestion.questionNumber}`
        : "Best first step for a fresh brief",
      icon: BookOpen,
      tone: "blue",
      disabled: !canSubmit || loading,
    };
  }, [
    canGenerateProfessional,
    canSubmit,
    estimatedReadiness,
    exporting,
    focusedQuestion,
    hasAssignmentBrief,
    hasDraft,
    hasPracticeQuiz,
    hasPersonalInsights,
    hasReferences,
    isDraftGenerating,
    loading,
    mode,
    references.length,
    uploading,
  ]);

  const draftUnlockChecklist = useMemo(
    () => [
      {
        label: "Brief added",
        done: hasAssignmentBrief,
        hint: hasAssignmentBrief ? "Ready to work from." : "Paste or upload the task first.",
      },
      {
        label: "Task explained",
        done: Boolean(latestTurn),
        hint: latestTurn
          ? "Tutor guidance is available."
          : "Use Explain It for a clearer breakdown.",
      },
      {
        label: "Knowledge checked",
        done: quizSubmitted || estimatedReadiness >= 50,
        hint:
          quizSubmitted || estimatedReadiness >= 50
            ? "Quiz submitted or readiness already high."
            : "Complete the quiz to prove understanding.",
      },
      {
        label: "Draft unlocked",
        done: canGenerateProfessional,
        hint: canGenerateProfessional
          ? "You can generate the draft now."
          : `Unlocks at 50% readiness. Current: ${estimatedReadiness}%.`,
      },
    ],
    [canGenerateProfessional, estimatedReadiness, hasAssignmentBrief, latestTurn, quizSubmitted],
  );

  const explainPrompt = focusedQuestion
    ? `Explain question ${focusedQuestion.questionNumber}: "${focusedQuestion.questionText}" in simpler words and break down what it is asking me to do.`
    : "Explain this assignment in simpler words and break down what it is asking me to do.";
  const practicePrompt = focusedQuestion
    ? `Coach me with questions about question ${focusedQuestion.questionNumber}: "${focusedQuestion.questionText}" so I can prove I understand it.`
    : "Coach me with questions so I can prove I understand before we draft.";
  const draftPrompt = focusedQuestion
    ? `Create a professional draft for question ${focusedQuestion.questionNumber}: "${focusedQuestion.questionText}" using my understanding, ${hasPersonalInsights ? "my own notes/examples, " : ""}and ${references.length > 0 ? `the ${references.length} references I provided` : "academic sources"}. Properly cite all sources in ${citationStyle || "APA"} format. Use clear academic section headings and a proper reference list.`
    : `Create a professional assignment draft using my understanding, ${hasPersonalInsights ? "my own notes/examples, " : ""}and ${references.length > 0 ? `the ${references.length} references I provided` : "academic sources"}. Properly cite all sources in ${citationStyle || "APA"} format. Use clear academic section headings and a proper reference list.`;

  const runRecommendedAction = () => {
    if (recommendedAction.kind === "upload") {
      fileInputRef.current?.click();
      return;
    }
    if (recommendedAction.kind === "understand") {
      void sendSupportRequest("understand", explainPrompt);
      return;
    }
    if (recommendedAction.kind === "practice") {
      void sendSupportRequest("practice", practicePrompt);
      return;
    }
    if (recommendedAction.kind === "draft") {
      void sendSupportRequest("draft", draftPrompt);
      return;
    }
    void handleExportDraft();
  };

  const handleQuizSubmit = () => {
    // Auto-check MCQs locally for immediate visual feedback
    const checked: Record<string, boolean> = { ...quizChecked };
    for (const q of practiceQuestions) {
      if (q.type === "mcq") {
        checked[q.id] = (quizAnswers[q.id] ?? "").toUpperCase() === q.correctAnswer.toUpperCase();
      }
    }
    setQuizChecked(checked);
    setQuizSubmitted(true);

    // Build quiz answers summary for AI grading
    const answersSummary = practiceQuestions.map((q, i) => {
      const answer = quizAnswers[q.id] ?? "(no answer)";
      if (q.type === "mcq") {
        return `Q${i + 1} [MCQ, id=${q.id}] "${q.question}" → My answer: ${answer}`;
      }
      return `Q${i + 1} [Short Answer, id=${q.id}] "${q.question}" → My answer: "${answer}"`;
    }).join("\n");

    // Send to AI for comprehensive grading (especially short answers)
    setQuizGrading(true);
    void sendSupportRequest(
      "practice",
      `Please grade my quiz answers and update my readiness score:\n\n${answersSummary}\n\nEvaluate each answer — for short answers assess if I demonstrated understanding. Return quizResults for each question with feedback.`
    );
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setQuizChecked({});
    setQuizSubmitted(false);
    setQuizDismissed(false);
    setQuizGrading(false);
    setQuizQuestionIndex(0);
    setQuizFeedback({});
  };

  const dismissQuiz = () => {
    setQuizDismissed(true);
    setActiveQuizQuestions([]);
    setQuizQuestionIndex(0);
    setQuizFeedback({});
    setMode(estimatedReadiness >= 50 ? "draft" : "understand");
  };

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
        personalInsights: personalInsights.trim() || undefined,
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
        // Multi-question focus
        focusQuestionId: focusQuestionId ?? undefined,
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
      if (response.draftResponse.trim()) {
        setShowIntegrityPanel(true);
      }

      // Save quiz questions when new practice questions arrive
      if (selectedMode === "practice" && (response.practiceQuestions?.length ?? 0) > 0) {
        setActiveQuizQuestions(response.practiceQuestions);
        resetQuiz();
      }

      // Process quiz grading results from AI
      if ((response.quizResults?.length ?? 0) > 0) {
        const fb: Record<string, { isCorrect: boolean; feedback: string }> = {};
        const chk: Record<string, boolean> = {};
        for (const r of response.quizResults) {
          fb[r.questionId] = { isCorrect: r.isCorrect, feedback: r.feedback };
          chk[r.questionId] = r.isCorrect;
        }
        setQuizFeedback(fb);
        // Merge AI grading with existing MCQ checks
        setQuizChecked((prev) => ({ ...prev, ...chk }));
        setQuizGrading(false);
      }

      // Auto-advance: understand → practice (quiz the student after teaching)
      if (selectedMode === "understand" && response.estimatedReadiness >= 25) {
        setPendingAutoPractice(true);
      }

      // Auto-advance: practice grading → draft (generate assignment after good quiz)
      if (
        selectedMode === "practice" &&
        response.estimatedReadiness >= 50 &&
        response.suggestedMode === "draft" &&
        (response.practiceQuestions?.length ?? 0) === 0
      ) {
        setPendingAutoDraft(true);
      }
      
      // More informative notices based on the automatic pipeline
      if (response.estimatedReadiness >= 50 && selectedMode === "draft") {
        setNotice(
          `🎉 Professional assignment generated! Your understanding is at ${response.estimatedReadiness}%. ` +
          "Review the draft, add your personal insights, and customize before submission."
        );
      } else if (selectedMode === "understand" && response.estimatedReadiness >= 25) {
        setNotice(
          `📚 Understanding at ${response.estimatedReadiness}%. Moving to knowledge check…`
        );
      } else if (selectedMode === "practice" && (response.quizResults?.length ?? 0) > 0 && response.estimatedReadiness >= 50) {
        setNotice(
          `🎉 Quiz complete! Score ready. Understanding at ${response.estimatedReadiness}%. Generating your draft…`
        );
      } else if (selectedMode === "practice" && (response.quizResults?.length ?? 0) > 0) {
        setNotice(
          `Quiz graded! Understanding at ${response.estimatedReadiness}%. ` +
          `${response.estimatedReadiness < 50 ? "Let's try more questions to build your understanding." : ""}`
        );
      } else if (selectedMode === "practice" && (response.practiceQuestions?.length ?? 0) > 0) {
        setNotice(
          `📝 Quiz ready! Answer the questions below. Your answers will be graded automatically.`
        );
      } else {
        setNotice(
          `Understanding: ${response.estimatedReadiness}%. ` +
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
    setModuleCode("");
    setLecturerName("");
    setSubmissionDate("");
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
    setYoutubeUrl("");
    setShowBriefGuide(true);
    setShowIntegrityPanel(true);
    resetQuiz();
    setActiveQuizQuestions([]);
    setFocusQuestionId(null);
    setPendingAutoPractice(false);
    setPendingAutoDraft(false);
    setLastSavedAt(null);
    setSaveState("idle");
    skipAutosaveRef.current = true;
    setError(null);
    setNotice("Assignment support session cleared. Start fresh!");
  };

  // Reference management
  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((ref) => ref.id !== id));
  };

  // File upload handler
  const processAssignmentFile = async (rawFile: File) => {
    const file = normaliseDocumentFile(rawFile);
    
    if (!file) {
      setError("Please upload a PDF or Word document (.pdf, .docx, .doc).");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > DOCUMENT_UPLOAD_LIMIT_BYTES) {
      setError("File is too large. Maximum size is 5MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setUploading(true);
    setError(null);
    
    try {
      const result = await extractDocumentText(file);
      setAssignmentInstructions(result.text);
      setNotice(`Document uploaded! Starting your tutor session…`);
      
      // Try to extract title from filename
      if (!assignmentTitle) {
        const nameWithoutExt = stripFileExtension(file.name);
        setAssignmentTitle(nameWithoutExt);
      }

      // Auto-trigger teaching — flag will be consumed by the useEffect
      // once React has committed the assignmentInstructions state update
      setPendingAutoTeach(true);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];
    if (!rawFile) return;
    await processAssignmentFile(rawFile);
  };

  const handleBriefDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsBriefDragActive(false);
    const rawFile = event.dataTransfer.files?.[0];
    if (!rawFile) return;
    await processAssignmentFile(rawFile);
  };

  const handleBriefDragLeave = (event: React.DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsBriefDragActive(false);
  };

  const handleReferenceFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];
    if (!rawFile) return;

    const file = normaliseDocumentFile(rawFile);

    if (!file) {
      setError("Please upload a PDF or Word document (.pdf, .docx, .doc).");
      if (referenceFileInputRef.current) {
        referenceFileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > DOCUMENT_UPLOAD_LIMIT_BYTES) {
      setError("Reference file is too large. Maximum size is 5MB.");
      if (referenceFileInputRef.current) {
        referenceFileInputRef.current.value = "";
      }
      return;
    }

    setReferenceUploading(true);
    setError(null);

    try {
      const result = await extractDocumentText(file);
      const reference: Reference = {
        id: createReferenceId(),
        type: "other",
        title: stripFileExtension(file.name) || "Uploaded reference",
        authors: "Uploaded source",
        year: new Date().getFullYear().toString(),
        source: file.name,
        notes:
          buildReferenceNotesSnippet(result.text) || "Student-uploaded reference document.",
      };

      setReferences((prev) => [...prev, reference]);
      setNotice(`Reference added from "${file.name}".`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to read the reference file. Please try again."
      );
    } finally {
      setReferenceUploading(false);
      if (referenceFileInputRef.current) {
        referenceFileInputRef.current.value = "";
      }
    }
  };

  const addYouTubeReference = () => {
    const normalizedUrl = normaliseYouTubeUrl(youtubeUrl);

    if (!normalizedUrl) {
      setError("Please paste a valid YouTube URL.");
      return;
    }

    const reference: Reference = {
      id: createReferenceId(),
      type: "website",
      title: "YouTube video",
      authors: "YouTube creator",
      year: new Date().getFullYear().toString(),
      source: "YouTube",
      url: normalizedUrl,
      notes: "Student-provided video reference. Update the title or creator if needed.",
    };

    setReferences((prev) => [...prev, reference]);
    setYoutubeUrl("");
    setError(null);
    setNotice("YouTube source added.");
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
        studentName: user?.fullName ?? undefined,
        studentNumber: user?.studentNumber ?? undefined,
        school: user?.school ?? undefined,
        course: course || undefined,
        programme: programme || undefined,
        moduleCode: moduleCode || undefined,
        lecturerName: lecturerName || undefined,
        dueDate: dueDate || undefined,
        submissionDate: submissionDate || undefined,
        wordCount: wordCount ?? undefined,
        references: references.length > 0 ? references.map(r => ({
          type: r.type,
          title: r.title,
          authors: r.authors,
          year: r.year,
          source: r.source,
          url: r.url,
        })) : undefined,
      });
      
      // Download the file directly
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(assignmentTitle || "Assignment").slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setNotice("Assignment exported as Word document. Review and personalise before submission.");
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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SEO
        title="Assignment Studio"
        description="Upload your assignment, learn the topics, pass a quiz, and get a professionally formatted draft — all automated."
        canonicalPath="/assignment-support"
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        onChange={(e) => void handleFileUpload(e)}
        className="hidden"
      />
      <input
        ref={referenceFileInputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        onChange={(e) => void handleReferenceFileUpload(e)}
        className="hidden"
      />

      {/* ── Compact Header ── */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <GraduationCap size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Assignment Studio</h1>
              <p className="text-xs text-slate-500">Upload → Learn → Quiz → Download</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                onClick={() => setView("support")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === "support"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <GraduationCap size={13} />
                Studio
              </button>
              <button
                onClick={() => setView("chat")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === "chat"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <MessageSquare size={13} />
                Chat
              </button>
            </div>

            {/* Sessions */}
            <button
              type="button"
              onClick={() => setShowSessionManager(!showSessionManager)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <FileText size={13} />
              {sessions.length}
              <ChevronDown size={12} className={`transition-transform ${showSessionManager ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Progress Row */}
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {workflowSteps.map((step, index) => {
              const StepIcon = step.icon;
              const stateStyles = {
                complete: "border-green-200 bg-green-50 text-green-700",
                current: "border-blue-200 bg-blue-50 text-blue-700",
                available: "border-amber-200 bg-amber-50 text-amber-700",
                locked: "border-slate-200 bg-slate-50 text-slate-400",
              } as const;

              return (
                <div key={step.key} className={`relative rounded-xl border p-3 ${stateStyles[step.state]}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
                      {step.state === "complete" ? <CheckCircle2 size={16} /> : <StepIcon size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide">Step {index + 1}</span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold">
                          {step.state === "complete" ? "Done" : step.state === "current" ? "Now" : step.state === "available" ? "Ready" : "Locked"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-90">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Recommended next step</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{recommendedAction.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{nextStepHint}</p>
                <p className="mt-2 text-[11px] font-medium text-slate-500">{recommendedAction.secondaryLabel}</p>
              </div>

              <div className="flex flex-col gap-3 xl:min-w-[320px]">
                <div className="flex items-center gap-2">
                  <Target size={14} className={estimatedReadiness >= 50 ? "text-green-500" : "text-slate-400"} />
                  <div className="relative h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-500 ${
                        estimatedReadiness >= 50 ? "bg-gradient-to-r from-green-500 to-emerald-500" : estimatedReadiness >= 30 ? "bg-amber-500" : "bg-red-400"
                      }`}
                      style={{ width: `${estimatedReadiness}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${estimatedReadiness >= 50 ? "text-green-600" : "text-slate-600"}`}>
                    {estimatedReadiness}%
                  </span>
                  {estimatedReadiness >= 50 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      Draft Ready
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={runRecommendedAction}
                    disabled={recommendedAction.disabled}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      recommendedAction.tone === "emerald"
                        ? "bg-green-600 hover:bg-green-700"
                        : recommendedAction.tone === "purple"
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          : recommendedAction.tone === "amber"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {loading && recommendedAction.kind !== "upload" ? <Loader2 size={15} className="animate-spin" /> : <recommendedAction.icon size={15} />}
                    {recommendedAction.actionLabel}
                  </button>

                  {!hasAssignmentBrief && (
                    <button
                      type="button"
                      onClick={() => briefTextareaRef.current?.focus()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <PenSquare size={15} />
                      Paste instead
                    </button>
                  )}

                  {recommendedAction.kind === "export" && hasDraft && (
                    <button
                      type="button"
                      onClick={() => void copyDraft()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy size={15} />
                      Copy draft
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Manager Dropdown */}
        {showSessionManager && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={createNewSession}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw size={12} />
              New
            </button>
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchSession(session.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    session.id === activeSessionId
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {session.name || "Untitled"}
                </button>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    className="rounded p-0.5 text-slate-400 hover:text-red-500"
                    title="Delete session"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {view === "chat" ? (
        <ChatPanel context="general" />
      ) : (
      <>
        {/* Error & Notice */}
        {(error || notice) && (
          <div className="mb-4 space-y-2">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{notice}</span>
              </div>
            )}
          </div>
        )}

        {/* ── HERO: Assignment Brief ── */}
        <section
          className={`mb-4 rounded-xl border bg-white p-5 shadow-sm transition-all ${
            isBriefDragActive
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBriefDragActive) {
              setIsBriefDragActive(true);
            }
          }}
          onDragLeave={handleBriefDragLeave}
          onDrop={(event) => void handleBriefDrop(event)}
        >
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <label className="text-sm font-semibold text-slate-800">
                Your Assignment Brief <span className="text-red-400">*</span>
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  saveState === "saving"
                    ? "bg-amber-50 text-amber-700"
                    : saveState === "saved"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                }`}>
                  {saveState === "saving" ? "Saving..." : saveState === "saved" ? `Saved ${formatSavedTime(lastSavedAt)}` : "Start adding your brief"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {briefWordCount} words
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {briefCharacterCount} characters
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBriefGuide((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <HelpCircle size={12} />
                {showBriefGuide ? "Hide setup tips" : "Show setup tips"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Upload PDF / Word
              </button>
              <button
                type="button"
                onClick={clearSession}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={12} />
                Clear
              </button>
            </div>
          </div>

          {(!hasAssignmentBrief || showBriefGuide) && (
            <div className="mb-4 rounded-xl border border-dashed border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold text-slate-800">Start here</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Add the full brief first. Once it is loaded, the studio can explain the task, build a quiz, and generate a draft from your understanding.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      "Paste the full assignment question or marking guide.",
                      "Or drop in a PDF / Word brief to extract the text automatically.",
                      "Add sources and citation style for better draft quality.",
                      "Use Explain It first, then move to Quiz Me and Draft.",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm">
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-52">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Upload size={13} />
                    Upload brief
                  </button>
                  <button
                    type="button"
                    onClick={() => briefTextareaRef.current?.focus()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <PenSquare size={13} />
                    Paste into editor
                  </button>
                  <p className="text-[11px] text-slate-500">
                    Tip: Drag and drop a brief anywhere inside this card.
                  </p>
                </div>
              </div>
            </div>
          )}

          <textarea
            ref={briefTextareaRef}
            value={assignmentInstructions}
            onChange={(e) => setAssignmentInstructions(e.target.value)}
            rows={1}
            placeholder="Paste the full assignment question, marking guide, or lecturer instructions here…"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-relaxed placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { label: "Essay brief", value: "Essay brief" },
              { label: "Case study", value: "Case study" },
              { label: "Reflective assignment", value: "Reflective assignment" },
              { label: citationStyle ? `Citation: ${citationStyle.toUpperCase()}` : "Add citation style", value: citationStyle ? "" : "Add citation style" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500"
              >
                {chip.label}
              </span>
            ))}
            {wordCount && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                {wordCount} words target
              </span>
            )}
            {moduleCode && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                Module {moduleCode}
              </span>
            )}
            {isBriefDragActive && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-600">
                Drop file to import
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            <span>
              Best results come from the full question, marking guide, and any lecturer instructions in one place.
            </span>
            <span>
              {hasAssignmentBrief
                ? "Brief is ready for tutoring."
                : "Add at least a few lines so the tutor has enough context."}
            </span>
          </div>

          {/* Compact optional field row — always visible, lightweight */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={assignmentTitle}
              onChange={(e) => setAssignmentTitle(e.target.value)}
              placeholder="Title (optional)"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            />
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Course / Module (optional)"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            />
            <input
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              placeholder="Programme (optional)"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            />
          </div>
        </section>

        {/* ── Collapsible Sections ── */}
        <div className="mb-4 space-y-2">
          {/* References & Sources */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowReferencesPanel(!showReferencesPanel)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Library size={15} className="text-purple-500" />
                <span className="text-sm font-medium text-slate-700">Your References &amp; Sources</span>
                {references.length > 0 && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    {references.length}
                  </span>
                )}
              </div>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${showReferencesPanel ? "rotate-180" : ""}`} />
            </button>

            {showReferencesPanel && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <div className="mb-3 rounded-lg border border-dashed border-purple-200 bg-white p-3">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Quick add a source</p>
                      <p className="text-[11px] text-slate-500">
                        Upload a PDF or Word document, or paste a YouTube URL to add it straight to your source list.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={() => referenceFileInputRef.current?.click()}
                        disabled={referenceUploading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                      >
                        {referenceUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        {referenceUploading ? "Reading source..." : "Upload PDF / Word"}
                      </button>
                      <input
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addYouTubeReference();
                          }
                        }}
                        placeholder="Paste a YouTube URL"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-purple-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={addYouTubeReference}
                        disabled={!youtubeUrl.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Link2 size={12} />
                        Add Video
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reference list */}
                {references.length > 0 ? (
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <div key={ref.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>
                              {ref.type === "book" && "📚"}
                              {ref.type === "journal" && "📄"}
                              {ref.type === "website" && "🌐"}
                              {ref.type === "other" && "📁"}
                            </span>
                            <span className="font-semibold text-slate-800">{ref.title}</span>
                            <span className="text-slate-400">({ref.year})</span>
                          </div>
                          <div className="text-slate-500">
                            {ref.authors}
                            {ref.source && ` — ${ref.source}`}
                          </div>
                          {ref.url && (
                            <a href={ref.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                              <Link2 size={9} />
                              {ref.url.slice(0, 50)}
                            </a>
                          )}
                          {ref.notes && (
                            <div className="mt-1 italic text-slate-500">&quot;{buildReferenceNotesPreview(ref.notes)}&quot;</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeReference(ref.id)}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                          title="Remove reference"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-slate-400">
                    No references yet. Add your sources to get properly cited content.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* More Options */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <GraduationCap size={15} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">More Options</span>
                <span className="text-[10px] text-slate-400">(goal, module details, dates, rubric…)</span>
              </div>
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`} />
            </button>

            {showAdvancedOptions && (
              <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                <input
                  value={studentGoal}
                  onChange={(e) => setStudentGoal(e.target.value)}
                  placeholder="What do you want help with most? (e.g. structuring my argument)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                />
                <textarea
                  value={currentAttempt}
                  onChange={(e) => setCurrentAttempt(e.target.value)}
                  rows={3}
                  placeholder="Your current attempt or rough draft (optional)…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-900">Add your own notes or real examples</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
                        Share class notes, placement observations, ward examples, or points you definitely want reflected. The tutor will use these when relevant, but will not invent experiences for you.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={personalInsights}
                    onChange={(e) => setPersonalInsights(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    placeholder="Example: On placement I observed how delayed triage increased patient anxiety, which links to the communication and prioritisation section…"
                    className="mt-3 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-100"
                  />
                  <div className="mt-2 flex items-center justify-between text-[10px] text-emerald-700">
                    <span>Best for authentic examples, lecturer-specific points, or wording you want to keep.</span>
                    <span>{personalInsightsLength}/4000</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    value={moduleCode}
                    onChange={(e) => setModuleCode(e.target.value)}
                    placeholder="Module code"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    value={lecturerName}
                    onChange={(e) => setLecturerName(e.target.value)}
                    placeholder="Lecturer / tutor"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={wordCount ?? ""}
                    onChange={(e) => setWordCount(e.target.value ? parseInt(e.target.value, 10) : null)}
                    placeholder="Word count"
                    min={100}
                    max={20000}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                  />
                  <select
                    value={citationStyle ?? ""}
                    onChange={(e) => setCitationStyle(e.target.value as CitationStyle || null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Citation style</option>
                    {CITATION_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Due date</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="flex-shrink-0 text-slate-400" />
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Submission date</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="flex-shrink-0 text-slate-400" />
                      <input
                        type="date"
                        value={submissionDate}
                        onChange={(e) => setSubmissionDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <textarea
                  value={markingCriteria}
                  onChange={(e) => setMarkingCriteria(e.target.value)}
                  rows={2}
                  placeholder="Marking rubric / grading criteria (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                />
                <textarea
                  value={lecturerFeedback}
                  onChange={(e) => setLecturerFeedback(e.target.value)}
                  rows={2}
                  placeholder="Previous lecturer feedback to address (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-400 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Action Bar ── */}
        <div className="sticky top-3 z-20 mb-4 space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Draft unlock</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  Follow the path once, then the draft button becomes predictable.
                </p>
              </div>
              {focusedQuestion && (
                <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600">
                  Focused on Q{focusedQuestion.questionNumber}{focusedQuestion.topic ? `: ${focusedQuestion.topic}` : ""}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              {draftUnlockChecklist.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl border px-3 py-2 ${
                    item.done
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : (
                      <ChevronRight size={14} className="text-slate-400" />
                    )}
                    <p className={`text-xs font-semibold ${item.done ? "text-green-700" : "text-slate-700"}`}>
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.hint}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => void sendSupportRequest("understand", explainPrompt)}
              disabled={!canSubmit || loading}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                estimatedReadiness >= 30
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading && mode === "understand" ? <Loader2 size={14} className="animate-spin" /> : estimatedReadiness >= 30 ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
              Explain It
            </button>

            <button
              type="button"
              onClick={() => void sendSupportRequest("practice", practicePrompt)}
              disabled={!canSubmit || loading}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                estimatedReadiness >= 50
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {loading && mode === "practice" ? <Loader2 size={14} className="animate-spin" /> : estimatedReadiness >= 50 ? <CheckCircle2 size={14} /> : <ClipboardCheck size={14} />}
              Quiz Me
            </button>

            <button
              type="button"
              onClick={() => void sendSupportRequest("draft", draftPrompt)}
              disabled={!canSubmit || loading || estimatedReadiness < 50}
              title={estimatedReadiness < 50 ? `Unlock at 50% understanding (currently ${estimatedReadiness}%)` : "Generate professional draft"}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                estimatedReadiness >= 50
                  ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm hover:from-purple-700 hover:to-blue-700"
                  : "border border-dashed border-slate-300 bg-slate-50 text-slate-400"
              }`}
            >
              {loading && mode === "draft" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate Draft
              {estimatedReadiness < 50 && <span className="text-[10px] font-normal">({estimatedReadiness}/50%)</span>}
            </button>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
              <span>{answeredQuestionCount}/{practiceQuestions.length || 0} quiz answers filled</span>
              {hasReferences && (
                <span className="rounded-full bg-purple-50 px-2 py-0.5 font-semibold text-purple-600">
                  {references.length} source{references.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Loading Banner ── */}
        {loading && (
          <div className="mb-5 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50">
            <div className="h-1 animate-pulse bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400" />
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Loader2 size={18} className="animate-spin text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800">{getLoadingMessage(mode)}</p>
                <p className="text-[10px] text-blue-500">This usually takes 10–20 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Multi-Question Navigator ── */}
        {hasMultipleQuestions && (
          <section className="mb-5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash size={15} className="text-indigo-600" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Assignment Questions
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                    {assignmentQuestions.length} parts
                  </span>
                </h2>
              </div>
              {focusQuestionId && (
                <button
                  type="button"
                  onClick={() => setFocusQuestionId(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  <Target size={10} />
                  Show All
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {assignmentQuestions.map((aq) => {
                const isActive = focusQuestionId === aq.id;
                return (
                  <button
                    key={aq.id}
                    type="button"
                    onClick={() => setFocusQuestionId(isActive ? null : aq.id)}
                    className={`group relative flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                      isActive
                        ? "border-indigo-400 bg-indigo-600 text-white shadow-md"
                        : "border-indigo-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                    style={{ maxWidth: "280px" }}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                    }`}>
                      {aq.questionNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`line-clamp-2 font-medium leading-tight ${isActive ? "text-white" : "text-slate-800"}`}>
                        {aq.questionText.length > 100 ? aq.questionText.slice(0, 100) + "…" : aq.questionText}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {aq.topic && (
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                            isActive ? "bg-white/20 text-white/90" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {aq.topic}
                          </span>
                        )}
                        {aq.marks != null && (
                          <span className={`text-[9px] font-semibold ${isActive ? "text-white/80" : "text-slate-400"}`}>
                            {aq.marks} marks
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {focusedQuestion && (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
                <p className="mb-1 text-[10px] font-bold uppercase text-indigo-500">
                  Focusing on Question {focusedQuestion.questionNumber}
                  {focusedQuestion.marks != null && ` (${focusedQuestion.marks} marks)`}
                </p>
                <p className="text-xs text-slate-700">{focusedQuestion.questionText}</p>
              </div>
            )}

            {!focusQuestionId && (
              <p className="mt-2 text-[10px] text-indigo-500/80">
                <Lightbulb size={10} className="mr-1 inline" />
                Tip: Click a question to focus the tutor on that specific part. Work through one question at a time for best results.
              </p>
            )}
          </section>
        )}

        {/* ── Topic Coverage Tracker ── */}
        {hasTopics && (
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Topic Coverage
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                  {coveredCount}/{topicsCovered.length} covered
                </span>
              </div>
              <div className="flex items-center gap-2">
                {inProgressCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                    {inProgressCount} in progress
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  avgConfidence >= 70 ? "bg-green-50 text-green-700" :
                  avgConfidence >= 40 ? "bg-amber-50 text-amber-700" :
                  "bg-red-50 text-red-700"
                }`}>
                  Avg. confidence: {avgConfidence}%
                </span>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mb-4">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-700"
                  style={{ width: `${topicsCovered.length > 0 ? (coveredCount / topicsCovered.length) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>Topic mastery</span>
                <span>{Math.round((coveredCount / topicsCovered.length) * 100)}%</span>
              </div>
            </div>

            {/* Topic list */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topicsCovered.map((topic, idx) => {
                const statusStyles = {
                  covered: {
                    border: "border-green-200",
                    bg: "bg-green-50/50",
                    icon: <CheckCircle2 size={14} className="text-green-500" />,
                    bar: "bg-green-500",
                    text: "text-green-700",
                    badge: "bg-green-100 text-green-700",
                    label: "Covered",
                  },
                  in_progress: {
                    border: "border-amber-200",
                    bg: "bg-amber-50/30",
                    icon: <Loader2 size={14} className="text-amber-500" />,
                    bar: "bg-amber-500",
                    text: "text-amber-700",
                    badge: "bg-amber-100 text-amber-700",
                    label: "In Progress",
                  },
                  not_started: {
                    border: "border-slate-200",
                    bg: "bg-slate-50/30",
                    icon: <BookOpen size={14} className="text-slate-400" />,
                    bar: "bg-slate-300",
                    text: "text-slate-500",
                    badge: "bg-slate-100 text-slate-500",
                    label: "Not Started",
                  },
                };
                const s = statusStyles[topic.status];

                return (
                  <div
                    key={`topic-${idx}`}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 ${s.border} ${s.bg}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold truncate ${s.text}`}>
                          {topic.topic}
                        </p>
                        <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                            style={{ width: `${topic.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{topic.confidence}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guidance message */}
            {coveredCount < topicsCovered.length && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                <Lightbulb size={13} className="mt-0.5 flex-shrink-0 text-blue-500" />
                <p className="text-[11px] text-blue-700">
                  {coveredCount === 0
                    ? "Your tutor has identified the key topics. Teaching will continue, then a quiz will test your understanding."
                    : `${topicsCovered.length - coveredCount} topic${topicsCovered.length - coveredCount > 1 ? "s" : ""} still need${topicsCovered.length - coveredCount === 1 ? "s" : ""} attention. The quiz results will help improve coverage.`
                  }
                </p>
              </div>
            )}

            {coveredCount === topicsCovered.length && topicsCovered.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <Award size={13} className="mt-0.5 flex-shrink-0 text-green-600" />
                <p className="text-[11px] font-medium text-green-700">
                  All topics covered! You've demonstrated understanding across the full assignment scope. You&apos;re ready to generate a professional draft.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Practice Quiz ── */}
        {hasPracticeQuiz && currentQuizQuestion && (
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-800">Knowledge Check</h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                  {practiceQuestions.length} questions
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {quizSubmitted && !quizGrading && quizScore && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    quizScore.pct >= 70 ? "bg-green-100 text-green-700" :
                    quizScore.pct >= 50 ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {quizScore.correct}/{quizScore.total} ({quizScore.pct}%)
                  </span>
                )}
                {quizSubmitted && (
                  <button
                    type="button"
                    onClick={resetQuiz}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void sendSupportRequest("practice", "Generate a new set of quiz questions to test my understanding.")}
                  disabled={!canSubmit || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  New Questions
                </button>
                <button
                  type="button"
                  onClick={dismissQuiz}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
                  title="Exit the quiz and return to the conversation"
                >
                  <XCircle size={10} />
                  Exit
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quiz progress</p>
                <p className="text-xs font-semibold text-slate-600">
                  Question {quizQuestionIndex + 1} of {practiceQuestions.length}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${quizProgressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{answeredQuestionCount} answered</span>
                <span>{practiceQuestions.length - answeredQuestionCount} left</span>
              </div>
            </div>

            {(() => {
              const q = currentQuizQuestion;
              const answered = (quizAnswers[q.id] ?? "").trim().length > 0;
              const isChecked = quizSubmitted;
              const isCorrectMcq =
                q.type === "mcq" &&
                isChecked &&
                (quizAnswers[q.id] ?? "").toUpperCase() === q.correctAnswer.toUpperCase();
              const isWrongMcq = q.type === "mcq" && isChecked && answered && !isCorrectMcq;
              const shortAnswerGraded = q.type === "short_answer" && quizFeedback[q.id] != null;
              const shortAnswerCorrect =
                q.type === "short_answer" && quizFeedback[q.id]?.isCorrect === true;
              const shortAnswerWrong =
                q.type === "short_answer" && quizFeedback[q.id]?.isCorrect === false;

              return (
                <div
                  className={`rounded-xl border p-4 ${
                    isCorrectMcq || shortAnswerCorrect
                      ? "border-green-200 bg-green-50/50"
                      : isWrongMcq || shortAnswerWrong
                        ? "border-red-200 bg-red-50/30"
                        : "border-slate-200 bg-slate-50/30"
                  }`}
                >
                  <div className="mb-3 flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isCorrectMcq || shortAnswerCorrect
                          ? "bg-green-500 text-white"
                          : isWrongMcq || shortAnswerWrong
                            ? "bg-red-500 text-white"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {quizQuestionIndex + 1}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            q.type === "mcq"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {q.type === "mcq" ? "Multiple Choice" : "Short Answer"}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">{q.question}</p>
                    </div>
                  </div>

                  {q.type === "mcq" && (
                    <div className="ml-8 space-y-2">
                      {q.options.map((opt) => {
                        const selected = (quizAnswers[q.id] ?? "") === opt.label;
                        const isCorrectOpt =
                          isChecked && opt.label.toUpperCase() === q.correctAnswer.toUpperCase();
                        const isWrongOpt = isChecked && selected && !isCorrectOpt;

                        return (
                          <label
                            key={opt.label}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                              isCorrectOpt && isChecked
                                ? "border-green-300 bg-green-50 font-medium text-green-800"
                                : isWrongOpt
                                  ? "border-red-300 bg-red-50 text-red-700 line-through"
                                  : selected
                                    ? "border-blue-300 bg-blue-50 text-blue-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            } ${quizSubmitted ? "pointer-events-none" : ""}`}
                          >
                            <input
                              type="radio"
                              name={`quiz-${q.id}`}
                              value={opt.label}
                              checked={selected}
                              onChange={() =>
                                setQuizAnswers((prev) => ({ ...prev, [q.id]: opt.label }))
                              }
                              disabled={quizSubmitted}
                              className="h-4 w-4 accent-blue-600"
                            />
                            <span className="flex-shrink-0 font-bold">{opt.label}.</span>
                            <span>{opt.text}</span>
                            {isCorrectOpt && isChecked && (
                              <CheckCircle2
                                size={16}
                                className="ml-auto flex-shrink-0 text-green-600"
                              />
                            )}
                            {isWrongOpt && (
                              <XCircle
                                size={16}
                                className="ml-auto flex-shrink-0 text-red-500"
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "short_answer" && (
                    <div className="ml-8">
                      <textarea
                        value={quizAnswers[q.id] ?? ""}
                        onChange={(e) =>
                          setQuizAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        rows={4}
                        disabled={quizSubmitted}
                        placeholder="Type your answer here…"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 disabled:bg-slate-50"
                      />
                      {isChecked && (
                        <div className="mt-2 space-y-2">
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                            <p className="text-[10px] font-bold uppercase text-blue-500">
                              Model Answer
                            </p>
                            <p className="text-xs text-blue-800">{q.correctAnswer}</p>
                          </div>
                          {quizGrading && !shortAnswerGraded ? (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <Loader2 size={12} className="animate-spin text-blue-500" />
                              <span className="text-xs text-slate-500">Grading your answer…</span>
                            </div>
                          ) : quizFeedback[q.id] ? (
                            <div
                              className={`rounded-lg border p-2.5 ${
                                quizFeedback[q.id].isCorrect
                                  ? "border-green-200 bg-green-50"
                                  : "border-red-200 bg-red-50"
                              }`}
                            >
                              <div className="mb-1 flex items-center gap-1.5">
                                {quizFeedback[q.id].isCorrect ? (
                                  <CheckCircle2 size={12} className="text-green-600" />
                                ) : (
                                  <XCircle size={12} className="text-red-500" />
                                )}
                                <span
                                  className={`text-[10px] font-bold uppercase ${
                                    quizFeedback[q.id].isCorrect
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {quizFeedback[q.id].isCorrect
                                    ? "Correct — Good understanding!"
                                    : "Needs Improvement"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700">
                                {quizFeedback[q.id].feedback}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}

                  {isChecked && q.explanation && (
                    <div className="ml-8 mt-3 rounded-lg border border-amber-100 bg-amber-50 p-2.5">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-600">
                        <Lightbulb size={11} />
                        Explanation
                      </p>
                      <p className="text-xs text-amber-800">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Submit / Score */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuizQuestionIndex((current) => Math.max(current - 1, 0))}
                    disabled={quizQuestionIndex === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronRight size={14} className="rotate-180" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuizQuestionIndex((current) =>
                        Math.min(current + 1, practiceQuestions.length - 1),
                      )
                    }
                    disabled={quizQuestionIndex >= practiceQuestions.length - 1}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {quizSubmitted
                    ? "Use Previous and Next to review each answer and explanation."
                    : canSubmitQuiz
                      ? "All questions answered. Submit when ready."
                      : `Answer ${practiceQuestions.length - answeredQuestionCount} more question${
                          practiceQuestions.length - answeredQuestionCount === 1 ? "" : "s"
                        } to submit.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
              {!quizSubmitted ? (
                <button
                  type="button"
                  onClick={handleQuizSubmit}
                  disabled={!canSubmitQuiz}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Submit &amp; Grade
                </button>
              ) : quizGrading ? (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
                  <Loader2 size={15} className="animate-spin" />
                  Grading your answers…
                </div>
              ) : (
                <>
                  {quizScore && (
                    <div className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      quizScore.pct >= 70 ? "bg-green-100 text-green-800" :
                      quizScore.pct >= 50 ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      Score: {quizScore.correct}/{quizScore.total} ({quizScore.pct}%)
                      {quizScore.pct >= 70 ? " — Great understanding! 🎉" :
                       quizScore.pct >= 50 ? " — Good progress! Keep going." :
                       " — Review the explanations and try again."}
                    </div>
                  )}
                  {estimatedReadiness < 50 && (
                    <button
                      type="button"
                      onClick={() => void sendSupportRequest("practice", "Generate a new set of quiz questions to test my understanding.")}
                      disabled={!canSubmit || loading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Try Again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissQuiz}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <MessageCircle size={14} />
                    Exit Quiz
                  </button>
                </>
              )}
              </div>
            </div>

            {/* ── Draft unlock CTA after quiz ── */}
            {quizSubmitted && !quizGrading && estimatedReadiness >= 50 && !pendingAutoDraft && (
              <div className="mt-4 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                      <Sparkles size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Generating your assignment draft… ✨</p>
                      <p className="text-[11px] text-slate-500">
                        Understanding at {estimatedReadiness}% — your draft will be generated automatically.
                        {references.length > 0 && ` ${references.length} reference${references.length > 1 ? "s" : ""} will be cited.`}
                      </p>
                    </div>
                  </div>
                  {!loading && (
                    <button
                      type="button"
                      onClick={() => {
                        dismissQuiz();
                        void sendSupportRequest("draft", focusedQuestion
                          ? `Create a professional draft for question ${focusedQuestion.questionNumber}: "${focusedQuestion.questionText}" using my understanding and ${references.length > 0 ? `the ${references.length} references I provided` : "academic sources"}. Properly cite all sources in ${citationStyle || "APA"} format. Use clear academic section headings and a proper reference list.`
                          : `Create a professional assignment draft using my understanding and ${references.length > 0 ? `the ${references.length} references I provided` : "academic sources"}. Properly cite all sources in ${citationStyle || "APA"} format. Use clear academic section headings and a proper reference list.`
                        );
                      }}
                      disabled={!canSubmit || loading}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
                    >
                      <Sparkles size={15} />
                      Generate My Draft
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Conversation ── */}
        {!hasPracticeQuiz && !hasDraft && !isDraftGenerating && (
        <section className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          {thread.length > 0 && (
            <div className="max-h-[280px] space-y-2 overflow-y-auto border-b border-slate-100 p-4">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 p-3">
            <textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              rows={1}
              placeholder="Ask a follow-up question…"
              className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={isRecording ? stopVoiceInput : startVoiceInput}
                className={`rounded-lg p-2 transition-colors ${
                  isRecording
                    ? "bg-red-100 text-red-600"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => void sendSupportRequest(mode)}
              disabled={!canSubmit}
              className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </section>
        )}

        {/* ── Draft generating spinner ── */}
        {isDraftGenerating && (
          <section className="mb-5 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100">
                <Loader2 size={28} className="animate-spin text-purple-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">Generating your assignment…</p>
                <p className="mt-1 text-xs text-slate-500">Following your assignment guidelines and incorporating your demonstrated understanding.</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Assignment Draft (shown prominently when available) ── */}
        {hasDraft && latestTurn && (
          <section className="mb-5">
            <div className="rounded-xl border-2 border-purple-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-purple-100 p-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Your Assignment</p>
                    <p className="text-[10px] text-slate-500">Generated based on the assignment guidelines and your understanding.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyDraft()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportDraft()}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Download Assignment
                  </button>
                </div>
              </div>
              {showIntegrityPanel && (
                <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  <p className="flex-1 text-[10px] text-amber-700">
                    <strong>Academic integrity:</strong> Review this draft, add your own examples, verify claims, and rewrite in your own voice before submission.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowIntegrityPanel(false)}
                    className="rounded p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700"
                    title="Hide reminder"
                  >
                    <XCircle size={12} />
                  </button>
                </div>
              )}
              <div className="border-b border-slate-100 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                    {citationStyle ? citationStyle.toUpperCase() : "Citation style not set"}
                  </span>
                  {moduleCode && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      Module {moduleCode}
                    </span>
                  )}
                  {lecturerName && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      Lecturer {lecturerName}
                    </span>
                  )}
                  {wordCount && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      Target {wordCount} words
                    </span>
                  )}
                  {hasPersonalInsights && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      Your notes included
                    </span>
                  )}
                  {references.length > 0 && (
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-600">
                      {references.length} provided source{references.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Personalise Before Submission</p>
                    <div className="mt-2 space-y-2">
                      {personalizationChecklist.map((item, index) => (
                        <div key={`personalise-${index}`} className="flex items-start gap-2 text-xs leading-relaxed text-emerald-900">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {draftPreviewBlocks.map((block, index) => {
                    if (block.kind === "h2") {
                      return (
                        <h2 key={`draft-${index}`} className="pt-2 text-base font-bold text-slate-900">
                          {block.text}
                        </h2>
                      );
                    }

                    if (block.kind === "h3") {
                      return (
                        <h3 key={`draft-${index}`} className="text-sm font-semibold text-slate-800">
                          {block.text}
                        </h3>
                      );
                    }

                    if (block.kind === "bullet") {
                      return (
                        <div key={`draft-${index}`} className="flex items-start gap-2 pl-2 text-sm leading-7 text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                          <span>{block.text}</span>
                        </div>
                      );
                    }

                    return (
                      <p
                        key={`draft-${index}`}
                        className="text-sm leading-8 text-slate-700"
                        style={{ textAlign: "justify" }}
                      >
                        {block.text}
                      </p>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => void sendSupportRequest("draft", `Regenerate the assignment draft with improvements.${hasPersonalInsights ? " Use my own notes and examples where relevant." : ""}${references.length > 0 ? ` Use my ${references.length} references.` : ""} Cite in ${citationStyle || "APA"} format. Keep a proper academic structure with section headings and a reference list.`)}
                  disabled={!canSubmit || loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("understand"); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <MessageCircle size={12} />
                  Back to Chat
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Tutor Guidance (hidden when draft is showing) ── */}
        {!hasDraft && !isDraftGenerating && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 p-1.5">
                <BrainCircuit size={16} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Tutor Guidance</h2>
            </div>
            {latestTurn && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                  {formatModeLabel(latestTurn.response.stage)}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  latestTurn.response.estimatedReadiness >= 50
                    ? "bg-green-50 text-green-700"
                    : latestTurn.response.estimatedReadiness >= 30
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                }`}>
                  {latestTurn.response.estimatedReadiness}%
                  {latestTurn.response.estimatedReadiness >= 50 && " ✓ Draft Ready"}
                </span>
                {references.length > 0 && (
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                    📚 {references.length} refs
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="p-5">
            {!latestTurn ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 p-3">
                  <GraduationCap size={24} className="text-blue-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Upload or paste your assignment brief to begin</p>
                <p className="max-w-sm text-center text-xs text-slate-400">
                  Your tutor will explain the topics, quiz your understanding, then generate a formatted draft automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* ── 1. Coaching Message — prominent card ── */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 shadow-sm ring-1 ring-blue-100/50">
                  <div className="mb-2 flex items-center gap-2">
                    <MessageCircle size={14} className="text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Tutor Says</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {latestTurn.response.coachingMessage}
                  </p>
                </div>

                {/* ── 2. Core Sections — 2x2 grid with icons ── */}
                {(latestTurn.response.learningFocus.length > 0 ||
                  latestTurn.response.checkQuestions.length > 0 ||
                  latestTurn.response.outline.length > 0 ||
                  latestTurn.response.nextSteps.length > 0) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SectionList title="Learning Focus" items={latestTurn.response.learningFocus} icon={Target} tone="blue" />
                    <SectionList title="Check Questions" items={latestTurn.response.checkQuestions} icon={HelpCircle} tone="amber" />
                    <SectionList title="Outline" items={latestTurn.response.outline} icon={ListChecks} tone="slate" />
                    <SectionList title="Next Steps" items={latestTurn.response.nextSteps} icon={ChevronRight} tone="emerald" />
                  </div>
                )}

                {/* ── 3. Understanding Indicators — visual checklist ── */}
                {latestTurn.response.understandingIndicators?.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
                    <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold text-green-700">
                      <Target size={13} />
                      You understand this when you can…
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {latestTurn.response.understandingIndicators.map((indicator, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2">
                          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-green-500" />
                          <span className="text-xs leading-relaxed text-green-800">{indicator}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 4. Deep Learning — collapsible extras ── */}
                {((latestTurn.response.conceptsExplained?.length ?? 0) > 0 ||
                  (latestTurn.response.commonMistakes?.length ?? 0) > 0 ||
                  (latestTurn.response.reflectionPrompts?.length ?? 0) > 0 ||
                  (latestTurn.response.paraphrasingTips?.length ?? 0) > 0 ||
                  (latestTurn.response.suggestedResources?.length ?? 0) > 0) && (
                  <div className="rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowDeepLearning(!showDeepLearning)}
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap size={15} className="text-purple-500" />
                        <span className="text-xs font-bold text-slate-700">Deep Learning &amp; Study Tips</span>
                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                          {[
                            ...(latestTurn.response.conceptsExplained ?? []),
                            ...(latestTurn.response.commonMistakes ?? []),
                            ...(latestTurn.response.reflectionPrompts ?? []),
                            ...(latestTurn.response.paraphrasingTips ?? []),
                            ...(latestTurn.response.suggestedResources ?? []),
                          ].length} tips
                        </span>
                      </div>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${showDeepLearning ? "rotate-180" : ""}`} />
                    </button>

                    {showDeepLearning && (
                      <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <SectionList title="Key Concepts" items={latestTurn.response.conceptsExplained || []} icon={BookOpen} tone="blue" />
                          <SectionList title="Common Mistakes" items={latestTurn.response.commonMistakes || []} icon={AlertTriangle} tone="amber" />
                          <SectionList title="Reflection Prompts" items={latestTurn.response.reflectionPrompts || []} icon={Lightbulb} tone="emerald" />
                          <SectionList title="Paraphrasing Tips" items={latestTurn.response.paraphrasingTips || []} icon={PenSquare} tone="purple" />
                          <SectionList title="Research Directions" items={latestTurn.response.suggestedResources || []} icon={Library} tone="slate" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Draft is now shown in its own section above */}
              </div>
            )}
          </div>
        </section>
        )}
      </>
      )}
    </div>
  );
};

export default AssignmentSupport;
