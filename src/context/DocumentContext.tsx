import React, { createContext, useContext, useState, ReactNode } from "react";
import { AnyDocument } from "../schemas/documentSchemas";
import {
  BackendDocumentType,
  SectionCitation,
  createDocument,
  createExportJob,
  createGenerationRun,
  CreateExportResponse,
  GenerationRunResponse,
  getDocument,
  getGenerationRun,
  patchDocumentSection,
  updateDocument,
} from "../services/backendApi";

interface CreateDocumentContextInput {
  programme: string;
  year?: string;
  course?: string;
  topic: string;
  templateId?: string;
  subtopic?: string;
  minorTopic?: string;
  semester?: string;
  programmeLevel?: string;
  objectives?: string[];
  outcomes?: string[];
  durationMinutes?: number;
  strictCurriculumAlignment?: boolean;
}

interface DocumentContextType {
  currentDocument: AnyDocument | null;
  lastGenerationRun: GenerationRunResponse | null;
  createNewDocument: (
    type: string,
    context: CreateDocumentContextInput,
  ) => Promise<void>;
  updateSection: (sectionId: string, newContent: unknown) => Promise<void>;
  regenerateSection: (
    sectionId: string,
    instructions?: string,
  ) => Promise<void>;
  saveCurrentDocument: () => Promise<void>;
  createExport: (format: "pdf" | "docx" | "pptx") => Promise<CreateExportResponse>;
  loadDocumentById: (documentId: string) => Promise<void>;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  clearError: () => void;
}

interface BackendDocumentRef {
  documentId: string;
  latestVersionId: string;
}

interface BackendGenerationContext {
  title: string;
  documentType: BackendDocumentType;
  programme: string;
  year?: string;
  course?: string;
  topic: string;
  durationMinutes?: number;
  strictCurriculumAlignment: boolean;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
};

function mapWizardTypeToBackend(type: string): BackendDocumentType {
  switch (type) {
    case "OSCE Station":
      return "OSCE Station";
    case "Theory Lesson Plan":
      return "Lesson Plan";
    case "Skills Lab Plan":
    case "Clinical Teaching Plan":
      return "Clinical Plan";
    case "Assessment Tool":
      return "Assessment Tool";
    case "Scheme of Work":
      return "Scheme of Work";
    default:
      return "Lesson Plan";
  }
}

function normalizeSections(
  rawSections: unknown,
): Array<{
  id: string;
  title: string;
  type: string;
  content: unknown;
  citations: SectionCitation[];
}> {
  if (!Array.isArray(rawSections)) {
    return [];
  }

  const normalizeCitations = (rawCitations: unknown): SectionCitation[] => {
    if (!Array.isArray(rawCitations)) {
      return [];
    }

    return rawCitations
      .map((citation) =>
        citation && typeof citation === "object"
          ? (citation as Record<string, unknown>)
          : null,
      )
      .filter((citation): citation is Record<string, unknown> => Boolean(citation))
      .filter(
        (citation) =>
          typeof citation.sourceId === "string" &&
          typeof citation.chunkId === "string" &&
          typeof citation.quoteSnippet === "string",
      )
      .map((citation) => ({
        sourceId: citation.sourceId as string,
        sourceName:
          typeof citation.sourceName === "string"
            ? citation.sourceName
            : undefined,
        page:
          typeof citation.page === "number"
            ? citation.page
            : citation.page === null
              ? null
              : undefined,
        chunkId: citation.chunkId as string,
        quoteSnippet: citation.quoteSnippet as string,
      }));
  };

  return rawSections.map((section, index) => {
    const sectionRecord =
      section && typeof section === "object"
        ? (section as Record<string, unknown>)
        : {};

    return {
      id:
        typeof sectionRecord.id === "string"
          ? sectionRecord.id
          : `section-${index + 1}`,
      title:
        typeof sectionRecord.title === "string"
          ? sectionRecord.title
          : `Section ${index + 1}`,
      type:
        typeof sectionRecord.type === "string" ? sectionRecord.type : "text",
      content:
        sectionRecord.content ?? "No content generated for this section yet.",
      citations: normalizeCitations(sectionRecord.citations),
    };
  });
}

