import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type MinorTopic = {
  minor_topic_number?: string;
  minor_topic_title?: string;
};

type Subtopic = {
  subtopic_number?: string;
  subtopic_title?: string;
  minor_topics?: MinorTopic[];
};

type Topic = {
  topic_number?: string;
  topic_title?: string;
  subtopics?: Subtopic[];
};

type OutlineEntry = {
  file: string;
  path?: string;
  course?: string;
  topics?: Topic[];
  error?: string;
};

type OutlineDocument = Record<string, OutlineEntry[]>;

type CleanNoneDocumentItem = {
  file?: string;
  relative_path?: string;
  course_id?: string;
  topics?: Topic[];
  error?: string;
};

type CleanNoneOutline = {
  courses?: Record<string, string>;
  documents?: Record<string, CleanNoneDocumentItem>;
};

type StructuredSubtopic = {
  number?: string;
  title: string;
  minorTopics: StructuredMinorTopic[];
};

type StructuredMinorTopic = {
  number?: string;
  title: string;
};

type StructuredTopic = {
  number?: string;
  title: string;
  subtopics: StructuredSubtopic[];
};

type StructuredCourse = {
  title: string;
  file: string;
  topics: StructuredTopic[];
};

type StructuredSemester = {
  label: string;
  courses: StructuredCourse[];
};

type StructuredOutline = {
  semesters: StructuredSemester[];
  loadedFrom: string;
};

export interface ProgrammeOutlinePlannerOptionsInput {
  programme?: string;
  programmeLevel?: string;
  semester?: string;
  course?: string;
  topic?: string;
  subtopic?: string;
  minorTopic?: string;
  limit?: number;
}

export interface ProgrammeOutlinePlannerOptionsResult {
  available: boolean;
  matchedContext: boolean;
  programmeLevels: string[];
  semesters: string[];
  courses: string[];
  topics: string[];
  subtopics: string[];
  minorTopics: string[];
}

export interface ProgrammeOutlineSelectionInput {
  semester?: string;
  course?: string;
  topic?: string;
  subtopic?: string;
  minorTopic?: string;
}

export interface ProgrammeOutlineSelectionResult {
  available: boolean;
  matched: boolean;
  reason?: string;
  canonicalSemester?: string;
  canonicalCourse?: string;
  canonicalTopic?: string;
  canonicalSubtopic?: string;
  canonicalMinorTopic?: string;
  topicNumber?: string;
  subtopicNumber?: string;
  minorTopicNumber?: string;
  suggestions?: {
    semesters: string[];
    courses: string[];
    topics: string[];
    subtopics: string[];
    minorTopics: string[];
  };
}

const DEFAULT_OUTLINE_PATHS = [
  "syllabi/FINAL DIPLOMA IN NURSING MODULES-2022/programme_outline_by_semester.clean.json",
  "syllabi/FINAL DIPLOMA IN NURSING MODULES-2022/programme_outline_by_semester.clean.none.json",
  "syllabi/FINAL DIPLOMA IN NURSING MODULES-2022/programme_outline_by_semester.json",
];

let cachedOutline: StructuredOutline | null = null;

function normalize(value: string | undefined | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string | undefined | null) {
  return normalize(value)
    .replace(/\b(module|course|unit|topic|subtopic|minor)\b/g, " ")
    // Expand common nursing abbreviations to improve matching
    .replace(/\bhrm\b/g, "human resource management")
    .replace(/\bgbv\b/g, "gender based violence")
    .replace(/\bhiv\b/g, "human immunodeficiency virus")
    .replace(/\baids\b/g, "acquired immunodeficiency syndrome")
    .replace(/\bphc\b/g, "primary health care")
    .replace(/\birh\b/g, "integrated reproductive health")
    .replace(/\blmg\b/g, "leadership management governance")
    .replace(/\bdsd\b/g, "differentiated service delivery")
    .replace(/\bsdgs?\b/g, "sustainable development goals")
    .replace(/\s+/g, " ")
    .trim();
}

