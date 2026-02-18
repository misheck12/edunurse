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
    .replace(/\s+/g, " ")
    .trim();
}

function isNoisePlannerLabel(value: string | undefined | null) {
  const normalized = normalize(value).replace(/^(?:\d+\s*)+/, "").trim();
  if (!normalized) return true;
  return (
    normalized.includes("unspecified") ||
    normalized === "unit introduction" ||
    normalized === "introduction" ||
    normalized === "unit learning outcome" ||
    normalized === "unit learning outcomes" ||
    normalized === "unit summary" ||
    normalized === "summary" ||
    normalized === "references" ||
    normalized === "reference" ||
    normalized === "references and further reading" ||
    normalized === "references and further readings" ||
    normalized === "self assessment test" ||
    normalized === "self assessment tests" ||
    normalized === "self assessment question" ||
    normalized === "self assessment questions"
  );
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
    value === "zambia"
  );
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

  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const label = normalizeForMatch(labelOf(item));
    if (!label) continue;
    let score = 0;
    if (label === needle) score = 300;
    else if (label.includes(needle)) score = 220;
    else if (needle.includes(label)) score = 180;
    else {
      const tokens = needle.split(" ").filter((token) => token.length >= 3);
      const hits = tokens.filter((token) => label.includes(token)).length;
      if (hits > 0) {
        const overlapRatio = hits / Math.max(1, tokens.length);
        score = Math.round(hits * 25 + overlapRatio * 40);
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
      const topics = Array.isArray(entry.topics)
        ? entry.topics
            .filter((topic) => topic && typeof topic === "object")
            .map((topic) => ({
              number:
                typeof topic.topic_number === "string"
                  ? topic.topic_number.trim()
                  : undefined,
              title: titleCase(String(topic.topic_title ?? "Untitled Topic")),
              subtopics: Array.isArray(topic.subtopics)
                ? topic.subtopics
                    .filter((subtopic) => subtopic && typeof subtopic === "object")
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
                                typeof minorTopic === "object",
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
  const byKey = new Map<string, StructuredTopic>();
  for (const topic of existing) {
    const key = `${topic.number ?? ""}|${normalize(topic.title)}`;
    byKey.set(key, {
      ...topic,
      subtopics: topic.subtopics.map((subtopic) => ({
        ...subtopic,
        minorTopics: [...subtopic.minorTopics],
      })),
    });
  }

  for (const topic of incoming) {
    const key = `${topic.number ?? ""}|${normalize(topic.title)}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        ...topic,
        subtopics: topic.subtopics.map((subtopic) => ({
          ...subtopic,
          minorTopics: [...subtopic.minorTopics],
        })),
      });
      continue;
    }

    const existingSubtopicKeys = new Set(
      current.subtopics.map((subtopic) => `${subtopic.number ?? ""}|${normalize(subtopic.title)}`),
    );
    for (const subtopic of topic.subtopics) {
      const subtopicKey = `${subtopic.number ?? ""}|${normalize(subtopic.title)}`;
      if (!existingSubtopicKeys.has(subtopicKey)) {
        current.subtopics.push(subtopic);
        existingSubtopicKeys.add(subtopicKey);
        continue;
      }

      const target = current.subtopics.find(
        (item) =>
          `${item.number ?? ""}|${normalize(item.title)}` === subtopicKey,
      );
      if (!target) continue;
      const minorTopicKeys = new Set(
        target.minorTopics.map(
          (minorTopic) =>
            `${minorTopic.number ?? ""}|${normalize(minorTopic.title)}`,
        ),
      );
      for (const minorTopic of subtopic.minorTopics) {
        const minorKey = `${minorTopic.number ?? ""}|${normalize(minorTopic.title)}`;
        if (!minorTopicKeys.has(minorKey)) {
          target.minorTopics.push(minorTopic);
          minorTopicKeys.add(minorKey);
        }
      }
    }
  }

  return Array.from(byKey.values());
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

  const parseTopics = (topics?: Topic[]) =>
    Array.isArray(topics)
      ? topics
          .filter((topic) => topic && typeof topic === "object")
          .map((topic) => ({
            number:
              typeof topic.topic_number === "string"
                ? topic.topic_number.trim()
                : undefined,
            title: titleCase(String(topic.topic_title ?? "Untitled Topic")),
            subtopics: Array.isArray(topic.subtopics)
              ? topic.subtopics
                  .filter((subtopic) => subtopic && typeof subtopic === "object")
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
                              typeof minorTopic === "object",
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

  for (const doc of Object.values(documentsMap)) {
    if (!doc || typeof doc !== "object" || doc.error) continue;
    const file = doc.file ?? "Untitled";
    const semesterLabel = parseSemesterFromRelativePath(doc.relative_path);
    const rawCourse =
      (doc.course_id && coursesMap[doc.course_id]) || undefined;
    const courseTitle = isGenericCourseLabel(rawCourse)
      ? cleanCourseFromFileName(file)
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
        .slice(0, 60),
      subtopics: (selectedTopic ? selectedTopic.subtopics : subtopicPool)
        .map((subtopic) => `${subtopic.number ?? ""} ${subtopic.title}`.trim())
        .slice(0, 80),
      minorTopics: (selectedSubtopic
        ? selectedSubtopic.minorTopics
        : minorTopicPool
      )
        .map(
          (minorTopic) =>
            `${minorTopic.number ?? ""} ${minorTopic.title}`.trim(),
        )
        .slice(0, 120),
    },
  };
}
