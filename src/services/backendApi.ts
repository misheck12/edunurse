const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

const DEFAULT_DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const AUTH_TOKEN_STORAGE_KEY = "edunurse_auth_token";
const LEGACY_AUTH_TOKEN_STORAGE_KEY = "accessToken";
const DEV_AUTH_BYPASS_ENABLED =
  import.meta.env.VITE_ENABLE_DEV_AUTH_BYPASS === "true";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFERRED_EXPORT_QUEUE_KEY = "edunurse_deferred_export_jobs_v1";
const LOCAL_EXPORT_JOB_PREFIX = "local-export-";

type ExportFormat = "pdf" | "docx" | "pptx";

interface DeferredExportJobRecord {
  localId: string;
  input: {
    documentId: string;
    documentVersionId?: string;
    format: ExportFormat;
  };
  status: "queued" | "failed" | "synced";
  remoteJobId?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

let queueProcessorStarted = false;
let queueFlushInFlight = false;
let queueIntervalId: number | null = null;
let removeOnlineListener: (() => void) | null = null;

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }
  const primary = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (primary) {
    if (!window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)) {
      window.localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, primary);
    }
    return primary;
  }

  const legacy = window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
  if (legacy) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, legacy);
    return legacy;
  }

  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    window.localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
  }
}

export function getCurrentDevUserId() {
  if (typeof window === "undefined") {
    return DEFAULT_DEV_USER_ID;
  }

  const stored = window.localStorage.getItem("edunurse_dev_user_id");
  const configured = import.meta.env.VITE_DEV_USER_ID;

  const fromStorage =
    stored && UUID_REGEX.test(stored) ? stored : null;
  const fromConfig =
    configured && UUID_REGEX.test(configured) ? configured : null;
  const userId = fromStorage ?? fromConfig ?? DEFAULT_DEV_USER_ID;

  if (stored !== userId) {
    window.localStorage.setItem("edunurse_dev_user_id", userId);
  }

  return userId;
}

export function setCurrentDevUserId(userId: string) {
  if (!UUID_REGEX.test(userId)) {
    throw new Error("User ID must be a valid UUID.");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("edunurse_dev_user_id", userId);
  }
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readDeferredExportQueue(): DeferredExportJobRecord[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(DEFERRED_EXPORT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => item as DeferredExportJobRecord)
      .filter(
        (item) =>
          typeof item.localId === "string" &&
          item.localId.startsWith(LOCAL_EXPORT_JOB_PREFIX) &&
          item.input &&
          typeof item.input.documentId === "string" &&
          typeof item.input.format === "string",
      );
  } catch {
    return [];
  }
}

function writeDeferredExportQueue(queue: DeferredExportJobRecord[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(DEFERRED_EXPORT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Safari Private Browsing and some mobile WebViews throw on setItem
    return;
  }
  window.dispatchEvent(
    new CustomEvent("edunurse:offline-queue-updated", {
      detail: {
        deferredExports: queue.length,
      },
    }),
  );
}

function generateLocalExportId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${LOCAL_EXPORT_JOB_PREFIX}${crypto.randomUUID()}`;
  }

  return `${LOCAL_EXPORT_JOB_PREFIX}${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

function isLocalExportJobId(value: string) {
  return value.startsWith(LOCAL_EXPORT_JOB_PREFIX);
}

function isNetworkError(error: unknown) {
  if (!error || !(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
}

function upsertDeferredExportJob(record: DeferredExportJobRecord) {
  const queue = readDeferredExportQueue();
  const existingIndex = queue.findIndex((item) => item.localId === record.localId);
  if (existingIndex >= 0) {
    queue[existingIndex] = record;
  } else {
    queue.push(record);
  }
  writeDeferredExportQueue(queue);
}

function getDeferredExportJob(localId: string) {
  return readDeferredExportQueue().find((item) => item.localId === localId);
}

function buildAuthHeaders(authMode: "default" | "none" = "default") {
  const token = getAuthToken();
  if (authMode === "none") {
    return {};
  }

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  if (DEV_AUTH_BYPASS_ENABLED) {
    return { "x-user-id": getCurrentDevUserId() };
  }

  return {};
}

async function submitExportJobDirect(input: {
  documentId: string;
  documentVersionId?: string;
  format: ExportFormat;
}) {
  return request<CreateExportResponse>("/exports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDeferredQueueStatus() {
  const queue = readDeferredExportQueue();
  return {
    deferredExports: queue.length,
    queuedExports: queue.filter((item) => item.status === "queued").length,
    failedExports: queue.filter((item) => item.status === "failed").length,
  };
}

export async function flushDeferredExportJobs() {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) return;
  if (queueFlushInFlight) return;

  const queue = readDeferredExportQueue();
  const pending = queue.filter(
    (item) => item.status !== "synced" && !item.remoteJobId,
  );
  if (pending.length === 0) return;

  queueFlushInFlight = true;
  try {
    let nextQueue = [...queue];
    for (const item of pending) {
      try {
        const job = await submitExportJobDirect(item.input);
        nextQueue = nextQueue.map((entry) =>
          entry.localId === item.localId
            ? {
                ...entry,
                status: "synced",
                remoteJobId: job.id,
                attempts: entry.attempts + 1,
                updatedAt: new Date().toISOString(),
                lastError: undefined,
              }
            : entry,
        );
      } catch (error) {
        const networkFailure = isNetworkError(error);
        const reason =
          error instanceof Error ? error.message : "Unable to sync deferred export.";
        nextQueue = nextQueue.map((entry) =>
          entry.localId === item.localId
            ? {
                ...entry,
                status: networkFailure ? "queued" : "failed",
                attempts: entry.attempts + 1,
                updatedAt: new Date().toISOString(),
                lastError: reason,
              }
            : entry,
        );

        if (!networkFailure) {
          // Do not continue hammering when request is invalid (e.g., auth).
          break;
        }
      }
    }

    writeDeferredExportQueue(nextQueue);
  } finally {
    queueFlushInFlight = false;
  }
}

export function startOfflineQueueProcessor() {
  if (typeof window === "undefined") return () => {};
  if (queueProcessorStarted) return () => {};

  queueProcessorStarted = true;

  const handleOnline = () => {
    void flushDeferredExportJobs();
  };
  window.addEventListener("online", handleOnline);
  removeOnlineListener = () => window.removeEventListener("online", handleOnline);

  queueIntervalId = window.setInterval(() => {
    void flushDeferredExportJobs();
  }, 30000);

  void flushDeferredExportJobs();

  return () => {
    if (removeOnlineListener) {
      removeOnlineListener();
      removeOnlineListener = null;
    }
    if (queueIntervalId !== null) {
      window.clearInterval(queueIntervalId);
      queueIntervalId = null;
    }
    queueProcessorStarted = false;
  };
}

async function request<T>(
  path: string,
  options: (RequestInit & { authMode?: "default" | "none" }) = {},
): Promise<T> {
  const { authMode = "default", headers, ...restOptions } = options;
  const authHeaders = buildAuthHeaders(authMode);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(headers ?? {}),
    },
  });

  if (!response.ok) {
    // Auto-redirect on expired / invalid token (unless this was a public request)
    if (response.status === 401 && authMode === "default") {
      clearAuthToken();
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        // Ops pages → redirect to ops login; client pages → redirect to client sign-in
        if (path.startsWith("/ops") && path !== "/ops/login") {
          window.location.href = "/ops/login";
        } else if (!path.startsWith("/signin")) {
          const returnTo = encodeURIComponent(path + window.location.search);
          window.location.href = `/signin?returnTo=${returnTo}`;
        }
      }
    }

    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as
        | { message?: string; errorMessage?: string }
        | undefined;
      message = payload?.errorMessage ?? payload?.message ?? message;
    } catch {
      // Use default message when response body is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  user: CurrentUserResponse;
}

export function loginSuperadmin(input: { email: string; password: string }) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    authMode: "none",
    body: JSON.stringify(input),
  }).then((response) => {
    setAuthToken(response.accessToken);
    return response;
  });
}

