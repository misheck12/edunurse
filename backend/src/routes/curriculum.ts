import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../config.js";
import { requireAdminUser, requireUserId } from "../services/auth-helpers.js";
import {
  answerCurriculumQuestionWithProviderFallback,
  RetrievalChunkForPrompt,
} from "../services/ai-layer.js";
import {
  embedTextsWithFallback,
  vectorToSqlLiteral,
} from "../services/embeddings.js";
import {
  getProgrammeOutlinePlannerOptions,
  resolveProgrammeOutlineSelection,
} from "../services/programme-outline.js";
import { ensureServiceEnabled } from "../services/service-controls.js";

const createSourceSchema = z.object({
  name: z.string().min(1),
  sourceType: z.enum(["syllabus", "standards", "guideline"]),
  programme: z.string().optional(),
  url: z.string().url().optional(),
  storageKey: z.string().min(1),
  checksum: z.string().min(1),
});

const createVersionSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  sourceIds: z.array(z.string().uuid()).min(1),
  activate: z.boolean().default(false),
});

const bulkChunksSchema = z.object({
  curriculumVersionId: z.string().uuid(),
  chunks: z
    .array(
      z.object({
        chunkIndex: z.number().int().nonnegative(),
        text: z.string().min(1),
        page: z.number().int().positive().optional(),
        heading: z.string().optional(),
        programmeTag: z.string().optional(),
        yearTag: z.string().optional(),
        courseCode: z.string().optional(),
        competencyCode: z.string().optional(),
        metadataJson: z.record(z.any()).default({}),
      }),
    )
    .min(1),
});

const searchChunksSchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  programmeTag: z.string().optional(),
  yearTag: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const curriculumTreeQuerySchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  programme: z.string().optional(),
  programmeLevel: z.string().optional(),
  year: z.string().optional(),
  search: z.string().optional(),
});

const plannerOptionsQuerySchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  programme: z.string().optional(),
  programmeLevel: z.string().optional(),
  semester: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  minorTopic: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(40),
});

const plannerSuggestionsSchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  programme: z.string().optional(),
  programmeLevel: z.string().optional(),
  semester: z.string().optional(),
  course: z.string().min(1),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  minorTopic: z.string().optional(),
  limit: z.coerce.number().int().positive().max(20).default(8),
});

const curriculumTreeNodeQuerySchema = z
  .object({
    curriculumVersionId: z.string().uuid().optional(),
    sourceId: z.string().uuid().optional(),
    programme: z.string().optional(),
    programmeLevel: z.string().optional(),
    path: z.string().min(3).optional(),
    code: z.string().min(1).optional(),
    nodeType: z.enum(["course", "unit", "section", "subsection"]).optional(),
  })
  .refine((value) => Boolean(value.path || value.code), {
    message: "Provide either path or code.",
    path: ["path"],
  });

const curriculumQuerySchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  programme: z.string().optional(),
  programmeLevel: z.string().optional(),
  year: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().optional(),
  subtopic: z.string().optional(),
  unit: z.string().optional(),
  section: z.string().optional(),
  question: z.string().min(3),
  strictCurriculumAlignment: z.boolean().default(true),
  limit: z.coerce.number().int().positive().max(20).default(6),
});

