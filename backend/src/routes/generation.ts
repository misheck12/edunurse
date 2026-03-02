import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserId } from "../services/auth-helpers.js";
import { DOCUMENT_TYPES, toDocumentTypeDb } from "../services/constants.js";
import {
  generateDocumentWithProviderFallback,
  LessonRetrievalPlanItem,
  RetrievalChunkForPrompt,
} from "../services/ai-layer.js";
import {
  embedTextsWithFallback,
  vectorToSqlLiteral,
} from "../services/embeddings.js";
import { resolveProgrammeOutlineSelection } from "../services/programme-outline.js";
import {
  ensureServiceEnabled,
  ensureStudioDocumentServiceEnabled,
} from "../services/service-controls.js";
import { checkGenerationLimit } from "../services/usage-limits.js";

const runGenerationSchema = z.object({
  documentId: z.string().uuid().optional(),
  documentType: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1),
  programme: z.string().min(1),
  year: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  strictCurriculumAlignment: z.boolean().default(true),
  templateId: z.string().uuid().optional(),
  curriculumVersionId: z.string().uuid().optional(),
  promptInput: z.record(z.any()).default({}),
});

const minimalCoverage = env.RETRIEVAL_MIN_COVERAGE;
const retrievalLimit = env.RETRIEVAL_TOP_K;
const retrievalCandidateLimit = env.RETRIEVAL_CANDIDATE_K;
const EXPAND_CONTENT_CACHE_TTL_MS = 30 * 60 * 1000;
const EXPAND_CONTENT_CACHE_MAX_ITEMS = 500;

type ExpandContentQuality = {
  confidence: number;
  coverage: number;
  keywordSignal: number;
  evidenceCount: number;
  candidateCount: number;
};

type ExpandContentResponse = {
  expandedContent: string;
  provider: string;
  model: string;
  chunksUsed: number;
  quality: ExpandContentQuality;
  cacheHit: boolean;
};

const expandContentCache = new Map<
  string,
  { expiresAt: number; value: Omit<ExpandContentResponse, "cacheHit"> }
>();

function normalizeCacheText(value: string | undefined) {
  return normalizeSearchText(value ?? "").slice(0, 320);
}

function makeExpandContentCacheKey(input: {
  userId: string;
  curriculumVersionId: string;
  topic: string;
  subtopic?: string;
  specificObjective?: string;
  contentBrief: string;
  programme?: string;
  course?: string;
}) {
  return [
    input.userId,
    input.curriculumVersionId,
    normalizeCacheText(input.topic),
    normalizeCacheText(input.subtopic),
    normalizeCacheText(input.specificObjective),
    normalizeCacheText(input.contentBrief),
    normalizeCacheText(input.programme),
    normalizeCacheText(input.course),
  ].join("|");
}