export interface ClientSignupInput {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  nrc: string;
  school: string;
  studentNumber: string;
  information: string;
}

export function signupClient(input: ClientSignupInput) {
  return request<LoginResponse>("/auth/client/signup", {
    method: "POST",
    authMode: "none",
    body: JSON.stringify(input),
  }).then((response) => {
    setAuthToken(response.accessToken);
    return response;
  });
}

export function signinClient(input: { email: string; password: string }) {
  return request<LoginResponse>("/auth/client/signin", {
    method: "POST",
    authMode: "none",
    body: JSON.stringify(input),
  }).then((response) => {
    setAuthToken(response.accessToken);
    return response;
  });
}

export function logoutCurrentSession() {
  clearAuthToken();
}

export type BackendDocumentType =
  | "Lesson Plan"
  | "OSCE Station"
  | "Clinical Plan"
  | "Assessment Tool"
  | "Scheme of Work";

export interface CreateGenerationRunInput {
  documentId?: string;
  documentType: BackendDocumentType;
  title: string;
  programme: string;
  year?: string;
  course?: string;
  topic: string;
  durationMinutes?: number;
  strictCurriculumAlignment?: boolean;
  templateId?: string;
  curriculumVersionId?: string;
  promptInput?: Record<string, unknown>;
}

export interface SectionCitation {
  sourceId: string;
  sourceName?: string;
  page?: number | null;
  chunkId: string;
  quoteSnippet: string;
}

export interface GenerationRunRetrieval {
  id: string;
  generationRunId: string;
  curriculumChunkId: string;
  rank: number;
  selected: boolean;
}

export interface GenerationFlag {
  id: string;
  generationRunId: string;
  flagType: string;
  severity: "info" | "warning" | "blocking";
  detailsJson: Record<string, unknown>;
}

export interface GenerationRunResponse {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "blocked";
  runType?: "create" | "regenerate_section" | "expand" | "simplify";
  modelProvider?: string;
  modelName?: string;
  documentId?: string | null;
  documentVersionId?: string | null;
  strictCurriculumAlignment?: boolean;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  retrievals?: GenerationRunRetrieval[];
  flags?: GenerationFlag[];
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export function createGenerationRun(input: CreateGenerationRunInput) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "You are offline. Generation requires an internet connection.",
    );
  }
  return request<GenerationRunResponse>("/generation/runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getGenerationRun(runId: string) {
  return request<GenerationRunResponse>(`/generation/runs/${runId}`);
}

export interface CreateDocumentInput {
  title: string;
  documentType: BackendDocumentType;
  programme: string;
  year?: string;
  course?: string;
  topic: string;
  durationMinutes?: number;
  templateId?: string;
  curriculumVersionId?: string;
  contentJson: Record<string, unknown>;
  changeSummary?: string;
}

export interface CreateDocumentResponse {
  doc: {
    id: string;
    title: string;
    documentType: string;
    programme: string;
    year?: string | null;
    course?: string | null;
    topic: string;
    durationMinutes?: number | null;
    createdAt: string;
    updatedAt: string;
  };
  version: {
    id: string;
    versionNum: number;
  };
}