/** Set of boilerplate heading labels that are not real curriculum content */
const NOISE_EXACT = new Set([
  "unit introduction",
  "introduction",
  "unit learning outcome",
  "unit learning outcomes",
  "learning outcomes",
  "learning outcome",
  "unit summary",
  "summary",
  "references",
  "reference",
  "references and further reading",
  "references and further readings",
  "reference and further reading",
  "self assessment test",
  "self assessment tests",
  "self assessment question",
  "self assessment questions",
  "further reading",
  "further readings",
  "definition of terms",
  "definition of key terms",
  "definitions",
  "definition of concepts",
  "definitions of key terms",
  "definitions of terms",
  "unit objectives",
  "objectives",
  "conclusion",
  "revision questions",
  "review questions",
  "assignment",
  "assignments",
  "practical exercises",
  "practical exercise",
  "tutorial",
  "tutorials",
  "suggested reading",
  "suggested readings",
  "recommended reading",
  "recommended readings",
  "bibliography",
]);

function isNoisePlannerLabel(value: string | undefined | null) {
  const normalized = normalize(value).replace(/^(?:\d+\s*)+/, "").trim();
  if (!normalized) return true;
  if (normalized.length < 4) return true;
  // Exact boilerplate matches
  if (NOISE_EXACT.has(normalized)) return true;
  if (normalized === "unit" || normalized === "topic") return true;
  if (normalized.includes("unspecified")) return true;
  // Generic "UNIT X" with no real title
  if (/^unit\s+\d+$/i.test(normalized)) return true;
  // Titles starting with "–" or "\"" are quoted list items parsed as subtopics (e.g. SDG goals)
  if (/^[–—"\-]\s*"/.test((value ?? "").trim())) return true;
  // Garbage: sentence fragments (>15 words for a title is suspicious)
  if (normalized.split(" ").length > 15) return true;
  // Garbage: equation fragments or stray punctuation
  if (/^[-=+*()\d\s.kpa]+$/.test(normalized)) return true;
  // Partial sentence fragments: starts with a non-title word and is long enough to be a sentence
  if (/^(million|and|or|but|also|however|therefore|furthermore|moreover|thus|hence)\s/.test(normalized) && normalized.split(" ").length > 3) return true;
  return false;
}

function titleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+\d{1,3}$/g, "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function cleanCourseFromFileName(fileName: string) {
  const withoutExt = fileName.replace(/\.[a-z0-9]+$/i, "");
  const stripped = withoutExt
    .replace(/^~\$\s*/i, "")
    .replace(/^\d+\s*[\.\-_]\s*/g, "")
    .replace(/\bfinal\b/gi, "")
    .replace(/\bmodule\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped ? titleCase(stripped) : "Untitled Course";
}

function isGenericCourseLabel(label: string | undefined) {
  const value = normalize(label);
  if (!value) return true;
  return (
    value.includes("nursing and midwifery council of zambia") ||
    value.includes("nursing and midwifery council") ||
    value === "zambia" ||
    value === "diploma in nursing" ||
    value === "diploma in registered nursing" ||
    value === "bsc nursing" ||
    value === "bachelor of science in nursing" ||
    /\b(diploma|bsc|bachelor|certificate)\b.*\b(nursing|midwifery)\b/.test(
      value,
    )
  );
}

/**
 * Deduplicate topics that share the same topic_number within one document.
 * The pattern is: a short "stub" topic (empty or few subtopics, different casing)
 * duplicating a full-content topic.  We keep the one with more subtopics, and
 * merge any unique subtopics from the stub into the winner.
 * When a loser has a meaningful title distinct from the winner, it is promoted
 * as a subtopic so no content is silently dropped.
 */
function deduplicateTopics(topics: StructuredTopic[]): StructuredTopic[] {
  const byNumber = new Map<string, StructuredTopic[]>();
  const unnumbered: StructuredTopic[] = [];

  for (const topic of topics) {
    const num = (topic.number ?? "").trim();
    if (!num) {
      // Skip truly empty / garbage entries
      if (!isNoisePlannerLabel(topic.title)) {
        unnumbered.push(topic);
      }
      continue;
    }
    const group = byNumber.get(num) ?? [];
    group.push(topic);
    byNumber.set(num, group);
  }

  const result: StructuredTopic[] = [];
  for (const [, group] of byNumber) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Pick the entry with the most subtopics (i.e. the full-content version)
    group.sort((a, b) => b.subtopics.length - a.subtopics.length);
    const winner = {
      ...group[0],
      subtopics: [...group[0].subtopics],
    };

    // If the winner has a generic title ("Unit X"), steal the title from the next best
    if (isNoisePlannerLabel(winner.title)) {
      for (const candidate of group.slice(1)) {
        if (!isNoisePlannerLabel(candidate.title)) {
          winner.title = candidate.title;
          break;
        }
      }
    }

    // Merge unique subtopics from losers.
    // If a loser has a meaningful title different from the winner, promote it as a subtopic.
    const existingSubKeys = new Set(
      winner.subtopics.map((s) => `${s.number ?? ""}|${normalize(s.title)}`),
    );
    for (const loser of group.slice(1)) {
      if (
        !isNoisePlannerLabel(loser.title) &&
        normalize(loser.title) !== normalize(winner.title)
      ) {
        const promoKey = `|${normalize(loser.title)}`;
        if (!existingSubKeys.has(promoKey)) {
          winner.subtopics.push({
            title: loser.title,
            minorTopics: loser.subtopics.length > 0
              ? loser.subtopics.map((s) => ({ number: s.number, title: s.title }))
              : [],
          });
          existingSubKeys.add(promoKey);
        }
      }
      for (const sub of loser.subtopics) {
        const key = `${sub.number ?? ""}|${normalize(sub.title)}`;
        if (!existingSubKeys.has(key)) {
          winner.subtopics.push(sub);
          existingSubKeys.add(key);
        }
      }
    }

    result.push(winner);
  }

  // Add unnumbered topics (rare, usually noise — already filtered above)
  result.push(...unnumbered);

  // Sort by topic number
  result.sort((a, b) => {
    const na = parseFloat(a.number ?? "9999");
    const nb = parseFloat(b.number ?? "9999");
    return na - nb;
  });

  return result;
}

