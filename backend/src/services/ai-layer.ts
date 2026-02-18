import { z } from "zod";
import { env } from "../config.js";

type ProviderName = "azure" | "gemini" | "deepseek";

const ALLOWED_SECTION_TYPES = [
  "text",
  "list",
  "script",
  "rubric",
  "duration_list",
  "table",
] as const;

const sectionTypeSchema = z.enum([
  "text",
  "list",
  "script",
  "rubric",
  "duration_list",
  "table",
]);

type GeneratedSectionType = z.infer<typeof sectionTypeSchema>;

const GeneratedOutputSchema = z.object({
  metadata: z.object({
    title: z.string(),
    type: z.string(),
    generatedAt: z.string().optional(),
    curriculumContext: z
      .object({
        programme: z.string(),
        year: z.string().nullable().optional(),
        course: z.string().nullable().optional(),
        topic: z.string(),
      })
      .passthrough(),
  }),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: sectionTypeSchema,
        content: z.unknown(),
        citations: z
          .array(
            z.object({
              sourceId: z.string(),
              sourceName: z.string().optional(),
              page: z.number().int().nullable().optional(),
              chunkId: z.string(),
              quoteSnippet: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .min(3),
});

export interface RetrievalChunkForPrompt {
  chunkId: string;
  sourceId: string;
  sourceName: string;
  page: number | null;
  heading: string | null;
  text: string;
}

export interface GenerateDocumentInput {
  documentType: string;
  title: string;
  programme: string;
  year?: string;
  course?: string;
  topic: string;
  plannerGuidance?: {
    programmeLevel?: string;
    semester?: string;
    subtopic?: string;
    minorTopic?: string;
    unit?: string;
    section?: string;
    difficultyLevel?: string;
    objectives?: string[];
    outcomes?: string[];
  };
  durationMinutes?: number;
  strictCurriculumAlignment: boolean;
  promptVersionName?: string;
  promptSystemText?: string;
  promptDeveloperText?: string;
  retrievalChunks: RetrievalChunkForPrompt[];
  retrievalPlan?: LessonRetrievalPlanItem[];
}

export interface GenerateDocumentResult {
  output: Record<string, unknown>;
  provider: ProviderName;
  model: string;
}

export interface LessonRetrievalPlanItem {
  sectionId: string;
  query: string;
  purpose: string;
  chunkIds: string[];
}

interface ProviderCallResult {
  rawText: string;
  model: string;
}

function isLessonPlanDocumentType(documentType: string) {
  const value = documentType.toLowerCase();
  return value.includes("lesson");
}

export interface AnswerCurriculumQuestionInput {
  question: string;
  strictCurriculumAlignment: boolean;
  retrievalChunks: RetrievalChunkForPrompt[];
  curriculumContext?: {
    programme?: string;
    programmeLevel?: string;
    year?: string;
    course?: string;
    topic?: string;
    subtopic?: string;
    minorTopic?: string;
    unit?: string;
    section?: string;
  };
}

export interface AnswerCurriculumQuestionResult {
  answer: string;
  provider: ProviderName;
  model: string;
}

function parseProviderPriority(): ProviderName[] {
  const raw = env.LLM_PROVIDER_PRIORITY.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const allowed: ProviderName[] = ["azure", "gemini", "deepseek"];
  const ordered = raw.filter((item): item is ProviderName =>
    allowed.includes(item as ProviderName),
  );

  return ordered.length > 0 ? ordered : ["azure", "gemini", "deepseek"];
}

function assertProviderConfig(provider: ProviderName) {
  if (
    provider === "azure" &&
    (!env.AZURE_OPENAI_ENDPOINT ||
      !env.AZURE_OPENAI_API_KEY ||
      !env.AZURE_OPENAI_DEPLOYMENT)
  ) {
    throw new Error("Azure OpenAI provider is missing configuration.");
  }

  if (provider === "gemini" && !env.GEMINI_API_KEY) {
    throw new Error("Gemini provider is missing configuration.");
  }

  if (provider === "deepseek" && !env.DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek provider is missing configuration.");
  }
}

function normalizeAzureEndpoint(rawEndpoint: string) {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname || "";

    // Azure Foundry project endpoint:
    // https://<resource>.services.ai.azure.com/api/projects/<project>
    // For inference we need the resource root host.
    if (pathname.startsWith("/api/projects/")) {
      return parsed.origin;
    }

    // Full Azure OpenAI request URLs are sometimes copied from portal/docs:
    // https://<resource>.cognitiveservices.azure.com/openai/responses?api-version=...
    // https://<resource>.cognitiveservices.azure.com/openai/chat/completions?api-version=...
    // Normalize these to origin so route construction below stays correct.
    if (
      pathname.startsWith("/openai/responses") ||
      pathname.startsWith("/openai/chat/completions") ||
      pathname.startsWith("/openai/deployments/")
    ) {
      return parsed.origin;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} (${response.statusText}): ${text.slice(0, 500)}`,
      );
    }

    return JSON.parse(text) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function unwrapContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const record = item as Record<string, unknown>;
        return typeof record.text === "string" ? record.text : "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Model returned an empty response.");
  }

  if (trimmed.startsWith("```")) {
    const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    if (fenced) return fenced;
  }

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    throw new Error("Could not extract valid JSON from model output.");
  }
}

function parseJsonWithRepairs(text: string) {
  const attempts = [
    text,
    text.replace(/,\s*([}\]])/g, "$1"),
    text.replace(/[\u0000-\u001F]/g, " ").replace(/,\s*([}\]])/g, "$1"),
  ];

  let lastError: Error | null = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Invalid JSON");
    }
  }

  throw lastError ?? new Error("Invalid JSON");
}

function tokenizeForRetrieval(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

const RETRIEVAL_GENERIC_TOKENS = new Set([
  "activity",
  "assessment",
  "background",
  "content",
  "course",
  "curriculum",
  "education",
  "evaluation",
  "introduction",
  "lesson",
  "module",
  "objective",
  "outcome",
  "overview",
  "presentation",
  "section",
  "session",
  "summary",
  "teaching",
  "topic",
  "unit",
]);

function toNormalizedRetrievalText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQueryPhrases(query: string) {
  const normalized = toNormalizedRetrievalText(query);
  if (!normalized) return [] as string[];
  const segments = query
    .split(/[;|,]/)
    .map((part) => toNormalizedRetrievalText(part))
    .filter((part) => part.length >= 8);

  const fromSegments = segments.slice(0, 4);
  if (fromSegments.length > 0) return fromSegments;
  return normalized.length >= 8 ? [normalized] : [];
}

function scoreChunkForQuery(chunk: RetrievalChunkForPrompt, query: string) {
  const textHaystack = toNormalizedRetrievalText(`${chunk.heading ?? ""} ${chunk.text}`);
  const headingHaystack = toNormalizedRetrievalText(chunk.heading ?? "");
  const tokens = Array.from(
    new Set(
      tokenizeForRetrieval(query).filter((token) => !RETRIEVAL_GENERIC_TOKENS.has(token)),
    ),
  );
  if (tokens.length === 0) return 0;

  const phrases = extractQueryPhrases(query);
  let score = 0;
  for (const token of tokens) {
    if (textHaystack.includes(token)) {
      score += 1;
    }
    if (headingHaystack.includes(token)) {
      score += 2;
    }
  }
  for (const phrase of phrases) {
    if (phrase.length < 8) continue;
    if (textHaystack.includes(phrase)) {
      score += 4;
    }
    if (headingHaystack.includes(phrase)) {
      score += 3;
    }
  }
  return score;
}

function defaultLessonRetrievalPlan(input: GenerateDocumentInput): LessonRetrievalPlanItem[] {
  const topic = input.topic;
  const course = input.course ?? "";
  const subtopic = input.plannerGuidance?.subtopic ?? "";
  const minorTopic = input.plannerGuidance?.minorTopic ?? "";
  const objectiveHint = input.plannerGuidance?.objectives?.slice(0, 3).join(" ") ?? "";
  const outcomeHint = input.plannerGuidance?.outcomes?.slice(0, 3).join(" ") ?? "";

  const templates: Array<Omit<LessonRetrievalPlanItem, "chunkIds">> = [
    {
      sectionId: "introduction",
      query: `${course} ${topic} ${subtopic} overview background importance`,
      purpose: "Context paragraph introducing topic scope and relevance.",
    },
    {
      sectionId: "general_objective",
      query: `${topic} learning objectives outcomes ${objectiveHint} ${outcomeHint}`,
      purpose: "General objective statement aligned to curriculum expectations.",
    },
    {
      sectionId: "specific_objectives",
      query: `${topic} specific objectives expected competencies ${objectiveHint} ${outcomeHint}`,
      purpose: "Specific objective list for the lesson.",
    },
    {
      sectionId: "key_definitions",
      query: `${topic} ${subtopic} ${minorTopic} definition defined as key concepts terminology`,
      purpose: "Core definitions and concise concept descriptions to enrich lesson_presentation.content.",
    },
    {
      sectionId: "lesson_presentation",
      query: `${topic} teaching steps practical examples activities demonstration`,
      purpose: "Main table rows: content flow, teacher/learner activities, resources, evaluation.",
    },
    {
      sectionId: "evaluation",
      query: `${topic} assessment formative questions checks understanding`,
      purpose: "Evaluation questions linked to objectives.",
    },
    {
      sectionId: "summary",
      query: `${topic} summary key points recap`,
      purpose: "Short summary paragraph for lesson closure.",
    },
    {
      sectionId: "assignment",
      query: `${topic} homework assignment practice true false short answer`,
      purpose: "Post-lesson assignment items.",
    },
    {
      sectionId: "references",
      query: `${course} ${topic} references bibliography source`,
      purpose: "Source references from retrieved curriculum files.",
    },
  ];

  const objectiveCoverage = uniqueNonEmpty([
    ...(input.plannerGuidance?.objectives ?? []),
    ...(input.plannerGuidance?.outcomes ?? []),
  ]).slice(0, 6);

  objectiveCoverage.forEach((objective, index) => {
    templates.push({
      sectionId: `lesson_presentation_objective_${index + 1}`,
      query: `${topic} ${subtopic} ${minorTopic} ${objective} definition explanation examples`,
      purpose:
        "Objective-level evidence to keep lesson table content detailed and curriculum-complete.",
    });
  });

  return templates.map((template) => {
    const ranked = input.retrievalChunks
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        score: scoreChunkForQuery(chunk, template.query),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, template.sectionId.startsWith("lesson_presentation_objective_") ? 6 : 4)
      .map((item) => item.chunkId);

    return {
      ...template,
      chunkIds: ranked.length > 0 ? ranked : input.retrievalChunks.slice(0, 3).map((c) => c.chunkId),
    };
  });
}