export function createDocument(input: CreateDocumentInput) {
  return request<CreateDocumentResponse>("/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface TemplateLibraryItem {
  id: string;
  ownerUserId?: string | null;
  name: string;
  documentType: BackendDocumentType;
  templateSchemaVersion: number;
  templateJson: Record<string, unknown>;
  isBuiltin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  owner?: {
    id: string;
    email: string;
    fullName?: string | null;
  } | null;
}

export interface ListTemplatesResponse {
  page: number;
  pageSize: number;
  total: number;
  items: TemplateLibraryItem[];
}

export function listTemplates(input?: {
  page?: number;
  pageSize?: number;
  scope?: "builtin" | "mine" | "all";
  search?: string;
  documentType?: BackendDocumentType;
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.scope) query.set("scope", input.scope);
  if (input?.search) query.set("search", input.search);
  if (input?.documentType) query.set("documentType", input.documentType);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListTemplatesResponse>(`/templates${suffix}`);
}

export function createTemplate(input: {
  name: string;
  documentType: BackendDocumentType;
  templateSchemaVersion?: number;
  templateJson?: Record<string, unknown>;
}) {
  return request<TemplateLibraryItem>("/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  templateId: string,
  input: {
    name?: string;
    templateSchemaVersion?: number;
    templateJson?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  return request<TemplateLibraryItem>(`/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTemplate(templateId: string) {
  return request<void>(`/templates/${templateId}`, {
    method: "DELETE",
  });
}

export interface PatchSectionResponse {
  latestVersion: {
    id: string;
    versionNum: number;
    createdAt: string;
  };
}

export function patchDocumentSection(
  documentId: string,
  sectionId: string,
  content: unknown,
) {
  return request<PatchSectionResponse>(
    `/documents/${documentId}/sections/${sectionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    },
  );
}

export interface CreateExportResponse {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  format: "pdf" | "docx" | "pptx";
}

export function createExportJob(input: {
  documentId: string;
  documentVersionId?: string;
  format: "pdf" | "docx" | "pptx";
}) {
  const normalizedInput = {
    documentId: input.documentId,
    documentVersionId: input.documentVersionId,
    format: input.format as ExportFormat,
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const localId = generateLocalExportId();
    upsertDeferredExportJob({
      localId,
      input: normalizedInput,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return Promise.resolve({
      id: localId,
      status: "queued" as const,
      format: normalizedInput.format,
    });
  }

  return submitExportJobDirect(normalizedInput).catch((error) => {
    if (!isNetworkError(error)) {
      throw error;
    }

    const localId = generateLocalExportId();
    upsertDeferredExportJob({
      localId,
      input: normalizedInput,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : "Network failure",
    });

    return {
      id: localId,
      status: "queued" as const,
      format: normalizedInput.format,
    };
  });
}

export interface DocumentListItem {
  id: string;
  title: string;
  documentType: BackendDocumentType;
  programme: string;
  year?: string | null;
  topic: string;
  status: "draft" | "final";
  latestVersionNum: number;
  updatedAt: string;
  createdAt: string;
}

export interface ListDocumentsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: DocumentListItem[];
}

export function listDocuments(input?: {
  page?: number;
  pageSize?: number;
  documentType?: BackendDocumentType;
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.documentType) query.set("documentType", input.documentType);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListDocumentsResponse>(`/documents${suffix}`);
}

export interface GetDocumentResponse {
  document: {
    id: string;
    title: string;
    documentType: BackendDocumentType;
    programme: string;
    year?: string | null;
    course?: string | null;
    topic: string;
    durationMinutes?: number | null;
    createdAt: string;
    updatedAt: string;
  };
  latestVersion: {
    id: string;
    versionNum: number;
    contentJson: Record<string, unknown>;
    createdAt: string;
  } | null;
}

export function getDocument(documentId: string) {
  return request<GetDocumentResponse>(`/documents/${documentId}`);
}

export interface UpdateDocumentInput {
  title?: string;
  programme?: string;
  year?: string;
  course?: string;
  topic?: string;
  durationMinutes?: number;
  status?: "draft" | "final";
  createVersion?: boolean;
  contentJson?: Record<string, unknown>;
  changeSummary?: string;
}

export interface UpdateDocumentResponse {
  document: {
    id: string;
    title: string;
    documentType: BackendDocumentType;
    programme: string;
    year?: string | null;
    course?: string | null;
    topic: string;
    durationMinutes?: number | null;
    status: "draft" | "final";
    updatedAt: string;
  };
  latestVersion: {
    id: string;
    versionNum: number;
    contentJson: Record<string, unknown>;
    createdAt: string;
  };
}

export function updateDocument(documentId: string, input: UpdateDocumentInput) {
  return request<UpdateDocumentResponse>(`/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface ExportJobResponse {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  format: "pdf" | "docx" | "pptx";
  storageKey?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  downloadPath?: string | null;
}

export interface ExportJobListItem extends ExportJobResponse {
  documentId: string;
  documentVersionId: string;
  checksum?: string | null;
  document?: {
    id: string;
    title: string;
    topic?: string | null;
    documentType?: string;
  } | null;
}

export interface ListExportJobsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: ExportJobListItem[];
}

export function listExportJobs(input?: {
  page?: number;
  pageSize?: number;
  status?: "queued" | "running" | "succeeded" | "failed";
  format?: "pdf" | "docx" | "pptx";
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.status) query.set("status", input.status);
  if (input?.format) query.set("format", input.format);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListExportJobsResponse>(`/exports${suffix}`);
}

export async function getExportJob(exportJobId: string) {
  if (isLocalExportJobId(exportJobId)) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      await flushDeferredExportJobs();
    }

    const localJob = getDeferredExportJob(exportJobId);
    if (!localJob) {
      throw new Error("Deferred export request not found.");
    }

    if (localJob.remoteJobId) {
      return request<ExportJobResponse>(`/exports/${localJob.remoteJobId}`);
    }

    return {
      id: localJob.localId,
      status: localJob.status === "failed" ? "failed" : "queued",
      format: localJob.input.format,
      createdAt: localJob.createdAt,
      completedAt: null,
      storageKey: null,
      downloadPath: null,
      errorMessage:
        localJob.status === "failed"
          ? localJob.lastError ?? "Deferred export failed to sync."
          : typeof navigator !== "undefined" && !navigator.onLine
            ? "Waiting for internet connection to submit export."
            : null,
    };
  }

  return request<ExportJobResponse>(`/exports/${exportJobId}`);
}

export async function downloadExportFile(
  exportJobId: string, 
  format: "pdf" | "docx" | "pptx",
  onProgress?: (progress: number) => void
) {
  let resolvedExportJobId = exportJobId;
  if (isLocalExportJobId(exportJobId)) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      await flushDeferredExportJobs();
    }
    const localJob = getDeferredExportJob(exportJobId);
    if (!localJob?.remoteJobId) {
      throw new Error(
        "Export is still queued. Reconnect and wait for sync before downloading.",
      );
    }
    resolvedExportJobId = localJob.remoteJobId;
  }

  const downloadUrl = `${API_BASE_URL}/exports/${resolvedExportJobId}/download`;
  const authHeaders = buildAuthHeaders("default");

  if (onProgress) {
    onProgress(10);
  }

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      ...authHeaders,
      Accept: mimeTypes[format] ?? "application/octet-stream",
    },
  });

  if (!response.ok) {
    let message = `Download failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string } | undefined;
      message = payload?.message ?? message;
    } catch {
      // Ignore non-JSON error payloads.
    }
    throw new Error(message);
  }

  if (onProgress) {
    onProgress(50);
  }

  const blob = await response.blob();

  // Validate the blob is not empty and has correct-ish content type
  if (blob.size === 0) {
    throw new Error("Downloaded file is empty. Please try again.");
  }

  const contentType = blob.type.toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    throw new Error("Download returned an invalid file format. Please try again.");
  }
  
  if (onProgress) {
    onProgress(80);
  }

  const fileName = `edunurse-export-${resolvedExportJobId}.${format}`;

  // iOS Safari and some mobile browsers cannot download blob: URLs via <a>.click().
  // Detect mobile/iOS and use window.open() with a typed blob as fallback.
  const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android|webOS/i.test(navigator.userAgent);

  if (isIOS) {
    // iOS Safari: open blob in a new tab — user can "Share > Save to Files"
    const typedBlob = new Blob([blob], { type: mimeTypes[format] ?? "application/octet-stream" });
    const blobUrl = window.URL.createObjectURL(typedBlob);
    window.open(blobUrl, "_blank");
    // iOS needs a longer delay before cleanup since the new tab must load the blob
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
  } else {
    // Standard browser + Android: programmatic <a> click download
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    // Longer delay for mobile browsers that are slower to initiate downloads
    const cleanupDelay = isMobile ? 3000 : 500;
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    }, cleanupDelay);
  }
  
  if (onProgress) {
    onProgress(100);
  }
}

type AiProviderName = "azure" | "gemini" | "deepseek";

export interface AiProviderProbe {
  attempted: boolean;
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  message: string;
}

export interface AiProviderHealth {
  configured: boolean;
  missing: string[];
  model?: string | null;
  endpoint?: string | null;
  apiVersion?: string;
  baseUrl?: string;
  keyPreview?: string | null;
  probe?: AiProviderProbe | null;
}

export interface AdminAiHealthResponse {
  timestamp: string;
  probeAttempted: boolean;
  providerPriority: AiProviderName[];
  providers: {
    azure: AiProviderHealth;
    gemini: AiProviderHealth;
    deepseek: AiProviderHealth;
  };
}

export function getAdminAiHealth(input?: {
  probe?: boolean;
  timeoutMs?: number;
}) {
  const query = new URLSearchParams();
  if (typeof input?.probe === "boolean") {
    query.set("probe", input.probe ? "true" : "false");
  }
  if (input?.timeoutMs) {
    query.set("timeoutMs", String(input.timeoutMs));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AdminAiHealthResponse>(`/admin/ai/health${suffix}`);
}

export interface CurrentUserResponse {
  id: string;
  email: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  nrc?: string | null;
  school?: string | null;
  studentNumber?: string | null;
  information?: string | null;
  profileCompleted?: boolean;
  role: "student" | "educator" | "admin";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getCurrentUser() {
  return request<CurrentUserResponse>("/users/me");
}

export function updateCurrentUser(input: {
  fullName?: string;
  phoneNumber?: string;
  nrc?: string;
  school?: string;
  studentNumber?: string;
  information?: string;
}) {
  return request<CurrentUserResponse>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type AssignmentSupportMode = "understand" | "practice" | "draft";

export type CitationStyle = "apa7" | "harvard" | "vancouver" | "mla" | "chicago";

export interface AssignmentSupportMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MCQOption {
  label: string;
  text: string;
}

export interface PracticeQuestion {
  id: string;
  type: "mcq" | "short_answer";
  question: string;
  options: MCQOption[];
  correctAnswer: string;
  explanation: string;
}

export interface AssignmentQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  marks: number | null;
  topic: string;
}

export interface AssignmentSupportResponse {
  stage: AssignmentSupportMode;
  coachingMessage: string;
  learningFocus: string[];
  nextSteps: string[];
  checkQuestions: string[];
  outline: string[];
  draftResponse: string;
  readyForDraft: boolean;
  suggestedMode: AssignmentSupportMode;
  provider: string;
  model: string;
  // Enhanced pedagogy fields
  conceptsExplained: string[];
  commonMistakes: string[];
  reflectionPrompts: string[];
  suggestedResources: string[];
  understandingIndicators: string[];
  paraphrasingTips: string[];
  estimatedReadiness: number;
  // Topic coverage tracking
  topicsCovered: Array<{
    topic: string;
    status: "not_started" | "in_progress" | "covered";
    confidence: number;
  }>;
  // Practice quiz questions
  practiceQuestions: PracticeQuestion[];
  // Quiz grading results from AI
  quizResults: Array<{
    questionId: string;
    isCorrect: boolean;
    feedback: string;
  }>;
  // Detected sub-questions from the assignment brief
  assignmentQuestions: AssignmentQuestion[];
}

export interface AssignmentSupportReference {
  type: "book" | "journal" | "website" | "other";
  title: string;
  authors: string;
  year: string;
  source: string;
  url?: string;
  notes?: string;
}

export interface AssignmentSupportInput {
  mode: AssignmentSupportMode;
  assignmentTitle?: string;
  assignmentInstructions: string;
  course?: string;
  programme?: string;
  studentGoal?: string;
  currentAttempt?: string;
  messages?: AssignmentSupportMessage[];
  // Enhanced pedagogy fields
  wordCount?: number;
  citationStyle?: CitationStyle;
  markingCriteria?: string;
  lecturerFeedback?: string;
  dueDate?: string;
  understandingScore?: number;
  // Student-provided references
  references?: AssignmentSupportReference[];
  // Multi-question support: which sub-question the student is focusing on
  focusQuestionId?: string;
}

export function getAssignmentSupport(input: AssignmentSupportInput) {
  return request<AssignmentSupportResponse>("/assignment-support/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface DocumentExtractionResponse {
  success: boolean;
  text: string;
  characterCount: number;
}

export async function extractDocumentText(file: File): Promise<DocumentExtractionResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  
  const response = await fetch(`${API_BASE_URL}/assignment-support/extract-document`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      ...buildAuthHeaders(),
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to extract document text");
  }

  return response.json();
}

export async function exportAssignmentDraft(input: {
  title: string;
  content: string;
  citationStyle?: CitationStyle;
  studentName?: string;
  studentNumber?: string;
  school?: string;
  course?: string;
  programme?: string;
  dueDate?: string;
  wordCount?: number;
  references?: {
    type: "book" | "journal" | "website" | "other";
    title: string;
    authors: string;
    year: string;
    source: string;
    url?: string;
  }[];
}): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/assignment-support/export-draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to export draft");
  }

  return response.blob();
}

