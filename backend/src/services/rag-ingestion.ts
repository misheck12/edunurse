import { createHash, randomUUID } from "node:crypto";
import {
  ConnectorType,
  ConnectorRunStatus,
  Prisma,
  PrismaClient,
  SourceType,
} from "@prisma/client";
import { env } from "../config.js";
import { fetchConnectorDocuments } from "./rag-connectors/adapters.js";
import {
  embedTextsWithFallback,
  vectorToSqlLiteral,
} from "./embeddings.js";

const CURRICULUM_PARSER_VERSION = "2026-02-14-structured-v4-hierarchy-span";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function checksum(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function parserVersionFromMetadata(metadata: unknown) {
  const record = safeRecord(metadata);
  return typeof record.parserVersion === "string" ? record.parserVersion : null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function toEmbeddingInput(text: string) {
  const normalized = sanitizeCurriculumText(text);
  // Keep input bounded to avoid provider limits while preserving context.
  return normalized.slice(0, 8000);
}

async function updateChunkEmbedding(
  prisma: PrismaClient,
  chunkId: string,
  vector: number[],
) {
  if (!isUuid(chunkId)) {
    return;
  }
  const vectorLiteral = vectorToSqlLiteral(vector);
  await prisma.$executeRawUnsafe(
    `UPDATE curriculum_chunks SET embedding='${vectorLiteral}'::vector WHERE id='${chunkId}'::uuid`,
  );
}

function sanitizeLine(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/[\u2012-\u2015]/g, "-")
    .trim();
}

function isPageNoiseLine(line: string) {
  const value = line.toLowerCase();
  if (!value) return false;
  if (/^page\s+\d+(\s+of\s+\d+)?$/.test(value)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(value)) return true;
  if (/^p\.\s*\d+(\s*of\s*\d+)?$/.test(value)) return true;
  return false;
}

function shouldDropRepeatedLine(line: string, count: number) {
  if (count < 4) return false;
  if (line.length < 6 || line.length > 120) return false;

  // Typical repeated header/footer fragments.
  if (line.includes("copyright")) return true;
  if (line.includes("nursing") || line.includes("midwifery")) return true;
  if (line.includes("council") || line.includes("syllabus")) return true;

  // Generic repeated line fallback.
  return true;
}

function sanitizeCurriculumText(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n").map(sanitizeLine);
  const frequency = new Map<string, number>();

  for (const line of rawLines) {
    if (!line) continue;
    const key = line.toLowerCase();
    frequency.set(key, (frequency.get(key) ?? 0) + 1);
  }

  const cleanedLines: string[] = [];
  for (const line of rawLines) {
    if (!line) {
      cleanedLines.push("");
      continue;
    }

    if (isPageNoiseLine(line)) {
      continue;
    }

    const lower = line.toLowerCase();
    const count = frequency.get(lower) ?? 0;
    if (shouldDropRepeatedLine(lower, count)) {
      continue;
    }

    cleanedLines.push(line);
  }

  return cleanedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ChunkContext = {
  programmeTag?: string | null;
  programmeLevel?: string | null;
  yearTag?: string | null;
  semester?: string | null;
  unit?: string | null;
  section?: string | null;
  difficultyLevel?: string | null;
  courseCode?: string | null;
  courseTitle?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  durationHours?: number | null;
  durationText?: string | null;
};

type StructuredChunk = {
  text: string;
  heading: string | null;
  programmeTag: string | null;
  yearTag: string | null;
  courseCode: string | null;
  metadata: Record<string, unknown>;
};

type HierarchyNodeType = "course" | "unit" | "section" | "subsection";

type HierarchyNodeDraft = {
  nodeType: HierarchyNodeType;
  code: string | null;
  title: string;
  path: string;
  parentPath: string | null;
  depth: number;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function normalizeHeadingText(value: string) {
  return value
    .replace(/^[\-\*\u2022]\s*/, "")
    .replace(/^\d+(\.\d+)*[\)\.\-]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProgrammeFromText(text: string) {
  const value = text.toLowerCase();
  if (value.includes("midwifery")) return "Midwifery";
  if (value.includes("public health nursing")) return "Public Health Nursing";
  if (value.includes("nursing")) return "Nursing";
  return null;
}

function parseProgrammeLevelFromText(text: string) {
  const value = text.toLowerCase();
  if (value.includes("bsc") || value.includes("bachelor")) return "BSc";
  if (value.includes("diploma")) return "Diploma";
  return null;
}

function parseAcademicIndexToken(token: string) {
  const normalized = token.toLowerCase().trim();
  if (/^[1-8]$/.test(normalized)) return normalized;

  const wordMap: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
  };

  return wordMap[normalized] ?? null;
}

function parseSemesterTag(text: string) {
  const combined = text.match(
    /\byear\s*(one|two|three|four|five|six|seven|eight|[1-8])\s*[-, ]+\s*(semester|term)\s*(one|two|three|four|five|six|seven|eight|[1-8])\b/i,
  );
  if (combined?.[1] && combined[3]) {
    const year = parseAcademicIndexToken(combined[1]);
    const semester = parseAcademicIndexToken(combined[3]);
    if (year && semester) {
      return `Year ${year} - Semester ${semester}`;
    }
  }

  const semesterOnly = text.match(
    /\b(semester|term)\s*(one|two|three|four|five|six|seven|eight|[1-8])\b/i,
  );
  if (semesterOnly?.[2]) {
    const semester = parseAcademicIndexToken(semesterOnly[2]);
    if (semester) {
      return `Semester ${semester}`;
    }
  }

  const yearOnly = text.match(
    /\byear\s*(one|two|three|four|five|six|seven|eight|[1-8])\b/i,
  );
  if (yearOnly?.[1]) {
    const year = parseAcademicIndexToken(yearOnly[1]);
    if (year) {
      return `Year ${year}`;
    }
  }

  return null;
}

function parseCourseCode(text: string) {
  const match = text.match(/\b([A-Z]{2,6}\s?-?\s?\d{2,4}[A-Z]?)\b/);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function parseCourseTitle(text: string) {
  const normalized = normalizeHeadingText(text);
  const prefixed = normalized.match(/^(course|module|subject)\s*[:\-]\s*(.+)$/i);
  if (prefixed?.[2]) {
    return titleCase(prefixed[2]);
  }

  if (parseCourseCode(normalized)) {
    const withoutCode = normalized.replace(/\b[A-Z]{2,6}\s?-?\s?\d{2,4}[A-Z]?\b/, "").trim();
    if (withoutCode.length >= 5) {
      return titleCase(withoutCode);
    }
  }

  return null;
}

function parseCourseTitleFromFileName(fileName: string) {
  const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, "");
  const stripped = withoutExt
    .replace(/^~\$\s*/i, "")
    .replace(/^\d+\s*[\.\-_]\s*/g, "")
    .replace(/\bfinal\b/gi, "")
    .replace(/\bmodule\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length < 4) {
    return null;
  }

  return titleCase(stripped);
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function deriveDocumentSeedContext(
  document: {
    title: string;
    metadata?: Record<string, unknown>;
  },
  fallbackProgramme: string | null,
) {
  const metadata = safeRecord(document.metadata);
  const drivePathSegments = parseStringArray(metadata.drivePathSegments);
  const drivePathText = drivePathSegments.join(" ");
  const semesterFromPath =
    parseSemesterTag(drivePathText) ||
    parseSemesterTag(typeof metadata.driveFolderHint === "string" ? metadata.driveFolderHint : "");
  const programmeFromPath =
    parseProgrammeFromText(drivePathText) || parseProgrammeFromText(document.title);
  const programmeLevelFromPath =
    parseProgrammeLevelFromText(drivePathText) ||
    parseProgrammeLevelFromText(document.title);
  const courseTitleFromFile =
    parseCourseTitleFromFileName(document.title) || parseCourseTitle(document.title);

  const seedContext: ChunkContext = {
    programmeTag: programmeFromPath ?? fallbackProgramme,
    programmeLevel: programmeLevelFromPath,
    yearTag: semesterFromPath,
    semester: semesterFromPath,
    courseTitle: courseTitleFromFile,
    topic: courseTitleFromFile,
  };

  return {
    seedContext,
    drivePathSegments,
    programmeLevelFromPath,
  };
}

function parseDurationFromText(text: string) {
  const direct = text.match(
    /\b(\d{1,3}(?:\.\d+)?)\s*(credit\s*)?(hours?|hrs?|hr|h)\b/i,
  );
  if (direct?.[1]) {
    const hours = Number(direct[1]);
    if (Number.isFinite(hours)) {
      return {
        durationHours: hours,
        durationText: direct[0],
      };
    }
  }

  const range = text.match(
    /\b(\d{1,3})\s*-\s*(\d{1,3})\s*(hours?|hrs?|hr|h)\b/i,
  );
  if (range?.[1] && range[2]) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return {
        durationHours: Number(((low + high) / 2).toFixed(2)),
        durationText: range[0],
      };
    }
  }

  return null;
}

function parseTopicContext(line: string) {
  const clean = normalizeHeadingText(line);
  if (!clean || clean.length < 4) return null;

  const topicPrefixed = clean.match(/^topic\s*[:\-]\s*(.+)$/i);
  if (topicPrefixed?.[1]) {
    return { topic: titleCase(topicPrefixed[1]), subtopic: null as string | null };
  }

  const subtopicPrefixed = clean.match(/^subtopic\s*[:\-]\s*(.+)$/i);
  if (subtopicPrefixed?.[1]) {
    return { topic: null as string | null, subtopic: titleCase(subtopicPrefixed[1]) };
  }

  if (/^\d+\.\d+\s+/.test(line)) {
    return { topic: null as string | null, subtopic: titleCase(clean) };
  }

  if (/^\d+\s+/.test(line) || /^\d+\.\s+/.test(line)) {
    return { topic: titleCase(clean), subtopic: null as string | null };
  }

  const looksLikeHeading =
    clean.length <= 110 &&
    clean.split(" ").length <= 14 &&
    !clean.endsWith(".") &&
    !clean.endsWith(";") &&
    !clean.endsWith(",");

  if (looksLikeHeading && /^[A-Z0-9][A-Za-z0-9\s,&/()'-]+$/.test(clean)) {
    return { topic: titleCase(clean), subtopic: null as string | null };
  }

  return null;
}

function parseUnitTag(line: string) {
  const match = line.match(/\bunit\s*([ivxlcdm]+|\d+)\b/i);
  if (!match?.[1]) return null;
  const token = match[1];
  const value = /^\d+$/.test(token) ? token : token.toUpperCase();
  return `Unit ${value}`;
}

function parseSectionTag(line: string) {
  const sectionKeyword = line.match(/\bsection\s*([a-z0-9]+(?:\.[a-z0-9]+)*)\b/i);
  if (sectionKeyword?.[1]) {
    return `Section ${sectionKeyword[1]}`;
  }

  const numericPrefix = line.trim().match(/^(\d+(?:\.\d+){1,3})\b/);
  if (numericPrefix?.[1]) {
    return `Section ${numericPrefix[1]}`;
  }

  return null;
}

function inferDifficultyLevel(context: ChunkContext) {
  const programmeLevel = (context.programmeLevel ?? "").toLowerCase();
  if (programmeLevel.includes("bsc") || programmeLevel.includes("bachelor")) {
    return "advanced";
  }

  const yearTag = (context.yearTag ?? "").toLowerCase();
  if (/\byear\s*[4-9]\b/.test(yearTag)) return "advanced";
  if (/\byear\s*3\b/.test(yearTag)) return "advanced";
  if (/\byear\s*2\b/.test(yearTag)) return "intermediate";
  if (/\byear\s*1\b/.test(yearTag)) return "basic";

  return context.difficultyLevel ?? null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseUnitLine(line: string) {
  const match = line.match(/^\s*unit\s*([ivxlcdm]+|\d+)\s*[:\-]?\s*(.+)?$/i);
  if (!match?.[1]) return null;
  const code = match[1].toUpperCase();
  const title = normalizeHeadingText(match[2] ?? "").trim();
  return {
    code,
    title: title || `Unit ${code}`,
  };
}

function parseSectionLine(line: string) {
  const match = line.match(/^\s*(\d+\.\d+)\s+(.{2,})$/);
  if (!match?.[1] || !match[2]) return null;
  return {
    code: match[1],
    title: normalizeHeadingText(match[2]),
  };
}

function parseSubsectionLine(line: string) {
  const match = line.match(/^\s*(\d+\.\d+\.\d+(?:\.\d+)?)\s+(.{2,})$/);
  if (!match?.[1] || !match[2]) return null;
  return {
    code: match[1],
    title: normalizeHeadingText(match[2]),
  };
}

function pickCourseTitleFromText(text: string, fallback: string) {
  const lines = text
    .split("\n")
    .map((line) => normalizeHeadingText(line))
    .filter(Boolean)
    .slice(0, 80);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("unit ")) continue;
    if (/^\d+\.\d+/.test(line)) continue;
    if (line.length < 5 || line.length > 120) continue;
    if (
      /^[A-Z][A-Za-z0-9\s,&/()'-]+$/.test(line) &&
      line.split(" ").length <= 14
    ) {
      return titleCase(line);
    }
  }

  return fallback;
}

function sectionToUnitCode(sectionCode: string) {
  return sectionCode.split(".")[0] ?? "";
}

function buildHierarchyNodeDrafts(input: {
  text: string;
  sourceFileName: string;
  fallbackProgramme: string | null;
  seedContext: ChunkContext;
}) {
  const fallbackCourse =
    input.seedContext.courseTitle ??
    parseCourseTitleFromFileName(input.sourceFileName) ??
    titleCase(input.sourceFileName.replace(/\.[a-z0-9]+$/i, ""));
  const courseTitle = pickCourseTitleFromText(input.text, fallbackCourse);
  const coursePath = `course:${slugify(courseTitle) || "untitled-course"}`;

  const drafts: HierarchyNodeDraft[] = [];
  const byPath = new Map<string, HierarchyNodeDraft>();
  const headingLineByPath = new Map<string, number>();
  let sortOrder = 0;

  const pushNode = (draft: HierarchyNodeDraft) => {
    if (byPath.has(draft.path)) return byPath.get(draft.path)!;
    byPath.set(draft.path, draft);
    drafts.push(draft);
    return draft;
  };

  pushNode({
    nodeType: "course",
    code: null,
    title: courseTitle,
    path: coursePath,
    parentPath: null,
    depth: 0,
    sortOrder: sortOrder++,
    metadata: {
      programme: input.fallbackProgramme ?? undefined,
      programmeLevel: input.seedContext.programmeLevel ?? undefined,
      semester: input.seedContext.semester ?? undefined,
      sourceFileName: input.sourceFileName,
    },
  });
  headingLineByPath.set(coursePath, 0);

  let currentUnitPath: string | null = null;
  let currentSectionPath: string | null = null;

  const sourceLines = input.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines = sourceLines
    .map((line, lineIndex) => ({ line: line.trim(), lineIndex }))
    .filter((item) => Boolean(item.line));

  for (const { line: rawLine, lineIndex } of lines) {
    const subsection = parseSubsectionLine(rawLine);
    if (subsection) {
      const unitCode = sectionToUnitCode(subsection.code);
      if (!currentUnitPath || !currentUnitPath.endsWith(`/unit:${unitCode.toLowerCase()}`)) {
        const unitPath = `${coursePath}/unit:${unitCode.toLowerCase()}`;
        pushNode({
          nodeType: "unit",
          code: unitCode,
          title: `Unit ${unitCode}`,
          path: unitPath,
          parentPath: coursePath,
          depth: 1,
          sortOrder: sortOrder++,
          metadata: {
            programme: input.fallbackProgramme ?? undefined,
            semester: input.seedContext.semester ?? undefined,
            sourceFileName: input.sourceFileName,
          },
        });
        currentUnitPath = unitPath;
        if (!headingLineByPath.has(unitPath)) {
          headingLineByPath.set(unitPath, lineIndex);
        }
      }

      const sectionCode = subsection.code.split(".").slice(0, 2).join(".");
      const sectionPath = `${currentUnitPath}/section:${sectionCode}`;
      if (!byPath.has(sectionPath)) {
        pushNode({
          nodeType: "section",
          code: sectionCode,
          title: `Section ${sectionCode}`,
          path: sectionPath,
          parentPath: currentUnitPath,
          depth: 2,
          sortOrder: sortOrder++,
          metadata: {
            programme: input.fallbackProgramme ?? undefined,
            semester: input.seedContext.semester ?? undefined,
            sourceFileName: input.sourceFileName,
          },
        });
        if (!headingLineByPath.has(sectionPath)) {
          headingLineByPath.set(sectionPath, lineIndex);
        }
      }
      currentSectionPath = sectionPath;

      pushNode({
        nodeType: "subsection",
        code: subsection.code,
        title: subsection.title,
        path: `${sectionPath}/subsection:${subsection.code}`,
        parentPath: sectionPath,
        depth: 3,
        sortOrder: sortOrder++,
        metadata: {
          unit: unitCode,
          section: sectionCode,
          programme: input.fallbackProgramme ?? undefined,
          semester: input.seedContext.semester ?? undefined,
          sourceFileName: input.sourceFileName,
        },
      });
      const subsectionPath = `${sectionPath}/subsection:${subsection.code}`;
      if (!headingLineByPath.has(subsectionPath)) {
        headingLineByPath.set(subsectionPath, lineIndex);
      }
      continue;
    }

    const section = parseSectionLine(rawLine);
    if (section) {
      const unitCode = sectionToUnitCode(section.code);
      const unitPath = `${coursePath}/unit:${unitCode.toLowerCase()}`;
      if (!byPath.has(unitPath)) {
        pushNode({
          nodeType: "unit",
          code: unitCode,
          title: `Unit ${unitCode}`,
          path: unitPath,
          parentPath: coursePath,
          depth: 1,
          sortOrder: sortOrder++,
          metadata: {
            programme: input.fallbackProgramme ?? undefined,
            semester: input.seedContext.semester ?? undefined,
            sourceFileName: input.sourceFileName,
          },
        });
        if (!headingLineByPath.has(unitPath)) {
          headingLineByPath.set(unitPath, lineIndex);
        }
      }
      currentUnitPath = unitPath;

      const sectionPath = `${unitPath}/section:${section.code}`;
      pushNode({
        nodeType: "section",
        code: section.code,
        title: section.title,
        path: sectionPath,
        parentPath: unitPath,
        depth: 2,
        sortOrder: sortOrder++,
        metadata: {
          unit: unitCode,
          programme: input.fallbackProgramme ?? undefined,
          semester: input.seedContext.semester ?? undefined,
          sourceFileName: input.sourceFileName,
        },
      });
      if (!headingLineByPath.has(sectionPath)) {
        headingLineByPath.set(sectionPath, lineIndex);
      }
      currentSectionPath = sectionPath;
      continue;
    }

    const unit = parseUnitLine(rawLine);
    if (unit) {
      const unitPath = `${coursePath}/unit:${unit.code.toLowerCase()}`;
      pushNode({
        nodeType: "unit",
        code: unit.code,
        title: unit.title,
        path: unitPath,
        parentPath: coursePath,
        depth: 1,
        sortOrder: sortOrder++,
        metadata: {
          programme: input.fallbackProgramme ?? undefined,
          semester: input.seedContext.semester ?? undefined,
          sourceFileName: input.sourceFileName,
        },
      });
      currentUnitPath = unitPath;
      currentSectionPath = null;
      if (!headingLineByPath.has(unitPath)) {
        headingLineByPath.set(unitPath, lineIndex);
      }
    }
  }

  const headingMarkers = drafts
    .map((draft) => ({
      path: draft.path,
      depth: draft.depth,
      lineIndex: Math.max(0, headingLineByPath.get(draft.path) ?? 0),
    }))
    .sort((a, b) => a.lineIndex - b.lineIndex || a.depth - b.depth);

  const markerIndexByPath = new Map<string, number>();
  for (let i = 0; i < headingMarkers.length; i += 1) {
    const marker = headingMarkers[i];
    if (!markerIndexByPath.has(marker.path)) {
      markerIndexByPath.set(marker.path, i);
    }
  }

  const MAX_NODE_CONTENT_CHARS = 3600;
  for (const draft of drafts) {
    const markerIndex = markerIndexByPath.get(draft.path);
    if (markerIndex === undefined) continue;
    const marker = headingMarkers[markerIndex];

    let endLine = sourceLines.length - 1;
    for (let nextIndex = markerIndex + 1; nextIndex < headingMarkers.length; nextIndex += 1) {
      const next = headingMarkers[nextIndex];
      if (next.lineIndex <= marker.lineIndex) continue;
      if (next.depth <= marker.depth) {
        endLine = Math.max(marker.lineIndex, next.lineIndex - 1);
        break;
      }
    }

    const contentLines = sourceLines
      .slice(Math.min(marker.lineIndex + 1, sourceLines.length), endLine + 1)
      .map((line) => line.trim())
      .filter(Boolean);
    const contentText = sanitizeCurriculumText(contentLines.join("\n"));
    const fullLength = contentText.length;

    draft.metadata.contentStartLine = marker.lineIndex + 1;
    draft.metadata.contentEndLine = endLine + 1;
    draft.metadata.contentCharCount = fullLength;
    if (fullLength > 0) {
      draft.metadata.contentText = contentText.slice(0, MAX_NODE_CONTENT_CHARS);
      draft.metadata.contentTruncated = fullLength > MAX_NODE_CONTENT_CHARS;
    } else {
      draft.metadata.contentText = "";
      draft.metadata.contentTruncated = false;
    }
  }

  return drafts;
}

async function persistHierarchyNodeDrafts(
  prisma: PrismaClient,
  input: {
    curriculumVersionId: string;
    sourceId: string;
    drafts: HierarchyNodeDraft[];
  },
) {
  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM curriculum_hierarchy_nodes
      WHERE curriculum_version_id = CAST(${input.curriculumVersionId} AS uuid)
        AND source_id = CAST(${input.sourceId} AS uuid)
    `,
  );

  const idByPath = new Map<string, string>();
  const orderedDrafts = [...input.drafts].sort(
    (a, b) =>
      a.depth - b.depth || a.sortOrder - b.sortOrder || a.path.localeCompare(b.path),
  );

  for (const draft of orderedDrafts) {
    const id = randomUUID();
    const parentId = draft.parentPath ? idByPath.get(draft.parentPath) ?? null : null;
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO curriculum_hierarchy_nodes
          (id, curriculum_version_id, source_id, parent_id, node_type, code, title, path, depth, sort_order, metadata_json, created_at, updated_at)
        VALUES
          (
            CAST(${id} AS uuid),
            CAST(${input.curriculumVersionId} AS uuid),
            CAST(${input.sourceId} AS uuid),
            CAST(${parentId} AS uuid),
            ${draft.nodeType},
            ${draft.code},
            ${draft.title},
            ${draft.path},
            ${draft.depth},
            ${draft.sortOrder},
            CAST(${toJson(draft.metadata)} AS jsonb),
            NOW(),
            NOW()
          )
      `,
    );
    idByPath.set(draft.path, id);
  }
}

function updateContextFromParagraph(
  context: ChunkContext,
  paragraph: string,
  fallbackProgramme: string | null,
) {
  const next: ChunkContext = { ...context };
  const lines = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  for (const line of lines) {
    const programme = parseProgrammeFromText(line);
    if (programme) {
      next.programmeTag = programme;
    }

    const programmeLevel = parseProgrammeLevelFromText(line);
    if (programmeLevel) {
      next.programmeLevel = programmeLevel;
    }

    const semesterTag = parseSemesterTag(line);
    if (semesterTag) {
      next.yearTag = semesterTag;
      next.semester = semesterTag;
    }

    const courseCode = parseCourseCode(line);
    if (courseCode) {
      next.courseCode = courseCode;
    }

    const courseTitle = parseCourseTitle(line);
    if (courseTitle) {
      next.courseTitle = courseTitle;
    }

    const unit = parseUnitTag(line);
    if (unit) {
      next.unit = unit;
    }

    const section = parseSectionTag(line);
    if (section) {
      next.section = section;
    }

    const topicCtx = parseTopicContext(line);
    if (topicCtx?.topic) {
      next.topic = topicCtx.topic;
      if (!topicCtx.subtopic) {
        next.subtopic = null;
      }
    }
    if (topicCtx?.subtopic) {
      next.subtopic = topicCtx.subtopic;
    }

    const duration = parseDurationFromText(line);
    if (duration) {
      next.durationHours = duration.durationHours;
      next.durationText = duration.durationText;
    }
  }

  if (!next.programmeTag && fallbackProgramme) {
    next.programmeTag = fallbackProgramme;
  }
  next.difficultyLevel = inferDifficultyLevel(next);

  return next;
}

function chunkHeading(contexts: ChunkContext[], fallbackHeading: string) {
  for (let i = contexts.length - 1; i >= 0; i -= 1) {
    const context = contexts[i];
    if (context.subtopic) return context.subtopic;
    if (context.topic) return context.topic;
    if (context.courseTitle) return context.courseTitle;
  }
  return fallbackHeading;
}

function resolveLatestValue<T>(contexts: ChunkContext[], getter: (context: ChunkContext) => T | null | undefined) {
  for (let i = contexts.length - 1; i >= 0; i -= 1) {
    const value = getter(contexts[i]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function splitIntoStructuredChunks(
  text: string,
  chunkSize: number,
  overlap: number,
  fallbackHeading: string,
  fallbackProgramme: string | null,
  seedContext?: ChunkContext,
) {
  const safeText = sanitizeCurriculumText(text);
  if (!safeText) return [] as StructuredChunk[];

  const paragraphs = safeText
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);

  const contextualParagraphs: Array<{ text: string; context: ChunkContext }> = [];
  let currentContext: ChunkContext = {
    ...seedContext,
    programmeTag: seedContext?.programmeTag ?? fallbackProgramme,
  };

  for (const paragraph of paragraphs) {
    currentContext = updateContextFromParagraph(
      currentContext,
      paragraph,
      fallbackProgramme,
    );
    contextualParagraphs.push({
      text: paragraph,
      context: { ...currentContext },
    });
  }

  const chunks: StructuredChunk[] = [];

  const finalize = (chunkText: string, contexts: ChunkContext[]) => {
    const textValue = sanitizeCurriculumText(chunkText);
    if (!textValue || textValue.length < 20) return;

    const heading = chunkHeading(contexts, fallbackHeading);
    const yearTag = resolveLatestValue(contexts, (ctx) => ctx.yearTag);
    const courseCode = resolveLatestValue(contexts, (ctx) => ctx.courseCode);
    const programmeTag =
      resolveLatestValue(contexts, (ctx) => ctx.programmeTag) ?? fallbackProgramme;
    const programmeLevel = resolveLatestValue(contexts, (ctx) => ctx.programmeLevel);
    const courseTitle = resolveLatestValue(contexts, (ctx) => ctx.courseTitle);
    const topic = resolveLatestValue(contexts, (ctx) => ctx.topic);
    const subtopic = resolveLatestValue(contexts, (ctx) => ctx.subtopic);
    const unit = resolveLatestValue(contexts, (ctx) => ctx.unit);
    const section = resolveLatestValue(contexts, (ctx) => ctx.section);
    const difficultyLevel = resolveLatestValue(contexts, (ctx) => ctx.difficultyLevel);
    const durationHours = resolveLatestValue(contexts, (ctx) => ctx.durationHours);
    const durationText = resolveLatestValue(contexts, (ctx) => ctx.durationText);

    chunks.push({
      text: textValue,
      heading: heading ?? fallbackHeading,
      programmeTag: programmeTag ?? null,
      yearTag: yearTag ?? null,
      courseCode: courseCode ?? null,
      metadata: {
        courseTitle: courseTitle ?? undefined,
        topic: topic ?? undefined,
        subtopic: subtopic ?? undefined,
        semester: yearTag ?? undefined,
        programmeLevel: programmeLevel ?? undefined,
        unit: unit ?? undefined,
        section: section ?? undefined,
        difficultyLevel: difficultyLevel ?? undefined,
        durationHours: durationHours ?? undefined,
        durationText: durationText ?? undefined,
      },
    });
  };

  let currentText = "";
  let currentContexts: ChunkContext[] = [];

  for (const paragraph of contextualParagraphs) {
    const candidate = currentText ? `${currentText}\n\n${paragraph.text}` : paragraph.text;
    if (candidate.length <= chunkSize) {
      currentText = candidate;
      currentContexts.push(paragraph.context);
      continue;
    }

    if (currentText) {
      finalize(currentText, currentContexts);
    }

    if (paragraph.text.length <= chunkSize) {
      currentText = paragraph.text;
      currentContexts = [paragraph.context];
      continue;
    }

    let start = 0;
    while (start < paragraph.text.length) {
      const end = Math.min(start + chunkSize, paragraph.text.length);
      const piece = paragraph.text.slice(start, end);
      finalize(piece, [paragraph.context]);
      if (end === paragraph.text.length) break;
      start = Math.max(0, end - overlap);
    }
    currentText = "";
    currentContexts = [];
  }

  if (currentText) {
    finalize(currentText, currentContexts);
  }

  return chunks;
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function configuredProgramme(rawConfig: unknown) {
  const config = safeRecord(rawConfig);
  if (typeof config.programme !== "string") {
    return null;
  }
  const value = config.programme.trim();
  return value.length > 0 ? value : null;
}

function connectorSourceType(rawConfig: unknown): SourceType {
  const config = safeRecord(rawConfig);
  const sourceType = config.sourceType;

  if (
    sourceType === "syllabus" ||
    sourceType === "standards" ||
    sourceType === "guideline"
  ) {
    return sourceType;
  }

  return "guideline";
}

async function resolveCurriculumVersionId(prisma: PrismaClient, connectorId: string) {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
    select: {
      id: true,
      defaultCurriculumVersionId: true,
    },
  });

  if (!connector) {
    throw new Error("Connector not found.");
  }

  if (connector.defaultCurriculumVersionId) {
    return connector.defaultCurriculumVersionId;
  }

  const active = await prisma.curriculumVersion.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (!active) {
    throw new Error("No curriculum version available for ingestion.");
  }

  return active.id;
}

type ParsedGoogleSecret = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType?: string;
  scope?: string;
};

function parseGoogleSecret(secretRaw: unknown): ParsedGoogleSecret {
  const secret = safeRecord(secretRaw);
  const googleOAuth = safeRecord(secret.googleOAuth);

  const accessToken =
    (typeof googleOAuth.accessToken === "string" && googleOAuth.accessToken) ||
    (typeof secret.accessToken === "string" ? secret.accessToken : "");
  const refreshToken =
    (typeof googleOAuth.refreshToken === "string" && googleOAuth.refreshToken) ||
    (typeof secret.refreshToken === "string" ? secret.refreshToken : "");
  const expiresAtRaw =
    (typeof googleOAuth.expiresAt === "string" && googleOAuth.expiresAt) ||
    (typeof secret.expiresAt === "string" ? secret.expiresAt : "");
  const expiresAt = expiresAtRaw ? Date.parse(expiresAtRaw) : 0;

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    tokenType:
      (typeof googleOAuth.tokenType === "string" && googleOAuth.tokenType) ||
      (typeof secret.tokenType === "string" ? secret.tokenType : undefined),
    scope:
      (typeof googleOAuth.scope === "string" && googleOAuth.scope) ||
      (typeof secret.scope === "string" ? secret.scope : undefined),
  };
}