/**
 * Deduplicate subtopics that share the same subtopic_number within one topic.
 * Keeps the entry with more minor_topics and merges unique minor topics from others.
 * When both entries have meaningful (non-noise) titles, the loser's title is
 * preserved as an additional minor topic so no content is lost.
 */
function deduplicateSubtopics(subtopics: StructuredSubtopic[]): StructuredSubtopic[] {
  const byNumber = new Map<string, StructuredSubtopic[]>();
  const unnumbered: StructuredSubtopic[] = [];

  for (const sub of subtopics) {
    const num = (sub.number ?? "").trim();
    if (!num) {
      unnumbered.push(sub);
      continue;
    }
    const group = byNumber.get(num) ?? [];
    group.push(sub);
    byNumber.set(num, group);
  }

  const result: StructuredSubtopic[] = [];
  for (const [, group] of byNumber) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Pick the entry with the most minor topics
    group.sort((a, b) => b.minorTopics.length - a.minorTopics.length);
    const winner = {
      ...group[0],
      minorTopics: [...group[0].minorTopics],
    };

    // If the winner has a noise title, try to steal a better one
    if (isNoisePlannerLabel(winner.title)) {
      for (const candidate of group.slice(1)) {
        if (!isNoisePlannerLabel(candidate.title)) {
          winner.title = candidate.title;
          break;
        }
      }
    }

    // Merge unique minor topics from losers.
    // When a loser has a meaningful title different from the winner,
    // promote it into a minor topic so no content is lost.
    const existingMinorKeys = new Set(
      winner.minorTopics.map((m) => `${m.number ?? ""}|${normalize(m.title)}`),
    );
    for (const loser of group.slice(1)) {
      // Promote loser title as minor topic if it's meaningful and different
      if (
        !isNoisePlannerLabel(loser.title) &&
        normalize(loser.title) !== normalize(winner.title)
      ) {
        const promoKey = `|${normalize(loser.title)}`;
        if (!existingMinorKeys.has(promoKey)) {
          winner.minorTopics.push({ title: loser.title });
          existingMinorKeys.add(promoKey);
        }
      }
      for (const minor of loser.minorTopics) {
        const key = `${minor.number ?? ""}|${normalize(minor.title)}`;
        if (!existingMinorKeys.has(key)) {
          winner.minorTopics.push(minor);
          existingMinorKeys.add(key);
        }
      }
    }

    result.push(winner);
  }

  result.push(...unnumbered);
  result.sort((a, b) => {
    const na = parseFloat(a.number ?? "9999");
    const nb = parseFloat(b.number ?? "9999");
    return na - nb;
  });

  return result;
}

/**
 * Filter out noise/boilerplate subtopics and minor topics that aren't
 * meaningful curriculum content (introductions, summaries, references, etc.).
 */
function filterNoiseFromTopic(topic: StructuredTopic): StructuredTopic {
  return {
    ...topic,
    subtopics: topic.subtopics
      .filter((sub) => !isNoisePlannerLabel(sub.title))
      .map((sub) => ({
        ...sub,
        minorTopics: sub.minorTopics.filter(
          (minor) => !isNoisePlannerLabel(minor.title),
        ),
      })),
  };
}