function serializeLessonRetrievalPlan(
  plan: LessonRetrievalPlanItem[],
  chunks: RetrievalChunkForPrompt[],
) {
  const chunkMap = new Map(chunks.map((chunk) => [chunk.chunkId, chunk] as const));
  return plan
    .map((item) => {
      const lines = [
        `section_id: ${item.sectionId}`,
        `purpose: ${item.purpose}`,
        `query: ${item.query}`,
        "recommended_chunks:",
      ];

      for (const chunkId of item.chunkIds.slice(0, 5)) {
        const chunk = chunkMap.get(chunkId);
        if (!chunk) {
          lines.push(`- ${chunkId}`);
          continue;
        }
        lines.push(
          `- ${chunk.chunkId} | ${chunk.sourceName} | page ${chunk.page ?? "n/a"} | heading: ${chunk.heading ?? "n/a"}`,
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

type GeneratedOutput = z.infer<typeof GeneratedOutputSchema>;
type GeneratedSection = GeneratedOutput["sections"][number];
type GeneratedCitation = NonNullable<GeneratedSection["citations"]>[number];

type LessonPresentationRow = {
  phase: string;
  time: string;
  specificObjective: string;
  content: string;
  educatorActivities: string;
  learnerActivities: string;
  materials: string;
  assessment: string;
};

const LESSON_TABLE_CONTENT_MAX_CHARS = 1400;
const LESSON_PRESENTATION_ROW_COUNT = 6;
const LESSON_PRESENTATION_SLOT_MINUTES = 10;
const LESSON_PLACEHOLDER_PATTERNS = [
  /clarify the central concept/i,
  /break down .*teachable elements/i,
  /connect the concept/i,
  /guide learners through an overview/i,
  /a patient presents with symptoms related to/i,
  /understand key aspects of/i,
  /content area/i,
];

function compactLessonTableCell(value: string, maxChars: number) {
  const clean = sanitizeGeneratedText(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\s*Definitions\/Descriptions:\s*/i, "\n\nDefinitions/Descriptions:\n");
  if (clean.length <= maxChars) return clean;

  const markerPattern = /\n\nDefinitions\/Descriptions:\n/i;
  const markerMatch = clean.match(markerPattern);

  const takeByLines = (text: string, budget: number) => {
    if (budget <= 4) return "";
    const lines = text.split("\n");
    let kept = "";
    for (const line of lines) {
      const candidate = kept ? `${kept}\n${line}` : line;
      if (candidate.length > budget - 4) break;
      kept = candidate;
    }
    if (!kept.trim()) {
      return text.slice(0, Math.max(0, budget - 3)).trimEnd();
    }
    return kept.trimEnd();
  };

  // Preserve the Definitions/Descriptions block even when content is long.
  if (markerMatch && markerMatch.index !== undefined) {
    const markerIndex = markerMatch.index;
    const before = clean.slice(0, markerIndex).trim();
    const details = clean.slice(markerIndex + 2).trim(); // starts with Definitions/Descriptions:
    const detailsBudget = Math.min(
      Math.max(260, Math.floor(maxChars * 0.45)),
      Math.max(280, maxChars - 80),
    );
    const keptDetails = takeByLines(details, detailsBudget);
    const remainingForBefore = Math.max(
      40,
      maxChars - keptDetails.length - (keptDetails ? 2 : 0) - 3,
    );
    const keptBefore = before ? takeByLines(before, remainingForBefore) : "";
    const merged = [keptBefore, keptDetails].filter(Boolean).join("\n\n").trim();
    return merged.length < clean.length ? `${merged}\n...` : merged;
  }

  const kept = takeByLines(clean, maxChars);
  if (kept.trim().length > 0) {
    return `${kept}\n...`;
  }
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function stripLessonPlaceholderLines(value: string) {
  const cleaned = sanitizeGeneratedText(value);
  if (!cleaned) return "";
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !LESSON_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(line)));

  if (lines.length === 0) return cleaned;

  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const signature = line.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    uniqueLines.push(line);
  }

  return uniqueLines.join("\n");
}

function toLooseText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => toLooseText(item)).join("\n");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => toLooseText(item))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function sanitizeGeneratedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeLine(value: unknown) {
  return sanitizeGeneratedText(toLooseText(value))
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[\.\)]\s+/, "")
    .trim();
}