export interface UserPreferencesResponse {
  userId: string;
  defaultProgramme?: string | null;
  defaultYear?: string | null;
  defaultDocumentType?: string | null;
  exportDefaults?: Record<string, unknown>;
  uiPreferences?: Record<string, unknown>;
  updatedAt?: string;
}

export function getUserPreferences() {
  return request<UserPreferencesResponse>("/users/preferences");
}

export function updateUserPreferences(input: {
  defaultProgramme?: string | null;
  defaultYear?: string | null;
  defaultDocumentType?: string | null;
  exportDefaults?: Record<string, unknown>;
  uiPreferences?: Record<string, unknown>;
}) {
  return request<UserPreferencesResponse>("/users/preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface StudioServiceItem {
  id:
    | "theory_lesson_plan"
    | "skills_lab_plan"
    | "clinical_teaching_plan"
    | "osce_station"
    | "assessment_tool"
    | "scheme_of_work";
  name: string;
  serviceKey:
    | "studio_theory_lesson_plan"
    | "studio_skills_lab_plan"
    | "studio_clinical_teaching_plan"
    | "studio_osce_station"
    | "studio_assessment_tool"
    | "studio_scheme_of_work";
  enabled: boolean;
  reason?: string | null;
}

export interface StudioServicesResponse {
  items: StudioServiceItem[];
}

export function getStudioServices() {
  return request<StudioServicesResponse>("/users/studio-services");
}

export type ConnectorType =
  | "google_drive"
  | "web_url"
  | "postgres"
  | "mysql"
  | "manual_upload";

export type ConnectorStatus = "active" | "paused" | "error";

export type ConnectorRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partial";

export interface ConnectorIngestionQuality {
  chunksIndexed: number;
  chunksEmbedded: number;
  semesterMetadataCoveragePct: number;
  courseMetadataCoveragePct: number;
}

export interface AdminConnectorRun {
  id: string;
  connectorId: string;
  initiatedByUserId: string;
  status: ConnectorRunStatus;
  discoveredCount: number;
  fetchedCount: number;
  indexedCount: number;
  failedCount: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  ingestionQuality?: ConnectorIngestionQuality;
}

export interface AdminConnector {
  id: string;
  name: string;
  connectorType: ConnectorType;
  status: ConnectorStatus;
  configJson: Record<string, unknown>;
  secretJson?: Record<string, unknown> | null;
  defaultCurriculumVersionId?: string | null;
  createdByUserId: string;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  runs?: AdminConnectorRun[];
}

export interface ListAdminConnectorsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AdminConnector[];
}

export function listAdminConnectors(input?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListAdminConnectorsResponse>(`/admin/rag/connectors${suffix}`);
}

export interface ExternalDocumentVersionSummary {
  id: string;
  checksum: string;
  createdAt: string;
}

export interface AdminExternalDocument {
  id: string;
  connectorId: string;
  externalId: string;
  title: string;
  sourceUrl?: string | null;
  mimeType?: string | null;
  owner?: string | null;
  accessScope?: string | null;
  isActive: boolean;
  latestVersionId?: string | null;
  curriculumSourceId?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion?: ExternalDocumentVersionSummary | null;
}

export interface GetAdminConnectorResponse extends AdminConnector {
  runs: AdminConnectorRun[];
  externalDocuments: AdminExternalDocument[];
  ingestionQuality?: ConnectorIngestionQuality;
}

export function getAdminConnector(connectorId: string) {
  return request<GetAdminConnectorResponse>(`/admin/rag/connectors/${connectorId}`);
}

export interface CreateAdminConnectorInput {
  name: string;
  connectorType: ConnectorType;
  configJson: Record<string, unknown>;
  secretJson?: Record<string, unknown>;
  defaultCurriculumVersionId?: string;
}