function buildUiDocument(input: {
  documentId: string;
  title: string;
  documentType: BackendDocumentType;
  programme: string;
  year?: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  contentJson: Record<string, unknown>;
}): AnyDocument {
  const metadata = {
    id: input.documentId,
    title: input.title,
    type: input.documentType,
    createdAt: new Date(input.createdAt),
    lastEdited: new Date(input.updatedAt),
    curriculumContext: {
      programme: input.programme,
      year: input.year ?? "Not specified",
      topic: input.topic,
    },
  };

  return {
    metadata,
    sections: normalizeSections(input.contentJson.sections),
  } as AnyDocument;
}

function composeTopicLabel(input: {
  topic: string;
  subtopic?: string;
  minorTopic?: string;
}) {
  const base = input.topic.trim();
  const subtopic = input.subtopic?.trim();
  const minorTopic = input.minorTopic?.trim();
  if (subtopic && minorTopic) return `${base} - ${subtopic} - ${minorTopic}`;
  if (subtopic) return `${base} - ${subtopic}`;
  if (minorTopic) return `${base} - ${minorTopic}`;
  return base;
}

async function hydrateGenerationRun(
  run: GenerationRunResponse,
): Promise<GenerationRunResponse> {
  try {
    return await getGenerationRun(run.id);
  } catch {
    return run;
  }
}

function ensureBackendDocumentType(type: string): BackendDocumentType {
  const allowed: BackendDocumentType[] = [
    "Lesson Plan",
    "OSCE Station",
    "Clinical Plan",
    "Assessment Tool",
    "Scheme of Work",
  ];

  if (allowed.includes(type as BackendDocumentType)) {
    return type as BackendDocumentType;
  }

  return "Lesson Plan";
}