function pruneExpandContentCache() {
  const now = Date.now();
  for (const [key, entry] of expandContentCache.entries()) {
    if (entry.expiresAt <= now) {
      expandContentCache.delete(key);
    }
  }

  if (expandContentCache.size <= EXPAND_CONTENT_CACHE_MAX_ITEMS) return;
  const overflow = expandContentCache.size - EXPAND_CONTENT_CACHE_MAX_ITEMS;
  let removed = 0;
  for (const key of expandContentCache.keys()) {
    expandContentCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildExpandContentQuality(input: {
  scoredChunks: Array<{ keywordScore: number }>;
  topChunks: Array<{ keywordScore: number }>;
}) {
  const evidenceCount = input.topChunks.length;
  const candidateCount = input.scoredChunks.length;
  const coverage = clampPercent(
    (evidenceCount / Math.max(1, retrievalLimit)) * 100,
  );

  const averageTopKeywordScore =
    evidenceCount > 0
      ? input.topChunks.reduce((sum, item) => sum + item.keywordScore, 0) /
        evidenceCount
      : 0;
  const keywordSignal = clampPercent((averageTopKeywordScore / 4) * 100);
  const confidence = clampPercent(coverage * 0.65 + keywordSignal * 0.35);

  return {
    confidence,
    coverage,
    keywordSignal,
    evidenceCount,
    candidateCount,
  } satisfies ExpandContentQuality;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function tokenizeTopic(topic: string) {
  const raw = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  return Array.from(new Set(raw)).slice(0, 8);
}

function asOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 15);
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function safeChunkQuote(text: string) {
  return text.slice(0, 220).replace(/\s+/g, " ").trim();
}

function toPublicGenerationErrorMessage(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  if (message.includes("aborted") || message.includes("timeout")) {
    return "Generation timed out. Please try again.";
  }

  if (
    message.includes("all llm providers failed") ||
    message.includes("missing configuration")
  ) {
    return "Generation service is temporarily unavailable. Please try again shortly.";
  }

  return "Generation failed. Please try again.";
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, term: string) {
  if (!text || !term) return 0;
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

// Vector literals are generated internally from embedding results. Validate format
// before using Prisma.raw() to ensure only numeric characters are present.
function isSafeVectorLiteral(value: string) {
  return /^\[[\d., eE+\-]+\]$/.test(value);
}

function blendRetrievalScore(keywordScore: number, vectorScore: number) {
  // keyword score remains dominant; vector signal lifts semantically related chunks.
  return keywordScore + vectorScore * env.RETRIEVAL_VECTOR_WEIGHT;
}

const DB_SCORE_MAX = 99.999999;

function toDbScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const clamped = Math.max(-DB_SCORE_MAX, Math.min(DB_SCORE_MAX, value));
  return Number(clamped.toFixed(6));
}

function tokenizeForSectionPlan(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scorePromptChunkForQuery(chunk: RetrievalChunkForPrompt, query: string) {
  const haystack = `${chunk.heading ?? ""} ${chunk.text}`.toLowerCase();
  const tokens = Array.from(new Set(tokenizeForSectionPlan(query)));
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function topChunkIdsForSection(
  chunks: RetrievalChunkForPrompt[],
  query: string,
  limit = 4,
) {
  return chunks
    .map((chunk) => ({ chunkId: chunk.chunkId, score: scorePromptChunkForQuery(chunk, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunkId);
}

function buildLessonRetrievalPlan(
  chunks: RetrievalChunkForPrompt[],
  input: {
    topic: string;
    course?: string;
    subtopic?: string;
    minorTopic?: string;
    objectives?: string[];
    outcomes?: string[];
  },
): LessonRetrievalPlanItem[] {
  if (chunks.length === 0) return [];

  const course = input.course ?? "";
  const subtopic = input.subtopic ?? "";
  const minorTopic = input.minorTopic ?? "";
  const objectiveHint = input.objectives?.slice(0, 3).join(" ") ?? "";
  const outcomeHint = input.outcomes?.slice(0, 3).join(" ") ?? "";

  const templates: Array<Omit<LessonRetrievalPlanItem, "chunkIds">> = [
    {
      sectionId: "introduction",
      query: `${course} ${input.topic} ${subtopic} overview background relevance`,
      purpose: "Topic introduction and context for learners.",
    },
    {
      sectionId: "general_objective",
      query: `${input.topic} learning objectives outcomes ${objectiveHint} ${outcomeHint}`,
      purpose: "General objective statement aligned to curriculum outcomes.",
    },
    {
      sectionId: "specific_objectives",
      query: `${input.topic} specific objectives expected competencies ${objectiveHint} ${outcomeHint}`,
      purpose: "Specific objective list for the lesson.",
    },
    {
      sectionId: "key_definitions",
      query: `${input.topic} ${subtopic} ${minorTopic} definition concepts terminology`,
      purpose: "Key definitions and descriptive explanations.",
    },
    {
      sectionId: "lesson_presentation",
      query: `${input.topic} teaching steps activities examples practical application`,
      purpose: "Content flow and teacher/learner activities.",
    },
    {
      sectionId: "evaluation",
      query: `${input.topic} formative assessment evaluation questions`,
      purpose: "Evaluation prompts aligned to objectives.",
    },
    {
      sectionId: "summary",
      query: `${input.topic} summary key points recap`,
      purpose: "Summary paragraph for lesson closure.",
    },
    {
      sectionId: "assignment",
      query: `${input.topic} assignment practice questions true false short answer`,
      purpose: "Post-lesson assignment items.",
    },
    {
      sectionId: "references",
      query: `${course} ${input.topic} references source`,
      purpose: "References and source listing.",
    },
  ];

  const objectiveCoverage = Array.from(
    new Set([...(input.objectives ?? []), ...(input.outcomes ?? [])]),
  )
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);

  objectiveCoverage.forEach((objective, index) => {
    templates.push({
      sectionId: `lesson_presentation_objective_${index + 1}`,
      query: `${input.topic} ${subtopic} ${minorTopic} ${objective} definition explanation examples`,
      purpose:
        "Objective-level retrieval to maximize detailed coverage in lesson table content.",
    });
  });

  // Round-robin fallback offset ensures sections without strong keyword matches
  // receive different chunks rather than always the same top-3.
  let fallbackOffset = 0;
  return templates.map((template) => {
    const limit = template.sectionId.startsWith("lesson_presentation_objective_") ? 6 : 4;
    const topChunkIds = topChunkIdsForSection(chunks, template.query, limit);
    if (topChunkIds.length > 0) {
      return { ...template, chunkIds: topChunkIds };
    }
    // Spread fallback chunks across sections so each gets a different slice.
    const fallbackChunks: string[] = [];
    for (let i = 0; i < Math.min(3, chunks.length); i += 1) {
      fallbackChunks.push(chunks[(fallbackOffset + i) % chunks.length].chunkId);
    }
    fallbackOffset = (fallbackOffset + 2) % Math.max(1, chunks.length);
    return { ...template, chunkIds: fallbackChunks };
  });
}

async function lookupVectorScores(
  app: FastifyInstance,
  chunkIds: string[],
  queryVectorLiteral: string,
) {
  const safeIds = chunkIds.filter((id) => isUuid(id));
  if (safeIds.length === 0) {
    return new Map<string, number>();
  }

  // Reject any vector literal that doesn't match the expected numeric format.
  if (!isSafeVectorLiteral(queryVectorLiteral)) {
    return new Map<string, number>();
  }

  const idSql = Prisma.join(
    safeIds.map((id) => Prisma.sql`${id}::uuid`),
    ", ",
  );
  const vectorRaw = Prisma.raw(queryVectorLiteral);
  const limitRaw = Prisma.raw(String(Math.max(20, safeIds.length)));

  const rows = await app.prisma.$queryRaw<
    Array<{ id: string; score: number | string | null }>
  >(Prisma.sql`
    SELECT id::text AS id, (1 - (embedding <=> ${vectorRaw}::vector))::float8 AS score
    FROM curriculum_chunks
    WHERE id IN (${idSql})
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorRaw}::vector
    LIMIT ${limitRaw}
  `);

  const scores = new Map<string, number>();
  for (const row of rows) {
    const score =
      typeof row.score === "number"
        ? row.score
        : typeof row.score === "string"
          ? Number(row.score)
          : 0;
    if (!Number.isFinite(score)) continue;
    scores.set(row.id, score);
  }
  return scores;
}

async function lookupFtsKeywordScores(
  app: FastifyInstance,
  chunkIds: string[],
  queryText: string,
) {
  const safeIds = chunkIds.filter((id) => isUuid(id));
  const normalizedQuery = queryText.trim();
  if (safeIds.length === 0 || normalizedQuery.length < 2) {
    return new Map<string, number>();
  }

  const idSql = Prisma.join(
    safeIds.map((id) => Prisma.sql`${id}::uuid`),
    ", ",
  );

  const rows = await app.prisma.$queryRaw<
    Array<{ id: string; score: number | string | null }>
  >(Prisma.sql`
    SELECT
      cc.id::text AS id,
      ts_rank_cd(
        to_tsvector('english', COALESCE(cc.heading, '') || ' ' || cc.text),
        websearch_to_tsquery('english', ${normalizedQuery})
      )::float8 AS score
    FROM curriculum_chunks cc
    WHERE cc.id IN (${idSql})
      AND websearch_to_tsquery('english', ${normalizedQuery})
          @@ to_tsvector('english', COALESCE(cc.heading, '') || ' ' || cc.text)
    ORDER BY score DESC
    LIMIT ${Math.max(20, safeIds.length)}
  `);

  const scores = new Map<string, number>();
  for (const row of rows) {
    const score =
      typeof row.score === "number"
        ? row.score
        : typeof row.score === "string"
          ? Number(row.score)
          : 0;
    if (!Number.isFinite(score)) continue;
    scores.set(row.id, score);
  }
  return scores;
}

type RetrievalChunkWithSource = {
  id: string;
  text: string;
  heading: string | null;
  metadataJson?: unknown;
  source: {
    name: string;
  };
};

function scoreRetrievedChunk(
  chunk: RetrievalChunkWithSource,
  input: {
    topic: string;
    course?: string;
    topicTerms: string[];
  },
) {
  const topic = normalizeSearchText(input.topic);
  const course = normalizeSearchText(input.course);
  const heading = normalizeSearchText(chunk.heading);
  const sourceName = normalizeSearchText(chunk.source.name);
  const text = normalizeSearchText(chunk.text);
  const metadata = safeRecord(chunk.metadataJson);
  const unit = normalizeSearchText(
    typeof metadata.unit === "string" ? metadata.unit : "",
  );
  const section = normalizeSearchText(
    typeof metadata.section === "string" ? metadata.section : "",
  );
  const difficultyLevel = normalizeSearchText(
    typeof metadata.difficultyLevel === "string"
      ? metadata.difficultyLevel
      : "",
  );

  let score = 0;

  if (topic) {
    score += countMatches(heading, topic) * 14;
    score += countMatches(sourceName, topic) * 10;
    score += countMatches(text, topic) * 8;
  }

  if (course) {
    score += countMatches(heading, course) * 10;
    score += countMatches(sourceName, course) * 8;
    score += countMatches(text, course) * 6;
  }

  for (const term of input.topicTerms) {
    const token = normalizeSearchText(term);
    if (!token) continue;
    score += countMatches(heading, token) * 5;
    score += countMatches(sourceName, token) * 4;
    score += countMatches(text, token) * 3;
    score += countMatches(unit, token) * 4;
    score += countMatches(section, token) * 4;
    score += countMatches(difficultyLevel, token) * 2;
  }

  if (topic && heading && heading.includes(topic)) {
    score += 12;
  }

  if (topic && sourceName && sourceName.includes(topic)) {
    score += 10;
  }

  return score;
}

const generationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/runs/:runId", async (request) => {
    const userId = requireUserId(request);
    const params = z.object({ runId: z.string().uuid() }).parse(request.params);

    const run = await app.prisma.generationRun.findFirst({
      where: { id: params.runId, userId },
      include: {
        retrievals: {
          orderBy: { rank: "asc" },
        },
        flags: true,
      },
    });

    if (!run) {
      throw app.httpErrors.notFound("Generation run not found");
    }

    return run;
  });

  app.post("/runs", async (request, reply) => {
    const userId = requireUserId(request);
    
    // Check usage limits before proceeding
    const limitCheck = await checkGenerationLimit(app.prisma, userId);
    if (!limitCheck.allowed) {
      throw app.httpErrors.paymentRequired(limitCheck.message);
    }
    
    await ensureServiceEnabled(app, "generation");
    const body = runGenerationSchema.parse(request.body);
    const promptInput = body.promptInput as Record<string, unknown>;
    const selectedStudioType =
      typeof promptInput.selectedType === "string"
        ? promptInput.selectedType
        : null;
    await ensureStudioDocumentServiceEnabled(app, {
      documentType: body.documentType,
      selectedType: selectedStudioType,
    });
    let selectedSubtopic = asOptionalString(promptInput.subtopic);
    let selectedMinorTopic = asOptionalString(promptInput.minorTopic);
    let selectedSemester =
      asOptionalString(promptInput.semester) ??
      asOptionalString(promptInput.year) ??
      body.year;
    const selectedProgrammeLevel = asOptionalString(promptInput.programmeLevel);
    let selectedUnit = asOptionalString(promptInput.unit);
    let selectedSection = asOptionalString(promptInput.section);
    const selectedDifficultyLevel = asOptionalString(promptInput.difficultyLevel);
    const selectedObjectives = asStringList(promptInput.objectives);
    const selectedOutcomes = asStringList(promptInput.outcomes);

    let effectiveCourse = body.course;
    let effectiveTopic = body.topic;
    let resolvedSourceIds: string[] = [];
    const effectivePromptInput: Record<string, unknown> = {
      ...promptInput,
    };

    if (body.documentType === "Lesson Plan") {
      const outline = resolveProgrammeOutlineSelection({
        semester: selectedSemester,
        course: body.course,
        topic: body.topic,
        subtopic: selectedSubtopic,
        minorTopic: selectedMinorTopic,
      });

      if (outline.available && outline.matched) {
        selectedSemester = outline.canonicalSemester ?? selectedSemester;
        effectiveCourse = outline.canonicalCourse ?? effectiveCourse;
        effectiveTopic = outline.canonicalTopic ?? effectiveTopic;
        selectedSubtopic = outline.canonicalSubtopic ?? selectedSubtopic;
        selectedMinorTopic = outline.canonicalMinorTopic ?? selectedMinorTopic;
        selectedUnit = outline.topicNumber ?? selectedUnit;
        selectedSection =
          outline.minorTopicNumber ??
          outline.subtopicNumber ??
          selectedSection;

        effectivePromptInput.sourceOfTruth = "programme_outline_by_semester.clean.json";
        effectivePromptInput.semester = selectedSemester;
        effectivePromptInput.course = effectiveCourse;
        effectivePromptInput.topic = effectiveTopic;
        if (selectedSubtopic) {
          effectivePromptInput.subtopic = selectedSubtopic;
        }
        if (selectedMinorTopic) {
          effectivePromptInput.minorTopic = selectedMinorTopic;
        }
        if (selectedUnit) {
          effectivePromptInput.unit = selectedUnit;
        }
        if (selectedSection) {
          effectivePromptInput.section = selectedSection;
        }
      } else if (
        outline.available &&
        body.strictCurriculumAlignment &&
        (
          selectedSemester ||
          body.course ||
          body.topic ||
          selectedSubtopic ||
          selectedMinorTopic
        )
      ) {
        throw app.httpErrors.conflict(
          [
            "Lesson selection does not match programme outline source-of-truth.",
            outline.reason ?? "Refine semester/course/topic/subtopic values.",
            outline.suggestions?.courses?.length
              ? `Example courses: ${outline.suggestions.courses.slice(0, 8).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    }

    const retrievalTopic = selectedSubtopic
      ? `${effectiveTopic} ${selectedSubtopic} ${selectedMinorTopic ?? ""}`.trim()
      : `${effectiveTopic} ${selectedMinorTopic ?? ""}`.trim();

    const selectedVersion =
      body.curriculumVersionId ??
      (
        await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        })
      )?.id;

    if (!selectedVersion) {
      throw app.httpErrors.serviceUnavailable(
        "Curriculum is not configured yet. Please contact your platform superadmin.",
      );
    }

    // For Lesson Plans where the outline resolved a canonical course, narrow retrieval
    // to only chunks from that course's source document. Falls back to cross-source
    // retrieval automatically if no matching sources are found.
    if (body.documentType === "Lesson Plan" && effectiveCourse && selectedVersion) {
      const matchedSources = await app.prisma.curriculumSource.findMany({
        where: {
          status: "indexed",
          name: { contains: effectiveCourse, mode: "insensitive" },
          versions: { some: { curriculumVersionId: selectedVersion } },
        },
        select: { id: true },
      });
      resolvedSourceIds = matchedSources.map((s) => s.id);
    }

    const promptVersion = await app.prisma.promptVersion.findFirst({
      where: {
        documentType: toDocumentTypeDb(body.documentType),
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const topicTerms = tokenizeTopic(
      [
        retrievalTopic,
        selectedUnit ?? "",
        selectedSection ?? "",
        selectedDifficultyLevel ?? "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    const programmeFilters: Prisma.CurriculumChunkWhereInput[] = [
      { programmeTag: null },
      {
        programmeTag: {
          equals: body.programme,
          mode: "insensitive",
        },
      },
      {
        programmeTag: {
          contains: body.programme,
          mode: "insensitive",
        },
      },
    ];

    const yearFilters: Prisma.CurriculumChunkWhereInput[] = selectedSemester
      ? [
          { yearTag: null },
          {
            yearTag: {
              equals: selectedSemester,
              mode: "insensitive",
            },
          },
          {
            yearTag: {
              contains: selectedSemester,
              mode: "insensitive",
            },
          },
        ]
      : [];

    const keywordFilters: Prisma.CurriculumChunkWhereInput[] =
      topicTerms.length > 0
        ? topicTerms.flatMap((term) => [
            {
              text: {
                contains: term,
                mode: "insensitive",
              },
            },
            {
              heading: {
                contains: term,
                mode: "insensitive",
              },
            },
            {
              competencyCode: {
                contains: term,
                mode: "insensitive",
              },
            },
          ])
        : [
            {
              text: {
                contains: effectiveTopic,
                mode: "insensitive",
              },
            },
          ];

    // Lesson Plans need more context chunks to cover all sections (intro, objectives,
    // presentation table, summary, evaluation, assignment, references).
    const effectiveRetrievalLimit =
      body.documentType === "Lesson Plan"
        ? Math.max(env.RETRIEVAL_TOP_K, env.RETRIEVAL_LESSON_PLAN_TOP_K)
        : env.RETRIEVAL_TOP_K;

    const focused = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId: selectedVersion,
        source: {
          status: "indexed",
        },
        AND: [
          { OR: programmeFilters },
          ...(yearFilters.length > 0 ? [{ OR: yearFilters }] : []),
          // When the outline resolves a specific course, narrow to its source document.
          ...(resolvedSourceIds.length > 0 ? [{ sourceId: { in: resolvedSourceIds } }] : []),
          { OR: keywordFilters },
        ],
      },
      take: retrievalCandidateLimit,
      include: {
        source: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const fallback =
      focused.length < minimalCoverage
        ? await app.prisma.curriculumChunk.findMany({
            where: {
              curriculumVersionId: selectedVersion,
              source: {
                status: "indexed",
              },
              AND: [
                { OR: programmeFilters },
                ...(yearFilters.length > 0 ? [{ OR: yearFilters }] : []),
                // If we resolved a source document, prefer its chunks even in fallback
                // to avoid pulling context from unrelated courses.
                ...(resolvedSourceIds.length > 0 ? [{ sourceId: { in: resolvedSourceIds } }] : []),
              ],
            },
            take: retrievalCandidateLimit,
            include: {
              source: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : [];

    const focusedWithKeyword = focused.map((chunk) => ({
      chunk,
      keywordScore: scoreRetrievedChunk(chunk, {
        topic: effectiveTopic,
        course: effectiveCourse,
        topicTerms,
      }),
    }));

    const fallbackWithKeyword = fallback.map((chunk) => ({
      chunk,
      keywordScore: scoreRetrievedChunk(chunk, {
        topic: effectiveTopic,
        course: effectiveCourse,
        topicTerms,
      }),
    }));

    const mergedById = new Map<
      string,
      {
        chunk: (typeof focused)[number];
        keywordScore: number;
      }
    >();

    for (const entry of [...focusedWithKeyword, ...fallbackWithKeyword]) {
      const current = mergedById.get(entry.chunk.id);
      if (!current || entry.keywordScore > current.keywordScore) {
        mergedById.set(entry.chunk.id, entry);
      }
    }

    const allCandidates = Array.from(mergedById.values());
    let vectorScores = new Map<string, number>();
    let ftsScores = new Map<string, number>();
    if (allCandidates.length > 0) {
      try {
        const embeddingQuery = [
          retrievalTopic,
          effectiveCourse ?? "",
          body.programme,
          selectedSemester ?? "",
          selectedUnit ?? "",
          selectedSection ?? "",
          selectedDifficultyLevel ?? "",
        ]
          .filter(Boolean)
          .join(" ");
        const embeddingResult = await embedTextsWithFallback([embeddingQuery]);
        const queryVector = embeddingResult.vectors[0];
        // Skip vector scoring when the local hash-based fallback is used — it produces
        // no semantic signal and amplifies noise in the blend score.
        if (queryVector && embeddingResult.provider !== "local") {
          const vectorLiteral = vectorToSqlLiteral(queryVector);
          vectorScores = await lookupVectorScores(
            app,
            allCandidates.map((item) => item.chunk.id),
            vectorLiteral,
          );
        }
      } catch {
        // Non-blocking retrieval enhancement. Keyword retrieval still runs.
      }

      try {
        const ftsQuery = [
          retrievalTopic,
          effectiveCourse ?? "",
          selectedUnit ?? "",
          selectedSection ?? "",
          selectedDifficultyLevel ?? "",
        ]
          .filter(Boolean)
          .join(" ");
        ftsScores = await lookupFtsKeywordScores(
          app,
          allCandidates.map((item) => item.chunk.id),
          ftsQuery,
        );
      } catch {
        // Non-blocking retrieval enhancement. Heuristic keyword retrieval still runs.
      }
    }

    // First pass: compute raw combined keyword + FTS scores for all candidates.
    const withRawScores = allCandidates.map((item) => {
      const ftsScore = ftsScores.get(item.chunk.id) ?? 0;
      const rawKeywordScore = item.keywordScore + ftsScore * env.RETRIEVAL_FTS_WEIGHT;
      const vectorScore = vectorScores.get(item.chunk.id) ?? 0;
      return { ...item, rawKeywordScore, vectorScore };
    });

    // Normalize keyword scores to [0, 1] so that character-frequency matches do not
    // overwhelm the semantic vector signal when blending the final rank score.
    const maxKeywordScore = Math.max(1, ...withRawScores.map((item) => item.rawKeywordScore));
    const rankedCandidates = withRawScores
      .map((item) => {
        const normalizedKeyword = item.rawKeywordScore / maxKeywordScore;
        const rerankScore = normalizedKeyword + item.vectorScore * (env.RETRIEVAL_VECTOR_WEIGHT / 40);
        return {
          ...item,
          keywordScore: item.rawKeywordScore,
          vectorScore: item.vectorScore,
          rerankScore,
        };
      })
      .sort((a, b) => b.rerankScore - a.rerankScore);

    const retrievedChunks = rankedCandidates.slice(0, effectiveRetrievalLimit);
    const hasCoverage = retrievedChunks.length >= minimalCoverage;

    const baseRun = await app.prisma.generationRun.create({
      data: {
        userId,
        documentId: body.documentId,
        runType: body.documentId ? "regenerate_section" : "create",
        status: hasCoverage ? "running" : "blocked",
        inputJson: toJson(effectivePromptInput),
        strictCurriculumAlignment: body.strictCurriculumAlignment,
        modelProvider: "llm_router",
        modelName: "pending",
        promptVersionId: promptVersion?.id,
      },
    });

    if (retrievedChunks.length > 0) {
      await app.prisma.generationRunRetrieval.createMany({
        data: retrievedChunks.map((entry, index) => ({
          generationRunId: baseRun.id,
          curriculumChunkId: entry.chunk.id,
          rank: index + 1,
          keywordScore: toDbScore(entry.keywordScore),
          vectorScore: toDbScore(entry.vectorScore),
          rerankScore: toDbScore(entry.rerankScore),
          selected: true,
        })),
      });
    }

    if (!hasCoverage) {
      const flagged = await app.prisma.generationRun.update({
        where: { id: baseRun.id },
        data: {
          status: "blocked",
          completedAt: new Date(),
          errorMessage:
            "Insufficient curriculum context for this topic. Refine topic/module details or contact your superadmin for additional curriculum ingestion.",
          flags: {
            create: {
              flagType: "low_retrieval_coverage",
              severity: "blocking",
              detailsJson: {
                required: minimalCoverage,
                found: retrievedChunks.length,
                topic: effectiveTopic,
              } as Prisma.InputJsonValue,
            },
          },
        },
        include: { flags: true },
      });

      return reply.code(409).send(flagged);
    }

    const promptChunks: RetrievalChunkForPrompt[] = retrievedChunks.map((entry) => {
      const meta = safeRecord(entry.chunk.metadataJson);
      return {
        chunkId: entry.chunk.id,
        sourceId: entry.chunk.sourceId,
        sourceName: entry.chunk.source.name,
        page: entry.chunk.page ?? null,
        heading: entry.chunk.heading ?? null,
        text: entry.chunk.text,
        unit: typeof meta.unit === "string" ? meta.unit : undefined,
        topic: typeof meta.topic === "string" ? meta.topic : undefined,
        subtopic: typeof meta.subtopic === "string" ? meta.subtopic : undefined,
      };
    });

    const lessonRetrievalPlan =
      body.documentType === "Lesson Plan"
        ? buildLessonRetrievalPlan(promptChunks, {
            topic: effectiveTopic,
            course: effectiveCourse,
            subtopic: selectedSubtopic,
            minorTopic: selectedMinorTopic,
            objectives: selectedObjectives,
            outcomes: selectedOutcomes,
          })
        : [];

    try {
      const aiResult = await generateDocumentWithProviderFallback({
        documentType: body.documentType,
        title: body.title,
        programme: body.programme,
        year: selectedSemester ?? body.year,
        course: effectiveCourse,
        topic: selectedSubtopic
          ? `${effectiveTopic} - ${selectedSubtopic}${selectedMinorTopic ? ` - ${selectedMinorTopic}` : ""}`
          : `${effectiveTopic}${selectedMinorTopic ? ` - ${selectedMinorTopic}` : ""}`,
        plannerGuidance: {
          programmeLevel: selectedProgrammeLevel,
          semester: selectedSemester,
          subtopic: selectedSubtopic,
          minorTopic: selectedMinorTopic,
          unit: selectedUnit,
          section: selectedSection,
          difficultyLevel: selectedDifficultyLevel,
          objectives: selectedObjectives,
          outcomes: selectedOutcomes,
        },
        durationMinutes: body.durationMinutes,
        strictCurriculumAlignment: body.strictCurriculumAlignment,
        promptVersionName: promptVersion?.name,
        promptSystemText: promptVersion?.systemPrompt,
        promptDeveloperText: promptVersion?.developerPrompt ?? undefined,
        retrievalChunks: promptChunks,
        retrievalPlan: lessonRetrievalPlan,
      });

      const outputJson = toJson(aiResult.output);

      const finalRun = await app.prisma.$transaction(async (tx) => {
        const updatedRun = await tx.generationRun.update({
          where: { id: baseRun.id },
          data: {
            status: "succeeded",
            outputJson,
            outputChecksum: `${baseRun.id}:${retrievedChunks.length}`,
            modelProvider: aiResult.provider,
            modelName: aiResult.model,
            completedAt: new Date(),
          },
        });

        if (body.documentId) {
          const document = await tx.document.findFirst({
            where: { id: body.documentId, userId, deletedAt: null },
          });

          if (document) {
            const createdVersion = await tx.documentVersion.create({
              data: {
                documentId: document.id,
                versionNum: document.latestVersionNum + 1,
                contentJson: outputJson,
                changeSummary: `Regenerated by run ${baseRun.id}`,
                createdByUserId: userId,
              },
            });

            await tx.document.update({
              where: { id: document.id },
              data: {
                latestVersionNum: createdVersion.versionNum,
                updatedAt: new Date(),
              },
            });

            await tx.generationRun.update({
              where: { id: baseRun.id },
              data: { documentVersionId: createdVersion.id },
            });
          }
        }

        return updatedRun;
      });

      return reply.code(201).send(finalRun);
    } catch (error) {
      const internalMessage =
        error instanceof Error ? error.message : "AI generation failed.";
      const publicMessage = toPublicGenerationErrorMessage(internalMessage);

      request.log.error(
        {
          generationRunId: baseRun.id,
          userId,
          internalMessage,
        },
        "Generation provider failure",
      );

      const failedRun = await app.prisma.generationRun.update({
        where: { id: baseRun.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: publicMessage,
          flags: {
            create: {
              flagType: "provider_generation_failure",
              severity: "warning",
              detailsJson: {
                topic: effectiveTopic,
                providerPriority: "from env",
                error: publicMessage,
              } as Prisma.InputJsonValue,
            },
          },
        },
        include: { flags: true },
      });

      return reply.code(502).send(failedRun);
    }
  });

  // POST /api/v1/generation/expand-content - Expand lesson content with AI
  const expandContentHandler = async (request: any, reply: any) => {
    const userId = requireUserId(request);
    await ensureServiceEnabled(app, "content_expansion");

    const expandContentSchema = z.object({
      topic: z.string().min(1),
      subtopic: z.string().optional(),
      contentBrief: z.string().min(1),
      specificObjective: z.string().optional(),
      programme: z.string().optional(),
      course: z.string().optional(),
      curriculumVersionId: z.string().uuid().optional(),
    });

    const body = expandContentSchema.parse(request.body);

    // Retrieve relevant curriculum chunks for context
    const topicTokens = tokenizeTopic(body.topic);

    // Retrieve curriculum chunks
    const activeVersion = body.curriculumVersionId
      ? { id: body.curriculumVersionId }
      : await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        });

    if (!activeVersion?.id) {
      return reply.code(409).send({
        error: "No active curriculum version",
        message: "Create and activate a curriculum version first.",
      });
    }

    const curriculumVersionId = activeVersion.id;
    pruneExpandContentCache();
    const cacheKey = makeExpandContentCacheKey({
      userId,
      curriculumVersionId,
      topic: body.topic,
      subtopic: body.subtopic,
      specificObjective: body.specificObjective,
      contentBrief: body.contentBrief,
      programme: body.programme,
      course: body.course,
    });
    const cached = expandContentCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.code(200).send({
        ...cached.value,
        cacheHit: true,
      } satisfies ExpandContentResponse);
    }

    const tokenFilters = topicTokens.flatMap((token) => [
      { text: { contains: token, mode: "insensitive" as const } },
      { heading: { contains: token, mode: "insensitive" as const } },
    ]);
    
    const chunks = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId,
        OR: tokenFilters.length > 0 ? tokenFilters : [{ text: { contains: body.topic, mode: "insensitive" as const } }],
      },
      include: {
        source: { select: { id: true, name: true } },
      },
      take: retrievalLimit,
    });

    // Score and rank chunks
    const scoredChunks = chunks.map((chunk) => {
      const searchText = normalizeSearchText(`${chunk.heading ?? ""} ${chunk.text}`);
      const keywordScore = topicTokens.reduce(
        (sum, token) => sum + countMatches(searchText, token),
        0,
      );
      return { chunk, keywordScore };
    });

    scoredChunks.sort((a, b) => b.keywordScore - a.keywordScore);

    const topChunks = scoredChunks.slice(0, 6);
    const quality = buildExpandContentQuality({
      scoredChunks,
      topChunks,
    });

    const promptChunks: RetrievalChunkForPrompt[] = topChunks.map((entry) => ({
      chunkId: entry.chunk.id,
      sourceId: entry.chunk.sourceId,
      sourceName: entry.chunk.source.name,
      page: entry.chunk.page ?? null,
      heading: entry.chunk.heading ?? null,
      text: entry.chunk.text,
    }));

    try {
      const { expandLessonContentWithProviderFallback } = await import("../services/ai-layer.js");
      
      const result = await expandLessonContentWithProviderFallback({
        topic: body.topic,
        subtopic: body.subtopic,
        contentBrief: body.contentBrief,
        specificObjective: body.specificObjective,
        programme: body.programme,
        course: body.course,
        retrievalChunks: promptChunks,
      });

      const responsePayload = {
        expandedContent: result.expandedContent,
        provider: result.provider,
        model: result.model,
        chunksUsed: promptChunks.length,
        quality,
        cacheHit: false,
      } satisfies ExpandContentResponse;

      expandContentCache.set(cacheKey, {
        expiresAt: Date.now() + EXPAND_CONTENT_CACHE_TTL_MS,
        value: {
          expandedContent: responsePayload.expandedContent,
          provider: responsePayload.provider,
          model: responsePayload.model,
          chunksUsed: responsePayload.chunksUsed,
          quality: responsePayload.quality,
        },
      });

      return reply.code(200).send(responsePayload);
    } catch (error) {
      app.log.error({ error }, "Content expansion failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      return reply.code(500).send({
        error: "Content expansion failed",
        message: toPublicGenerationErrorMessage(message),
      });
    }
  };

  app.post("/expand-content", expandContentHandler);
  // Backward-compatible alias for older clients that still hit the previously hardcoded path.
  app.post("/api/generation/expand-content", expandContentHandler);
};

export default generationRoutes;