function toGoogleSecretJson(secret: ParsedGoogleSecret): Record<string, unknown> {
  const expiresAtIso = new Date(secret.expiresAt).toISOString();
  return {
    accessToken: secret.accessToken,
    refreshToken: secret.refreshToken || undefined,
    expiresAt: expiresAtIso,
    tokenType: secret.tokenType,
    scope: secret.scope,
    googleOAuth: {
      accessToken: secret.accessToken,
      refreshToken: secret.refreshToken || undefined,
      expiresAt: expiresAtIso,
      tokenType: secret.tokenType,
      scope: secret.scope,
    },
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.CONNECTOR_HTTP_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshGoogleAccessToken(refreshToken: string) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth refresh requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const details = body.error_description ?? body.error ?? "OAuth refresh failed.";
    throw new Error(`Google OAuth refresh failed: ${details}`);
  }

  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: body.scope,
    tokenType: body.token_type,
  };
}

async function resolveConnectorFetchPayload(
  prisma: PrismaClient,
  connector: {
    id: string;
    connectorType: ConnectorType;
    configJson: Prisma.JsonValue;
    secretJson: Prisma.JsonValue | null;
  },
) {
  const configJson = safeRecord(connector.configJson);
  let secretJson = safeRecord(connector.secretJson);

  if (connector.connectorType !== "google_drive") {
    return { configJson, secretJson };
  }

  const parsedSecret = parseGoogleSecret(secretJson);
  let current: ParsedGoogleSecret = { ...parsedSecret };

  if (
    current.refreshToken &&
    (!current.accessToken ||
      (current.expiresAt > 0 && Date.now() >= current.expiresAt - 30_000))
  ) {
    const refreshed = await refreshGoogleAccessToken(current.refreshToken);
    current = {
      ...current,
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope ?? current.scope,
      tokenType: refreshed.tokenType ?? current.tokenType,
    };
    secretJson = toGoogleSecretJson(current);

    await prisma.connector.update({
      where: { id: connector.id },
      data: {
        secretJson: toJson(secretJson),
      },
    });
  }

  if (!current.accessToken) {
    throw new Error(
      "Google Drive connector is missing OAuth access token. Reconnect the connector.",
    );
  }

  const effectiveConfig = {
    ...configJson,
    syncCursor: safeRecord(configJson.syncCursor),
  };

  return {
    configJson: effectiveConfig,
    secretJson: secretJson.accessToken ? secretJson : toGoogleSecretJson(current),
  };
}