export const DocumentProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentDocument, setCurrentDocument] = useState<AnyDocument | null>(
    null,
  );
  const [backendDocumentRef, setBackendDocumentRef] =
    useState<BackendDocumentRef | null>(null);
  const [backendGenerationContext, setBackendGenerationContext] =
    useState<BackendGenerationContext | null>(null);
  const [lastGenerationRun, setLastGenerationRun] =
    useState<GenerationRunResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const createNewDocument = async (
    type: string,
    context: CreateDocumentContextInput,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const backendType = mapWizardTypeToBackend(type);
      const title = `${backendType}: ${context.topic}`;
      const strictCurriculumAlignment =
        context.strictCurriculumAlignment ?? true;

      const generationRun = await createGenerationRun({
        documentType: backendType,
        title,
        programme: context.programme,
        year: context.semester ?? context.year,
        course: context.course,
        topic: composeTopicLabel({
          topic: context.topic,
          subtopic: context.subtopic,
          minorTopic: context.minorTopic,
        }),
        templateId: context.templateId,
        durationMinutes: context.durationMinutes,
        strictCurriculumAlignment,
        promptInput: {
          source: "create_wizard",
          selectedType: type,
          programmeLevel: context.programmeLevel ?? null,
          semester: context.semester ?? context.year ?? null,
          subtopic: context.subtopic ?? null,
          minorTopic: context.minorTopic ?? null,
          objectives: context.objectives ?? [],
          outcomes: context.outcomes ?? [],
          ...context,
        },
      });

      const fullRun = await hydrateGenerationRun(generationRun);
      const runOutput = fullRun.outputJson ?? generationRun.outputJson;

      if (!runOutput) {
        throw new Error(
          fullRun.errorMessage ??
            generationRun.errorMessage ??
            "Generation completed without output. Please retry.",
        );
      }

      const created = await createDocument({
        title,
        documentType: backendType,
        programme: context.programme,
        year: context.semester ?? context.year,
        course: context.course,
        topic: composeTopicLabel({
          topic: context.topic,
          subtopic: context.subtopic,
          minorTopic: context.minorTopic,
        }),
        templateId: context.templateId,
        durationMinutes: context.durationMinutes,
        contentJson: runOutput,
        changeSummary: "Initial generated draft",
      });

      const uiDocument = buildUiDocument({
        documentId: created.doc.id,
        title: created.doc.title,
        documentType: backendType,
        programme: context.programme,
        year: context.semester ?? context.year,
        topic: composeTopicLabel({
          topic: context.topic,
          subtopic: context.subtopic,
          minorTopic: context.minorTopic,
        }),
        createdAt: created.doc.createdAt,
        updatedAt: created.doc.updatedAt,
        contentJson: runOutput,
      });

      setCurrentDocument(uiDocument);
      setBackendDocumentRef({
        documentId: created.doc.id,
        latestVersionId: created.version.id,
      });
      setBackendGenerationContext({
        title: created.doc.title,
        documentType: backendType,
        programme: context.programme,
        year: context.semester ?? context.year,
        course: context.course,
        topic: composeTopicLabel({
          topic: context.topic,
          subtopic: context.subtopic,
          minorTopic: context.minorTopic,
        }),
        durationMinutes: context.durationMinutes,
        strictCurriculumAlignment,
      });
      setLastGenerationRun(fullRun);
      setLastSavedAt(new Date(created.doc.updatedAt));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate document.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateSection = async (sectionId: string, newContent: unknown) => {
    setCurrentDocument((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          lastEdited: new Date(),
        },
        sections: prev.sections.map((section) =>
          section.id === sectionId
            ? { ...section, content: newContent }
            : section,
        ),
      };
    });

    if (!backendDocumentRef) {
      return;
    }

    try {
      const updated = await patchDocumentSection(
        backendDocumentRef.documentId,
        sectionId,
        newContent,
      );

      setBackendDocumentRef((prev) =>
        prev
          ? { ...prev, latestVersionId: updated.latestVersion.id }
          : prev,
      );
      setLastSavedAt(new Date(updated.latestVersion.createdAt));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save section update.";
      setError(message);
    }
  };

  const saveCurrentDocument = async () => {
    if (!backendDocumentRef || !currentDocument) {
      throw new Error("No active document to save.");
    }

    setIsSaving(true);
    setError(null);

    try {
      const contentJson = {
        metadata: {
          title: currentDocument.metadata.title,
          type: currentDocument.metadata.type,
          generatedAt: currentDocument.metadata.lastEdited.toISOString(),
          curriculumContext: {
            programme: currentDocument.metadata.curriculumContext.programme,
            year: currentDocument.metadata.curriculumContext.year,
            course: backendGenerationContext?.course ?? null,
            topic: currentDocument.metadata.curriculumContext.topic,
          },
        },
        sections: currentDocument.sections.map((section) => ({
          id: section.id,
          title: section.title,
          type: section.type,
          content: section.content,
          citations: Array.isArray((section as { citations?: unknown }).citations)
            ? (section as { citations?: unknown }).citations
            : [],
        })),
      };

      const updated = await updateDocument(backendDocumentRef.documentId, {
        title: currentDocument.metadata.title,
        programme: currentDocument.metadata.curriculumContext.programme,
        year:
          currentDocument.metadata.curriculumContext.year === "Not specified"
            ? undefined
            : currentDocument.metadata.curriculumContext.year,
        course: backendGenerationContext?.course,
        topic: currentDocument.metadata.curriculumContext.topic,
        durationMinutes: backendGenerationContext?.durationMinutes,
        createVersion: true,
        contentJson,
        changeSummary: "Manual save from editor",
      });

      setBackendDocumentRef((prev) =>
        prev
          ? { ...prev, latestVersionId: updated.latestVersion.id }
          : prev,
      );
      setLastSavedAt(new Date(updated.latestVersion.createdAt));
      setCurrentDocument((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...prev.metadata,
                lastEdited: new Date(updated.document.updatedAt),
              },
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save document.";
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateSection = async (sectionId: string, instructions?: string) => {
    if (!backendDocumentRef || !backendGenerationContext || !currentDocument) {
      throw new Error("No active document to regenerate.");
    }

    setIsLoading(true);
    setError(null);

    try {
      const section = currentDocument.sections.find((item) => item.id === sectionId);
      if (!section) {
        throw new Error("Selected section was not found in the current document.");
      }

      const generationRun = await createGenerationRun({
        documentId: backendDocumentRef.documentId,
        documentType: backendGenerationContext.documentType,
        title: backendGenerationContext.title,
        programme: backendGenerationContext.programme,
        year: backendGenerationContext.year,
        course: backendGenerationContext.course,
        topic: backendGenerationContext.topic,
        durationMinutes: backendGenerationContext.durationMinutes,
        strictCurriculumAlignment:
          backendGenerationContext.strictCurriculumAlignment,
        promptInput: {
          source: "editor_section_regenerate",
          sectionId,
          sectionTitle: section.title,
          userInstructions: instructions ?? null,
          existingSectionContent: section.content,
        },
      });

      const fullRun = await hydrateGenerationRun(generationRun);
      const output = fullRun.outputJson ?? generationRun.outputJson;
      if (!output) {
        throw new Error(
          fullRun.errorMessage ??
            generationRun.errorMessage ??
            "Regeneration completed without output.",
        );
      }

      const nextSections = normalizeSections(output.sections);
      if (nextSections.length === 0) {
        throw new Error(
          "Regeneration response did not include document sections.",
        );
      }

      setCurrentDocument((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          metadata: {
            ...prev.metadata,
            lastEdited: new Date(),
          },
          sections: nextSections,
        };
      });

      if (fullRun.documentVersionId) {
        setBackendDocumentRef((prev) =>
          prev
            ? {
                ...prev,
                latestVersionId: fullRun.documentVersionId ?? prev.latestVersionId,
              }
            : prev,
        );
      }

      setLastGenerationRun(fullRun);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to regenerate section.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createExport = async (format: "pdf" | "docx" | "pptx") => {
    if (!backendDocumentRef) {
      throw new Error("No active backend document to export.");
    }

    return createExportJob({
      documentId: backendDocumentRef.documentId,
      documentVersionId: backendDocumentRef.latestVersionId,
      format,
    });
  };

  const loadDocumentById = async (documentId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await getDocument(documentId);

      if (!payload.latestVersion) {
        throw new Error("Selected document has no saved version.");
      }

      const uiDocument = buildUiDocument({
        documentId: payload.document.id,
        title: payload.document.title,
        documentType: ensureBackendDocumentType(payload.document.documentType),
        programme: payload.document.programme,
        year: payload.document.year ?? undefined,
        topic: payload.document.topic,
        createdAt: payload.document.createdAt,
        updatedAt: payload.document.updatedAt,
        contentJson: payload.latestVersion.contentJson,
      });

      setCurrentDocument(uiDocument);
      setBackendDocumentRef({
        documentId: payload.document.id,
        latestVersionId: payload.latestVersion.id,
      });
      setBackendGenerationContext({
        title: payload.document.title,
        documentType: ensureBackendDocumentType(payload.document.documentType),
        programme: payload.document.programme,
        year: payload.document.year ?? undefined,
        course: payload.document.course ?? undefined,
        topic: payload.document.topic,
        durationMinutes: payload.document.durationMinutes ?? undefined,
        strictCurriculumAlignment: true,
      });
      setLastGenerationRun(null);
      setLastSavedAt(new Date(payload.latestVersion.createdAt));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load document.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DocumentContext.Provider
      value={{
        currentDocument,
        lastGenerationRun,
        createNewDocument,
        updateSection,
        regenerateSection,
        saveCurrentDocument,
        createExport,
        loadDocumentById,
        isLoading,
        isSaving,
        lastSavedAt,
        error,
        clearError,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};