/**
 * Fix minor topic numbers whose prefix doesn't match their parent subtopic.
 * E.g. a minor topic under subtopic 4.4 with number "2.5.1" is clearly a parsing
 * error and should be renumbered to 4.4.N.
 * Also assigns sequential numbers to minor topics that lack numbers.
 */
function fixMinorTopicNumbers(topic: StructuredTopic): StructuredTopic {
  return {
    ...topic,
    subtopics: topic.subtopics.map((sub) => {
      const subNum = (sub.number ?? "").trim();
      if (!subNum || sub.minorTopics.length === 0) return sub;

      // Find the maximum existing sequential index under this subtopic
      let maxSeq = 0;
      for (const m of sub.minorTopics) {
        const mn = (m.number ?? "").trim();
        if (mn.startsWith(subNum + ".")) {
          const seq = parseInt(mn.slice(subNum.length + 1), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }

      const fixedMinors = sub.minorTopics.map((minor) => {
        const mn = (minor.number ?? "").trim();
        if (!mn) {
          // Assign a sequential number
          maxSeq += 1;
          return { ...minor, number: `${subNum}.${maxSeq}` };
        }
        if (!mn.startsWith(subNum + ".") && mn.includes(".")) {
          // Mismatched prefix — renumber
          maxSeq += 1;
          return { ...minor, number: `${subNum}.${maxSeq}` };
        }
        return minor;
      });

      return { ...sub, minorTopics: fixedMinors };
    }),
  };
}

function resolveOutlinePath() {
  const envPath = process.env.PROGRAMME_OUTLINE_JSON_PATH?.trim();
  const defaultCandidates = DEFAULT_OUTLINE_PATHS.flatMap((relativePath) => [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), "..", relativePath),
  ]);

  const candidates = [envPath, ...defaultCandidates].filter(
    (value): value is string => Boolean(value),
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function bestMatch<T>(items: T[], input: string, labelOf: (item: T) => string) {
  const needle = normalizeForMatch(input);
  if (!needle) return null;
  // Also try stripping a leading number prefix from the input (e.g. "3 Social Units" → "social units")
  const needleNoNum = needle.replace(/^\d+(?:\.\d+)*\s*/, "").trim();

  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const label = normalizeForMatch(labelOf(item));
    if (!label) continue;
    const labelNoNum = label.replace(/^\d+(?:\.\d+)*\s*/, "").trim();

    let score = 0;
    // Exact match (with or without numbers)
    if (label === needle || labelNoNum === needleNoNum) score = 300;
    else if (labelNoNum && needleNoNum && labelNoNum === needleNoNum) score = 300;
    // One contains the other
    else if (label.includes(needle) || label.includes(needleNoNum)) score = 220;
    else if (needle.includes(label) || needleNoNum.includes(labelNoNum)) score = 180;
    else {
      // Token overlap scoring
      const needleTokens = needleNoNum.split(" ").filter((token) => token.length >= 3);
      const labelTokens = labelNoNum.split(" ").filter((token) => token.length >= 3);
      const hits = needleTokens.filter(
        (token) => label.includes(token) || labelNoNum.includes(token),
      ).length;
      // Also check reverse: how many label tokens appear in needle
      const reverseHits = labelTokens.filter(
        (token) => needle.includes(token) || needleNoNum.includes(token),
      ).length;
      const bestHits = Math.max(hits, reverseHits);
      const bestBase = Math.max(needleTokens.length, labelTokens.length);
      if (bestHits > 0) {
        const overlapRatio = bestHits / Math.max(1, bestBase);
        score = Math.round(bestHits * 25 + overlapRatio * 40);
        // Bonus for matching >60% of tokens
        if (overlapRatio > 0.6) score += 30;
        // Bonus for matching >80% of tokens
        if (overlapRatio > 0.8) score += 20;
      }
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  if (!best || best.score < 30) return null;
  return best.item;
}

function buildStructuredOutline(raw: OutlineDocument, loadedFrom: string): StructuredOutline {
  const semesters: StructuredSemester[] = [];
  for (const [label, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) continue;
    const courses: StructuredCourse[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || entry.error) continue;
      const file = entry.file ?? "Untitled";
      const courseTitle = isGenericCourseLabel(entry.course)
        ? cleanCourseFromFileName(file)
        : titleCase(String(entry.course));
      const rawTopics: StructuredTopic[] = Array.isArray(entry.topics)
        ? entry.topics
            .filter((topic) => topic && typeof topic === "object" && (topic.topic_number || topic.topic_title))
            .map((topic) => ({
              number:
                typeof topic.topic_number === "string"
                  ? topic.topic_number.trim()
                  : undefined,
              title: titleCase(String(topic.topic_title ?? "Untitled Topic")),
              subtopics: Array.isArray(topic.subtopics)
                ? topic.subtopics
                    .filter((subtopic) => subtopic && typeof subtopic === "object" && (subtopic.subtopic_number || subtopic.subtopic_title))
                    .map((subtopic) => ({
                      number:
                        typeof subtopic.subtopic_number === "string"
                          ? subtopic.subtopic_number.trim()
                          : undefined,
                      title: titleCase(String(subtopic.subtopic_title ?? "Untitled Subtopic")),
                      minorTopics: Array.isArray(subtopic.minor_topics)
                        ? subtopic.minor_topics
                            .filter(
                              (minorTopic) =>
                                minorTopic &&
                                typeof minorTopic === "object" &&
                                (minorTopic.minor_topic_number || minorTopic.minor_topic_title),
                            )
                            .map((minorTopic) => ({
                              number:
                                typeof minorTopic.minor_topic_number === "string"
                                  ? minorTopic.minor_topic_number.trim()
                                  : undefined,
                              title: titleCase(
                                String(
                                  minorTopic.minor_topic_title ??
                                    "Untitled Minor Topic",
                                ),
                              ),
                            }))
                        : [],
                    }))
                : [],
            }))
        : [];

      // Apply dedup and noise filtering
      const topics = deduplicateTopics(rawTopics).map((topic) => {
        const cleaned = filterNoiseFromTopic(topic);
        const fixedNumbers = fixMinorTopicNumbers(cleaned);
        return { ...fixedNumbers, subtopics: deduplicateSubtopics(fixedNumbers.subtopics) };
      });

      courses.push({
        title: courseTitle,
        file,
        topics,
      });
    }

    semesters.push({
      label,
      courses,
    });
  }

  return {
    semesters,
    loadedFrom,
  };
}

function parseSemesterFromRelativePath(relativePath?: string) {
  const value = (relativePath ?? "").trim();
  if (!value) return "UNASSIGNED";
  const parts = value.split(/[\\/]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts[0];
  }
  return "UNASSIGNED";
}

function mergeTopics(existing: StructuredTopic[], incoming: StructuredTopic[]) {
  // Combine all topics and run them through the dedup pipeline
  // so cross-document duplicates (same topic_number, different casing/stubs) are merged.
  const all = [
    ...existing.map((topic) => ({
      ...topic,
      subtopics: topic.subtopics.map((subtopic) => ({
        ...subtopic,
        minorTopics: [...subtopic.minorTopics],
      })),
    })),
    ...incoming.map((topic) => ({
      ...topic,
      subtopics: topic.subtopics.map((subtopic) => ({
        ...subtopic,
        minorTopics: [...subtopic.minorTopics],
      })),
    })),
  ];

  return deduplicateTopics(all);
}

function buildStructuredOutlineFromCleanNone(raw: CleanNoneOutline, loadedFrom: string): StructuredOutline {
  const coursesMap = raw.courses ?? {};
  const documentsMap = raw.documents ?? {};

  const semesters = new Map<
    string,
    Map<
      string,
      {
        file: string;
        title: string;
        topics: StructuredTopic[];
      }
    >
  >();

  const parseTopics = (topics?: Topic[]): StructuredTopic[] => {
    if (!Array.isArray(topics)) return [];

    const rawParsed = topics
      .filter((topic) => topic && typeof topic === "object" && (topic.topic_number || topic.topic_title))
      .map((topic) => ({
        number:
          typeof topic.topic_number === "string"
            ? topic.topic_number.trim()
            : undefined,
        title: titleCase(String(topic.topic_title ?? "Untitled Topic")),
        subtopics: Array.isArray(topic.subtopics)
          ? topic.subtopics
              .filter((subtopic) => subtopic && typeof subtopic === "object" && (subtopic.subtopic_number || subtopic.subtopic_title))
              .map((subtopic) => ({
                number:
                  typeof subtopic.subtopic_number === "string"
                    ? subtopic.subtopic_number.trim()
                    : undefined,
                title: titleCase(String(subtopic.subtopic_title ?? "Untitled Subtopic")),
                minorTopics: Array.isArray(subtopic.minor_topics)
                  ? subtopic.minor_topics
                      .filter(
                        (minorTopic) =>
                          minorTopic &&
                          typeof minorTopic === "object" &&
                          (minorTopic.minor_topic_number || minorTopic.minor_topic_title),
                      )
                      .map((minorTopic) => ({
                        number:
                          typeof minorTopic.minor_topic_number === "string"
                            ? minorTopic.minor_topic_number.trim()
                            : undefined,
                        title: titleCase(
                          String(
                            minorTopic.minor_topic_title ??
                              "Untitled Minor Topic",
                          ),
                        ),
                      }))
                  : [],
              }))
          : [],
      }));

    // 1. Deduplicate topics with the same topic_number (stub vs full content)
    const deduped = deduplicateTopics(rawParsed);

    // 2. For each topic, deduplicate subtopics with the same subtopic_number
    //    and filter out noise/boilerplate entries
    return deduped.map((topic) => {
      const cleaned = filterNoiseFromTopic(topic);
      const fixedNumbers = fixMinorTopicNumbers(cleaned);
      return {
        ...fixedNumbers,
        subtopics: deduplicateSubtopics(fixedNumbers.subtopics),
      };
    });
  };

  for (const doc of Object.values(documentsMap)) {
    if (!doc || typeof doc !== "object" || doc.error) continue;
    const file = doc.file ?? "Untitled";
    const semesterLabel = parseSemesterFromRelativePath(doc.relative_path);
    const rawCourse =
      (doc.course_id && coursesMap[doc.course_id]) || undefined;
    const fileDerivedCourseTitle = cleanCourseFromFileName(file);
    const relativePathFileName =
      typeof doc.relative_path === "string"
        ? doc.relative_path.split(/[\\/]/).pop()
        : undefined;
    const relativePathDerivedCourseTitle = relativePathFileName
      ? cleanCourseFromFileName(relativePathFileName)
      : fileDerivedCourseTitle;

    const courseTitle = isGenericCourseLabel(rawCourse)
      ? fileDerivedCourseTitle || relativePathDerivedCourseTitle
      : titleCase(String(rawCourse));
    const topics = parseTopics(doc.topics);

    if (!semesters.has(semesterLabel)) {
      semesters.set(semesterLabel, new Map());
    }
    const courses = semesters.get(semesterLabel)!;
    const courseKey = normalize(courseTitle);
    const existing = courses.get(courseKey);
    if (!existing) {
      courses.set(courseKey, {
        file,
        title: courseTitle,
        topics,
      });
      continue;
    }

    existing.topics = mergeTopics(existing.topics, topics);
  }

  return {
    semesters: Array.from(semesters.entries()).map(([label, courses]) => ({
      label,
      courses: Array.from(courses.values()).map((course) => ({
        title: course.title,
        file: course.file,
        topics: course.topics,
      })),
    })),
    loadedFrom,
  };
}

function getStructuredOutline() {
  if (cachedOutline) {
    return cachedOutline;
  }

  const outlinePath = resolveOutlinePath();
  if (!outlinePath) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(outlinePath, "utf8")) as unknown;
  const asRecord =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const isCleanNoneShape =
    Boolean(asRecord.documents && typeof asRecord.documents === "object") &&
    Boolean(asRecord.courses && typeof asRecord.courses === "object");

  cachedOutline = isCleanNoneShape
    ? buildStructuredOutlineFromCleanNone(
        parsed as CleanNoneOutline,
        outlinePath,
      )
    : buildStructuredOutline(parsed as OutlineDocument, outlinePath);
  return cachedOutline;
}

function splitNumberAndTitle(input: string | undefined) {
  const value = (input ?? "").trim();
  if (!value) return { number: undefined, title: undefined };
  const match = value.match(/^(\d+(?:\.\d+)*)\s*[:\-]?\s*(.+)?$/);
  if (match?.[1]) {
    return {
      number: match[1],
      title: match[2]?.trim() || undefined,
    };
  }
  return {
    number: undefined,
    title: value,
  };
}

function uniqSorted(values: string[], limit = 120) {
  return Array.from(new Set(values.filter(Boolean))).sort().slice(0, limit);
}

function formatTopicLabel(topic: StructuredTopic) {
  return `${topic.number ?? ""} ${topic.title}`.trim();
}

function formatSubtopicLabel(subtopic: StructuredSubtopic) {
  return `${subtopic.number ?? ""} ${subtopic.title}`.trim();
}

function formatMinorTopicLabel(minorTopic: StructuredMinorTopic) {
  return `${minorTopic.number ?? ""} ${minorTopic.title}`.trim();
}

function semesterLike(semester: StructuredSemester) {
  return /\bsemester\b/i.test(semester.label);
}

function supportsRequestedContext(programme?: string, programmeLevel?: string) {
  const p = normalize(programme);
  const level = normalize(programmeLevel);
  const programmeOk = !p || p.includes("nursing");
  const levelOk = !level || level.includes("diploma");
  return programmeOk && levelOk;
}

export function getProgrammeOutlinePlannerOptions(
  input: ProgrammeOutlinePlannerOptionsInput,
): ProgrammeOutlinePlannerOptionsResult {
  const outline = getStructuredOutline();
  if (!outline) {
    return {
      available: false,
      matchedContext: false,
      programmeLevels: [],
      semesters: [],
      courses: [],
      topics: [],
      subtopics: [],
      minorTopics: [],
    };
  }

  const matchedContext = supportsRequestedContext(
    input.programme,
    input.programmeLevel,
  );
  const limit = Math.max(10, Math.min(200, input.limit ?? 80));
  const semestersPool = outline.semesters.filter(
    (semester) => semesterLike(semester) && semester.courses.length > 0,
  );

  const selectedSemester = input.semester
    ? bestMatch(semestersPool, input.semester, (semester) => semester.label)
    : null;
  const semesterCandidates = selectedSemester ? [selectedSemester] : semestersPool;

  const courses = semesterCandidates.flatMap((semester) => semester.courses);
  const selectedCourse = input.course
    ? bestMatch(courses, input.course, (course) => `${course.title} ${course.file}`)
    : null;
  const hasCourseInput = Boolean(input.course?.trim());
  const topicPool = selectedCourse
    ? selectedCourse.topics
    : hasCourseInput
      ? []
      : courses.flatMap((course) => course.topics);

  const topicInput = splitNumberAndTitle(input.topic);
  const selectedTopic = topicInput.number
    ? topicPool.find((topic) => normalize(topic.number) === normalize(topicInput.number)) ?? null
    : input.topic
      ? bestMatch(
          topicPool,
          topicInput.title ?? input.topic,
          (topic) => formatTopicLabel(topic),
        )
      : null;

  const subtopicPool = selectedTopic ? selectedTopic.subtopics : [];
  const selectedSubtopic = input.subtopic
    ? bestMatch(
        subtopicPool,
        input.subtopic,
        (subtopic) => formatSubtopicLabel(subtopic),
      )
    : null;
  const minorTopicPool = selectedSubtopic
    ? selectedSubtopic.minorTopics
    : subtopicPool.flatMap((subtopic) => subtopic.minorTopics);

  return {
    available: true,
    matchedContext,
    programmeLevels: ["Diploma"],
    semesters: uniqSorted(semestersPool.map((semester) => semester.label), limit),
    courses: uniqSorted(
      semesterCandidates.flatMap((semester) =>
        semester.courses.map((course) => course.title),
      ),
      limit,
    ),
    topics: uniqSorted(
      topicPool
        .map(formatTopicLabel)
        .filter((label) => !isNoisePlannerLabel(label)),
      limit,
    ),
    subtopics: uniqSorted(
      subtopicPool
        .map(formatSubtopicLabel)
        .filter((label) => !isNoisePlannerLabel(label)),
      limit,
    ),
    minorTopics: uniqSorted(
      minorTopicPool
        .map(formatMinorTopicLabel)
        .filter((label) => !isNoisePlannerLabel(label)),
      limit,
    ),
  };
}

export function resolveProgrammeOutlineSelection(
  input: ProgrammeOutlineSelectionInput,
): ProgrammeOutlineSelectionResult {
  const outline = getStructuredOutline();
  if (!outline) {
    return {
      available: false,
      matched: false,
      reason: "Programme outline file not found.",
    };
  }

  const semestersPool = outline.semesters.filter((semester) => semester.courses.length > 0);
  const selectedSemester = input.semester
    ? bestMatch(semestersPool, input.semester, (semester) => semester.label)
    : null;
  const semesterCandidates = selectedSemester ? [selectedSemester] : semestersPool;

  const allCourses = semesterCandidates.flatMap((semester) =>
    semester.courses.map((course) => ({
      ...course,
      semesterLabel: semester.label,
    })),
  );

  const selectedCourse = input.course
    ? bestMatch(allCourses, input.course, (course) => `${course.title} ${course.file}`)
    : null;

  const topicInput = splitNumberAndTitle(input.topic);
  const topicPool = (selectedCourse ? selectedCourse.topics : allCourses.flatMap((course) => course.topics))
    .map((topic) => ({
      ...topic,
      contextCourse: selectedCourse?.title,
    }));

  const selectedTopic = topicInput.number
    ? topicPool.find((topic) => normalize(topic.number) === normalize(topicInput.number)) ?? null
    : input.topic
      ? bestMatch(
          topicPool,
          topicInput.title ?? input.topic,
          (topic) => `${topic.number ?? ""} ${topic.title}`,
        )
      : null;

  const subtopicInput = splitNumberAndTitle(input.subtopic);
  const subtopicPool = (selectedTopic ? selectedTopic.subtopics : topicPool.flatMap((topic) => topic.subtopics))
    .map((subtopic) => ({
      ...subtopic,
    }));
  const selectedSubtopic = subtopicInput.number
    ? subtopicPool.find((subtopic) => normalize(subtopic.number) === normalize(subtopicInput.number)) ?? null
    : input.subtopic
      ? bestMatch(
          subtopicPool,
          subtopicInput.title ?? input.subtopic,
          (subtopic) => `${subtopic.number ?? ""} ${subtopic.title}`,
        )
      : null;

  const minorTopicInput = splitNumberAndTitle(input.minorTopic);
  const minorTopicPool = (
    selectedSubtopic
      ? selectedSubtopic.minorTopics
      : subtopicPool.flatMap((subtopic) => subtopic.minorTopics)
  ).map((minorTopic) => ({
    ...minorTopic,
  }));

  const selectedMinorTopic = minorTopicInput.number
    ? minorTopicPool.find(
        (minorTopic) =>
          normalize(minorTopic.number) === normalize(minorTopicInput.number),
      ) ?? null
    : input.minorTopic
      ? bestMatch(
          minorTopicPool,
          minorTopicInput.title ?? input.minorTopic,
          (minorTopic) =>
            `${minorTopic.number ?? ""} ${minorTopic.title}`,
        )
      : null;

  const hasRequiredInputs = Boolean(
    input.semester ||
      input.course ||
      input.topic ||
      input.subtopic ||
      input.minorTopic,
  );
  const hasPathMatch =
    (!input.semester || Boolean(selectedSemester)) &&
    (!input.course || Boolean(selectedCourse)) &&
    (!input.topic || Boolean(selectedTopic)) &&
    (!input.subtopic || Boolean(selectedSubtopic)) &&
    (!input.minorTopic || Boolean(selectedMinorTopic));

  const resolvedSemester = selectedCourse?.semesterLabel ?? selectedSemester?.label;

  return {
    available: true,
    matched: hasRequiredInputs ? hasPathMatch : false,
    reason: hasPathMatch ? undefined : "Selection does not match programme outline structure.",
    canonicalSemester: resolvedSemester ?? input.semester,
    canonicalCourse: selectedCourse?.title ?? input.course,
    canonicalTopic: selectedTopic?.title ?? input.topic,
    canonicalSubtopic: selectedSubtopic?.title ?? input.subtopic,
    canonicalMinorTopic: selectedMinorTopic?.title ?? input.minorTopic,
    topicNumber: selectedTopic?.number,
    subtopicNumber: selectedSubtopic?.number,
    minorTopicNumber: selectedMinorTopic?.number,
    suggestions: {
      semesters: semestersPool.map((semester) => semester.label).slice(0, 12),
      courses: semesterCandidates
        .flatMap((semester) => semester.courses.map((course) => course.title))
        .slice(0, 40),
      topics: (selectedCourse ? selectedCourse.topics : topicPool)
        .map((topic) => `${topic.number ?? ""} ${topic.title}`.trim())
        .filter((label) => !isNoisePlannerLabel(label))
        .slice(0, 60),
      subtopics: (selectedTopic ? selectedTopic.subtopics : subtopicPool)
        .map((subtopic) => `${subtopic.number ?? ""} ${subtopic.title}`.trim())
        .filter((label) => !isNoisePlannerLabel(label))
        .slice(0, 80),
      minorTopics: (selectedSubtopic
        ? selectedSubtopic.minorTopics
        : minorTopicPool
      )
        .map(
          (minorTopic) =>
            `${minorTopic.number ?? ""} ${minorTopic.title}`.trim(),
        )
        .filter((label) => !isNoisePlannerLabel(label))
        .slice(0, 120),
    },
  };
}