export function createAdminConnector(input: CreateAdminConnectorInput) {
  return request<AdminConnector>("/admin/rag/connectors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface GoogleDriveOauthExchangeResponse {
  oauthSessionId: string;
  expiresAt: string;
  hasRefreshToken: boolean;
}

export function exchangeAdminGoogleDriveOauthCode(input: {
  authorizationCode: string;
  redirectUri?: string;
}) {
  return request<GoogleDriveOauthExchangeResponse>(
    "/admin/rag/google-drive/oauth/exchange",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export interface CreateAdminGoogleDriveConnectorInput {
  oauthSessionId: string;
  name: string;
  mode: "folder" | "files";
  folderId?: string;
  fileIds?: string[];
  programme?: string;
  sourceType?: "syllabus" | "standards" | "guideline";
  defaultCurriculumVersionId?: string;
}

export function createAdminGoogleDriveConnector(
  input: CreateAdminGoogleDriveConnectorInput,
) {
  return request<AdminConnector>("/admin/rag/google-drive/connect", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateAdminConnectorInput {
  name?: string;
  status?: ConnectorStatus;
  configJson?: Record<string, unknown>;
  secretJson?: Record<string, unknown>;
  defaultCurriculumVersionId?: string | null;
}

export function updateAdminConnector(
  connectorId: string,
  input: UpdateAdminConnectorInput,
) {
  return request<AdminConnector>(`/admin/rag/connectors/${connectorId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface QueueConnectorSyncResponse {
  message: string;
  runId: string;
  connectorId: string;
}

export function queueAdminConnectorSync(connectorId: string) {
  return request<QueueConnectorSyncResponse>(
    `/admin/rag/connectors/${connectorId}/sync`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function disconnectAdminConnector(connectorId: string) {
  return request<{
    message: string;
    connector: AdminConnector;
  }>(`/admin/rag/connectors/${connectorId}/disconnect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export interface GoogleDriveBrowseItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  isFolder: boolean;
}

export interface GoogleDriveBrowseResponse {
  folderId: string;
  nextPageToken?: string | null;
  items: GoogleDriveBrowseItem[];
}

export function browseAdminGoogleDrive(input: {
  accessToken?: string;
  oauthSessionId?: string;
  connectorId?: string;
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
}) {
  return request<GoogleDriveBrowseResponse>("/admin/rag/google-drive/browse", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAdminConnectorRun(runId: string) {
  return request<AdminConnectorRun & {
    connector?: {
      id: string;
      name: string;
      connectorType: ConnectorType;
    };
  }>(`/admin/rag/runs/${runId}`);
}

export interface CurriculumSourceSummary {
  id: string;
  name: string;
  sourceType: "syllabus" | "standards" | "guideline";
  programme?: string | null;
  url?: string | null;
  storageKey: string;
  checksum: string;
  status: "uploaded" | "parsed" | "indexed" | "active" | "deprecated" | "failed";
  createdAt: string;
  updatedAt: string;
}

export function listCurriculumSources() {
  return request<{ items: CurriculumSourceSummary[] }>("/curriculum/sources");
}

export interface CurriculumTreeNode {
  id: string;
  nodeType: string;
  code?: string | null;
  title: string;
  path: string;
  depth: number;
  sortOrder: number;
  metadataJson?: Record<string, unknown>;
  children: CurriculumTreeNode[];
}

export interface CurriculumTreeSourceItem {
  source: {
    id: string;
    name: string;
    programme?: string | null;
  };
  roots: CurriculumTreeNode[];
}

export interface CurriculumTreeResponse {
  curriculumVersionId: string;
  sourceCount: number;
  nodeCount: number;
  items: CurriculumTreeSourceItem[];
}

export function getCurriculumTree(input?: {
  curriculumVersionId?: string;
  sourceId?: string;
  programme?: string;
  programmeLevel?: string;
  year?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (input?.curriculumVersionId) query.set("curriculumVersionId", input.curriculumVersionId);
  if (input?.sourceId) query.set("sourceId", input.sourceId);
  if (input?.programme) query.set("programme", input.programme);
  if (input?.programmeLevel) query.set("programmeLevel", input.programmeLevel);
  if (input?.year) query.set("year", input.year);
  if (input?.search) query.set("search", input.search);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<CurriculumTreeResponse>(`/curriculum/tree${suffix}`);
}

export interface CurriculumTreeNodeLookupResponse {
  curriculumVersionId: string;
  found: boolean;
  message?: string;
  source?: {
    id: string;
    name: string;
    programme?: string | null;
  } | null;
  node?: {
    id: string;
    sourceId: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  };
  ancestors?: Array<{
    id: string;
    sourceId: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  }>;
  children?: Array<{
    id: string;
    sourceId?: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  }>;
  alternatives?: Array<{
    id: string;
    sourceId: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  }>;
}

export function getCurriculumTreeNode(input: {
  curriculumVersionId?: string;
  sourceId?: string;
  programme?: string;
  programmeLevel?: string;
  path?: string;
  code?: string;
  nodeType?: "course" | "unit" | "section" | "subsection";
}) {
  const query = new URLSearchParams();
  if (input?.curriculumVersionId) query.set("curriculumVersionId", input.curriculumVersionId);
  if (input?.sourceId) query.set("sourceId", input.sourceId);
  if (input?.programme) query.set("programme", input.programme);
  if (input?.programmeLevel) query.set("programmeLevel", input.programmeLevel);
  if (input?.path) query.set("path", input.path);
  if (input?.code) query.set("code", input.code);
  if (input?.nodeType) query.set("nodeType", input.nodeType);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<CurriculumTreeNodeLookupResponse>(`/curriculum/tree/node${suffix}`);
}

export interface CurriculumQueryCitation {
  sourceId: string;
  sourceName?: string;
  chunkId: string;
  page?: number | null;
  heading?: string | null;
  quoteSnippet: string;
  score?: number;
}

export interface CurriculumQueryResponse {
  curriculumVersionId: string;
  mode: "navigation" | "reasoning" | "no_context";
  blocked?: boolean;
  found?: boolean;
  message?: string;
  answer?: string | null;
  provider?: "azure" | "gemini" | "deepseek";
  model?: string;
  node?: {
    id: string;
    sourceId: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  };
  source?: {
    id: string;
    name: string;
    programme?: string | null;
  } | null;
  children?: Array<{
    id: string;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  }>;
  alternatives?: Array<{
    id: string;
    sourceId?: string;
    parentId?: string | null;
    nodeType: string;
    code?: string | null;
    title: string;
    path: string;
    depth: number;
    sortOrder: number;
    metadataJson?: Record<string, unknown>;
  }>;
  citations: CurriculumQueryCitation[];
}

export function queryCurriculum(input: {
  curriculumVersionId?: string;
  sourceId?: string;
  programme?: string;
  programmeLevel?: string;
  year?: string;
  course?: string;
  topic?: string;
  subtopic?: string;
  unit?: string;
  section?: string;
  question: string;
  strictCurriculumAlignment?: boolean;
  limit?: number;
}) {
  return request<CurriculumQueryResponse>("/curriculum/query", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CurriculumPlannerOptionsResponse {
  curriculumVersionId: string;
  programmeLevels: string[];
  semesters: string[];
  courses: string[];
  topics: string[];
  subtopics: string[];
  minorTopics: string[];
}

export function getCurriculumPlannerOptions(input?: {
  curriculumVersionId?: string;
  programme?: string;
  programmeLevel?: string;
  semester?: string;
  course?: string;
  topic?: string;
  subtopic?: string;
  minorTopic?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (input?.curriculumVersionId) query.set("curriculumVersionId", input.curriculumVersionId);
  if (input?.programme) query.set("programme", input.programme);
  if (input?.programmeLevel) query.set("programmeLevel", input.programmeLevel);
  if (input?.semester) query.set("semester", input.semester);
  if (input?.course) query.set("course", input.course);
  if (input?.topic) query.set("topic", input.topic);
  if (input?.subtopic) query.set("subtopic", input.subtopic);
  if (input?.minorTopic) query.set("minorTopic", input.minorTopic);
  if (input?.limit) query.set("limit", String(input.limit));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<CurriculumPlannerOptionsResponse>(`/curriculum/planner/options${suffix}`);
}

export interface CurriculumPlannerSuggestionsResponse {
  curriculumVersionId: string;
  objectives: string[];
  outcomes: string[];
  durationMinutesHint?: number | null;
  sourceCount: number;
  chunkCount: number;
}

export function getCurriculumPlannerSuggestions(input: {
  curriculumVersionId?: string;
  programme?: string;
  programmeLevel?: string;
  semester?: string;
  course: string;
  topic?: string;
  subtopic?: string;
  minorTopic?: string;
  limit?: number;
}) {
  return request<CurriculumPlannerSuggestionsResponse>("/curriculum/planner/suggestions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface OpsOverviewResponse {
  timeWindowDays: number;
  generatedAt: string;
  generation: {
    total: number;
    byStatus: Record<string, number>;
  };
  guardrails: {
    bySeverity: Record<string, number>;
    lowCoverageBlocks: number;
  };
  exports: {
    byStatus: Record<string, number>;
  };
  queue: {
    queuedByType: Record<string, number>;
    runningByType: Record<string, number>;
    staleRunningJobs: number;
  };
  connectors: {
    byStatus: Record<string, number>;
  };
  curriculum: {
    activeVersion: {
      id: string;
      label: string;
      activatedAt?: string | null;
    } | null;
    sourceCount: number;
    chunkCount: number;
  };
}

export function getOpsOverview(input?: { days?: number }) {
  const query = new URLSearchParams();
  if (input?.days) {
    query.set("days", String(input.days));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<OpsOverviewResponse>(`/admin/ops/overview${suffix}`);
}

export type ServiceControlKey =
  | "generation"
  | "content_expansion"
  | "assignment_support"
  | "exports"
  | "curriculum_query"
  | "curriculum_planner"
  | "rag_connector_sync"
  | "studio_theory_lesson_plan"
  | "studio_skills_lab_plan"
  | "studio_clinical_teaching_plan"
  | "studio_osce_station"
  | "studio_assessment_tool"
  | "studio_scheme_of_work";

export interface AdminServiceControlItem {
  key: ServiceControlKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  enabled: boolean;
  reason?: string | null;
  updatedAt?: string | null;
  updatedByUserId?: string | null;
}

export function listAdminServiceControls() {
  return request<{ items: AdminServiceControlItem[] }>("/admin/ops/service-controls");
}

export function updateAdminServiceControl(
  serviceKey: ServiceControlKey,
  input: { enabled: boolean; reason?: string | null },
) {
  return request<AdminServiceControlItem>(
    `/admin/ops/service-controls/${serviceKey}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export interface OpsGenerationRunItem extends GenerationRunResponse {
  _count?: {
    flags: number;
    retrievals: number;
  };
  document?: {
    id: string;
    title: string;
    documentType: string;
    programme: string;
    topic: string;
  } | null;
  user?: {
    id: string;
    email: string;
    role: "student" | "educator" | "admin";
  };
}

export interface OpsGenerationRunsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: OpsGenerationRunItem[];
}

export function listOpsGenerationRuns(input?: {
  page?: number;
  pageSize?: number;
  status?: "queued" | "running" | "succeeded" | "failed" | "blocked";
  runType?: "create" | "regenerate_section" | "expand" | "simplify";
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.status) query.set("status", input.status);
  if (input?.runType) query.set("runType", input.runType);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<OpsGenerationRunsResponse>(`/admin/ops/generation/runs${suffix}`);
}

export interface OpsExportJobItem {
  id: string;
  userId: string;
  documentId: string;
  documentVersionId: string;
  format: "pdf" | "docx" | "pptx";
  status: "queued" | "running" | "succeeded" | "failed";
  storageKey?: string | null;
  checksum?: string | null;
  createdAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  document?: {
    id: string;
    title: string;
    documentType: string;
  };
  user?: {
    id: string;
    email: string;
    role: "student" | "educator" | "admin";
  };
}

export interface OpsExportJobsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: OpsExportJobItem[];
}

export function listOpsExportJobs(input?: {
  page?: number;
  pageSize?: number;
  status?: "queued" | "running" | "succeeded" | "failed";
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.status) query.set("status", input.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<OpsExportJobsResponse>(`/admin/ops/exports/jobs${suffix}`);
}

export interface OpsCurriculumVersion {
  id: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  activatedAt?: string | null;
  createdAt: string;
  _count: {
    chunks: number;
    sources: number;
    documents: number;
  };
}

export function listOpsCurriculumVersions() {
  return request<{ items: OpsCurriculumVersion[] }>(
    "/admin/ops/curriculum/versions",
  );
}

export function activateOpsCurriculumVersion(versionId: string) {
  return request<OpsCurriculumVersion>(
    `/admin/ops/curriculum/versions/${versionId}/activate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export interface OpsCurriculumTopicItem {
  topic: string;
  chunkCount: number;
  subtopicCount: number;
  semesterCount: number;
}

export interface OpsCurriculumTopicsResponse {
  page: number;
  pageSize: number;
  total: number;
  curriculumVersionId: string | null;
  items: OpsCurriculumTopicItem[];
}

export function listOpsCurriculumTopics(input?: {
  page?: number;
  pageSize?: number;
  curriculumVersionId?: string;
  programme?: string;
  semester?: string;
  course?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.curriculumVersionId) query.set("curriculumVersionId", input.curriculumVersionId);
  if (input?.programme) query.set("programme", input.programme);
  if (input?.semester) query.set("semester", input.semester);
  if (input?.course) query.set("course", input.course);
  if (input?.search) query.set("search", input.search);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<OpsCurriculumTopicsResponse>(`/admin/ops/curriculum/topics${suffix}`);
}

export interface OpsSyllabusYearItem {
  name: string;
  chunkCount: number;
}

export interface OpsSyllabusProgrammeItem {
  name: string;
  chunkCount: number;
  sourceCount: number;
  years: OpsSyllabusYearItem[];
}

export interface OpsSyllabusProgramItem {
  program: string;
  totalProgrammes: number;
  totalChunks: number;
  totalSources: number;
  programmes: OpsSyllabusProgrammeItem[];
}

export interface OpsSyllabusProgrammesResponse {
  curriculumVersionId: string | null;
  totalPrograms: number;
  totalProgrammes: number;
  items: OpsSyllabusProgramItem[];
}

export function listOpsSyllabusProgrammes(input?: {
  curriculumVersionId?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (input?.curriculumVersionId) query.set("curriculumVersionId", input.curriculumVersionId);
  if (input?.search) query.set("search", input.search);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<OpsSyllabusProgrammesResponse>(`/admin/ops/syllabus/programmes${suffix}`);
}

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  nrc?: string | null;
  school?: string | null;
  studentNumber?: string | null;
  information?: string | null;
  profileCompleted?: boolean;
  emailVerified?: boolean;
  role: "student" | "educator" | "admin";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  preferences?: Record<string, unknown> | null;
  subscriptions?: Array<{
    id: string;
    status: "trialing" | "active" | "past_due" | "canceled";
    plan?: {
      id: string;
      code: string;
      name: string;
    };
  }>;
  _count?: {
    documents: number;
    generationRuns: number;
    exportJobs: number;
    transactions: number;
  };
}

export interface ListAdminUsersResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AdminUserListItem[];
}

export function listAdminUsers(input?: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: "student" | "educator" | "admin";
  isActive?: boolean;
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.search) query.set("search", input.search);
  if (input?.role) query.set("role", input.role);
  if (typeof input?.isActive === "boolean") {
    query.set("isActive", input.isActive ? "true" : "false");
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListAdminUsersResponse>(`/admin/users${suffix}`);
}

export function getAdminUser(userId: string) {
  return request<AdminUserListItem & {
    subscriptions: Array<Record<string, unknown>>;
    transactions: Array<Record<string, unknown>>;
  }>(`/admin/users/${userId}`);
}

export function createAdminUser(input: {
  email: string;
  fullName?: string;
  role?: "student" | "educator" | "admin";
  isActive?: boolean;
  preferences?: {
    defaultProgramme?: string;
    defaultYear?: string;
    defaultDocumentType?: string;
    exportDefaults?: Record<string, unknown>;
    uiPreferences?: Record<string, unknown>;
  };
}) {
  return request<AdminUserListItem>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminUser(
  userId: string,
  input: {
    fullName?: string | null;
    email?: string;
    phoneNumber?: string | null;
    nrc?: string | null;
    school?: string | null;
    studentNumber?: string | null;
    information?: string | null;
    role?: "student" | "educator" | "admin";
    isActive?: boolean;
  },
) {
  return request<AdminUserListItem>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ─── User-Facing Payment / Subscription / Usage API ────────────────────────

export interface PaymentPlan {
  code: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  features: string[];
}

export interface PaymentPlansResponse {
  monthly_subscription?: PaymentPlan;
  pay_as_you_go?: PaymentPlan;
}

export function getPaymentPlans() {
  return request<{ success: boolean; data: PaymentPlansResponse }>("/payments/plans");
}

export function initiatePayment(input: {
  planType: "monthly_subscription" | "pay_as_you_go";
  phone: string;
  country?: string;
}) {
  return request<{
    success: boolean;
    data: { reference: string; status: string };
    message?: string;
  }>("/payments/initiate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyPaymentStatus(reference: string) {
  return request<{
    success: boolean;
    data: {
      reference: string;
      status: string;
      amount: number;
      currency: string;
      completedAt: string | null;
    };
  }>(`/payments/verify/${reference}`);
}

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
  processedAt: string | null;
  metadata: Record<string, unknown>;
}

export function getPaymentHistory() {
  return request<{ success: boolean; data: PaymentHistoryItem[] }>("/payments/history");
}

export function getPaymentUsage() {
  return request<{
    success: boolean;
    data: {
      limits: Record<string, unknown>;
      summary: Record<string, unknown>;
    };
  }>("/payments/usage");
}

export interface UserSubscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: { id: string; code: string; name: string; monthlyPriceCents: number; limitsJson: Record<string, unknown> };
}

export function getCurrentSubscription() {
  return request<{ subscription: UserSubscription | null }>("/subscriptions/current");
}

export function cancelSubscription() {
  return request<{ message: string }>("/subscriptions/cancel", { method: "POST" });
}

export function reactivateSubscription() {
  return request<{ message: string }>("/subscriptions/reactivate", { method: "POST" });
}

export function getBillingHistory() {
  return request<{
    transactions: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      plan?: { name: string };
    }>;
  }>("/subscriptions/billing-history");
}

export function getSubscriptionFeatures() {
  return request<{
    features: Record<string, boolean>;
    tier: string;
    limits: Record<string, number>;
  }>("/subscriptions/features");
}

// ─── Admin Plans, Subscriptions, Transactions ──────────────────────────────

export interface AdminPlan {
  id: string;
  code: string;
  name: string;
  monthlyPriceCents: number;
  limitsJson: Record<string, unknown>;
  createdAt: string;
}

export function listAdminPlans() {
  return request<AdminPlan[]>("/admin/plans");
}

export function createAdminPlan(input: {
  code: string;
  name: string;
  monthlyPriceCents: number;
  limitsJson?: Record<string, unknown>;
}) {
  return request<AdminPlan>("/admin/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminPlan(
  planId: string,
  input: {
    code?: string;
    name?: string;
    monthlyPriceCents?: number;
    limitsJson?: Record<string, unknown>;
  },
) {
  return request<AdminPlan>(`/admin/plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface AdminSubscription {
  id: string;
  userId: string;
  planId: string;
  provider: string;
  providerSubscriptionId?: string | null;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    fullName?: string | null;
    role: "student" | "educator" | "admin";
    isActive: boolean;
  };
  plan?: AdminPlan;
  transactions?: Array<AdminTransaction>;
}

export interface ListAdminSubscriptionsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AdminSubscription[];
}

export function listAdminSubscriptions(input?: {
  page?: number;
  pageSize?: number;
  userId?: string;
  status?: "trialing" | "active" | "past_due" | "canceled";
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.userId) query.set("userId", input.userId);
  if (input?.status) query.set("status", input.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListAdminSubscriptionsResponse>(`/admin/subscriptions${suffix}`);
}

export function createAdminSubscription(input: {
  userId: string;
  planId: string;
  provider?: string;
  providerSubscriptionId?: string;
  status?: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}) {
  return request<AdminSubscription>("/admin/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminSubscription(
  subscriptionId: string,
  input: {
    planId?: string;
    status?: "trialing" | "active" | "past_due" | "canceled";
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  },
) {
  return request<AdminSubscription>(`/admin/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface AdminTransaction {
  id: string;
  userId: string;
  subscriptionId?: string | null;
  provider: string;
  externalTransactionId?: string | null;
  transactionType: "charge" | "refund" | "adjustment";
  status: "pending" | "succeeded" | "failed" | "canceled";
  amountCents: number;
  currency: string;
  metadataJson: Record<string, unknown>;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    fullName?: string | null;
  };
  subscription?: {
    id: string;
    plan?: AdminPlan;
  } | null;
}

export interface ListAdminTransactionsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AdminTransaction[];
}

export function listAdminTransactions(input?: {
  page?: number;
  pageSize?: number;
  userId?: string;
  subscriptionId?: string;
  status?: "pending" | "succeeded" | "failed" | "canceled";
  transactionType?: "charge" | "refund" | "adjustment";
}) {
  const query = new URLSearchParams();
  if (input?.page) query.set("page", String(input.page));
  if (input?.pageSize) query.set("pageSize", String(input.pageSize));
  if (input?.userId) query.set("userId", input.userId);
  if (input?.subscriptionId) query.set("subscriptionId", input.subscriptionId);
  if (input?.status) query.set("status", input.status);
  if (input?.transactionType) query.set("transactionType", input.transactionType);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ListAdminTransactionsResponse>(`/admin/transactions${suffix}`);
}

export function createAdminTransaction(input: {
  userId: string;
  subscriptionId?: string;
  provider: string;
  externalTransactionId?: string;
  transactionType: "charge" | "refund" | "adjustment";
  status?: "pending" | "succeeded" | "failed" | "canceled";
  amountCents: number;
  currency?: string;
  metadataJson?: Record<string, unknown>;
  errorMessage?: string;
  processedAt?: string;
}) {
  return request<AdminTransaction>("/admin/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminTransaction(
  transactionId: string,
  input: {
    status?: "pending" | "succeeded" | "failed" | "canceled";
    metadataJson?: Record<string, unknown>;
    errorMessage?: string | null;
    processedAt?: string | null;
  },
) {
  return request<AdminTransaction>(`/admin/transactions/${transactionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// System Settings
export interface SystemSettingCategory {
  key: string;
  value: string;
  description: string;
  isSecret: boolean;
}

export interface SystemSettingsResponse {
  categories: Record<string, SystemSettingCategory[]>;
  definitions: Array<{
    key: string;
    category: string;
    description: string;
    defaultValue: string;
    isSecret: boolean;
  }>;
}

export function getAdminSettings() {
  return request<SystemSettingsResponse>("/admin/settings");
}

export function updateAdminSettings(settings: Record<string, string>) {
  return request<{ message: string }>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
}

export function resetUserPassword(userId: string, newPassword: string) {
  return request<{ message: string }>("/admin/users/reset-password", {
    method: "POST",
    body: JSON.stringify({ userId, newPassword }),
  });
}

export function testEmailConfiguration(toEmail: string) {
  return request<{ message: string }>("/admin/test-email", {
    method: "POST",
    body: JSON.stringify({ toEmail }),
  });
}

/* ------------------------------------------------------------------ */
/* Admin Notifications / Communications                               */
/* ------------------------------------------------------------------ */

export type NotificationChannel = "email" | "sms" | "whatsapp";

export interface NotificationResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface NotificationLogItem {
  id: string;
  userId: string | null;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  status: "pending" | "sent" | "failed";
  errorDetail: string | null;
  sentBy: string | null;
  createdAt: string;
  user?: { id: string; email: string; fullName: string | null } | null;
}

export interface NotificationLogResponse {
  page: number;
  pageSize: number;
  total: number;
  items: NotificationLogItem[];
}

export interface NotificationStats {
  emailSent: number;
  smsSent: number;
  whatsappSent: number;
  totalFailed: number;
}

export function sendAdminNotification(data: {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  userId?: string;
}) {
  return request<NotificationResult>("/admin/notifications/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function broadcastAdminNotification(data: {
  channel: NotificationChannel;
  subject?: string;
  body: string;
  userIds?: string[];
  filterRole?: "student" | "educator" | "admin";
}) {
  return request<{
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    results: NotificationResult[];
  }>("/admin/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getNotificationLogs(params?: {
  page?: number;
  pageSize?: number;
  channel?: NotificationChannel;
  status?: "pending" | "sent" | "failed";
  userId?: string;
}) {
  const qp = new URLSearchParams();
  if (params?.page) qp.set("page", String(params.page));
  if (params?.pageSize) qp.set("pageSize", String(params.pageSize));
  if (params?.channel) qp.set("channel", params.channel);
  if (params?.status) qp.set("status", params.status);
  if (params?.userId) qp.set("userId", params.userId);
  const qs = qp.toString();
  return request<NotificationLogResponse>(`/admin/notifications/logs${qs ? `?${qs}` : ""}`);
}

export function getNotificationStats() {
  return request<NotificationStats>("/admin/notifications/stats");
}

export function retryFailedNotification(logId: string) {
  return request<NotificationResult>(`/admin/notifications/retry/${logId}`, {
    method: "POST",
  });
}

/* ------------------------------------------------------------------ */
/* Admin Marketing — Email Templates & Campaigns                      */
/* ------------------------------------------------------------------ */

export interface EmailTemplateItem {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  category: "marketing" | "transactional" | "onboarding";
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaignItem {
  id: string;
  name: string;
  templateId: string | null;
  subject: string;
  htmlBody: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  audienceFilter: Record<string, unknown>;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string } | null;
}

export interface MarketingStats {
  totalCampaigns: number;
  sentCampaigns: number;
  totalTemplates: number;
  totalEmailsSent: number;
  totalEmailsFailed: number;
}

// Templates
export function listEmailTemplates(params?: { page?: number; pageSize?: number }) {
  const qp = new URLSearchParams();
  if (params?.page) qp.set("page", String(params.page));
  if (params?.pageSize) qp.set("pageSize", String(params.pageSize));
  const qs = qp.toString();
  return request<{ page: number; pageSize: number; total: number; items: EmailTemplateItem[] }>(
    `/admin/marketing/templates${qs ? `?${qs}` : ""}`,
  );
}

export function getEmailTemplate(id: string) {
  return request<EmailTemplateItem>(`/admin/marketing/templates/${id}`);
}

export function createEmailTemplate(data: {
  name: string;
  subject: string;
  htmlBody: string;
  category?: "marketing" | "transactional" | "onboarding";
}) {
  return request<EmailTemplateItem>("/admin/marketing/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmailTemplate(
  id: string,
  data: Partial<{ name: string; subject: string; htmlBody: string; category: string; isActive: boolean }>,
) {
  return request<EmailTemplateItem>(`/admin/marketing/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteEmailTemplate(id: string) {
  return request<{ success: boolean }>(`/admin/marketing/templates/${id}`, { method: "DELETE" });
}

// Campaigns
export function listEmailCampaigns(params?: { page?: number; pageSize?: number }) {
  const qp = new URLSearchParams();
  if (params?.page) qp.set("page", String(params.page));
  if (params?.pageSize) qp.set("pageSize", String(params.pageSize));
  const qs = qp.toString();
  return request<{ page: number; pageSize: number; total: number; items: EmailCampaignItem[] }>(
    `/admin/marketing/campaigns${qs ? `?${qs}` : ""}`,
  );
}

export function getEmailCampaign(id: string) {
  return request<EmailCampaignItem>(`/admin/marketing/campaigns/${id}`);
}

export function createEmailCampaign(data: {
  name: string;
  templateId?: string;
  subject: string;
  htmlBody: string;
  audienceFilter?: Record<string, unknown>;
  scheduledAt?: string;
}) {
  return request<EmailCampaignItem>("/admin/marketing/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEmailCampaign(
  id: string,
  data: Partial<{
    name: string;
    subject: string;
    htmlBody: string;
    audienceFilter: Record<string, unknown>;
    scheduledAt: string | null;
    status: string;
  }>,
) {
  return request<EmailCampaignItem>(`/admin/marketing/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function sendEmailCampaign(id: string) {
  return request<{ success: boolean; total: number; sent: number; failed: number }>(
    `/admin/marketing/campaigns/${id}/send`,
    { method: "POST" },
  );
}

export function previewEmailCampaign(id: string) {
  return request<{ audienceCount: number; subject: string; previewHtml: string }>(
    `/admin/marketing/campaigns/${id}/preview`,
    { method: "POST" },
  );
}

export function deleteEmailCampaign(id: string) {
  return request<{ success: boolean }>(`/admin/marketing/campaigns/${id}`, { method: "DELETE" });
}

export function getMarketingStats() {
  return request<MarketingStats>("/admin/marketing/stats");
}

// ─── Admin Referral API (Ops) ──────────────────────────────────────────────

export interface AdminReferralItem {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  transactionId: string | null;
  commissionCents: number;
  currency: string;
  status: "pending" | "earned" | "paid_out";
  paidOutAt: string | null;
  createdAt: string;
  referrer: { id: string; email: string; fullName: string | null; referralCode: string | null };
  referred: { id: string; email: string; fullName: string | null };
  transaction: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  } | null;
}

export interface AdminReferralStats {
  totalReferrals: number;
  pendingCount: number;
  earnedCount: number;
  paidOutCount: number;
  totalCommissionCents: number;
  pendingCommissionCents: number;
  paidOutCommissionCents: number;
  totalReferredUsers: number;
  topReferrers: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    referralCode: string | null;
    referralCount: number;
    totalEarnedCents: number;
  }>;
}

export interface ListAdminReferralsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AdminReferralItem[];
}

export function getAdminReferralStats() {
  return request<AdminReferralStats>("/admin/referrals/stats");
}

export function listAdminReferrals(input?: {
  page?: number;
  pageSize?: number;
  status?: "pending" | "earned" | "paid_out";
  referrerUserId?: string;
  referredUserId?: string;
  search?: string;
}) {
  const qp = new URLSearchParams();
  if (input?.page) qp.set("page", String(input.page));
  if (input?.pageSize) qp.set("pageSize", String(input.pageSize));
  if (input?.status) qp.set("status", input.status);
  if (input?.referrerUserId) qp.set("referrerUserId", input.referrerUserId);
  if (input?.referredUserId) qp.set("referredUserId", input.referredUserId);
  if (input?.search) qp.set("search", input.search);
  const qs = qp.toString();
  return request<ListAdminReferralsResponse>(`/admin/referrals${qs ? `?${qs}` : ""}`);
}

export function updateAdminReferral(
  id: string,
  input: { status?: "pending" | "earned" | "paid_out" },
) {
  return request<AdminReferralItem>(`/admin/referrals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

// ─── Referral / Affiliate API ──────────────────────────────────────────────

export interface ReferralCodeData {
  referralCode: string;
  shareUrl: string;
}

export interface ReferralItem {
  id: string;
  referredName: string;
  referredEmail: string;
  commissionCents: number;
  currency: string;
  status: "pending" | "earned" | "paid_out";
  transactionAmount: number | null;
  createdAt: string;
}

export interface ReferralEarningsData {
  totalEarnedCents: number;
  pendingCents: number;
  paidOutCents: number;
  currency: string;
  referredUsersCount: number;
  commissionRate: number;
  referrals: ReferralItem[];
}

export function getMyReferralCode() {
  return request<{ success: boolean; data: ReferralCodeData }>("/referrals/my-code");
}

export function getReferralEarnings() {
  return request<{ success: boolean; data: ReferralEarningsData }>("/referrals/earnings");
}

export function applyReferralCode(referralCode: string) {
  return request<{ success: boolean; message: string }>("/referrals/apply-code", {
    method: "POST",
    body: JSON.stringify({ referralCode }),
  });
}