function uniqueNonEmpty(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function lineSignature(value: string) {
  return sanitizeGeneratedText(value)
    .toLowerCase()
    .replace(/\b(definitions|descriptions|description)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNearDuplicateText(a: string, b: string) {
  const sa = lineSignature(a);
  const sb = lineSignature(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (sa.length >= 24 && sb.includes(sa)) return true;
  if (sb.length >= 24 && sa.includes(sb)) return true;
  return false;
}

function parseDefinitionsBlock(text: string) {
  const clean = sanitizeGeneratedText(text).replace(/\r\n/g, "\n");
  const markerRegex = /\n\nDefinitions\/Descriptions:\n/i;
  const match = clean.match(markerRegex);
  if (!match || match.index === undefined) {
    return { preface: clean.trim(), definitions: [] as string[] };
  }
  const preface = clean.slice(0, match.index).trim();
  const details = clean.slice(match.index + match[0].length).trim();
  const definitions = uniqueNonEmpty(
    details
      .split(/\n+|;/)
      .map((item) => sanitizeLine(item.replace(/^[-*]\s*/, "")))
      .filter((item) => item.length >= 18),
  );
  return { preface, definitions };
}

function dedupeLessonPresentationContentAcrossRows(
  rows: LessonPresentationRow[],
  input: GenerateDocumentInput,
) {
  if (rows.length === 0) return rows;

  const seenPreface = new Set<string>();
  const seenDefinitions = new Set<string>();

  return rows.map((row) => {
    const parsed = parseDefinitionsBlock(row.content);
    const objectiveHint = sanitizeGeneratedText(row.specificObjective) || input.topic;

    const keptPrefaceLines: string[] = [];
    for (const raw of parsed.preface.split("\n")) {
      const line = sanitizeLine(raw);
      if (!line) continue;
      const sig = lineSignature(line);
      if (!sig || seenPreface.has(sig)) continue;
      seenPreface.add(sig);
      keptPrefaceLines.push(line);
    }

    const keptDefinitions: string[] = [];
    for (const definition of parsed.definitions) {
      const sig = lineSignature(definition);
      if (!sig || seenDefinitions.has(sig)) continue;
      seenDefinitions.add(sig);
      keptDefinitions.push(definition);
    }

    if (keptDefinitions.length === 0) {
      const fallbackDefinitions = extractCoverageSentences(
        input,
        [
          input.topic,
          input.plannerGuidance?.subtopic ?? "",
          input.plannerGuidance?.minorTopic ?? "",
          objectiveHint,
          "definition description meaning",
        ]
          .filter(Boolean)
          .join(" "),
        2,
      )
        .map((item) => sanitizeLine(item))
        .filter((item) => item.length >= 24);

      for (const definition of fallbackDefinitions) {
        const sig = lineSignature(definition);
        if (!sig || seenDefinitions.has(sig)) continue;
        seenDefinitions.add(sig);
        keptDefinitions.push(definition);
        if (keptDefinitions.length >= 2) break;
      }
    }

    if (keptPrefaceLines.length === 0) {
      keptPrefaceLines.push(
        `Objective focus: ${objectiveHint}.`,
        `Use the retrieved module evidence to teach the specific concept and nursing relevance for ${input.topic}.`,
      );
    }

    const prefaceBlock = keptPrefaceLines.join("\n").trim();
    const definitionBlock =
      keptDefinitions.length > 0
        ? `Definitions/Descriptions:\n${keptDefinitions
            .slice(0, 4)
            .map((item) => `- ${item}`)
            .join("\n")}`
        : "Definitions/Descriptions:\n- Not found in module.";

    return {
      ...row,
      content: compactLessonTableCell(
        `${prefaceBlock}\n\n${definitionBlock}`,
        LESSON_TABLE_CONTENT_MAX_CHARS,
      ),
    };
  });
}

function ensureSummaryDistinctFromBody(
  summary: string,
  introduction: string,
  generalObjective: string,
  objectives: string[],
  topic: string,
) {
  const trimmed = sanitizeGeneratedText(summary);
  const intro = sanitizeGeneratedText(introduction);
  const general = sanitizeGeneratedText(generalObjective);

  const duplicated =
    isNearDuplicateText(trimmed, intro) || isNearDuplicateText(trimmed, general);

  if (!trimmed || duplicated) {
    const objectiveLine = objectives
      .map((item) => sanitizeLine(item))
      .filter(Boolean)
      .slice(0, 2)
      .join("; ");
    return objectiveLine
      ? `This lesson consolidated ${topic} through the objectives covered: ${objectiveLine}. Learners should now demonstrate clearer conceptual understanding and applied nursing relevance.`
      : `This lesson consolidated ${topic}, reinforced core concepts, and linked learning to practical nursing application.`;
  }

  return trimmed;
}

function listFromUnknown(value: unknown, limit = 10): string[] {
  const asTextLines = (text: string) =>
    text
      .split("\n")
      .map((line) => sanitizeLine(line))
      .filter(Boolean);

  if (Array.isArray(value)) {
    const rows = value.flatMap((item) => {
      if (typeof item === "string") return asTextLines(item);
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const preferred = [
          "item",
          "text",
          "objective",
          "outcome",
          "activity",
          "description",
          "content",
          "value",
        ];
        for (const key of preferred) {
          if (record[key] !== undefined) {
            const text = sanitizeLine(record[key]);
            if (text) return [text];
          }
        }
        const joined = sanitizeLine(Object.values(record).map((v) => toLooseText(v)).join(" "));
        return joined ? [joined] : [];
      }
      const fallback = sanitizeLine(item);
      return fallback ? [fallback] : [];
    });
    return uniqueNonEmpty(rows).slice(0, limit);
  }

  if (typeof value === "string") {
    return uniqueNonEmpty(asTextLines(value)).slice(0, limit);
  }

  const fallback = sanitizeLine(value);
  return fallback ? [fallback] : [];
}

function contentToParagraph(value: unknown, fallback: string) {
  const text = sanitizeGeneratedText(toLooseText(value));
  if (!text) return fallback;
  const paragraphs = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const merged = paragraphs.join("\n");
  return merged.slice(0, 1600) || fallback;
}

function normalizeCitation(citation: GeneratedCitation): GeneratedCitation {
  return {
    sourceId: citation.sourceId,
    sourceName: citation.sourceName,
    page:
      typeof citation.page === "number" && Number.isFinite(citation.page)
        ? Math.max(1, Math.floor(citation.page))
        : null,
    chunkId: citation.chunkId,
    quoteSnippet: sanitizeGeneratedText(citation.quoteSnippet).slice(0, 260),
  };
}

function normalizeSectionContent(type: GeneratedSectionType, content: unknown): unknown {
  if (type === "text") {
    return contentToParagraph(content, "Content unavailable.");
  }

  if (type === "list" || type === "rubric") {
    const items = listFromUnknown(content, 14);
    return items.length > 0 ? items : ["No items provided."];
  }

  if (type === "duration_list") {
    if (Array.isArray(content)) {
      const rows = content
        .filter((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))
        .map((row) => {
          const record = row as Record<string, unknown>;
          return {
            time: sanitizeLine(record.time ?? record.duration ?? ""),
            activity: sanitizeLine(
              record.activity ?? record.content ?? record.description ?? "",
            ),
          };
        })
        .filter((row) => row.time || row.activity);
      if (rows.length > 0) return rows.slice(0, 12);
    }
    const items = listFromUnknown(content, 10);
    return items.map((item) => ({ time: "", activity: item }));
  }

  if (type === "table") {
    if (Array.isArray(content)) {
      return content
        .filter((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))
        .map((row) => {
          const record = row as Record<string, unknown>;
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(record)) {
            normalized[key] = sanitizeLine(value);
          }
          return normalized;
        })
        .filter((row) =>
          Object.values(row).some((value) => typeof value === "string" && value.length > 0),
        );
    }
    return [];
  }

  if (type === "script") {
    if (Array.isArray(content)) {
      return content
        .filter((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))
        .map((row) => {
          const record = row as Record<string, unknown>;
          return {
            speaker: sanitizeLine(record.speaker ?? record.role ?? "Facilitator"),
            text: sanitizeLine(record.text ?? record.content ?? ""),
            note: sanitizeLine(record.note ?? ""),
          };
        })
        .filter((row) => row.text);
    }
    return [{ speaker: "Facilitator", text: contentToParagraph(content, "No script provided.") }];
  }

  return contentToParagraph(content, "Content unavailable.");
}

function sectionMatches(section: GeneratedSection, needles: string[]) {
  const haystack = `${section.id} ${section.title}`.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function findSection(sections: GeneratedSection[], needles: string[]) {
  return sections.find((section) => sectionMatches(section, needles));
}

function canonicalLessonMetadataRows(
  input: GenerateDocumentInput,
  source?: GeneratedSection,
) {
  const fromSource = new Map<string, string>();
  const rows = Array.isArray(source?.content) ? source.content : [];

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const key = sanitizeLine(record.field ?? record.label ?? record.name).toLowerCase();
    const value = sanitizeLine(record.value ?? record.content ?? record.text);
    if (key && value) {
      fromSource.set(key, value);
    }
  }

  const lookup = (aliases: string[], fallback: string) => {
    for (const alias of aliases) {
      const value = fromSource.get(alias.toLowerCase());
      if (value) return value;
    }
    return fallback;
  };

  const topicLine = [
    input.topic,
    input.plannerGuidance?.subtopic ? ` - ${input.plannerGuidance.subtopic}` : "",
    input.plannerGuidance?.minorTopic ? ` - ${input.plannerGuidance.minorTopic}` : "",
  ]
    .join("")
    .trim();

  return [
    { field: "NAME OF STUDENT", value: lookup(["name of student", "student"], "______________________") },
    { field: "STUDENT NUMBER", value: lookup(["student number", "index number"], "______________________") },
    { field: "COURSE NAME", value: lookup(["course name", "course/module", "course", "module"], input.course ?? "Nursing") },
    {
      field: "PROGRAMME",
      value: lookup(
        ["programme", "programme level", "level"],
        input.plannerGuidance?.programmeLevel ?? "Diploma",
      ),
    },
    { field: "NAME OF TOPIC", value: lookup(["name of topic", "topic"], topicLine || input.topic) },
    { field: "DATE", value: lookup(["date", "lesson date"], new Date().toLocaleDateString()) },
    { field: "VENUE", value: lookup(["venue"], "Classroom / Ward") },
    { field: "INTAKE", value: lookup(["intake"], "______________") },
    { field: "SIZE OF CLASS", value: lookup(["size of class", "number of students", "students"], "______________") },
    { field: "TIME", value: lookup(["time"], "08:00 - 09:00") },
    {
      field: "DURATION",
      value: lookup(["duration", "duration (minutes)"], `${input.durationMinutes ?? 60} Minutes`),
    },
    { field: "METHOD OF TEACHING", value: lookup(["method of teaching", "method of instruction", "method"], "Lecture / Discussion") },
    { field: "MEDIA OF TEACHING", value: lookup(["media of teaching", "media", "teaching media"], "Whiteboard, LCD") },
    { field: "NAME OF SUPERVISOR", value: lookup(["name of supervisor", "supervisor"], "______________________") },
  ];
}

function fallbackLessonPresentationRows(input: GenerateDocumentInput): LessonPresentationRow[] {
  const rows: LessonPresentationRow[] = [
    {
      phase: "Introduction",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: `Orient learners to the core ideas of ${input.topic}.`,
      content: `Introduce ${input.topic} and connect to prior learning.`,
      educatorActivities: "Set lesson context and state objectives.",
      learnerActivities: "Respond to starter questions and share prior knowledge.",
      materials: "Whiteboard, marker, module notes",
      assessment: "Oral questioning",
    },
    {
      phase: "Development 1",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: `Explain foundational concepts of ${input.topic}.`,
      content: `Core teaching and guided discussion for ${input.topic}.`,
      educatorActivities: "Facilitate explanations, demonstrations, and discussion.",
      learnerActivities: "Participate in discussion, note-taking, and short practice tasks.",
      materials: "Slides/handouts/flip chart",
      assessment: "Formative checks for understanding",
    },
    {
      phase: "Development 2",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: `Apply concepts of ${input.topic} in practical examples.`,
      content: `Guided application of ${input.topic} using contextual nursing examples.`,
      educatorActivities: "Guide applied examples and link concepts to practice.",
      learnerActivities: "Work through examples and justify responses.",
      materials: "Case prompts, board notes",
      assessment: "Targeted oral probes",
    },
    {
      phase: "Development 3",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: `Differentiate key components and relationships within ${input.topic}.`,
      content: `Compare and contrast major elements within ${input.topic}.`,
      educatorActivities: "Facilitate comparison and correct misconceptions.",
      learnerActivities: "Compare concepts and ask clarifying questions.",
      materials: "Comparison chart, marker",
      assessment: "Pair-share check",
    },
    {
      phase: "Development 4",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: `Reinforce clinical relevance of ${input.topic}.`,
      content: `Connect ${input.topic} to clinical reasoning, safety, and patient care.`,
      educatorActivities: "Link concepts to practical nursing decision-making.",
      learnerActivities: "Relate concepts to patient scenarios.",
      materials: "Clinical scenario card",
      assessment: "Scenario response check",
    },
    {
      phase: "Conclusion",
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Consolidate understanding and identify follow-up learning needs.",
      content: "Summarize key points and connect to follow-up learning.",
      educatorActivities: "Recap main points and address misconceptions.",
      learnerActivities: "Summarize learning and ask clarifying questions.",
      materials: "Summary notes",
      assessment: "Exit question or reflection",
    },
  ];

  return rows.slice(0, LESSON_PRESENTATION_ROW_COUNT);
}

function buildDetailedLessonRow(
  input: GenerateDocumentInput,
  index: number,
  partial?: Partial<LessonPresentationRow>,
): LessonPresentationRow {
  const objectives = input.plannerGuidance?.objectives ?? [];
  const basePhase = partial?.phase?.trim()
    ? partial.phase
    : index === 0
      ? "Introduction"
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Conclusion"
        : `Development ${index}`;

  const defaultTime = `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`;
  const objectiveFallback =
    objectives[index] ??
    (index === 0
      ? `Orient learners to the core concepts of ${input.topic}.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? `Consolidate understanding of ${input.topic} through recap and reflection.`
        : index === 1
        ? `Explain and apply major principles of ${input.topic}.`
        : `Deepen understanding and application of ${input.topic}.`);
  const contentFallback =
    index === 0
      ? `Introduce ${input.topic}, activate prior knowledge, and outline what learners are expected to achieve during the lesson.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? `Summarize key ideas from ${input.topic}, correct misconceptions, and highlight the next learning steps.`
        : index === 1
        ? `Develop the lesson with detailed explanations, guided examples, and contextual clinical applications related to ${input.topic}.`
        : `Expand ${input.topic} with structured explanation, practical interpretation, and applied learner tasks.`;
  const educatorFallback =
    index === 0
      ? "Facilitates opening discussion, clarifies objectives, and links the topic to previous learning."
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Leads recap, asks consolidation questions, and reinforces safe professional practice points."
        : index === 1
        ? "Explains concepts step-by-step, demonstrates examples, probes understanding, and gives corrective feedback."
        : "Guides deeper application, prompts analysis, and corrects misconceptions using source-based examples.";
  const learnerFallback =
    index === 0
      ? "Share prior understanding, respond to starter questions, and note lesson expectations."
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Summarize key points, ask clarifying questions, and complete brief reflection tasks."
        : index === 1
        ? "Participate in guided discussion, analyze examples, answer probing questions, and take structured notes."
        : "Analyze examples, relate concepts to practice, and respond to targeted checks for understanding.";
  const materialsFallback =
    index === 0
      ? "Whiteboard, markers, module outline"
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Summary notes, notebook"
        : index === 1
        ? "Whiteboard, handouts/slides, case examples"
        : "Handouts, case prompts, whiteboard";
  const evaluationFallback =
    index === 0
      ? `Opening oral questions to check baseline understanding of ${input.topic}.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Exit question and verbal summary to confirm objective achievement."
        : index === 1
        ? "Formative questioning and short in-lesson checks to verify comprehension."
        : "Focused formative check linked to the specific objective.";

  const ensureDetail = (value: string | undefined, fallback: string) => {
    const normalized = sanitizeLine(value ?? "");
    if (!normalized) return fallback;
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    return wordCount >= 5 ? normalized : `${normalized}. ${fallback}`;
  };

  return {
    phase: ensureDetail(partial?.phase, basePhase),
    time: sanitizeLine(partial?.time ?? "") || defaultTime,
    specificObjective: ensureDetail(partial?.specificObjective, objectiveFallback),
    content: ensureDetail(partial?.content, contentFallback),
    educatorActivities: ensureDetail(partial?.educatorActivities, educatorFallback),
    learnerActivities: ensureDetail(partial?.learnerActivities, learnerFallback),
    materials: ensureDetail(partial?.materials, materialsFallback),
    assessment: ensureDetail(partial?.assessment, evaluationFallback),
  };
}

function normalizeLessonPresentationRows(
  input: GenerateDocumentInput,
  source?: GeneratedSection,
) {
  if (!source || !Array.isArray(source.content)) {
    return fallbackLessonPresentationRows(input);
  }

  const rows = source.content
    .filter((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        phase: sanitizeLine(record.phase ?? record.step ?? record.stage ?? ""),
        time: sanitizeLine(record.time ?? record.duration ?? ""),
        specificObjective: sanitizeLine(
          record.specificObjective ?? record.objective ?? record.obj ?? "",
        ),
        content: sanitizeLine(
          record.content ?? record.topic ?? record.concepts ?? record.activity ?? "",
        ),
        educatorActivities: sanitizeLine(
          record.educatorActivities ??
          record.teacherActivities ??
          record.facilitatorActivities ??
          "",
        ),
        learnerActivities: sanitizeLine(
          record.learnerActivities ??
          record.studentActivities ??
          record.participantActivities ??
          "",
        ),
        materials: sanitizeLine(record.materials ?? record.resources ?? ""),
        assessment: sanitizeLine(record.assessment ?? record.evaluation ?? ""),
      } satisfies LessonPresentationRow;
    })
    .filter((row) => row.phase || row.time || row.content);

  const selected =
    rows.length > 0 ? rows.slice(0, LESSON_PRESENTATION_ROW_COUNT) : fallbackLessonPresentationRows(input);
  const withMinimumRows = [...selected];
  while (withMinimumRows.length < LESSON_PRESENTATION_ROW_COUNT) {
    withMinimumRows.push({
      phase: "",
      time: "",
      specificObjective: "",
      content: "",
      educatorActivities: "",
      learnerActivities: "",
      materials: "",
      assessment: "",
    });
  }

  return withMinimumRows.map((row, index) => buildDetailedLessonRow(input, index, row));
}

function parseMinutesFromText(value: string) {
  const lowered = value.toLowerCase();
  const range = lowered.match(/(\d+)\s*(?:-|to)\s*(\d+)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      return b - a;
    }
  }
  const direct = lowered.match(/(\d+)/);
  if (!direct) return 0;
  const num = Number(direct[1]);
  return Number.isFinite(num) ? num : 0;
}

function enforceDurationBudget(
  rows: LessonPresentationRow[],
  _targetMinutes: number,
  _topic: string,
) {
  const target = `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`;
  return rows
    .slice(0, LESSON_PRESENTATION_ROW_COUNT)
    .map((row) => ({ ...row, time: target }));
}

function mergeDefinitionsIntoPresentationContent(
  rows: LessonPresentationRow[],
  input: GenerateDocumentInput,
  definitions: string[],
) {
  if (rows.length === 0 || definitions.length === 0) return rows;

  const cleanDefinitions = definitions
    .map((item) => sanitizeLine(item))
    .filter((item) => item.length > 0)
    .slice(0, Math.max(3, rows.length * 2));
  if (cleanDefinitions.length === 0) return rows;

  const nextRows = rows.map((row) => ({ ...row }));
  const splitDefinitionParts = (value: string) => {
    const marker = "definitions/descriptions:";
    const clean = sanitizeGeneratedText(value);
    const idx = clean.toLowerCase().indexOf(marker);
    if (idx < 0) {
      return { content: clean, definitions: [] as string[] };
    }
    const content = clean.slice(0, idx).trim();
    const details = clean.slice(idx + marker.length).trim();
    const definitionItems = uniqueNonEmpty(
      details
        .split(/\n+|;/)
        .map((item) => sanitizeLine(item.replace(/^[-*]\s*/, "")))
        .filter((item) => item.length >= 18),
    );
    return { content, definitions: definitionItems };
  };

  const looksLikeDefinitionOrDescription = (sentence: string) => {
    const lowered = sentence.toLowerCase();
    return (
      lowered.includes(" is ") ||
      lowered.includes(" are ") ||
      lowered.includes(" refers to ") ||
      lowered.includes(" defined as ") ||
      lowered.includes(" means ") ||
      lowered.includes(" describes ") ||
      lowered.includes(" characterized by ") ||
      lowered.includes(" consists of ") ||
      lowered.includes(" includes ")
    );
  };

  const buildDefinitionBlock = (items: string[]) => {
    const lines = uniqueNonEmpty(items)
      .slice(0, 4)
      .map((item) => `- ${item}`);
    if (lines.length === 0) return "";
    return `Definitions/Descriptions:\n${lines.join("\n")}`;
  };

  const inferDefinitionsFromChunks = (objectiveHint: string, fallbackPool: string[]) => {
    const query = [
      input.topic,
      input.plannerGuidance?.subtopic ?? "",
      input.plannerGuidance?.minorTopic ?? "",
      objectiveHint,
      "definition description concept meaning",
    ]
      .filter(Boolean)
      .join(" ");

    const scored = input.retrievalChunks
      .map((chunk) => ({
        chunk,
        score: scoreChunkForQuery(chunk, query),
      }))
      .sort((a, b) => b.score - a.score)
      .filter((item) => item.score > 0)
      .slice(0, 6);

    const candidates = uniqueNonEmpty([
      ...scored.flatMap(({ chunk }) =>
        chunk.text
          .split(/(?<=[.!?])\s+|\n+/)
          .map((sentence) => sanitizeGeneratedText(sentence))
          .filter((sentence) => {
            return (
              sentence.length >= 35 &&
              sentence.length <= 340 &&
              isOnTopic(sentence, query, 2) &&
              looksLikeDefinitionOrDescription(sentence)
            );
          }),
      ),
      ...extractCoverageSentences(input, query, 3).filter((sentence) =>
        looksLikeDefinitionOrDescription(sentence),
      ),
      ...fallbackPool,
    ])
      .map((item) => sanitizeLine(item))
      .filter((item) => item.length >= 24)
      .slice(0, 6);

    return candidates.slice(0, 4);
  };

  const usedDefinitionSignatures = new Set<string>();
  let cursor = 0;
  for (let i = 0; i < nextRows.length; i += 1) {
    const objectiveHint =
      sanitizeGeneratedText(nextRows[i].specificObjective) || input.topic;
    const existingParts = splitDefinitionParts(nextRows[i].content);

    const pooled = cleanDefinitions.slice(cursor, cursor + 2);
    cursor += 2;

    const inferred = inferDefinitionsFromChunks(objectiveHint, pooled);
    const mergedDefinitions = uniqueNonEmpty([
      ...existingParts.definitions,
      ...inferred,
    ])
      .filter((item) => {
        const sig = lineSignature(item);
        if (!sig || usedDefinitionSignatures.has(sig)) return false;
        usedDefinitionSignatures.add(sig);
        return true;
      })
      .slice(0, 4);

    const detailBlock = buildDefinitionBlock(
      mergedDefinitions.length > 0
        ? mergedDefinitions
        : ["Not found in module."],
    );
    const existing = existingParts.content;
    nextRows[i].content = compactLessonTableCell(
      detailBlock ? `${existing}\n\n${detailBlock}`.trim() : existing,
      LESSON_TABLE_CONTENT_MAX_CHARS,
    );
  }
  return nextRows;
}

function extractDefinitionCandidates(input: GenerateDocumentInput, limit = 8) {
  const anchor = [
    input.topic,
    input.plannerGuidance?.subtopic ?? "",
    input.plannerGuidance?.minorTopic ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const sentences = input.retrievalChunks
    .flatMap((chunk) =>
      chunk.text
        .split(/(?<=[.!?])\s+/)
        .map((line) => sanitizeGeneratedText(line))
        .filter(Boolean),
    )
    .filter((sentence) => {
      const lowered = sentence.toLowerCase();
      return (
        lowered.includes(" is ") ||
        lowered.includes(" are ") ||
        lowered.includes(" refers to ") ||
        lowered.includes(" defined as ") ||
        lowered.includes(" definition ") ||
        lowered.includes(" describes ") ||
        lowered.includes(" characterized by ") ||
        lowered.includes(" consists of ") ||
        lowered.includes(" includes ")
      );
    })
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 340)
    .filter((sentence) => isOnTopic(sentence, anchor));

  return uniqueNonEmpty(sentences).slice(0, limit);
}

const COVERAGE_STOPWORDS = new Set([
  "about",
  "after",
  "against",
  "among",
  "been",
  "being",
  "between",
  "could",
  "during",
  "from",
  "have",
  "into",
  "lesson",
  "module",
  "must",
  "over",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "topic",
  "under",
  "using",
  "with",
]);

function isOnTopic(text: string, anchor: string, minHits = 2) {
  const anchorTokens = new Set(
    tokenizeForRetrieval(anchor).filter((token) => !COVERAGE_STOPWORDS.has(token)),
  );
  if (anchorTokens.size === 0) return true;
  const textTokens = new Set(tokenizeForRetrieval(text));
  let hit = 0;
  for (const token of textTokens) {
    if (anchorTokens.has(token)) hit += 1;
    if (hit >= minHits) return true;
  }
  return false;
}

function extractCoverageSentences(
  input: GenerateDocumentInput,
  query: string,
  limit = 2,
) {
  const queryTokens = Array.from(
    new Set(
      tokenizeForRetrieval(query).filter(
        (token) => token.length >= 4 && !COVERAGE_STOPWORDS.has(token),
      ),
    ),
  ).slice(0, 14);

  if (queryTokens.length === 0) return [] as string[];

  const scored: Array<{ sentence: string; score: number }> = [];
  for (const chunk of input.retrievalChunks) {
    const heading = (chunk.heading ?? "").toLowerCase();
    const sentences = chunk.text.split(/(?<=[.!?])\s+|\n+/);

    for (const sentenceRaw of sentences) {
      const sentence = sanitizeGeneratedText(sentenceRaw);
      if (sentence.length < 45 || sentence.length > 320) continue;
      if (!isOnTopic(sentence, query, 2)) continue;

      const lowered = sentence.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (lowered.includes(token)) score += 2;
        if (heading.includes(token)) score += 1;
      }

      if (score === 0) continue;
      if (
        lowered.includes(" is ") ||
        lowered.includes(" are ") ||
        lowered.includes(" refers to ") ||
        lowered.includes(" defined as ") ||
        lowered.includes(" includes ")
      ) {
        score += 2;
      }

      scored.push({ sentence, score });
    }
  }

  if (scored.length === 0) return [] as string[];

  const ordered = scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sentence.length - b.sentence.length;
  });

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const entry of ordered) {
    const key = entry.sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry.sentence);
    if (unique.length >= limit) break;
  }
  return unique;
}

function mergeObjectiveCoverageIntoPresentationContent(
  rows: LessonPresentationRow[],
  input: GenerateDocumentInput,
  specificObjectives: string[],
) {
  if (rows.length === 0) return rows;

  const objectiveHints =
    specificObjectives.length > 0
      ? specificObjectives
      : rows.map((row) => sanitizeGeneratedText(row.specificObjective)).filter(Boolean);

  if (objectiveHints.length === 0) return rows;

  const nextRows = rows.map((row) => ({ ...row }));
  const usedSnippetSignatures = new Set<string>();
  for (let i = 0; i < nextRows.length; i += 1) {
    const hint = objectiveHints[Math.min(i, objectiveHints.length - 1)] ?? input.topic;
    const query = [
      input.topic,
      input.plannerGuidance?.subtopic ?? "",
      input.plannerGuidance?.minorTopic ?? "",
      hint,
    ]
      .filter(Boolean)
      .join(" ");

    const snippets = extractCoverageSentences(input, query, 3).filter((snippet) => {
      const sig = lineSignature(snippet);
      if (!sig || usedSnippetSignatures.has(sig)) return false;
      usedSnippetSignatures.add(sig);
      return true;
    });
    if (snippets.length === 0) continue;

    const detailBlock = [
      "Additional evidence:",
      ...snippets.map((snippet) => `- ${snippet}`),
    ].join("\n");
    const existing = sanitizeGeneratedText(nextRows[i].content);
    nextRows[i].content = compactLessonTableCell(
      existing ? `${existing}\n${detailBlock}` : detailBlock,
      LESSON_TABLE_CONTENT_MAX_CHARS,
    );
  }

  return nextRows;
}

function buildFacilitatorNotes(
  input: GenerateDocumentInput,
  rows: LessonPresentationRow[],
  sourceSection?: GeneratedSection,
) {
  const fromSection = listFromUnknown(sourceSection?.content, 10);
  if (fromSection.length > 0) return fromSection;

  const fromRows = rows
    .map((row) => sanitizeGeneratedText(`${row.phase}: ${row.educatorActivities}`))
    .filter((item) => item.length > 12)
    .slice(0, 8);

  if (fromRows.length > 0) return fromRows;

  return [
    `Use context-specific examples when introducing ${input.topic}.`,
    "Pause at key points to check understanding before moving forward.",
    "Reinforce safe practice and local policy alignment throughout the lesson.",
  ];
}

const LESSON_CORE_SECTION_IDS = new Set([
  "lesson_metadata",
  "introduction",
  "general_objective",
  "specific_objectives",
  "lesson_presentation",
  "summary",
  "assignment",
  "evaluation",
  "references",
]);

function isCoreLessonSection(section: GeneratedSection) {
  return (
    LESSON_CORE_SECTION_IDS.has(section.id.toLowerCase()) ||
    sectionMatches(section, [
      "lesson_metadata",
      "lesson context",
      "introduction",
      "overview",
      "general objective",
      "specific objective",
      "objective",
      "outcome",
      "lesson_presentation",
      "teaching_flow",
      "summary",
      "assignment",
      "evaluation",
      "reference",
    ])
  );
}

function normalizeSupplementaryLessonSection(
  section: GeneratedSection,
  index: number,
): GeneratedSection | null {
  const title = sanitizeGeneratedText(section.title);
  const normalizedContent = normalizeSectionContent(section.type, section.content);
  const hasContent =
    (typeof normalizedContent === "string" && normalizedContent.length > 0) ||
    (Array.isArray(normalizedContent) && normalizedContent.length > 0) ||
    (normalizedContent && typeof normalizedContent === "object");
  if (!hasContent) return null;

  return {
    id: `supplementary_${index + 1}_${sanitizeLine(section.id || title || "section").toLowerCase().replace(/\s+/g, "_")}`,
    title: title || `Supplementary Notes ${index + 1}`,
    type: section.type,
    content: normalizedContent,
    citations: (section.citations ?? []).map((citation) => normalizeCitation(citation)),
  };
}

function buildReferences(
  input: GenerateDocumentInput,
  sections: GeneratedSection[],
  referencesSection?: GeneratedSection,
) {
  const fromSection = listFromUnknown(referencesSection?.content, 20);
  const fromCitations = sections
    .flatMap((section) => section.citations ?? [])
    .map((citation) => {
      const source = citation.sourceName ?? "Curriculum source";
      const page =
        typeof citation.page === "number" && Number.isFinite(citation.page)
          ? ` (p.${Math.max(1, Math.floor(citation.page))})`
          : "";
      return sanitizeGeneratedText(`${source}${page}`);
    });

  const combined = uniqueNonEmpty([...fromSection, ...fromCitations]).slice(0, 20);
  if (combined.length > 0) return combined;

  if (input.strictCurriculumAlignment) {
    return ["Not found in module."];
  }

  return fallbackCitations(input).map(
    (citation) =>
      `${citation.sourceName ?? "Curriculum source"}${citation.page ? ` (p.${citation.page})` : ""}`,
  );
}

function normalizeLessonPlanOutput(output: GeneratedOutput, input: GenerateDocumentInput): GeneratedOutput {
  const sections = output.sections;
  const fallback = buildLessonPlanFallbackOutput(input);

  const metadataSection = findSection(sections, ["lesson_metadata", "lesson context", "context"]);
  const introSection = findSection(sections, ["introduction", "overview"]);
  const generalObjectiveSection = findSection(sections, [
    "general_objective",
    "general objective",
    "objective",
  ]);
  const specificObjectivesSection = findSection(sections, [
    "specific_objectives",
    "specific objective",
    "learning_outcomes",
    "learning outcome",
    "outcome",
  ]);
  const presentationSection = findSection(sections, [
    "lesson_presentation",
    "teaching_flow",
    "presentation",
    "activities",
  ]);
  const definitionsSection = findSection(sections, [
    "definition",
    "glossary",
    "terminology",
    "key term",
  ]);
  const summarySection = findSection(sections, ["summary", "conclusion"]);
  const assignmentSection = findSection(sections, ["assignment"]);
  const evaluationSection = findSection(sections, ["evaluation", "assessment"]);
  const referencesSection = findSection(sections, ["reference"]);

  const fallbackSectionCitations =
    fallback.sections[0].citations?.map((citation) => normalizeCitation(citation)) ?? [];
  const citationsFor = (section?: GeneratedSection): GeneratedCitation[] => {
    if (section?.citations && section.citations.length > 0) {
      return section.citations.map(normalizeCitation);
    }
    if (input.strictCurriculumAlignment) return [];
    return fallbackSectionCitations;
  };

  const strictGroundedContent = (
    sectionId: string,
    type: GeneratedSectionType,
    content: unknown,
    citations: GeneratedCitation[],
  ) => {
    if (!input.strictCurriculumAlignment || sectionId === "lesson_metadata") {
      return content;
    }
    if (citations.length > 0) return content;
    if (type === "list" || type === "rubric") return ["Not found in module."];
    if (type === "table") {
      if (Array.isArray(content)) {
        return (content as Array<Record<string, unknown>>).map((row) => ({
          ...row,
          content: "Not found in module.",
        }));
      }
      return content;
    }
    return "Not found in module.";
  };

  const specificObjectives =
    listFromUnknown(specificObjectivesSection?.content, 10).length > 0
      ? listFromUnknown(specificObjectivesSection?.content, 10)
      : input.plannerGuidance?.objectives && input.plannerGuidance.objectives.length > 0
        ? uniqueNonEmpty(input.plannerGuidance.objectives.map((item) => sanitizeLine(item))).slice(0, 10)
        : input.plannerGuidance?.outcomes && input.plannerGuidance.outcomes.length > 0
          ? uniqueNonEmpty(input.plannerGuidance.outcomes.map((item) => sanitizeLine(item))).slice(0, 10)
          : listFromUnknown(
              fallback.sections.find((section) => section.id === "specific_objectives")?.content,
              10,
            );

  const generalObjective = contentToParagraph(
    generalObjectiveSection?.content,
    `By the end of the lecture/discussion, learners should demonstrate clear understanding of ${input.topic}.`,
  );

  const introductionText = contentToParagraph(
    introSection?.content,
    `This lesson introduces ${input.topic} for ${input.programme} learners, with a focus on curriculum-aligned teaching.`,
  );

  const summaryText = contentToParagraph(
    summarySection?.content,
    `This lesson summarized key concepts in ${input.topic} and reinforced practical understanding through guided discussion and evaluation.`,
  );

  const evaluation =
    listFromUnknown(evaluationSection?.content, 8).length > 0
      ? listFromUnknown(evaluationSection?.content, 8)
      : listFromUnknown(
        fallback.sections.find((section) => section.id === "evaluation")?.content,
        8,
      );

  const presentationRows = normalizeLessonPresentationRows(input, presentationSection);
  const timedPresentationRows = enforceDurationBudget(
    presentationRows,
    input.durationMinutes ?? 60,
    input.topic,
  );

  const keyDefinitions =
    listFromUnknown(definitionsSection?.content, 12).length > 0
      ? listFromUnknown(definitionsSection?.content, 12)
      : extractDefinitionCandidates(input, 10);

  const enrichedPresentationRows = mergeDefinitionsIntoPresentationContent(
    timedPresentationRows,
    input,
    keyDefinitions,
  );
  const objectiveCoverageHints =
    specificObjectives.length > 0
      ? specificObjectives
      : uniqueNonEmpty(
          (input.plannerGuidance?.outcomes ?? []).map((item) => sanitizeLine(item)),
        ).slice(0, 10);
  const fullyEnrichedPresentationRows = mergeObjectiveCoverageIntoPresentationContent(
    enrichedPresentationRows,
    input,
    objectiveCoverageHints,
  );
  const deDuplicatedPresentationRows = dedupeLessonPresentationContentAcrossRows(
    fullyEnrichedPresentationRows,
    input,
  );
  const finalizedPresentationRows = deDuplicatedPresentationRows.map((row) => ({
    ...row,
    content: compactLessonTableCell(
      stripLessonPlaceholderLines(row.content),
      LESSON_TABLE_CONTENT_MAX_CHARS,
    ),
    specificObjective: compactLessonTableCell(
      stripLessonPlaceholderLines(row.specificObjective),
      240,
    ),
    educatorActivities: compactLessonTableCell(
      stripLessonPlaceholderLines(row.educatorActivities),
      360,
    ),
    learnerActivities: compactLessonTableCell(
      stripLessonPlaceholderLines(row.learnerActivities),
      360,
    ),
    materials: compactLessonTableCell(
      stripLessonPlaceholderLines(row.materials),
      180,
    ),
    assessment: compactLessonTableCell(
      stripLessonPlaceholderLines(row.assessment),
      220,
    ),
    time: compactLessonTableCell(stripLessonPlaceholderLines(row.time), 40),
  }));
  const summaryTextResolved = ensureSummaryDistinctFromBody(
    summaryText,
    introductionText,
    generalObjective,
    specificObjectives,
    input.topic,
  );

  const presentationCitations = Array.from(
    new Map(
      [...citationsFor(presentationSection), ...citationsFor(definitionsSection)].map(
        (citation) => [`${citation.sourceId}:${citation.chunkId}`, citation] as const,
      ),
    ).values(),
  );
  const introCitations = citationsFor(introSection);
  const generalObjectiveCitations = citationsFor(generalObjectiveSection);
  const specificObjectivesCitations = citationsFor(specificObjectivesSection);
  const summaryCitations = citationsFor(summarySection);
  const evaluationCitations = citationsFor(evaluationSection);
  const assignmentCitations = citationsFor(assignmentSection);
  const referenceCitations = citationsFor(referencesSection);
  const metadataCitations = citationsFor(metadataSection);

  const assignment =
    listFromUnknown(assignmentSection?.content, 10).length > 0
      ? listFromUnknown(assignmentSection?.content, 10)
      : listFromUnknown(
        fallback.sections.find((section) => section.id === "assignment")?.content,
        10,
      );

  return {
    metadata: {
      ...output.metadata,
      title: sanitizeGeneratedText(output.metadata.title) || input.title,
      type: output.metadata.type || input.documentType,
      generatedAt: output.metadata.generatedAt ?? new Date().toISOString(),
      curriculumContext: {
        ...output.metadata.curriculumContext,
        programme: output.metadata.curriculumContext.programme || input.programme,
        year: output.metadata.curriculumContext.year ?? input.year ?? null,
        course: output.metadata.curriculumContext.course ?? input.course ?? null,
        topic: output.metadata.curriculumContext.topic || input.topic,
        subtopic:
          (output.metadata.curriculumContext as Record<string, unknown>).subtopic ??
          input.plannerGuidance?.subtopic ??
          null,
        minorTopic:
          (output.metadata.curriculumContext as Record<string, unknown>).minorTopic ??
          input.plannerGuidance?.minorTopic ??
          null,
      },
    },
    sections: [
      {
        id: "lesson_metadata",
        title: "Lesson Context",
        type: "table",
        content: strictGroundedContent(
          "lesson_metadata",
          "table",
          canonicalLessonMetadataRows(input, metadataSection),
          metadataCitations,
        ),
        citations: metadataCitations,
      },
      {
        id: "introduction",
        title: "INTRODUCTION",
        type: "text",
        content: strictGroundedContent(
          "introduction",
          "text",
          introductionText,
          introCitations,
        ),
        citations: introCitations,
      },
      {
        id: "general_objective",
        title: "GENERAL OBJECTIVE",
        type: "text",
        content: strictGroundedContent(
          "general_objective",
          "text",
          generalObjective,
          generalObjectiveCitations,
        ),
        citations: generalObjectiveCitations,
      },
      {
        id: "specific_objectives",
        title: "SPECIFIC OBJECTIVES",
        type: "list",
        content: strictGroundedContent(
          "specific_objectives",
          "list",
          specificObjectives,
          specificObjectivesCitations,
        ),
        citations: specificObjectivesCitations,
      },
      {
        id: "lesson_presentation",
        title: "LESSON PRESENTATION",
        type: "table",
        content: strictGroundedContent(
          "lesson_presentation",
          "table",
          finalizedPresentationRows,
          presentationCitations,
        ),
        citations: presentationCitations,
      },
      {
        id: "summary",
        title: "SUMMARY",
        type: "text",
        content: strictGroundedContent("summary", "text", summaryTextResolved, summaryCitations),
        citations: summaryCitations,
      },
      {
        id: "evaluation",
        title: "EVALUATION",
        type: "list",
        content: strictGroundedContent("evaluation", "list", evaluation, evaluationCitations),
        citations: evaluationCitations,
      },
      {
        id: "assignment",
        title: "ASSIGNMENT",
        type: "list",
        content: strictGroundedContent("assignment", "list", assignment, assignmentCitations),
        citations: assignmentCitations,
      },
      {
        id: "references",
        title: "REFERENCES",
        type: "list",
        content: strictGroundedContent(
          "references",
          "list",
          buildReferences(input, sections, referencesSection),
          referenceCitations,
        ),
        citations: referenceCitations,
      },
    ],
  };
}

function normalizeOutput(
  parsed: z.infer<typeof GeneratedOutputSchema>,
  input: GenerateDocumentInput,
) {
  const fallbackCitations = input.retrievalChunks.slice(0, 4).map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceName: chunk.sourceName,
    page: chunk.page,
    chunkId: chunk.chunkId,
    quoteSnippet: chunk.text.slice(0, 180),
  }));

  const normalized: GeneratedOutput = {
    metadata: {
      ...parsed.metadata,
      title: sanitizeGeneratedText(parsed.metadata.title) || input.title,
      type: parsed.metadata.type || input.documentType,
      generatedAt: parsed.metadata.generatedAt ?? new Date().toISOString(),
      curriculumContext: {
        ...parsed.metadata.curriculumContext,
        programme:
          parsed.metadata.curriculumContext.programme || input.programme,
        year: parsed.metadata.curriculumContext.year ?? input.year ?? null,
        course: parsed.metadata.curriculumContext.course ?? input.course ?? null,
        topic: parsed.metadata.curriculumContext.topic || input.topic,
      },
    },
    sections: parsed.sections.map((section, index) => ({
      id: sanitizeLine(section.id) || `section_${index + 1}`,
      title: sanitizeGeneratedText(section.title) || `Section ${index + 1}`,
      type: section.type,
      content: normalizeSectionContent(section.type, section.content),
      citations:
        section.citations && section.citations.length > 0
          ? section.citations.map((citation) => normalizeCitation(citation))
          : input.strictCurriculumAlignment
            ? []
            : fallbackCitations.map((citation) => normalizeCitation(citation)),
    })),
  };

  return isLessonPlanDocumentType(input.documentType)
    ? normalizeLessonPlanOutput(normalized, input)
    : normalized;
}

function fallbackCitations(input: GenerateDocumentInput) {
  return input.retrievalChunks.slice(0, 6).map((chunk) => ({
    sourceId: chunk.sourceId,
    sourceName: chunk.sourceName,
    page: chunk.page,
    chunkId: chunk.chunkId,
    quoteSnippet: chunk.text.slice(0, 180),
  }));
}

function buildFallbackOutput(input: GenerateDocumentInput) {
  const citations = fallbackCitations(input);
  const snippet = input.retrievalChunks[0]?.text.slice(0, 220) ?? "Curriculum context available.";
  const fallbackOutcomes =
    input.plannerGuidance?.outcomes && input.plannerGuidance.outcomes.length > 0
      ? input.plannerGuidance.outcomes.slice(0, 5)
      : [
        `Describe core concepts related to ${input.topic}.`,
        "Relate theory to safe clinical learning practice.",
        "Demonstrate understanding through formative assessment.",
      ];

  return {
    metadata: {
      title: input.title,
      type: input.documentType,
      generatedAt: new Date().toISOString(),
      curriculumContext: {
        programme: input.programme,
        year: input.year ?? null,
        course: input.course ?? null,
        topic: input.topic,
      },
    },
    sections: [
      {
        id: "overview",
        title: "Overview",
        type: "text" as const,
        content: `Lesson focus: ${input.topic}. ${snippet}`,
        citations,
      },
      {
        id: "outcomes",
        title: "Learning Outcomes",
        type: "list" as const,
        content: fallbackOutcomes,
        citations,
      },
      {
        id: "teaching_flow",
        title: "Teaching Flow",
        type: "duration_list" as const,
        content: [
          { time: "0-15 min", activity: "Introduction and prior knowledge check." },
          { time: "15-60 min", activity: `Guided teaching on ${input.topic}.` },
          { time: "60-90 min", activity: "Recap, Q&A, and formative questions." },
        ],
        citations,
      },
      {
        id: "assessment",
        title: "Assessment",
        type: "list" as const,
        content: [
          "Oral questioning during lesson delivery.",
          "Short written check for understanding.",
          "End-of-session reflective prompt.",
        ],
        citations,
      },
      {
        id: "safety_notes",
        title: "Safety Notes",
        type: "list" as const,
        content: [
          "Follow local infection prevention protocols.",
          "Confirm procedures against local institutional guidelines.",
          "Mark unsupported details as needing verification.",
        ],
        citations,
      },
    ],
  };
}

function buildLessonPlanFallbackOutput(input: GenerateDocumentInput) {
  const citations = fallbackCitations(input);
  const defaultDefinitions = [
    `${input.topic}: A core concept area within the selected nursing curriculum context.`,
    "Clinical relevance: Knowledge from this topic supports safe, evidence-informed nursing decisions.",
    "Professional relevance: Mastery of terminology improves communication, documentation, and patient care coordination.",
  ];
  const specificObjectives =
    input.plannerGuidance?.outcomes && input.plannerGuidance.outcomes.length > 0
      ? input.plannerGuidance.outcomes.slice(0, 6)
      : [
        `Explain key principles of ${input.topic}.`,
        `Apply ${input.topic} concepts in realistic clinical scenarios.`,
        "Demonstrate safe and professional nursing judgement.",
      ];
  const plannerObjectives =
    input.plannerGuidance?.objectives && input.plannerGuidance.objectives.length > 0
      ? input.plannerGuidance.objectives.slice(0, 6)
      : [
        `Introduce foundational concepts in ${input.topic}.`,
        `Guide learner participation and reasoning on ${input.topic}.`,
        "Assess understanding using short formative checks.",
      ];

  return {
    metadata: {
      title: input.title,
      type: input.documentType,
      generatedAt: new Date().toISOString(),
      curriculumContext: {
        programme: input.programme,
        year: input.year ?? null,
        course: input.course ?? null,
        topic: input.topic,
      },
    },
    sections: [
      {
        id: "lesson_metadata",
        title: "LESSON METADATA",
        type: "table" as const,
        content: canonicalLessonMetadataRows(input),
        citations,
      },
      {
        id: "introduction",
        title: "INTRODUCTION",
        type: "text" as const,
        content: `This lesson introduces ${input.topic} for ${input.programme} learners, with a focus on safe application in nursing education.`,
        citations,
      },
      {
        id: "general_objective",
        title: "GENERAL OBJECTIVE",
        type: "text" as const,
        content:
          plannerObjectives[0] ??
          `By the end of the lecture/discussion, learners should demonstrate clear understanding of ${input.topic}.`,
        citations,
      },
      {
        id: "specific_objectives",
        title: "SPECIFIC OBJECTIVES",
        type: "list" as const,
        content: specificObjectives,
        citations,
      },
      {
        id: "lesson_presentation",
        title: "LESSON PRESENTATION",
        type: "table" as const,
        content: [
          {
            phase: "Introduction",
            time: "10 min",
            specificObjective: `Introduce the foundational concepts of ${input.topic}.`,
            content: `Introduce ${input.topic} and connect to prior learning.\nDefinitions/Descriptions: ${defaultDefinitions[0]}`,
            educatorActivities: "Ask starter questions; present learning targets.",
            learnerActivities: "Respond to prompts and share prior understanding.",
            materials: "Whiteboard, marker, module notes",
            assessment: "Oral questioning",
          },
          {
            phase: "Development",
            time: "40 min",
            specificObjective: `Explain and apply key principles of ${input.topic}.`,
            content: `Core concepts, examples, and guided discussion for ${input.topic}.\nDefinitions/Descriptions: ${defaultDefinitions[1]} ; ${defaultDefinitions[2]}`,
            educatorActivities: "Facilitate explanation, demonstration, and case prompts.",
            learnerActivities: "Participate in guided discussion and note-taking.",
            materials: "Slides/module extracts/flip chart",
            assessment: "Short checks for understanding",
          },
          {
            phase: "Conclusion",
            time: "10 min",
            specificObjective: "Consolidate understanding and identify next learning steps.",
            content: "Summarize key points and link to next lesson.",
            educatorActivities: "Recap and clarify misconceptions.",
            learnerActivities: "Summarize takeaways and ask final questions.",
            materials: "Summary notes",
            assessment: "Exit question/reflection",
          },
        ],
        citations,
      },
      {
        id: "summary",
        title: "SUMMARY",
        type: "text" as const,
        content: `The lesson covered core concepts of ${input.topic}, reinforced definitions and practical meaning, and checked understanding through guided questioning.`,
        citations,
      },
      {
        id: "evaluation",
        title: "EVALUATION",
        type: "list" as const,
        content: [
          `What is ${input.topic}?`,
          `Explain one method used to assess understanding in ${input.topic}.`,
          `State one practical application of ${input.topic}.`,
        ],
        citations,
      },
      {
        id: "assignment",
        title: "ASSIGNMENT",
        type: "list" as const,
        content: [
          `1) ${input.topic} is relevant to safe nursing practice.`,
          `2) Clear definitions improve teaching quality in ${input.topic}.`,
          `3) Formative checks are unnecessary during lessons on ${input.topic}.`,
          `4) Learner participation supports deeper understanding of ${input.topic}.`,
          `5) Curriculum references should guide lesson content on ${input.topic}.`,
        ],
        citations,
      },
      {
        id: "references",
        title: "REFERENCES",
        type: "list" as const,
        content: citations.map((item) =>
          `${item.sourceName ?? "Curriculum source"}${item.page ? ` (p.${item.page})` : ""}`,
        ),
        citations,
      },
    ],
  };
}

function coerceModelOutput(
  parsed: unknown,
  input: GenerateDocumentInput,
): z.infer<typeof GeneratedOutputSchema> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const metadataRecord =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {};
  const curriculumContextRecord =
    metadataRecord.curriculumContext &&
      typeof metadataRecord.curriculumContext === "object" &&
      !Array.isArray(metadataRecord.curriculumContext)
      ? (metadataRecord.curriculumContext as Record<string, unknown>)
      : {};

  const citationsFallback = fallbackCitations(input);
  const rawSections = Array.isArray(record.sections) ? record.sections : [];

  const sections = rawSections
    .map((section, index) => {
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        return null;
      }
      const sectionRecord = section as Record<string, unknown>;
      const typeValue: GeneratedSectionType =
        typeof sectionRecord.type === "string" &&
          (ALLOWED_SECTION_TYPES as readonly string[]).includes(sectionRecord.type)
          ? (sectionRecord.type as GeneratedSectionType)
          : "text";

      const rawCitations = Array.isArray(sectionRecord.citations)
        ? sectionRecord.citations
        : [];

      const citations = rawCitations
        .map((citation) => {
          if (!citation || typeof citation !== "object" || Array.isArray(citation)) {
            return null;
          }
          const c = citation as Record<string, unknown>;
          return {
            sourceId: typeof c.sourceId === "string" ? c.sourceId : citationsFallback[0]?.sourceId ?? "",
            sourceName: typeof c.sourceName === "string" ? c.sourceName : citationsFallback[0]?.sourceName,
            page: typeof c.page === "number" ? c.page : null,
            chunkId: typeof c.chunkId === "string" ? c.chunkId : citationsFallback[0]?.chunkId ?? "",
            quoteSnippet:
              typeof c.quoteSnippet === "string"
                ? c.quoteSnippet
                : citationsFallback[0]?.quoteSnippet ?? "",
          };
        })
        .filter((citation): citation is NonNullable<typeof citation> => Boolean(citation))
        .filter((citation) => citation.sourceId && citation.chunkId && citation.quoteSnippet);

      return {
        id: typeof sectionRecord.id === "string" ? sectionRecord.id : `section_${index + 1}`,
        title:
          typeof sectionRecord.title === "string" && sectionRecord.title.trim()
            ? sectionRecord.title
            : `Section ${index + 1}`,
        type: typeValue,
        content: sectionRecord.content ?? "",
        citations:
          citations.length > 0
            ? citations
            : input.strictCurriculumAlignment
              ? []
              : citationsFallback,
      };
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section));

  const fallback = buildFallbackOutput(input);
  while (sections.length < 3) {
    sections.push(fallback.sections[sections.length]);
  }

  return {
    metadata: {
      title:
        typeof metadataRecord.title === "string" && metadataRecord.title.trim()
          ? metadataRecord.title
          : input.title,
      type:
        typeof metadataRecord.type === "string" && metadataRecord.type.trim()
          ? metadataRecord.type
          : input.documentType,
      generatedAt:
        typeof metadataRecord.generatedAt === "string"
          ? metadataRecord.generatedAt
          : new Date().toISOString(),
      curriculumContext: {
        programme:
          typeof curriculumContextRecord.programme === "string"
            ? curriculumContextRecord.programme
            : input.programme,
        year:
          typeof curriculumContextRecord.year === "string"
            ? curriculumContextRecord.year
            : input.year ?? null,
        course:
          typeof curriculumContextRecord.course === "string"
            ? curriculumContextRecord.course
            : input.course ?? null,
        topic:
          typeof curriculumContextRecord.topic === "string"
            ? curriculumContextRecord.topic
            : input.topic,
      },
    },
    sections,
  };
}

function buildPrompt(input: GenerateDocumentInput) {
  const objectivesBlock =
    input.plannerGuidance?.objectives && input.plannerGuidance.objectives.length > 0
      ? input.plannerGuidance.objectives.map((item) => `- ${item}`).join("\n")
      : "n/a";

  const outcomesBlock =
    input.plannerGuidance?.outcomes && input.plannerGuidance.outcomes.length > 0
      ? input.plannerGuidance.outcomes.map((item) => `- ${item}`).join("\n")
      : "n/a";

  const chunkBlock = input.retrievalChunks
    .map((chunk, index) => {
      return [
        `[[chunk_${index + 1}]]`,
        `chunk_id: ${chunk.chunkId}`,
        `source_id: ${chunk.sourceId}`,
        `source_name: ${chunk.sourceName}`,
        `page: ${chunk.page ?? "n/a"}`,
        `heading: ${chunk.heading ?? "n/a"}`,
        `text: ${chunk.text.slice(0, 1600)}`,
      ].join("\n");
    })
    .join("\n\n");

  const lessonRetrievalPlan =
    isLessonPlanDocumentType(input.documentType)
      ? input.retrievalPlan && input.retrievalPlan.length > 0
        ? input.retrievalPlan
        : defaultLessonRetrievalPlan(input)
      : [];

  const lessonRetrievalPlanBlock =
    lessonRetrievalPlan.length > 0
      ? serializeLessonRetrievalPlan(lessonRetrievalPlan, input.retrievalChunks)
      : "";

  const systemPrompt = [
    "You are EduNurse's curriculum-grounded generation engine.",
    "You must generate structured educator documents using ONLY retrieved curriculum chunks.",
    "Never invent unsupported clinical facts. If unsupported, write 'Needs verification against local guideline'.",
    "Synthesize and paraphrase curriculum findings into lecturer-quality instructional language.",
    "Do not copy long textbook phrases; avoid verbatim reuse beyond short terminology.",
    "Return strict JSON only. No markdown, no prose outside JSON.",
    "Each section must include citations with sourceId, chunkId, page, and quoteSnippet.",
    input.promptSystemText ? `Prompt version rules:\n${input.promptSystemText}` : "",
    input.promptDeveloperText
      ? `Developer constraints:\n${input.promptDeveloperText}`
      : "",
    isLessonPlanDocumentType(input.documentType)
      ? [
        "For Lesson Plan outputs, enforce the CLASSROOM LESSON PLAN institutional format exactly.",
        "Include these sections in order with these ids:",
        "lesson_metadata, introduction, general_objective, specific_objectives, key_definitions, lesson_presentation, summary, evaluation, assignment, references.",
        "key_definitions must be type=list and content must be an array of complete definitional sentences. Each definition MUST use 'is', 'are', 'refers to', 'defined as', 'describes', 'characterized by', 'consists of', or 'includes'. Example content: ['Puerperium is the period following childbirth during which the mother\\'s body returns to its pre-pregnancy state.', 'Involution refers to the process by which the uterus returns to its normal size after delivery.', 'Lochia is the vaginal discharge containing blood, mucus, and tissue that occurs after childbirth.']. Do NOT use colon format like 'Term: definition' - use complete sentences only.",
        "lesson_presentation must be type=table and content must be an array of row objects with keys:",
        "phase, time, specificObjective, content, educatorActivities, learnerActivities, materials, assessment.",
        "time field must reflect realistic duration for the activities described. Introduction/setup: 5-10 min, Content delivery: 15-25 min, Practice activities: 20-30 min, Assessment: 10-15 min. Total should match requested lesson duration.",
        "educatorActivities must describe SPECIFIC teaching actions, not generic phrases. Example: 'Demonstrate fundal palpation technique using anatomical model, emphasizing hand placement 2cm below umbilicus' NOT 'Facilitate discussion and demonstration'.",
        "learnerActivities must describe CONCRETE student actions. Example: 'Practice fundal palpation in pairs using simulation mannequin, document findings on assessment form' NOT 'Participate in discussion and take notes'.",
        "materials must list SPECIFIC resources. Example: 'Postpartum assessment mannequin, fundal height measurement tape, lochia assessment chart, vital signs equipment' NOT 'Teaching aids and handouts'.",
        "assessment must include MEASURABLE evaluation methods. Example: 'Student demonstrates correct fundal palpation technique and accurately identifies fundal height within 1cm margin' NOT 'Observe student participation'.",
        "lesson_metadata must be type=table with rows using fields:",
        "NAME OF STUDENT, STUDENT NUMBER, COURSE NAME, PROGRAMME, NAME OF TOPIC, VENUE, INTAKE, SIZE OF CLASS, DATE, TIME, DURATION, METHOD OF TEACHING, MEDIA OF TEACHING, NAME OF SUPERVISOR.",
        "content field inside lesson_presentation rows must include short definitions/descriptions where relevant.",
        "For each specific objective, include matching detailed content in the lesson_presentation.content column.",
        "Each specific_objectives item must have a corresponding lesson_presentation row with matching specificObjective field. The content in that row must directly address and fulfill that objective with curriculum evidence.",
        "Do not leave major curriculum points out when evidence exists in retrieved chunks.",
        "Write concrete, educator-usable detail: definitions, short explanations, and applied examples.",
        "Avoid generic filler. Do not use phrases like: 'clarify the central concept', 'break down into teachable elements', 'guide learners through an overview', or 'a patient presents with symptoms related to ...'.",
        "Each lesson_presentation row must include objective-specific depth: Definition, Explanation, Nursing relevance, and one concrete teaching example.",
        "CRITICAL: When writing definitions in lesson_presentation.content, use complete definitional sentences with 'is', 'are', 'refers to', 'defined as', 'describes', 'characterized by', 'consists of', or 'includes'. Example: 'Puerperium is the period following childbirth during which the mother's body returns to its pre-pregnancy state.' NOT just 'Puerperium: post-childbirth period.'",
        "Format definitions clearly at the end of content cells using the marker 'Definitions/Descriptions:' followed by semicolon-separated complete definitional sentences. Example: 'Definitions/Descriptions: Involution is the process by which the uterus returns to its normal size after delivery; Lochia refers to the vaginal discharge containing blood, mucus, and tissue that occurs after childbirth.'",
        "MANDATORY: Every lesson_presentation row MUST have at least 2-3 complete definitional sentences in the content field. Do not write vague overviews - write specific, curriculum-grounded definitions and explanations.",
        "Ensure rows are distinct. Do not repeat sentence openings or duplicate bullet text across rows.",
        "Do not repeat the same paragraph across introduction, general_objective, summary, or lesson_presentation rows.",
        "introduction must set context and explain WHY the topic matters (clinical significance, prevalence, impact). general_objective must state WHAT students will achieve (learning goals). summary must recap HOW the lesson covered the objectives (key points learned). Each must be distinct in purpose and content.",
        "Only include terms that are supported by retrieved chunks and aligned to selected topic/subtopic.",
        "Anti-redundancy rules:",
        "- Do not repeat the same sentence template across rows.",
        "- Each lesson_presentation.content cell must include 2-4 distinct factual points from sources.",
        "- Avoid meta-teaching filler unless immediately followed by concrete curriculum evidence.",
        "- If evidence is missing for a requested point, write exactly: Not found in module.",
        "assignment must be type=list and content must be 5 True/False statements about the topic.",
        "Assignment statements must be curriculum-grounded, clinically accurate, and test understanding of key concepts. Each statement should be clear, unambiguous, and directly related to lesson objectives. Example: 'The fundus should be at the level of the umbilicus immediately after delivery' NOT 'Postpartum care is important for mothers'.",
        "evaluation must be type=list and content must be 3-5 direct evaluation questions.",
        "Evaluation questions must assess specific learning objectives using action verbs (describe, identify, demonstrate, explain, list). Example: 'Describe the three stages of lochia and their expected duration' NOT 'What did you learn about postpartum care?'.",
        "summary must be type=text and must concisely recap the whole lesson.",
        "Use section retrieval plan mapping to ground each section with the recommended chunks.",
      ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    `Document type: ${input.documentType}`,
    `Title: ${input.title}`,
    `Programme: ${input.programme}`,
    `Year: ${input.year ?? "Not specified"}`,
    `Course: ${input.course ?? "Not specified"}`,
    `Topic: ${input.topic}`,
    `Subtopic: ${input.plannerGuidance?.subtopic ?? "Not specified"}`,
    `Minor topic: ${input.plannerGuidance?.minorTopic ?? "Not specified"}`,
    `Programme level: ${input.plannerGuidance?.programmeLevel ?? "Not specified"}`,
    `Semester: ${input.plannerGuidance?.semester ?? "Not specified"}`,
    `Unit: ${input.plannerGuidance?.unit ?? "Not specified"}`,
    `Section: ${input.plannerGuidance?.section ?? "Not specified"}`,
    `Difficulty level: ${input.plannerGuidance?.difficultyLevel ?? "Not specified"}`,
    `Duration minutes: ${input.durationMinutes ?? "Not specified"}`,
    `Strict curriculum alignment: ${input.strictCurriculumAlignment}`,
    input.promptVersionName ? `Prompt version: ${input.promptVersionName}` : "",
    "",
    "Planner objectives:",
    objectivesBlock,
    "",
    "Planner outcomes:",
    outcomesBlock,
    "",
    "Use this output schema:",
    JSON.stringify(
      {
        metadata: {
          title: "string",
          type: "string",
          generatedAt: "ISO datetime string",
          curriculumContext: {
            programme: "string",
            year: "string | null",
            course: "string | null",
            topic: "string",
          },
        },
        sections: [
          {
            id: "string",
            title: "string",
            type: "text | list | script | rubric | duration_list | table",
            content: "string | array | object depending on section type",
            citations: [
              {
                sourceId: "uuid",
                sourceName: "string",
                page: 1,
                chunkId: "uuid",
                quoteSnippet: "short quote from retrieved chunk",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "",
    "Retrieved chunks:",
    chunkBlock,
    lessonRetrievalPlanBlock ? "Section retrieval plan:" : "",
    lessonRetrievalPlanBlock,
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}

async function callAzure(systemPrompt: string, userPrompt: string) {
  assertProviderConfig("azure");

  const endpoint = normalizeAzureEndpoint(env.AZURE_OPENAI_ENDPOINT!);
  const chatCompletionsUrl = `${endpoint}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`;
  const responsesUrl = `${endpoint}/openai/responses?api-version=${env.AZURE_OPENAI_API_VERSION}`;

  const extractResponsesText = (payload: Record<string, unknown>) => {
    if (typeof payload.output_text === "string" && payload.output_text.trim()) {
      return payload.output_text.trim();
    }

    const output = Array.isArray(payload.output)
      ? (payload.output as Array<Record<string, unknown>>)
      : [];

    for (const item of output) {
      const content = Array.isArray(item.content)
        ? (item.content as Array<Record<string, unknown>>)
        : [];
      for (const part of content) {
        const text = part.text;
        if (typeof text === "string" && text.trim()) {
          return text.trim();
        }
      }
    }

    return "";
  };

  const shouldTryResponsesFallback = (message: string) => {
    const lowered = message.toLowerCase();
    return (
      lowered.includes("operationnotsupported") ||
      lowered.includes("unsupported") ||
      lowered.includes("chat/completions") ||
      lowered.includes("not found") ||
      lowered.includes("404")
    );
  };

  try {
    const payload = await fetchJsonWithTimeout(
      chatCompletionsUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
      env.GENERATION_TIMEOUT_MS,
    );

    const choices = payload.choices as Array<Record<string, unknown>> | undefined;
    const content = unwrapContent(
      choices?.[0]?.message && (choices[0].message as Record<string, unknown>).content,
    );

    if (!content) {
      throw new Error("Azure OpenAI returned no message content.");
    }

    return {
      rawText: content,
      model: `${env.AZURE_OPENAI_DEPLOYMENT}`,
    };
  } catch (chatError) {
    const chatMessage =
      chatError instanceof Error ? chatError.message : "Azure chat completions failed";

    if (!shouldTryResponsesFallback(chatMessage)) {
      throw chatError;
    }

    const payload = await fetchJsonWithTimeout(
      responsesUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          model: env.AZURE_OPENAI_DEPLOYMENT,
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: systemPrompt }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: userPrompt }],
            },
          ],
          text: {
            format: { type: "json_object" },
          },
        }),
      },
      env.GENERATION_TIMEOUT_MS,
    );

    const content = extractResponsesText(payload);
    if (!content) {
      throw new Error("Azure Responses API returned no text content.");
    }

    return {
      rawText: content,
      model: `${env.AZURE_OPENAI_DEPLOYMENT}`,
    };
  }
}

async function callGemini(systemPrompt: string, userPrompt: string) {
  assertProviderConfig("gemini");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_MODEL,
  )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;

  const payload = await fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    env.GENERATION_TIMEOUT_MS,
  );

  const candidates = payload.candidates as Array<Record<string, unknown>> | undefined;
  const first = candidates?.[0];
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = typeof parts?.[0]?.text === "string" ? parts[0].text : "";

  if (!text) {
    throw new Error("Gemini returned no text content.");
  }

  return {
    rawText: text,
    model: env.GEMINI_MODEL,
  };
}

async function callDeepSeek(systemPrompt: string, userPrompt: string) {
  assertProviderConfig("deepseek");

  const payload = await fetchJsonWithTimeout(
    env.DEEPSEEK_BASE_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    },
    env.GENERATION_TIMEOUT_MS,
  );

  const choices = payload.choices as Array<Record<string, unknown>> | undefined;
  const content = unwrapContent(choices?.[0]?.message && (choices[0].message as Record<string, unknown>).content);

  if (!content) {
    throw new Error("DeepSeek returned no message content.");
  }

  return {
    rawText: content,
    model: env.DEEPSEEK_MODEL,
  };
}

async function callProvider(
  provider: ProviderName,
  systemPrompt: string,
  userPrompt: string,
): Promise<ProviderCallResult> {
  if (provider === "azure") {
    return callAzure(systemPrompt, userPrompt);
  }
  if (provider === "gemini") {
    return callGemini(systemPrompt, userPrompt);
  }
  return callDeepSeek(systemPrompt, userPrompt);
}

function parseGeneratedOutputFromRawText(
  rawText: string,
  input: GenerateDocumentInput,
): GeneratedOutput {
  const jsonText = extractJsonText(rawText);
  const parsed = parseJsonWithRepairs(jsonText);
  const validated = GeneratedOutputSchema.safeParse(parsed);
  if (validated.success) {
    return validated.data;
  }

  const coerced = coerceModelOutput(parsed, input);
  if (coerced) {
    const coercedValidated = GeneratedOutputSchema.safeParse(coerced);
    if (coercedValidated.success) {
      return coercedValidated.data;
    }
  }

  throw new Error(JSON.stringify(validated.error.issues, null, 2));
}

function buildLessonSynthesisPrompt(
  input: GenerateDocumentInput,
  draft: GeneratedOutput,
) {
  const chunkDigest = input.retrievalChunks
    .slice(0, 8)
    .map((chunk, index) =>
      [
        `[[source_${index + 1}]]`,
        `chunk_id: ${chunk.chunkId}`,
        `source_name: ${chunk.sourceName}`,
        `page: ${chunk.page ?? "n/a"}`,
        `heading: ${chunk.heading ?? "n/a"}`,
        `key_text: ${sanitizeGeneratedText(chunk.text).slice(0, 700)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const lessonRetrievalPlan =
    input.retrievalPlan && input.retrievalPlan.length > 0
      ? input.retrievalPlan
      : defaultLessonRetrievalPlan(input);
  const lessonRetrievalPlanBlock = serializeLessonRetrievalPlan(
    lessonRetrievalPlan,
    input.retrievalChunks,
  );

  const systemPrompt = [
    "You are a senior nursing educator and curriculum writer.",
    "Rewrite the draft lesson plan into professional lecturer-quality language.",
    "Keep curriculum fidelity and keep all claims grounded in provided sources.",
    "Do NOT copy textbook wording. Paraphrase and synthesize.",
    "Do not reproduce long verbatim excerpts; avoid copying more than 10 consecutive source words.",
    "Preserve JSON structure, section ids, and citations.",
    "Improve clarity, instructional flow, and classroom usability.",
    "Keep tone formal, practical, and inspection-ready.",
    "Return strict JSON only.",
  ].join("\n");

  const userPrompt = [
    `Document type: ${input.documentType}`,
    `Programme: ${input.programme}`,
    `Course: ${input.course ?? "Not specified"}`,
    `Topic: ${input.topic}`,
    `Subtopic: ${input.plannerGuidance?.subtopic ?? "Not specified"}`,
    `Minor topic: ${input.plannerGuidance?.minorTopic ?? "Not specified"}`,
    "",
    "Source digest:",
    chunkDigest,
    "",
    "Section retrieval plan:",
    lessonRetrievalPlanBlock,
    "",
    "Draft lesson plan JSON to improve:",
    JSON.stringify(draft),
    "",
    "Rewrite requirements:",
    "- Keep same section ids and section count.",
    "- Keep citations arrays intact unless clearly malformed.",
    "- Improve explanations, definitions, educator guidance, and learner-facing activities.",
    "- Remove repetitive or copied textbook phrasing.",
    "- Remove generic filler and placeholder language. Use objective-specific, topic-faithful lecturer wording.",
    "- Ensure each lesson_presentation row is distinct and includes definition/explanation, nursing relevance, and one concrete example.",
    "- Drop any out-of-scope terminology that is not supported by source digest or retrieval plan.",
    "- Keep medically safe wording and mark unsupported detail as: Needs verification against local guideline.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

async function refineLessonPlanWithProvider(
  provider: ProviderName,
  input: GenerateDocumentInput,
  draft: GeneratedOutput,
) {
  if (!isLessonPlanDocumentType(input.documentType)) {
    return draft;
  }

  try {
    const prompt = buildLessonSynthesisPrompt(input, draft);
    const refined = await callProvider(provider, prompt.systemPrompt, prompt.userPrompt);
    return parseGeneratedOutputFromRawText(refined.rawText, input);
  } catch {
    return draft;
  }
}

export async function generateDocumentWithProviderFallback(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  const { systemPrompt, userPrompt } = buildPrompt(input);
  const providers = parseProviderPriority();
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const result = await callProvider(provider, systemPrompt, userPrompt);
      const parsedOutput = parseGeneratedOutputFromRawText(result.rawText, input);
      const refinedOutput = await refineLessonPlanWithProvider(
        provider,
        input,
        parsedOutput,
      );

      return {
        output: normalizeOutput(refinedOutput, input) as Record<string, unknown>,
        provider,
        model: result.model,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${provider}: ${message}`);
    }
  }
  // Last-resort deterministic fallback keeps the app usable even when providers fail.
  return {
    output: (isLessonPlanDocumentType(input.documentType)
      ? buildLessonPlanFallbackOutput(input)
      : buildFallbackOutput(input)) as Record<string, unknown>,
    provider: "azure",
    model: "fallback-local-template",
  };
}

function buildQuestionPrompt(input: AnswerCurriculumQuestionInput) {
  const chunkBlock = input.retrievalChunks
    .map((chunk, index) =>
      [
        `[[chunk_${index + 1}]]`,
        `chunk_id: ${chunk.chunkId}`,
        `source_id: ${chunk.sourceId}`,
        `source_name: ${chunk.sourceName}`,
        `page: ${chunk.page ?? "n/a"}`,
        `heading: ${chunk.heading ?? "n/a"}`,
        `text: ${chunk.text.slice(0, 2200)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const context = input.curriculumContext ?? {};
  const systemPrompt = [
    "You are EduNurse's curriculum-grounded QA engine.",
    "Answer ONLY from the retrieved curriculum chunks.",
    "If the answer is not clearly supported by chunks, respond exactly: Not found in module.",
    "Do not invent clinical steps or facts.",
    "Use concise educator-focused wording.",
  ].join("\n");

  const userPrompt = [
    `Question: ${input.question}`,
    `Strict curriculum alignment: ${input.strictCurriculumAlignment}`,
    `Programme: ${context.programme ?? "Not specified"}`,
    `Programme level: ${context.programmeLevel ?? "Not specified"}`,
    `Year/Semester: ${context.year ?? "Not specified"}`,
    `Course: ${context.course ?? "Not specified"}`,
    `Topic: ${context.topic ?? "Not specified"}`,
    `Subtopic: ${context.subtopic ?? "Not specified"}`,
    `Minor topic: ${context.minorTopic ?? "Not specified"}`,
    `Unit: ${context.unit ?? "Not specified"}`,
    `Section: ${context.section ?? "Not specified"}`,
    "",
    "Retrieved chunks:",
    chunkBlock,
    "",
    "Return plain text answer only.",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export async function answerCurriculumQuestionWithProviderFallback(
  input: AnswerCurriculumQuestionInput,
): Promise<AnswerCurriculumQuestionResult> {
  const { systemPrompt, userPrompt } = buildQuestionPrompt(input);
  const providers = parseProviderPriority();
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const result =
        provider === "azure"
          ? await callAzure(systemPrompt, userPrompt)
          : provider === "gemini"
            ? await callGemini(systemPrompt, userPrompt)
            : await callDeepSeek(systemPrompt, userPrompt);

      const answer = result.rawText
        .trim()
        .replace(/^```(?:text|markdown)?/i, "")
        .replace(/```$/i, "")
        .trim()
        .slice(0, 6000);

      if (!answer) {
        throw new Error("Model returned empty QA answer.");
      }

      return {
        answer,
        provider,
        model: result.model,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${provider}: ${message}`);
    }
  }

  throw new Error(`All LLM providers failed. ${failures.join(" | ")}`);
}

/**
 * Interface for expanding lesson content with AI-generated detailed notes
 */
export interface ExpandLessonContentInput {
  topic: string;
  subtopic?: string;
  contentBrief: string;
  specificObjective?: string;
  programme?: string;
  course?: string;
  retrievalChunks: RetrievalChunkForPrompt[];
}

export interface ExpandLessonContentResult {
  expandedContent: string;
  provider: ProviderName;
  model: string;
}

function buildContentExpansionFallback(input: ExpandLessonContentInput) {
  const objective = input.specificObjective?.trim();
  const topic = input.topic.trim() || "this topic";
  const brief = input.contentBrief.trim();
  const heading = objective
    ? `Specific objective: ${objective}.`
    : `Focus area: ${topic}.`;
  return [
    `${heading}`,
    "",
    "Definitions/Descriptions:",
    `- ${brief || `Core concepts for ${topic}.`}`,
    `- Explain the scope, rationale, and expected learner understanding for ${topic}.`,
    "",
    "Key teaching points:",
    `- Clarify the concept in simple professional language for nursing learners.`,
    "- Link to clinical relevance and patient safety considerations.",
    "- Use one concrete local practice example and one quick comprehension check.",
    "",
    "Clinical relevance:",
    "- Apply the concept during assessment, decision-making, and patient education.",
    "",
    "Safety note:",
    "- Verify local protocol details before teaching procedure-specific steps.",
  ].join("\n");
}

/**
 * Build prompt for expanding lesson content with detailed notes
 */
function buildContentExpansionPrompt(input: ExpandLessonContentInput) {
  const chunkDigest = input.retrievalChunks
    .slice(0, 6)
    .map((chunk, index) =>
      [
        `[[source_${index + 1}]]`,
        `source: ${chunk.sourceName}`,
        `page: ${chunk.page ?? "n/a"}`,
        `text: ${sanitizeGeneratedText(chunk.text).slice(0, 600)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const systemPrompt = [
    "You are an expert nursing educator preparing detailed lecture notes.",
    "Your task is to expand brief content descriptions into comprehensive teaching notes.",
    "Include:",
    "- Clear definitions of key terms",
    "- Important concepts explained in detail",
    "- Bullet points for key facts",
    "- Clinical examples where relevant",
    "- Safety considerations and best practices",
    "- Coverage of all key points found in the retrieved module context for this objective",
    "",
    "Guidelines:",
    "- Base all content on provided curriculum sources only.",
    "- Use clear, professional language suitable for nursing education",
    "- Keep content focused and relevant to the specific objective",
    "- Keep layout readable using short paragraphs and bullet points",
    "- Preserve line breaks and bullet markers for easy use in lesson table cells",
    "- Include a visible Definitions/Descriptions subsection when relevant",
    "- Target 280-420 words so definitions and practical details are not lost",
    "- Do NOT copy verbatim from sources - paraphrase and synthesize",
    "- Mark any unsupported claims as: (Needs verification against local guideline)",
    "- If evidence is insufficient for a requested detail, write: Not found in module.",
    "",
    "Return plain text only (no JSON), but keep line breaks and bullet markers.",
  ].join("\n");

  const contextParts = [
    input.programme ? `Programme: ${input.programme}` : null,
    input.course ? `Course: ${input.course}` : null,
    `Topic: ${input.topic}`,
    input.subtopic ? `Subtopic: ${input.subtopic}` : null,
    input.specificObjective ? `Specific Objective: ${input.specificObjective}` : null,
  ].filter(Boolean);

  const userPrompt = [
    "Context:",
    ...contextParts,
    "",
    "Brief content to expand:",
    input.contentBrief,
    "",
    "Curriculum sources:",
    chunkDigest || "No direct chunk evidence retrieved. Expand cautiously and mark unsupported details.",
    "",
    "Provide expanded content with definitions, key points, and teaching notes:",
  ].join("\n");

  return { systemPrompt, userPrompt };
}

/**
 * Expand lesson content with AI-generated detailed notes for lecturers
 * 
 * This function takes brief content descriptions and expands them into
 * comprehensive teaching notes including definitions, key points, examples,
 * and clinical considerations.
 * 
 * @param input - Content expansion parameters
 * @returns Expanded content with provider information
 */
export async function expandLessonContentWithProviderFallback(
  input: ExpandLessonContentInput,
): Promise<ExpandLessonContentResult> {
  const { systemPrompt, userPrompt } = buildContentExpansionPrompt(input);
  const providers = parseProviderPriority();
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const result = await callProvider(provider, systemPrompt, userPrompt);

      const expandedContent = result.rawText
        .replace(/\r\n/g, "\n")
        .replace(/^```(?:text|markdown)?/i, "")
        .replace(/```$/i, "")
        .trim()
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, 3200); // Preserve richer lecturer notes while keeping table-safe bounds.

      if (!expandedContent || expandedContent.length < 20) {
        throw new Error("Model returned insufficient content expansion.");
      }

      return {
        expandedContent,
        provider,
        model: result.model,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${provider}: ${message}`);
    }
  }

  return {
    expandedContent: buildContentExpansionFallback(input),
    provider: "azure",
    model: "fallback-local-template",
  };
}