function normalizeLabel(value: string) {
  return value
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^[\d\s\.\-_]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferProgrammeLevel(input: string) {
  const lowered = input.toLowerCase();
  if (lowered.includes("bsc") || lowered.includes("bachelor")) {
    return "BSc";
  }
  if (lowered.includes("diploma")) {
    return "Diploma";
  }
  return "Unspecified";
}

function splitSearchTerms(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function sourceMatchesProgrammeLevel(
  source: { name: string; programme: string | null },
  requestedLevel?: string,
) {
  if (!requestedLevel) return true;
  const selected = requestedLevel.toLowerCase();
  const inferred = inferProgrammeLevel(
    `${source.name} ${source.programme ?? ""}`.trim(),
  ).toLowerCase();

  if (selected === "bsc" || selected.includes("bachelor")) {
    return inferred.includes("bsc") || inferred.includes("bachelor");
  }

  if (selected.includes("diploma")) {
    return inferred.includes("diploma");
  }

  return inferred === selected;
}

function sourceMatchesProgramme(
  source: { programme: string | null; name: string },
  requestedProgramme?: string,
) {
  if (!requestedProgramme) return true;
  const needle = requestedProgramme.toLowerCase().trim();
  if (!needle) return true;

  const programme = (source.programme ?? "").toLowerCase();
  const name = source.name.toLowerCase();

  return programme.includes(needle) || name.includes(needle);
}

function chunkMatchesSemester(
  chunk: { text: string; yearTag: string | null },
  semester?: string,
) {
  if (!semester) return true;
  const target = semester.toLowerCase().trim();
  if (!target) return true;
  const yearTag = (chunk.yearTag ?? "").toLowerCase();
  const text = chunk.text.toLowerCase();
  return yearTag.includes(target) || text.includes(target);
}

function scoreByNeedles(text: string, needles: string[]) {
  if (needles.length === 0) return 0;
  const haystack = text.toLowerCase();
  let score = 0;
  for (const needle of needles) {
    const token = needle.toLowerCase();
    if (!token) continue;
    let idx = haystack.indexOf(token);
    while (idx !== -1) {
      score += 1;
      idx = haystack.indexOf(token, idx + token.length);
    }
  }
  return score;
}

function extractSemesterCandidates(text: string) {
  const results = new Set<string>();
  const matches = text.matchAll(/\bsemester\s*([1-8])\b/gi);
  for (const match of matches) {
    const value = match[1];
    if (value) {
      results.add(`Semester ${value}`);
    }
  }
  return Array.from(results);
}

function cleanHeadingLine(value: string) {
  return value
    .replace(/^[\d]+(\.[\d]+)*\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadingCandidates(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 120);
  const candidates = new Set<string>();

  for (const line of lines) {
    const isNumbered = /^[\d]+(\.[\d]+)*\s+.{4,140}$/.test(line);
    const isUpperHeading =
      /^[A-Z][A-Z0-9\s,&/()-]{6,120}$/.test(line) &&
      line.split(" ").length <= 12;

    if (!isNumbered && !isUpperHeading) continue;

    const cleaned = cleanHeadingLine(line);
    if (cleaned.length < 5 || cleaned.length > 140) continue;
    candidates.add(cleaned);
    if (candidates.size >= 100) break;
  }

  return Array.from(candidates);
}

function sentenceCase(line: string) {
  if (!line) return line;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function sanitizePlannerLine(line: string) {
  const cleaned = line
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0\t\r]+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/__+/g, "")
    .replace(/`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[\.\)]|[a-z][\.\)]|[ivxlcdm]+[\.\)]|\(\d+\)|\[[x ]\])\s+/i, "")
    .replace(
      /^(?:learning\s+objectives?|learning\s+outcomes?|objectives?|outcomes?)\s*:\s*/i,
      "",
    )
    .replace(/^\s*(?:\"|')+/, "")
    .replace(/(?:\"|')+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length < 10 || cleaned.length > 280) return "";
  if (/^(table|figure|references?|appendix|unknown section type)\b/i.test(cleaned)) {
    return "";
  }
  if (/^[^a-z0-9]+$/i.test(cleaned)) return "";

  return sentenceCase(cleaned);
}

function plannerLineKey(line: string) {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lineToObjective(line: string) {
  return sanitizePlannerLine(line);
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeProgrammeLevel(value: string) {
  const lowered = value.toLowerCase().trim();
  if (lowered.includes("bsc") || lowered.includes("bachelor")) return "BSc";
  if (lowered.includes("diploma")) return "Diploma";
  return value.trim();
}

function chunkProgrammeLevel(chunk: { metadataJson: unknown }) {
  const metadata = safeRecord(chunk.metadataJson);
  const raw = typeof metadata.programmeLevel === "string" ? metadata.programmeLevel : null;
  return raw ? normalizeProgrammeLevel(raw) : null;
}

function chunkMatchesProgrammeLevel(
  chunk: { metadataJson: unknown },
  requestedLevel?: string,
) {
  if (!requestedLevel) return true;
  const normalizedRequest = normalizeProgrammeLevel(requestedLevel);
  const fromMeta = chunkProgrammeLevel(chunk);
  if (!fromMeta) return true;
  return fromMeta.toLowerCase() === normalizedRequest.toLowerCase();
}

function hierarchyNodeMatchesYear(
  node: {
    title: string;
    code: string | null;
    path: string;
    metadataJson: unknown;
  },
  requestedYear?: string,
) {
  if (!requestedYear) return true;
  const needle = requestedYear.toLowerCase().trim();
  if (!needle) return true;

  const metadata = safeRecord(node.metadataJson);
  const yearTag =
    typeof metadata.yearTag === "string" ? metadata.yearTag.toLowerCase() : "";
  const semester =
    typeof metadata.semester === "string" ? metadata.semester.toLowerCase() : "";

  const haystack = `${node.title} ${node.code ?? ""} ${node.path}`.toLowerCase();
  return (
    haystack.includes(needle) ||
    yearTag.includes(needle) ||
    semester.includes(needle)
  );
}

function parseDurationMinutesFromText(text: string) {
  const range = text.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\s*(hours?|hrs?|hr|h)\b/i);
  if (range?.[1] && range[2]) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
      return Math.round(((low + high) / 2) * 60);
    }
  }

  const direct = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*(hours?|hrs?|hr|h)\b/i);
  if (direct?.[1]) {
    const hours = Number(direct[1]);
    if (Number.isFinite(hours) && hours > 0) {
      return Math.round(hours * 60);
    }
  }

  return null;
}

function parseDurationMinutesFromMetadata(metadata: unknown) {
  const record = safeRecord(metadata);
  const durationHours =
    typeof record.durationHours === "number" ? record.durationHours : null;
  if (durationHours && Number.isFinite(durationHours) && durationHours > 0) {
    return Math.round(durationHours * 60);
  }

  const durationText =
    typeof record.durationText === "string" ? record.durationText : null;
  if (durationText) {
    return parseDurationMinutesFromText(durationText);
  }

  return null;
}

function buildPlannerFallbackSuggestions(labelTopic: string, limit: number) {
  const safeLabel = labelTopic.trim() || "this topic";
  return {
    objectives: [
      `Define core concepts and terminology related to ${safeLabel}.`,
      `Describe key principles, processes and nursing relevance of ${safeLabel}.`,
      `Apply ${safeLabel} knowledge to a focused teaching or clinical scenario.`,
    ].slice(0, limit),
    outcomes: [
      `Learners accurately explain central ideas of ${safeLabel} using professional language.`,
      `Learners differentiate major components of ${safeLabel} and relate them to practice.`,
      `Learners demonstrate safe, evidence-informed reasoning when discussing ${safeLabel}.`,
    ].slice(0, limit),
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQueryText(value: string) {
  return Array.from(
    new Set(
      normalizeSearchText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    ),
  ).slice(0, 12);
}

function countOccurrences(text: string, term: string) {
  if (!text || !term) return 0;
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function querySafeQuote(text: string) {
  return text.slice(0, 220).replace(/\s+/g, " ").trim();
}

function looksLikeNavigationQuestion(question: string) {
  const value = question.toLowerCase();
  if (/\b(show|list|find|locate|where)\b/.test(value) && /\b(unit|section|subsection|topic|course)\b/.test(value)) {
    return true;
  }
  if (/\b\d+\.\d+(\.\d+)?\b/.test(value)) {
    return true;
  }
  if (/\bunit\s+([ivxlcdm]+|\d+)\b/.test(value)) {
    return true;
  }
  return false;
}

function extractHierarchyCode(question: string) {
  const subsection = question.match(/\b(\d+\.\d+\.\d+(?:\.\d+)?)\b/);
  if (subsection?.[1]) {
    return { code: subsection[1], nodeType: "subsection" as const };
  }

  const section = question.match(/\b(\d+\.\d+)\b/);
  if (section?.[1]) {
    return { code: section[1], nodeType: "section" as const };
  }

  const unit = question.match(/\bunit\s+([ivxlcdm]+|\d+)\b/i);
  if (unit?.[1]) {
    return { code: unit[1].toUpperCase(), nodeType: "unit" as const };
  }

  return null;
}

function scoreCurriculumChunkForQuery(
  chunk: {
    text: string;
    heading: string | null;
    sourceName: string;
    metadataJson: unknown;
  },
  queryText: string,
  terms: string[],
) {
  const text = normalizeSearchText(chunk.text);
  const heading = normalizeSearchText(chunk.heading);
  const sourceName = normalizeSearchText(chunk.sourceName);
  const metadata = safeRecord(chunk.metadataJson);
  const topic = normalizeSearchText(
    typeof metadata.topic === "string" ? metadata.topic : "",
  );
  const subtopic = normalizeSearchText(
    typeof metadata.subtopic === "string" ? metadata.subtopic : "",
  );
  const unit = normalizeSearchText(
    typeof metadata.unit === "string" ? metadata.unit : "",
  );
  const section = normalizeSearchText(
    typeof metadata.section === "string" ? metadata.section : "",
  );

  let score = 0;
  const normalizedQuestion = normalizeSearchText(queryText);
  if (normalizedQuestion) {
    score += countOccurrences(heading, normalizedQuestion) * 14;
    score += countOccurrences(topic, normalizedQuestion) * 10;
    score += countOccurrences(subtopic, normalizedQuestion) * 9;
    score += countOccurrences(sourceName, normalizedQuestion) * 7;
    score += countOccurrences(text, normalizedQuestion) * 6;
  }

  for (const term of terms) {
    score += countOccurrences(heading, term) * 6;
    score += countOccurrences(topic, term) * 5;
    score += countOccurrences(subtopic, term) * 5;
    score += countOccurrences(unit, term) * 5;
    score += countOccurrences(section, term) * 5;
    score += countOccurrences(text, term) * 3;
  }

  return score;
}

function blendRetrievalScore(keywordScore: number, vectorScore: number) {
  return keywordScore + vectorScore * env.RETRIEVAL_VECTOR_WEIGHT;
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

  const inList = safeIds.map((id) => `'${id}'::uuid`).join(", ");
  const sql = `
    SELECT id::text AS id, (1 - (embedding <=> '${queryVectorLiteral}'::vector))::float8 AS score
    FROM curriculum_chunks
    WHERE id IN (${inList})
      AND embedding IS NOT NULL
    ORDER BY embedding <=> '${queryVectorLiteral}'::vector
    LIMIT ${Math.max(20, safeIds.length)}
  `;

  const rows = (await app.prisma.$queryRawUnsafe(sql)) as Array<{
    id: string;
    score: number | string | null;
  }>;

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

function toPublicQueryErrorMessage(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  if (message.includes("aborted") || message.includes("timeout")) {
    return "Response generation timed out. Please try again.";
  }
  if (
    message.includes("all llm providers failed") ||
    message.includes("missing configuration")
  ) {
    return "Answer service is temporarily unavailable. Please try again shortly.";
  }
  return "Unable to answer this question right now.";
}

function extractObjectivesAndOutcomes(text: string) {
  const objectives = new Set<string>();
  const outcomes = new Set<string>();
  const objectiveKeys = new Set<string>();
  const outcomeKeys = new Set<string>();

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let mode: "none" | "objectives" | "outcomes" = "none";

  for (const rawLine of lines) {
    const line = rawLine.toLowerCase().trim();

    if (
      /^(?:learning\s+objectives?|objectives?)\s*:?\s*$/i.test(line) ||
      /\blearning\s+objective(s)?\b/.test(line)
    ) {
      mode = "objectives";
      continue;
    }
    if (
      /^(?:learning\s+outcomes?|outcomes?)\s*:?\s*$/i.test(line) ||
      /\blearning\s+outcome(s)?\b/.test(line)
    ) {
      mode = "outcomes";
      continue;
    }

    const normalized = lineToObjective(rawLine);
    if (!normalized || normalized.length < 10) continue;

    const looksLikeBullet =
      /^[\-\*\u2022]/.test(rawLine) ||
      /^\d+[\.\)]\s+/.test(rawLine) ||
      /^(describe|explain|identify|demonstrate|define|outline|apply|differentiate|discuss)\b/i.test(
        normalized,
      );

    if (!looksLikeBullet) continue;

    const key = plannerLineKey(normalized);
    if (!key) continue;

    if (mode === "objectives") {
      if (objectiveKeys.has(key)) continue;
      objectiveKeys.add(key);
      objectives.add(normalized);
      continue;
    }
    if (mode === "outcomes") {
      if (outcomeKeys.has(key)) continue;
      outcomeKeys.add(key);
      outcomes.add(normalized);
      continue;
    }

    if (
      /^(describe|explain|identify|define|outline|differentiate|discuss)\b/i.test(
        normalized,
      )
    ) {
      if (outcomeKeys.has(key)) continue;
      outcomeKeys.add(key);
      outcomes.add(normalized);
    } else {
      if (objectiveKeys.has(key)) continue;
      objectiveKeys.add(key);
      objectives.add(normalized);
    }
  }

  return {
    objectives: Array.from(objectives),
    outcomes: Array.from(outcomes),
  };
}

async function resolveCurriculumVersionId(
  app: FastifyInstance,
  requested?: string,
) {
  if (requested) {
    const exists = await app.prisma.curriculumVersion.findUnique({
      where: { id: requested },
      select: { id: true },
    });
    return exists?.id ?? null;
  }

  const active = await app.prisma.curriculumVersion.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return active?.id ?? null;
}

const curriculumRoutes: FastifyPluginAsync = async (app) => {
  app.get("/sources", async () => {
    const sources = await app.prisma.curriculumSource.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { items: sources };
  });

  app.post("/sources", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    const body = createSourceSchema.parse(request.body);

    const source = await app.prisma.curriculumSource.create({
      data: {
        name: body.name,
        sourceType: body.sourceType,
        programme: body.programme,
        url: body.url,
        storageKey: body.storageKey,
        checksum: body.checksum,
        uploadedByUserId: admin.id,
        status: "uploaded",
      },
    });

    return reply.code(201).send(source);
  });

  app.post("/versions", async (request, reply) => {
    await requireAdminUser(app, request);
    const body = createVersionSchema.parse(request.body);

    const version = await app.prisma.$transaction(async (tx) => {
      if (body.activate) {
        await tx.curriculumVersion.updateMany({
          data: { isActive: false },
        });
      }

      const created = await tx.curriculumVersion.create({
        data: {
          label: body.label,
          description: body.description,
          isActive: body.activate,
          activatedAt: body.activate ? new Date() : null,
          sources: {
            createMany: {
              data: body.sourceIds.map((sourceId) => ({ sourceId })),
            },
          },
        },
        include: {
          sources: true,
        },
      });

      return created;
    });

    return reply.code(201).send(version);
  });

  app.post("/versions/:versionId/activate", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ versionId: z.string().uuid() }).parse(request.params);

    const version = await app.prisma.$transaction(async (tx) => {
      await tx.curriculumVersion.updateMany({
        data: { isActive: false },
      });

      return tx.curriculumVersion.update({
        where: { id: params.versionId },
        data: {
          isActive: true,
          activatedAt: new Date(),
        },
      });
    });

    return version;
  });

  app.post("/sources/:sourceId/chunks/bulk", async (request, reply) => {
    await requireAdminUser(app, request);
    const params = z.object({ sourceId: z.string().uuid() }).parse(request.params);
    const body = bulkChunksSchema.parse(request.body);

    const source = await app.prisma.curriculumSource.findUnique({
      where: { id: params.sourceId },
      select: { id: true },
    });

    if (!source) {
      throw app.httpErrors.notFound("Curriculum source not found");
    }

    const version = await app.prisma.curriculumVersion.findUnique({
      where: { id: body.curriculumVersionId },
      select: { id: true },
    });

    if (!version) {
      throw app.httpErrors.notFound("Curriculum version not found");
    }

    await app.prisma.curriculumChunk.createMany({
      data: body.chunks.map((chunk) => ({
        sourceId: params.sourceId,
        curriculumVersionId: body.curriculumVersionId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        page: chunk.page,
        heading: chunk.heading,
        programmeTag: chunk.programmeTag,
        yearTag: chunk.yearTag,
        courseCode: chunk.courseCode,
        competencyCode: chunk.competencyCode,
        metadataJson: chunk.metadataJson,
      })),
      skipDuplicates: true,
    });

    await app.prisma.curriculumSource.update({
      where: { id: params.sourceId },
      data: { status: "indexed" },
    });

    return reply.code(202).send({
      message: "Chunks accepted",
      sourceId: params.sourceId,
      inserted: body.chunks.length,
    });
  });

  app.get("/chunks/search", async (request) => {
    const query = searchChunksSchema.parse(request.query);

    const activeVersion = query.curriculumVersionId
      ? null
      : await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        });

    const chunks = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId: query.curriculumVersionId ?? activeVersion?.id,
        programmeTag: query.programmeTag,
        yearTag: query.yearTag,
        ...(query.q
          ? {
              text: {
                contains: query.q,
                mode: "insensitive",
              },
            }
          : {}),
      },
      take: query.limit,
      orderBy: [{ sourceId: "asc" }, { chunkIndex: "asc" }],
    });

    return {
      items: chunks,
    };
  });

  app.get("/tree", async (request) => {
    const query = curriculumTreeQuerySchema.parse(request.query);
    const curriculumVersionId = await resolveCurriculumVersionId(
      app,
      query.curriculumVersionId,
    );

    if (!curriculumVersionId) {
      throw app.httpErrors.serviceUnavailable(
        "No active curriculum version available.",
      );
    }

    const sourceCandidates = await app.prisma.curriculumSource.findMany({
      where: {
        status: "indexed",
        ...(query.sourceId ? { id: query.sourceId } : {}),
        versions: {
          some: {
            curriculumVersionId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        programme: true,
      },
      orderBy: { name: "asc" },
    });

    const sources = sourceCandidates
      .filter((source) => sourceMatchesProgramme(source, query.programme))
      .filter((source) =>
        sourceMatchesProgrammeLevel(source, query.programmeLevel),
      );

    if (sources.length === 0) {
      return {
        curriculumVersionId,
        sourceCount: 0,
        nodeCount: 0,
        items: [],
      };
    }

    const sourceIdSql = Prisma.join(
      sources.map((source) => Prisma.sql`CAST(${source.id} AS uuid)`),
      ", ",
    );
    const searchNeedle = query.search?.trim();

    const nodes = await app.prisma.$queryRaw<
      Array<{
        id: string;
        sourceId: string;
        parentId: string | null;
        nodeType: string;
        code: string | null;
        title: string;
        path: string;
        depth: number;
        sortOrder: number;
        metadataJson: unknown;
      }>
    >(
      Prisma.sql`
        SELECT
          id::text AS id,
          source_id::text AS "sourceId",
          parent_id::text AS "parentId",
          node_type AS "nodeType",
          code,
          title,
          path,
          depth,
          sort_order AS "sortOrder",
          metadata_json AS "metadataJson"
        FROM curriculum_hierarchy_nodes
        WHERE curriculum_version_id = CAST(${curriculumVersionId} AS uuid)
          AND source_id IN (${sourceIdSql})
          ${
            searchNeedle
              ? Prisma.sql`AND (title ILIKE ${`%${searchNeedle}%`} OR path ILIKE ${`%${searchNeedle}%`} OR COALESCE(code, '') ILIKE ${`%${searchNeedle}%`})`
              : Prisma.empty
          }
        ORDER BY source_id ASC, depth ASC, sort_order ASC, created_at ASC
      `,
    );

    const filteredNodes = nodes.filter((node) =>
      hierarchyNodeMatchesYear(node, query.year),
    );

    type TreeNode = {
      id: string;
      nodeType: string;
      code: string | null;
      title: string;
      path: string;
      depth: number;
      sortOrder: number;
      metadataJson: unknown;
      children: TreeNode[];
    };

    const nodesBySource = new Map<
      string,
      {
        source: { id: string; name: string; programme: string | null };
        roots: TreeNode[];
      }
    >(
      sources.map((source) => [
        source.id,
        {
          source,
          roots: [],
        },
      ]),
    );

    for (const source of sources) {
      const sourceNodes = filteredNodes.filter((node) => node.sourceId === source.id);
      const mapById = new Map<string, TreeNode>();

      for (const node of sourceNodes) {
        mapById.set(node.id, {
          id: node.id,
          nodeType: node.nodeType,
          code: node.code,
          title: node.title,
          path: node.path,
          depth: node.depth,
          sortOrder: node.sortOrder,
          metadataJson: node.metadataJson,
          children: [],
        });
      }

      const roots: TreeNode[] = [];
      for (const node of sourceNodes) {
        const current = mapById.get(node.id);
        if (!current) continue;
        if (!node.parentId) {
          roots.push(current);
          continue;
        }
        const parent = mapById.get(node.parentId);
        if (parent) {
          parent.children.push(current);
        } else {
          roots.push(current);
        }
      }

      const sortTree = (items: TreeNode[]) => {
        items.sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
        );
        for (const item of items) {
          sortTree(item.children);
        }
      };
      sortTree(roots);

      const group = nodesBySource.get(source.id);
      if (group) {
        group.roots = roots;
      }
    }

    return {
      curriculumVersionId,
      sourceCount: sources.length,
      nodeCount: filteredNodes.length,
      items: Array.from(nodesBySource.values()),
    };
  });

  app.get("/tree/node", async (request) => {
    const query = curriculumTreeNodeQuerySchema.parse(request.query);
    const curriculumVersionId = await resolveCurriculumVersionId(
      app,
      query.curriculumVersionId,
    );

    if (!curriculumVersionId) {
      throw app.httpErrors.serviceUnavailable(
        "No active curriculum version available.",
      );
    }

    const sourceCandidates = await app.prisma.curriculumSource.findMany({
      where: {
        status: "indexed",
        ...(query.sourceId ? { id: query.sourceId } : {}),
        versions: {
          some: {
            curriculumVersionId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        programme: true,
      },
    });

    const sources = sourceCandidates
      .filter((source) => sourceMatchesProgramme(source, query.programme))
      .filter((source) =>
        sourceMatchesProgrammeLevel(source, query.programmeLevel),
      );

    if (sources.length === 0) {
      return {
        curriculumVersionId,
        found: false,
        message: "No matching indexed sources found for the selected filters.",
      };
    }

    const sourceIdSql = Prisma.join(
      sources.map((source) => Prisma.sql`CAST(${source.id} AS uuid)`),
      ", ",
    );
    const pathNeedle = query.path?.trim();
    const codeNeedle = query.code?.trim();

    const matches = await app.prisma.$queryRaw<
      Array<{
        id: string;
        sourceId: string;
        parentId: string | null;
        nodeType: string;
        code: string | null;
        title: string;
        path: string;
        depth: number;
        sortOrder: number;
        metadataJson: unknown;
      }>
    >(
      Prisma.sql`
        SELECT
          id::text AS id,
          source_id::text AS "sourceId",
          parent_id::text AS "parentId",
          node_type AS "nodeType",
          code,
          title,
          path,
          depth,
          sort_order AS "sortOrder",
          metadata_json AS "metadataJson"
        FROM curriculum_hierarchy_nodes
        WHERE curriculum_version_id = CAST(${curriculumVersionId} AS uuid)
          AND source_id IN (${sourceIdSql})
          ${
            query.nodeType
              ? Prisma.sql`AND node_type = ${query.nodeType}`
              : Prisma.empty
          }
          ${
            pathNeedle
              ? Prisma.sql`AND path ILIKE ${`%${pathNeedle}%`}`
              : Prisma.empty
          }
          ${
            codeNeedle
              ? Prisma.sql`AND (COALESCE(code, '') ILIKE ${codeNeedle} OR COALESCE(code, '') ILIKE ${`%${codeNeedle}%`})`
              : Prisma.empty
          }
        ORDER BY
          CASE
            WHEN ${pathNeedle ?? ""} <> '' AND path = ${pathNeedle ?? ""} THEN 0
            WHEN ${codeNeedle ?? ""} <> '' AND COALESCE(code, '') = ${codeNeedle ?? ""} THEN 1
            ELSE 2
          END,
          depth ASC,
          sort_order ASC
        LIMIT 25
      `,
    );

    if (matches.length === 0) {
      return {
        curriculumVersionId,
        found: false,
        message: "No hierarchy node matched the requested path/code.",
      };
    }

    const selected = matches[0];
    const sourceMap = new Map(sources.map((source) => [source.id, source]));
    const selectedSource = sourceMap.get(selected.sourceId) ?? null;

    const nodeById = new Map(matches.map((node) => [node.id, node]));
    const ancestors: Array<typeof selected> = [];
    let cursor = selected.parentId;

    while (cursor) {
      let parent = nodeById.get(cursor);
      if (!parent) {
        const fromDb = await app.prisma.$queryRaw<
          Array<{
            id: string;
            sourceId: string;
            parentId: string | null;
            nodeType: string;
            code: string | null;
            title: string;
            path: string;
            depth: number;
            sortOrder: number;
            metadataJson: unknown;
          }>
        >(
          Prisma.sql`
            SELECT
              id::text AS id,
              source_id::text AS "sourceId",
              parent_id::text AS "parentId",
              node_type AS "nodeType",
              code,
              title,
              path,
              depth,
              sort_order AS "sortOrder",
              metadata_json AS "metadataJson"
            FROM curriculum_hierarchy_nodes
            WHERE id = CAST(${cursor} AS uuid)
            LIMIT 1
          `,
        );
        parent = fromDb[0];
        if (parent) {
          nodeById.set(parent.id, parent);
        }
      }
      if (!parent) break;
      ancestors.unshift(parent);
      cursor = parent.parentId;
    }

    const children = await app.prisma.$queryRaw<
      Array<{
        id: string;
        sourceId: string;
        parentId: string | null;
        nodeType: string;
        code: string | null;
        title: string;
        path: string;
        depth: number;
        sortOrder: number;
        metadataJson: unknown;
      }>
    >(
      Prisma.sql`
        SELECT
          id::text AS id,
          source_id::text AS "sourceId",
          parent_id::text AS "parentId",
          node_type AS "nodeType",
          code,
          title,
          path,
          depth,
          sort_order AS "sortOrder",
          metadata_json AS "metadataJson"
        FROM curriculum_hierarchy_nodes
        WHERE parent_id = CAST(${selected.id} AS uuid)
        ORDER BY sort_order ASC, title ASC
      `,
    );

    return {
      curriculumVersionId,
      found: true,
      source: selectedSource,
      node: selected,
      ancestors,
      children,
      alternatives: matches.slice(1, 12),
    };
  });

  app.post("/query", async (request) => {
    requireUserId(request);
    await ensureServiceEnabled(app, "curriculum_query");
    const body = curriculumQuerySchema.parse(request.body);
    const curriculumVersionId = await resolveCurriculumVersionId(
      app,
      body.curriculumVersionId,
    );

    if (!curriculumVersionId) {
      throw app.httpErrors.serviceUnavailable(
        "No active curriculum version available.",
      );
    }

    const sourceCandidates = await app.prisma.curriculumSource.findMany({
      where: {
        status: "indexed",
        ...(body.sourceId ? { id: body.sourceId } : {}),
        versions: {
          some: {
            curriculumVersionId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        programme: true,
      },
      take: 2000,
    });

    const sources = sourceCandidates
      .filter((source) => sourceMatchesProgramme(source, body.programme))
      .filter((source) =>
        sourceMatchesProgrammeLevel(source, body.programmeLevel),
      );
    const sourceIds = sources.map((source) => source.id);
    if (sourceIds.length === 0) {
      return {
        curriculumVersionId,
        mode: "no_context",
        message: "No indexed curriculum sources match the selected filters.",
        answer: null,
        citations: [],
      };
    }

    const intent = looksLikeNavigationQuestion(body.question)
      ? "navigation"
      : "reasoning";

    if (intent === "navigation") {
      const inferred = extractHierarchyCode(body.question);
      const pathNeedle = normalizeSearchText(body.question).replace(/\s+/g, "-");
      const codeNeedle = inferred?.code ?? undefined;
      const nodeTypeNeedle = inferred?.nodeType ?? undefined;
      const sourceIdSql = Prisma.join(
        sourceIds.map((sourceId) => Prisma.sql`CAST(${sourceId} AS uuid)`),
        ", ",
      );

      const nodes = await app.prisma.$queryRaw<
        Array<{
          id: string;
          sourceId: string;
          parentId: string | null;
          nodeType: string;
          code: string | null;
          title: string;
          path: string;
          depth: number;
          sortOrder: number;
          metadataJson: unknown;
        }>
      >(
        Prisma.sql`
          SELECT
            id::text AS id,
            source_id::text AS "sourceId",
            parent_id::text AS "parentId",
            node_type AS "nodeType",
            code,
            title,
            path,
            depth,
            sort_order AS "sortOrder",
            metadata_json AS "metadataJson"
          FROM curriculum_hierarchy_nodes
          WHERE curriculum_version_id = CAST(${curriculumVersionId} AS uuid)
            AND source_id IN (${sourceIdSql})
            ${
              nodeTypeNeedle
                ? Prisma.sql`AND node_type = ${nodeTypeNeedle}`
                : Prisma.empty
            }
            ${
              codeNeedle
                ? Prisma.sql`AND (COALESCE(code, '') ILIKE ${codeNeedle} OR title ILIKE ${`%${codeNeedle}%`})`
                : Prisma.sql`AND (title ILIKE ${`%${body.question}%`} OR path ILIKE ${`%${pathNeedle}%`})`
            }
          ORDER BY depth ASC, sort_order ASC
          LIMIT 20
        `,
      );

      if (nodes.length === 0) {
        return {
          curriculumVersionId,
          mode: "navigation",
          found: false,
          message: "No matching curriculum node found.",
          answer: "Not found in module.",
          citations: [],
        };
      }

      const best = nodes[0];
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      const children = await app.prisma.$queryRaw<
        Array<{
          id: string;
          nodeType: string;
          code: string | null;
          title: string;
          path: string;
          depth: number;
          sortOrder: number;
          metadataJson: unknown;
        }>
      >(
        Prisma.sql`
          SELECT
            id::text AS id,
            node_type AS "nodeType",
            code,
            title,
            path,
            depth,
            sort_order AS "sortOrder",
            metadata_json AS "metadataJson"
          FROM curriculum_hierarchy_nodes
          WHERE parent_id = CAST(${best.id} AS uuid)
          ORDER BY sort_order ASC, title ASC
          LIMIT 50
        `,
      );

      return {
        curriculumVersionId,
        mode: "navigation",
        found: true,
        answer: `${best.nodeType.toUpperCase()}: ${best.title}`,
        node: best,
        source: sourceById.get(best.sourceId) ?? null,
        children,
        alternatives: nodes.slice(1, 10),
        citations: [],
      };
    }

    const topicTerms = tokenizeQueryText(
      [
        body.question,
        body.topic ?? "",
        body.subtopic ?? "",
        body.unit ?? "",
        body.section ?? "",
        body.course ?? "",
      ]
        .filter(Boolean)
        .join(" "),
    );
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
          ])
        : [
            {
              text: {
                contains: body.question,
                mode: "insensitive",
              },
            },
          ];

    const yearFilters: Prisma.CurriculumChunkWhereInput[] = body.year
      ? [
          { yearTag: null },
          {
            yearTag: {
              equals: body.year,
              mode: "insensitive",
            },
          },
          {
            yearTag: {
              contains: body.year,
              mode: "insensitive",
            },
          },
        ]
      : [];

    const focused = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId,
        sourceId: { in: sourceIds },
        AND: [
          ...(yearFilters.length > 0 ? [{ OR: yearFilters }] : []),
          { OR: keywordFilters },
        ],
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: env.RETRIEVAL_CANDIDATE_K,
      orderBy: { createdAt: "desc" },
    });

    const fallback =
      focused.length < env.RETRIEVAL_MIN_COVERAGE
        ? await app.prisma.curriculumChunk.findMany({
            where: {
              curriculumVersionId,
              sourceId: { in: sourceIds },
              ...(yearFilters.length > 0 ? { OR: yearFilters } : {}),
            },
            include: {
              source: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            take: env.RETRIEVAL_CANDIDATE_K,
            orderBy: { createdAt: "desc" },
          })
        : [];

    const merged = new Map<
      string,
      {
        chunk: (typeof focused)[number];
        keywordScore: number;
      }
    >();

    for (const chunk of [...focused, ...fallback]) {
      const metadata = safeRecord(chunk.metadataJson);
      const matchesFilters =
        (!body.course ||
          normalizeSearchText(
            `${chunk.source.name} ${typeof metadata.courseTitle === "string" ? metadata.courseTitle : ""}`,
          ).includes(normalizeSearchText(body.course))) &&
        (!body.topic ||
          normalizeSearchText(
            `${chunk.heading ?? ""} ${typeof metadata.topic === "string" ? metadata.topic : ""}`,
          ).includes(normalizeSearchText(body.topic))) &&
        (!body.subtopic ||
          normalizeSearchText(
            `${chunk.heading ?? ""} ${typeof metadata.subtopic === "string" ? metadata.subtopic : ""}`,
          ).includes(normalizeSearchText(body.subtopic))) &&
        (!body.unit ||
          normalizeSearchText(typeof metadata.unit === "string" ? metadata.unit : "").includes(
            normalizeSearchText(body.unit),
          )) &&
        (!body.section ||
          normalizeSearchText(
            typeof metadata.section === "string" ? metadata.section : "",
          ).includes(normalizeSearchText(body.section)));

      if (!matchesFilters) continue;

      const keywordScore = scoreCurriculumChunkForQuery(
        {
          text: chunk.text,
          heading: chunk.heading,
          sourceName: chunk.source.name,
          metadataJson: chunk.metadataJson,
        },
        body.question,
        topicTerms,
      );

      const existing = merged.get(chunk.id);
      if (!existing || keywordScore > existing.keywordScore) {
        merged.set(chunk.id, { chunk, keywordScore });
      }
    }

    const candidates = Array.from(merged.values());
    if (candidates.length === 0) {
      return {
        curriculumVersionId,
        mode: "reasoning",
        message: "No relevant curriculum chunks found for this query.",
        answer: "Not found in module.",
        citations: [],
      };
    }

    let vectorScores = new Map<string, number>();
    let ftsScores = new Map<string, number>();
    try {
      const embeddingResult = await embedTextsWithFallback([body.question]);
      const queryVector = embeddingResult.vectors[0];
      if (queryVector) {
        vectorScores = await lookupVectorScores(
          app,
          candidates.map((entry) => entry.chunk.id),
          vectorToSqlLiteral(queryVector),
        );
      }
    } catch {
      // Non-blocking enhancement.
    }

    try {
      ftsScores = await lookupFtsKeywordScores(
        app,
        candidates.map((entry) => entry.chunk.id),
        body.question,
      );
    } catch {
      // Non-blocking enhancement.
    }

    const ranked = candidates
      .map((entry) => {
        const ftsScore = ftsScores.get(entry.chunk.id) ?? 0;
        const keywordScore =
          entry.keywordScore + ftsScore * env.RETRIEVAL_FTS_WEIGHT;
        const vectorScore = vectorScores.get(entry.chunk.id) ?? 0;
        const rerankScore = blendRetrievalScore(keywordScore, vectorScore);
        return {
          ...entry,
          keywordScore,
          vectorScore,
          rerankScore,
        };
      })
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, body.limit);

    if (
      body.strictCurriculumAlignment &&
      ranked.length < env.RETRIEVAL_MIN_COVERAGE
    ) {
      return {
        curriculumVersionId,
        mode: "reasoning",
        blocked: true,
        message:
          "Insufficient curriculum context for this question. Refine programme/course/topic filters.",
        answer: null,
        citations: ranked.map((entry) => ({
          sourceId: entry.chunk.sourceId,
          sourceName: entry.chunk.source.name,
          chunkId: entry.chunk.id,
          page: entry.chunk.page ?? null,
          quoteSnippet: querySafeQuote(entry.chunk.text),
          score: entry.rerankScore,
        })),
      };
    }

    const retrievalChunks: RetrievalChunkForPrompt[] = ranked.map((entry) => ({
      chunkId: entry.chunk.id,
      sourceId: entry.chunk.sourceId,
      sourceName: entry.chunk.source.name,
      page: entry.chunk.page ?? null,
      heading: entry.chunk.heading ?? null,
      text: entry.chunk.text,
    }));

    try {
      const ai = await answerCurriculumQuestionWithProviderFallback({
        question: body.question,
        strictCurriculumAlignment: body.strictCurriculumAlignment,
        retrievalChunks,
        curriculumContext: {
          programme: body.programme,
          programmeLevel: body.programmeLevel,
          year: body.year,
          course: body.course,
          topic: body.topic,
          subtopic: body.subtopic,
          unit: body.unit,
          section: body.section,
        },
      });

      return {
        curriculumVersionId,
        mode: "reasoning",
        blocked: false,
        answer: ai.answer,
        provider: ai.provider,
        model: ai.model,
        citations: ranked.map((entry) => ({
          sourceId: entry.chunk.sourceId,
          sourceName: entry.chunk.source.name,
          chunkId: entry.chunk.id,
          page: entry.chunk.page ?? null,
          heading: entry.chunk.heading,
          quoteSnippet: querySafeQuote(entry.chunk.text),
          score: entry.rerankScore,
        })),
      };
    } catch (error) {
      const internalMessage =
        error instanceof Error ? error.message : "Unknown query generation error.";
      request.log.error(
        {
          curriculumVersionId,
          sourceCount: sourceIds.length,
          error: internalMessage,
        },
        "Curriculum query provider failure",
      );
      return {
        curriculumVersionId,
        mode: "reasoning",
        blocked: false,
        answer: "Not found in module.",
        message: toPublicQueryErrorMessage(internalMessage),
        citations: ranked.map((entry) => ({
          sourceId: entry.chunk.sourceId,
          sourceName: entry.chunk.source.name,
          chunkId: entry.chunk.id,
          page: entry.chunk.page ?? null,
          heading: entry.chunk.heading,
          quoteSnippet: querySafeQuote(entry.chunk.text),
          score: entry.rerankScore,
        })),
      };
    }
  });

  app.get("/planner/options", async (request) => {
    await ensureServiceEnabled(app, "curriculum_planner");
    const query = plannerOptionsQuerySchema.parse(request.query);
    const curriculumVersionId = await resolveCurriculumVersionId(
      app,
      query.curriculumVersionId,
    );

    if (!curriculumVersionId) {
      throw app.httpErrors.serviceUnavailable(
        "No active curriculum version available.",
      );
    }

    const outlineOptions = getProgrammeOutlinePlannerOptions({
      programme: query.programme,
      programmeLevel: query.programmeLevel,
      semester: query.semester,
      course: query.course,
      topic: query.topic,
      subtopic: query.subtopic,
      minorTopic: query.minorTopic,
      limit: query.limit,
    });

    if (outlineOptions.available) {
      return {
        curriculumVersionId,
        programmeLevels:
          outlineOptions.programmeLevels.length > 0
            ? outlineOptions.programmeLevels
            : ["Diploma"],
        semesters: outlineOptions.matchedContext ? outlineOptions.semesters : [],
        courses: outlineOptions.matchedContext ? outlineOptions.courses : [],
        topics: outlineOptions.matchedContext ? outlineOptions.topics : [],
        subtopics: outlineOptions.matchedContext ? outlineOptions.subtopics : [],
        minorTopics: outlineOptions.matchedContext ? outlineOptions.minorTopics : [],
      };
    }

    const versionSources = await app.prisma.curriculumVersionSource.findMany({
      where: { curriculumVersionId },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            status: true,
            programme: true,
          },
        },
      },
      take: 1000,
    });

    const indexedSources = versionSources
      .map((entry) => entry.source)
      .filter(
        (source) =>
          source.status === "indexed" &&
          sourceMatchesProgramme(source, query.programme),
      );

    const indexedSourcesByLevel = indexedSources.filter((source) =>
      sourceMatchesProgrammeLevel(source, query.programmeLevel),
    );
    const effectiveSourcesForLevel =
      indexedSourcesByLevel.length > 0 ? indexedSourcesByLevel : indexedSources;

    const programmeLevelCounts = new Map<string, number>();
    for (const source of indexedSources) {
      const inferred = inferProgrammeLevel(
        `${source.name} ${source.programme ?? ""}`.trim(),
      );
      programmeLevelCounts.set(inferred, (programmeLevelCounts.get(inferred) ?? 0) + 1);
    }

    const programmeLevels = Array.from(programmeLevelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value)
      .filter((value) => value !== "Unspecified");
    if (!programmeLevels.includes("Diploma")) programmeLevels.unshift("Diploma");
    if (!programmeLevels.includes("BSc")) programmeLevels.push("BSc");

    if (effectiveSourcesForLevel.length === 0) {
      return {
        curriculumVersionId,
        programmeLevels,
        semesters: [],
        courses: [],
        topics: [],
        subtopics: [],
        minorTopics: [],
      };
    }

    const sourceIdsForSelection = effectiveSourcesForLevel
      .filter((source) => {
        if (!query.course) return true;
        const normalized = normalizeLabel(source.name).toLowerCase();
        const courseNeedle = query.course.toLowerCase().trim();
        return (
          normalized === courseNeedle ||
          normalized.includes(courseNeedle) ||
          courseNeedle.includes(normalized)
        );
      })
      .map((source) => source.id);

    const fallbackSourceIdsForSelection = effectiveSourcesForLevel.map(
      (source) => source.id,
    );

    const chunkPool = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId,
        ...((sourceIdsForSelection.length > 0
          ? sourceIdsForSelection
          : fallbackSourceIdsForSelection
        ).length > 0
          ? {
              sourceId: {
                in:
                  sourceIdsForSelection.length > 0
                    ? sourceIdsForSelection
                    : fallbackSourceIdsForSelection,
              },
            }
          : {}),
      },
      select: {
        sourceId: true,
        text: true,
        heading: true,
        yearTag: true,
        metadataJson: true,
      },
      take: 1400,
      orderBy: { createdAt: "desc" },
    });

    const levelScopedChunks = chunkPool.filter((chunk) =>
      chunkMatchesProgrammeLevel(chunk, query.programmeLevel),
    );

    const semesterScopedChunks = levelScopedChunks.filter((chunk) =>
      chunkMatchesSemester(chunk, query.semester),
    );

    const sourceNameById = new Map(
      effectiveSourcesForLevel.map((source) => [source.id, normalizeLabel(source.name)]),
    );

    const semesters = new Set<string>();
    const topics = new Set<string>();
    for (const chunk of levelScopedChunks) {
      const metadata = safeRecord(chunk.metadataJson);
      if (typeof metadata.semester === "string" && metadata.semester.trim()) {
        semesters.add(metadata.semester.trim());
      }
      if (chunk.yearTag && chunk.yearTag.trim().length > 0) {
        semesters.add(chunk.yearTag.trim());
      }
      for (const semester of extractSemesterCandidates(chunk.text)) {
        semesters.add(semester);
      }
    }

    const courses = new Set<string>();
    if (query.semester) {
      for (const chunk of semesterScopedChunks) {
        const metadata = safeRecord(chunk.metadataJson);
        if (typeof metadata.courseTitle === "string" && metadata.courseTitle.trim()) {
          courses.add(normalizeLabel(metadata.courseTitle));
          continue;
        }

        const sourceCourse = sourceNameById.get(chunk.sourceId);
        if (sourceCourse) {
          courses.add(sourceCourse);
        }
      }
    } else {
      // First, try to get course titles from chunk metadata
      for (const chunk of levelScopedChunks) {
        const metadata = safeRecord(chunk.metadataJson);
        if (typeof metadata.courseTitle === "string" && metadata.courseTitle.trim()) {
          courses.add(normalizeLabel(metadata.courseTitle));
        }
      }
      
      // If no course titles found in metadata, fall back to source names
      if (courses.size === 0) {
        for (const source of effectiveSourcesForLevel) {
          const name = normalizeLabel(source.name);
          if (name) {
            courses.add(name);
          }
        }
      }
    }

    for (const chunk of semesterScopedChunks) {
      const metadata = safeRecord(chunk.metadataJson);
      if (typeof metadata.topic === "string" && metadata.topic.trim()) {
        topics.add(metadata.topic.trim());
      }
      if (chunk.heading) {
        const cleanedHeading = cleanHeadingLine(chunk.heading);
        if (cleanedHeading.length >= 5) {
          topics.add(cleanedHeading);
        }
      }
      for (const heading of extractHeadingCandidates(chunk.text)) {
        topics.add(heading);
      }
    }

    const subtopics = new Set<string>();
    if (query.topic) {
      const topicNeedles = splitSearchTerms(query.topic);
      const topicFallbackNeedle = query.topic.toLowerCase().trim();
      const topicChunks = semesterScopedChunks.filter((chunk) => {
        const metadata = safeRecord(chunk.metadataJson);
        const metadataTopic =
          typeof metadata.topic === "string" ? metadata.topic.toLowerCase() : "";
        const haystack = `${chunk.heading ?? ""}\n${chunk.text}`.toLowerCase();
        if (metadataTopic && metadataTopic.includes(topicFallbackNeedle)) {
          return true;
        }
        if (topicNeedles.length > 0) {
          return topicNeedles.some((needle) => haystack.includes(needle));
        }
        return haystack.includes(topicFallbackNeedle);
      });

      for (const chunk of topicChunks) {
        const metadata = safeRecord(chunk.metadataJson);
        if (typeof metadata.subtopic === "string" && metadata.subtopic.trim()) {
          subtopics.add(metadata.subtopic.trim());
        }
        if (chunk.heading) {
          const cleaned = cleanHeadingLine(chunk.heading);
          if (
            cleaned &&
            cleaned.toLowerCase() !== topicFallbackNeedle &&
            !cleaned.toLowerCase().includes(topicFallbackNeedle)
          ) {
            subtopics.add(cleaned);
          }
        }
        for (const heading of extractHeadingCandidates(chunk.text)) {
          if (heading.toLowerCase() !== topicFallbackNeedle) {
            subtopics.add(heading);
          }
        }
      }
    }

    return {
      curriculumVersionId,
      programmeLevels,
      semesters: Array.from(semesters).sort(),
      courses: Array.from(courses).sort().slice(0, query.limit),
      topics: Array.from(topics).sort().slice(0, query.limit),
      subtopics: Array.from(subtopics).sort().slice(0, query.limit),
      minorTopics: [],
    };
  });

  app.post("/planner/suggestions", async (request) => {
    await ensureServiceEnabled(app, "curriculum_planner");
    const body = plannerSuggestionsSchema.parse(request.body);
    const curriculumVersionId = await resolveCurriculumVersionId(
      app,
      body.curriculumVersionId,
    );

    if (!curriculumVersionId) {
      throw app.httpErrors.serviceUnavailable(
        "No active curriculum version available.",
      );
    }

    const outlineSelection = resolveProgrammeOutlineSelection({
      semester: body.semester,
      course: body.course,
      topic: body.topic,
      subtopic: body.subtopic,
      minorTopic: body.minorTopic,
    });

    const hasHierarchyInput = Boolean(
      body.course?.trim() ||
        body.topic?.trim() ||
        body.subtopic?.trim() ||
        body.minorTopic?.trim(),
    );
    if (
      outlineSelection.available &&
      hasHierarchyInput &&
      !outlineSelection.matched
    ) {
      const labelTopic =
        outlineSelection.canonicalMinorTopic?.trim() ||
        outlineSelection.canonicalSubtopic?.trim() ||
        outlineSelection.canonicalTopic?.trim() ||
        outlineSelection.canonicalCourse?.trim() ||
        body.minorTopic?.trim() ||
        body.subtopic?.trim() ||
        body.topic?.trim() ||
        body.course.trim();
      const fallback = buildPlannerFallbackSuggestions(labelTopic, body.limit);
      return {
        curriculumVersionId,
        objectives: fallback.objectives,
        outcomes: fallback.outcomes,
        durationMinutesHint: null,
        sourceCount: 0,
        chunkCount: 0,
      };
    }

    const effectiveCourse = outlineSelection.canonicalCourse ?? body.course;
    const effectiveTopic = outlineSelection.canonicalTopic ?? body.topic;
    const effectiveSubtopic = outlineSelection.canonicalSubtopic ?? body.subtopic;
    const effectiveMinorTopic =
      outlineSelection.canonicalMinorTopic ?? body.minorTopic;

    const sourceCandidates = await app.prisma.curriculumSource.findMany({
      where: {
        status: "indexed",
        versions: {
          some: {
            curriculumVersionId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        programme: true,
      },
      take: 1000,
    });

    const sourcesByProgramme = sourceCandidates.filter((source) =>
      sourceMatchesProgramme(source, body.programme),
    );

    const sourcesByLevel = sourcesByProgramme.filter((source) =>
      sourceMatchesProgrammeLevel(source, body.programmeLevel),
    );
    const effectiveSourcesForLevel =
      sourcesByLevel.length > 0 ? sourcesByLevel : sourcesByProgramme;

    const courseNeedles = [body.course, effectiveCourse]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.toLowerCase().trim());

    const matchingSourceIds = effectiveSourcesForLevel
      .filter(
        (source) => {
          const sourceName = normalizeLabel(source.name).toLowerCase();
          return courseNeedles.some(
            (courseName) =>
              sourceName === courseName ||
              sourceName.includes(courseName) ||
              courseName.includes(sourceName),
          );
        },
      )
      .map((source) => source.id);

    const fallbackSourceIds = effectiveSourcesForLevel.map((source) => source.id);
    const resolvedSourceIds =
      matchingSourceIds.length > 0 ? matchingSourceIds : fallbackSourceIds;

    const labelTopic =
      effectiveMinorTopic?.trim() ||
      effectiveSubtopic?.trim() ||
      effectiveTopic?.trim() ||
      effectiveCourse.trim();
    if (resolvedSourceIds.length === 0) {
      const fallback = buildPlannerFallbackSuggestions(labelTopic, body.limit);
      return {
        curriculumVersionId,
        objectives: fallback.objectives,
        outcomes: fallback.outcomes,
        durationMinutesHint: null,
        sourceCount: 0,
        chunkCount: 0,
      };
    }

    const whereBase = {
      curriculumVersionId,
      sourceId: {
        in: resolvedSourceIds,
      },
    };

    const topicNeedles = [effectiveTopic, effectiveSubtopic, effectiveMinorTopic]
      .filter((value): value is string => Boolean(value && value.trim()))
      .flatMap((value) => splitSearchTerms(value.trim()));

    const chunks = await app.prisma.curriculumChunk.findMany({
      where: {
        ...whereBase,
      },
      select: {
        text: true,
        heading: true,
        yearTag: true,
        metadataJson: true,
        sourceId: true,
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const levelScopedChunks = chunks.filter((chunk) =>
      chunkMatchesProgrammeLevel(chunk, body.programmeLevel),
    );

    const semesterScopedChunks = levelScopedChunks.filter((chunk) =>
      chunkMatchesSemester(chunk, body.semester),
    );

    const rankedChunks = semesterScopedChunks
      .map((chunk) => {
        const haystack = `${chunk.heading ?? ""}\n${chunk.text}`;
        return {
          chunk,
          score: scoreByNeedles(haystack, topicNeedles),
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.chunk);

    const selectedChunks =
      topicNeedles.length > 0
        ? rankedChunks
            .filter((chunk) => {
              const haystack = `${chunk.heading ?? ""}\n${chunk.text}`.toLowerCase();
              return topicNeedles.some((needle) => haystack.includes(needle));
            })
            .slice(0, Math.max(body.limit * 20, 120))
        : rankedChunks.slice(0, Math.max(body.limit * 20, 120));

    const aggregateObjectives = new Set<string>();
    const aggregateOutcomes = new Set<string>();
    const durationHints = new Map<number, number>();

    for (const chunk of selectedChunks) {
      const extracted = extractObjectivesAndOutcomes(chunk.text);
      for (const item of extracted.objectives) {
        aggregateObjectives.add(item);
      }
      for (const item of extracted.outcomes) {
        aggregateOutcomes.add(item);
      }

      const durationFromMetadata = parseDurationMinutesFromMetadata(
        chunk.metadataJson,
      );
      if (durationFromMetadata) {
        durationHints.set(
          durationFromMetadata,
          (durationHints.get(durationFromMetadata) ?? 0) + 2,
        );
      }

      const durationFromText = parseDurationMinutesFromText(chunk.text);
      if (durationFromText) {
        durationHints.set(
          durationFromText,
          (durationHints.get(durationFromText) ?? 0) + 1,
        );
      }
    }

    if (aggregateObjectives.size === 0 && labelTopic.length > 0) {
      aggregateObjectives.add(`Introduce foundational concepts in ${labelTopic}.`);
      aggregateObjectives.add(`Guide learners through key clinical teaching points for ${labelTopic}.`);
      aggregateObjectives.add(`Support learners to interpret curriculum requirements for ${labelTopic}.`);
    }

    if (aggregateOutcomes.size === 0 && labelTopic.length > 0) {
      aggregateOutcomes.add(`Learners can explain the essential principles of ${labelTopic}.`);
      aggregateOutcomes.add(`Learners can apply ${labelTopic} knowledge in structured clinical scenarios.`);
      aggregateOutcomes.add(`Learners can evaluate safe practice considerations related to ${labelTopic}.`);
    }

    const durationMinutesHint =
      durationHints.size > 0
        ? Array.from(durationHints.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        : null;

    return {
      curriculumVersionId,
      objectives: Array.from(aggregateObjectives).slice(0, body.limit),
      outcomes: Array.from(aggregateOutcomes).slice(0, body.limit),
      durationMinutesHint,
      sourceCount: new Set(selectedChunks.map((chunk) => chunk.sourceId)).size,
      chunkCount: selectedChunks.length,
    };
  });
};

export default curriculumRoutes;