export async function runConnectorIngestion(prisma: PrismaClient, connectorRunId: string) {
  const run = await prisma.connectorRun.findUnique({
    where: { id: connectorRunId },
    include: {
      connector: true,
    },
  });

  if (!run) {
    throw new Error("Connector run not found.");
  }

  const sourceType = connectorSourceType(run.connector.configJson);
  const curriculumVersionId = await resolveCurriculumVersionId(prisma, run.connectorId);

  await prisma.connectorRun.update({
    where: { id: run.id },
    data: {
      status: "running",
      startedAt: new Date(),
      errorMessage: null,
      logJson: toJson({
        message: "Connector ingestion started.",
      }),
    },
  });

  const fetchPayload = await resolveConnectorFetchPayload(prisma, {
    id: run.connector.id,
    connectorType: run.connector.connectorType,
    configJson: run.connector.configJson,
    secretJson: run.connector.secretJson,
  });

  const fetchResult = await fetchConnectorDocuments({
    connectorType: run.connector.connectorType,
    configJson: fetchPayload.configJson,
    secretJson: fetchPayload.secretJson,
  });

  let indexedCount = 0;
  let fetchedCount = 0;
  let failedCount = fetchResult.errors.length;
  const logs: Array<Record<string, unknown>> = [];

  for (const document of fetchResult.documents) {
    try {
      const cleanText = sanitizeCurriculumText(document.contentText);
      if (!cleanText) {
        failedCount += 1;
        logs.push({
          externalId: document.externalId,
          status: "skipped",
          reason: "empty_content",
        });
        continue;
      }

      fetchedCount += 1;
      const contentChecksum = checksum(cleanText);
      const configuredSourceProgramme = configuredProgramme(run.connector.configJson);
      const inferredFromTitle = parseProgrammeFromText(document.title);
      const metadataHints = deriveDocumentSeedContext(
        {
          title: document.title,
          metadata: document.metadata,
        },
        configuredSourceProgramme ? titleCase(configuredSourceProgramme) : null,
      );
      const fallbackProgramme =
        metadataHints.seedContext.programmeTag ??
        inferredFromTitle ??
        (configuredSourceProgramme ? titleCase(configuredSourceProgramme) : null);

      const externalDoc = await prisma.externalDocument.upsert({
        where: {
          connectorId_externalId: {
            connectorId: run.connectorId,
            externalId: document.externalId,
          },
        },
        update: {
          title: document.title,
          sourceUrl: document.sourceUrl,
          mimeType: document.mimeType,
          owner: document.owner,
          accessScope: document.accessScope,
          lastSeenAt: new Date(),
          isActive: true,
        },
        create: {
          connectorId: run.connectorId,
          externalId: document.externalId,
          title: document.title,
          sourceUrl: document.sourceUrl,
          mimeType: document.mimeType,
          owner: document.owner,
          accessScope: document.accessScope,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });

      const existingVersion = await prisma.externalDocumentVersion.findFirst({
        where: {
          externalDocumentId: externalDoc.id,
          checksum: contentChecksum,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          metadataJson: true,
        },
      });

      const existingParserVersion = parserVersionFromMetadata(
        existingVersion?.metadataJson,
      );
      const needsReindex =
        Boolean(existingVersion) &&
        existingParserVersion !== CURRICULUM_PARSER_VERSION;

      if (existingVersion && !needsReindex) {
        logs.push({
          externalId: document.externalId,
          status: "unchanged",
        });
        continue;
      }

      const version = existingVersion
        ? await prisma.externalDocumentVersion.update({
            where: { id: existingVersion.id },
            data: {
              metadataJson: toJson({
                ...(safeRecord(existingVersion.metadataJson) ?? {}),
                ...(document.metadata ?? {}),
                parserVersion: CURRICULUM_PARSER_VERSION,
                parserUpdatedAt: new Date().toISOString(),
              }),
            },
          })
        : await prisma.externalDocumentVersion.create({
            data: {
              externalDocumentId: externalDoc.id,
              revisionId: document.revisionId,
              checksum: contentChecksum,
              rawText: cleanText,
              metadataJson: toJson({
                ...(document.metadata ?? {}),
                parserVersion: CURRICULUM_PARSER_VERSION,
              }),
            },
          });

      const sourceChecksum = `${document.externalId}:${contentChecksum}`;
      const curriculumSource =
        externalDoc.curriculumSourceId
          ? await prisma.curriculumSource.update({
              where: { id: externalDoc.curriculumSourceId },
              data: {
                name: document.title,
                sourceType,
                programme: fallbackProgramme,
                url: document.sourceUrl,
                storageKey: `connector://${run.connectorId}/${document.externalId}`,
                checksum: sourceChecksum,
                status: "parsed",
                connectorId: run.connectorId,
                uploadedByUserId: run.connector.createdByUserId,
              },
            })
          : await prisma.curriculumSource.create({
              data: {
                name: document.title,
                sourceType,
                programme: fallbackProgramme,
                url: document.sourceUrl,
                storageKey: `connector://${run.connectorId}/${document.externalId}`,
                checksum: sourceChecksum,
                status: "parsed",
                connectorId: run.connectorId,
                uploadedByUserId: run.connector.createdByUserId,
              },
            });

      await prisma.externalDocument.update({
        where: { id: externalDoc.id },
        data: {
          latestVersionId: version.id,
          curriculumSourceId: curriculumSource.id,
        },
      });

      await prisma.curriculumVersionSource.upsert({
        where: {
          curriculumVersionId_sourceId: {
            curriculumVersionId,
            sourceId: curriculumSource.id,
          },
        },
        create: {
          curriculumVersionId,
          sourceId: curriculumSource.id,
        },
        update: {},
      });

      const hierarchyDrafts = buildHierarchyNodeDrafts({
        text: cleanText,
        sourceFileName: document.title,
        fallbackProgramme,
        seedContext: metadataHints.seedContext,
      });

      await persistHierarchyNodeDrafts(prisma, {
        curriculumVersionId,
        sourceId: curriculumSource.id,
        drafts: hierarchyDrafts,
      });

      await prisma.curriculumChunk.deleteMany({
        where: {
          sourceId: curriculumSource.id,
          curriculumVersionId,
        },
      });

      const chunks = splitIntoStructuredChunks(
        cleanText,
        env.INGESTION_CHUNK_SIZE,
        env.INGESTION_CHUNK_OVERLAP,
        document.title,
        fallbackProgramme,
        metadataHints.seedContext,
      );

      if (chunks.length === 0) {
        failedCount += 1;
        logs.push({
          externalId: document.externalId,
          status: "failed",
          reason: "no_chunks_produced",
        });
        continue;
      }

      const createdChunkRows: Array<{ id: string; text: string }> = [];
      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const createdChunk = await prisma.curriculumChunk.create({
          data: {
            sourceId: curriculumSource.id,
            curriculumVersionId,
            chunkIndex: i,
            text: chunk.text,
            heading: chunk.heading,
            programmeTag: chunk.programmeTag ?? fallbackProgramme ?? null,
            yearTag: chunk.yearTag,
            courseCode: chunk.courseCode,
            metadataJson: toJson({
              connectorId: run.connectorId,
              externalDocumentId: externalDoc.id,
              externalDocumentVersionId: version.id,
              externalId: document.externalId,
              ingestionRunId: run.id,
              mimeType: document.mimeType,
              drivePathSegments: metadataHints.drivePathSegments,
              sourceFileName: document.title,
              programmeLevel: metadataHints.programmeLevelFromPath ?? undefined,
              ...chunk.metadata,
            }),
          },
        });
        createdChunkRows.push({
          id: createdChunk.id,
          text: chunk.text,
        });

        await prisma.chunkLineage.create({
          data: {
            curriculumChunkId: createdChunk.id,
            externalDocumentVersionId: version.id,
            connectorRunId: run.id,
            externalChunkIndex: i,
          },
        });
      }

      let embeddingProvider: string | null = null;
      let embeddingModel: string | null = null;
      let embeddedChunkCount = 0;
      if (env.INGESTION_EMBEDDINGS_ENABLED && createdChunkRows.length > 0) {
        const batchSize = 24;
        for (let start = 0; start < createdChunkRows.length; start += batchSize) {
          const batch = createdChunkRows.slice(start, start + batchSize);
          const embeddingInput = batch.map((item) => toEmbeddingInput(item.text));
          try {
            const embeddingResult = await embedTextsWithFallback(embeddingInput);
            embeddingProvider = embeddingResult.provider;
            embeddingModel = embeddingResult.model;

            for (let i = 0; i < batch.length; i += 1) {
              const row = batch[i];
              const vector = embeddingResult.vectors[i];
              if (!vector) continue;
              await updateChunkEmbedding(prisma, row.id, vector);
              embeddedChunkCount += 1;
            }
          } catch {
            // Non-blocking: ingestion should continue even if embedding enrichment fails.
          }
        }
      }

      await prisma.curriculumSource.update({
        where: { id: curriculumSource.id },
        data: { status: "indexed" },
      });

      indexedCount += 1;
      logs.push({
        externalId: document.externalId,
        status: "indexed",
        reindexedForParserVersion: needsReindex,
        chunkCount: chunks.length,
        embeddedChunkCount,
        embeddingProvider,
        embeddingModel,
        inferredProgramme: fallbackProgramme,
        sampleHeading: chunks[0]?.heading ?? null,
        sampleSemester: chunks[0]?.yearTag ?? null,
        sampleCourseCode: chunks[0]?.courseCode ?? null,
        hierarchyNodeCount: hierarchyDrafts.length,
      });
    } catch (error) {
      failedCount += 1;
      logs.push({
        externalId: document.externalId,
        status: "failed",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const finalStatus: ConnectorRunStatus =
    fetchResult.documents.length === 0 && failedCount === 0
      ? "failed"
      : failedCount === 0
      ? "succeeded"
      : indexedCount > 0
        ? "partial"
        : "failed";

  const noDocumentsDiscovered =
    fetchResult.documents.length === 0 && failedCount === 0;
  const adapterErrors = fetchResult.errors;
  const adapterErrorPreview =
    adapterErrors.length > 0
      ? adapterErrors
          .slice(0, 2)
          .map((item) => item.message)
          .join(" | ")
      : null;

  await prisma.connectorRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      discoveredCount: fetchResult.documents.length,
      fetchedCount,
      indexedCount,
      failedCount,
      finishedAt: new Date(),
      errorMessage:
        finalStatus === "failed"
          ? noDocumentsDiscovered
            ? "Connector ingestion failed: no documents discovered from connector source."
            : adapterErrorPreview
              ? `Connector ingestion failed: ${adapterErrorPreview}`
              : "Connector ingestion failed."
          : null,
      logJson: toJson({
        logs,
        adapterErrors,
        summary: {
          noDocumentsDiscovered,
          discoveredCount: fetchResult.documents.length,
          fetchedCount,
          indexedCount,
          failedCount,
        },
      }),
    },
  });

  const existingConfig = safeRecord(run.connector.configJson);
  const existingSyncCursor = safeRecord(existingConfig.syncCursor);

  await prisma.connector.update({
    where: { id: run.connectorId },
    data: {
      lastSyncedAt: new Date(),
      status: finalStatus === "failed" ? "error" : "active",
      configJson: toJson({
        ...existingConfig,
        syncCursor: {
          ...existingSyncCursor,
          lastSyncAt: new Date().toISOString(),
          lastIngestionRunId: run.id,
          lastStatus: finalStatus,
          discoveredCount: fetchResult.documents.length,
          indexedCount,
          failedCount,
        },
      }),
    },
  });

  return {
    status: finalStatus,
    discoveredCount: fetchResult.documents.length,
    fetchedCount,
    indexedCount,
    failedCount,
  };
}
