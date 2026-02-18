import { createHash } from "node:crypto";
import { env } from "../config.js";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import PDFDocument from "pdfkit";
import * as PptxGenJSImport from "pptxgenjs";
import {
  expandLessonContentWithProviderFallback,
  type RetrievalChunkForPrompt,
} from "./ai-layer.js";

interface RenderInput {
  title: string;
  programme: string;
  year?: string | null;
  topic: string;
  documentType?: string | null;
  contentJson: Record<string, unknown>;
}

interface CitationLike {
  sourceName?: string;
  page?: number | null;
  quoteSnippet?: string;
}

type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string };

type ParsedSection = {
  id: string;
  title: string;
  type: string;
  content: unknown;
  blocks: ContentBlock[];
  citations: string[];
};

type LessonPresentationRow = {
  time: string;
  specificObjective: string;
  content: string;
  educatorActivities: string;
  learnerActivities: string;
  materials: string;
  assessment: string;
};

const LESSON_TEMPLATE = {
  institutionName: "LUSAKA OPEN BUSINESS COLLEGE",
  planTitle: "CLASSROOM LESSON PLAN",
} as const;

const LESSON_PRESENTATION_COLUMNS: Array<TableColumn<LessonPresentationRow>> = [
  { key: "time", label: "TIME/MINUTES", widthRatio: 0.8 },
  { key: "specificObjective", label: "SPECIFIC OBJECTIVE", widthRatio: 1.8 },
  { key: "content", label: "CONTENT", widthRatio: 3.4 },
  { key: "materials", label: "AUDIO VISUAL AID", widthRatio: 1.2 },
  { key: "educatorActivities", label: "TEACHER'S ACTIVITY", widthRatio: 1.5 },
  { key: "learnerActivities", label: "LEANER'S ACTIVITY", widthRatio: 1.5 },
  { key: "assessment", label: "EVALUATION", widthRatio: 0.9 },
];

const TABLE_CELL_CHAR_LIMITS = {
  time: 40,
  specificObjective: 320,
  content: 1400,
  educatorActivities: 520,
  learnerActivities: 520,
  materials: 240,
  assessment: 260,
} as const;
const LESSON_PRESENTATION_ROW_COUNT = 6;
const LESSON_PRESENTATION_SLOT_MINUTES = 10;

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function compactText(
  value: string,
  maxChars: number,
  options?: { preserveLineBreaks?: boolean },
) {
  const preserveLineBreaks = options?.preserveLineBreaks ?? false;
  const base = sanitizeInlineMarkdown(normalizeText(value)).replace(/\r\n/g, "\n");
  const clean = preserveLineBreaks
    ? base
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    : base
      .replace(/\s+/g, " ")
      .trim();
  
  if (clean.length <= maxChars) return clean;
  
  // Try to break at sentence boundary first
  const sentenceEnd = clean.slice(0, maxChars).lastIndexOf('. ');
  if (sentenceEnd > maxChars * 0.6) {
    return clean.slice(0, sentenceEnd + 1).trim();
  }
  
  // Try to break at word boundary
  const lastSpace = clean.slice(0, maxChars - 3).lastIndexOf(' ');
  if (lastSpace > maxChars * 0.7) {
    return `${clean.slice(0, lastSpace).trim()}...`;
  }
  
  // Fallback to hard cut with ellipsis
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function compactHeaderValue(value: string) {
  return compactText(value, 72);
}

function formatContentCellText(value: string, maxChars: number) {
  const compact = compactText(value, maxChars, { preserveLineBreaks: true });
  return compact.replace(/\s*Definitions\/Descriptions:\s*/i, "\n\nDefinitions/Descriptions:\n");
}

const DOCX_BODY_FONT = "Times New Roman";
const DOCX_BODY_SIZE = 24; // 12pt (half-points)
const DOCX_LINE_SPACING = 360; // 1.5 line spacing for 12pt text

function createDocxDocument(
  sections: Array<{ properties: any; children: Array<Paragraph | Table> }>,
) {
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_BODY_FONT,
            size: DOCX_BODY_SIZE,
          },
          paragraph: {
            spacing: {
              line: DOCX_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
    },
    sections,
  });
}

function withDocxSpacing(spacing?: { before?: number; after?: number }) {
  return {
    ...(spacing ?? {}),
    line: DOCX_LINE_SPACING,
    lineRule: LineRuleType.AUTO,
  };
}

function createPptxInstance() {
  const Ctor =
    (PptxGenJSImport as any)?.default?.default ??
    (PptxGenJSImport as any)?.default ??
    (PptxGenJSImport as any);
  if (typeof Ctor !== "function") {
    throw new Error("pptxgenjs constructor could not be resolved");
  }
  return new Ctor();
}

/**
 * Sanitize markdown and HTML formatting from text while preserving content.
 * Removes common markdown markers and HTML tags.
 * 
 * @param text - The text to sanitize
 * @returns The sanitized text with formatting removed
 */
function sanitizeInlineMarkdown(text: string): string {
  if (!text) return "";

  let result = text;

  // Check if it looks like HTML, if so strip tags
  if (result.includes("<") && result.includes(">")) {
    // Remove HTML tags but preserve content
    result = result.replace(/<[^>]*>/g, "");
    // Decode common HTML entities
    result = result
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  // Remove markdown formatting markers
  result = result
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")  // Bold + Italic
    .replace(/___(.+?)___/g, "$1")        // Bold + Italic
    .replace(/\*\*(.+?)\*\*/g, "$1")      // Bold
    .replace(/\*(.+?)\*/g, "$1")          // Italic
    .replace(/__(.+?)__/g, "$1")          // Bold
    .replace(/_(.+?)_/g, "$1")            // Italic
    .replace(/~~(.+?)~~/g, "$1")          // Strikethrough
    .replace(/`([^`]+)`/g, "$1")          // Inline code
    .replace(/```[\s\S]*?```/g, "")       // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Links [text](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // Images ![alt](url)
    .replace(/^#+\s+/gm, "")              // Headings
    .replace(/^>\s+/gm, "");              // Blockquotes

  return result.trim();
}

function citationToLine(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return sanitizeInlineMarkdown(value);
  if (typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const source = normalizeText(record.sourceName ?? "Curriculum source");
  const page = normalizeText(record.page);
  const quote = sanitizeInlineMarkdown(normalizeText(record.quoteSnippet));
  return [source, page ? `(p.${page})` : "", quote ? `- ${quote}` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Extract text content from various data structures.
 * Tries multiple common field names to find text content.
 * 
 * @param item - The item to extract text from (string, array, or object)
 * @returns The extracted text or empty string
 */
function extractTextFromItem(item: unknown): string {
  if (item === null || item === undefined) return "";

  if (typeof item === "string") {
    return item.trim();
  }

  if (typeof item === "number" || typeof item === "boolean") {
    return String(item);
  }

  if (typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;

    // Try common field names in order of preference
    const fieldNames = [
      "text", "content", "description", "value",
      "question", "statement", "activity", "note",
      "body", "message", "detail", "data"
    ];

    for (const fieldName of fieldNames) {
      if (fieldName in obj && obj[fieldName]) {
        const value = obj[fieldName];
        if (typeof value === "string") {
          return value.trim();
        }
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
      }
    }
  }

  return "";
}

/**
 * Parse sections from the input document, handling various content structures.
 * Supports string, array, and object content types with robust field name recognition.
 * 
 * @param input - The render input containing contentJson with sections
 * @returns Array of parsed sections with extracted blocks and citations
 */
function parseSections(input: RenderInput): ParsedSection[] {
  const rawSections = (input.contentJson.sections as any[]) || [];

  return rawSections.map((s: any) => {
    const blocks: ContentBlock[] = [];

    // Handle different content types to populate blocks
    if (typeof s.content === "string") {
      // Simple text content - split by newlines for better formatting
      const text = s.content.trim();
      if (!text) {
        // Empty content, skip
      } else if (text.includes('\n')) {
        // Multi-line text - split into separate paragraphs
        const lines = text.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          const clean = sanitizeInlineMarkdown(line.trim());
          if (clean) blocks.push({ kind: "paragraph", text: clean });
        });
      } else {
        // Single line text
        const clean = sanitizeInlineMarkdown(text);
        if (clean) blocks.push({ kind: "paragraph", text: clean });
      }
    } else if (Array.isArray(s.content)) {
      // List or structured content
      s.content.forEach((item: any) => {
        if (typeof item === 'string') {
          const clean = sanitizeInlineMarkdown(item.trim());
          if (clean) blocks.push({ kind: "bullet", text: clean });
        } else if (typeof item === 'object' && item !== null) {
          // Try to extract text from object using multiple field names
          const text = extractTextFromItem(item);
          if (text) {
            const clean = sanitizeInlineMarkdown(text);
            if (clean) blocks.push({ kind: "bullet", text: clean });
          }
        } else if (typeof item === 'number' || typeof item === 'boolean') {
          // Handle primitive types in arrays
          const clean = sanitizeInlineMarkdown(String(item));
          if (clean) blocks.push({ kind: "bullet", text: clean });
        }
      });
    } else if (typeof s.content === 'object' && s.content !== null) {
      // Object content - try to extract meaningful text
      const text = extractTextFromItem(s.content);
      if (text) {
        // Check if the text contains newlines for multi-line handling
        if (text.includes('\n')) {
          const lines = text.split('\n').filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            const clean = sanitizeInlineMarkdown(line.trim());
            if (clean) blocks.push({ kind: "paragraph", text: clean });
          });
        } else {
          const clean = sanitizeInlineMarkdown(text);
          if (clean) blocks.push({ kind: "paragraph", text: clean });
        }
      }
    }

    return {
      id: s.id ?? "",
      title: s.title ?? "Untitled Section",
      type: s.type ?? "text",
      content: s.content,
      blocks,
      citations: Array.isArray(s.citations)
        ? s.citations
          .map((citation: unknown) => citationToLine(citation))
          .filter(Boolean)
        : []
    };
  });
}

function toPresentationRows(section?: ParsedSection) {
  if (!section || !Array.isArray(section.content)) return [] as LessonPresentationRow[];
  const rows: LessonPresentationRow[] = [];
  for (const row of section.content) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    rows.push({
      time: compactText(
        normalizeText(rec.time ?? rec.timeMinutes ?? rec.duration ?? ""),
        TABLE_CELL_CHAR_LIMITS.time,
      ),
      specificObjective: compactText(
        normalizeText(rec.specificObjective ?? rec.objective ?? rec.obj ?? ""),
        TABLE_CELL_CHAR_LIMITS.specificObjective,
      ),
      content: formatContentCellText(
        normalizeText(rec.content ?? rec.topic ?? rec.concepts ?? rec.activity ?? ""),
        TABLE_CELL_CHAR_LIMITS.content,
      ),
      educatorActivities: compactText(
        normalizeText(rec.educatorActivities ?? rec.teacherActivities ?? rec.facilitatorActivities ?? ""),
        TABLE_CELL_CHAR_LIMITS.educatorActivities,
      ),
      learnerActivities: compactText(
        normalizeText(rec.learnerActivities ?? rec.studentActivities ?? rec.participantActivities ?? ""),
        TABLE_CELL_CHAR_LIMITS.learnerActivities,
      ),
      materials: compactText(
        normalizeText(rec.materials ?? rec.resources ?? rec.tools ?? ""),
        TABLE_CELL_CHAR_LIMITS.materials,
      ),
      assessment: compactText(
        normalizeText(rec.assessment ?? rec.evaluation ?? rec.formativeCheck ?? ""),
        TABLE_CELL_CHAR_LIMITS.assessment,
      ),
    });
  }
  return rows.filter((row) => row.time || row.content || row.educatorActivities);
}

function completePresentationRow(
  topic: string,
  row: Partial<LessonPresentationRow>,
  index: number,
): LessonPresentationRow {
  const ensureDetail = (value: string | undefined, fallback: string) => {
    const clean = sanitizeInlineMarkdown(normalizeText(value));
    if (!clean) return fallback;
    const words = clean.split(/\s+/).filter(Boolean).length;
    return words >= 5 ? clean : `${clean}. ${fallback}`;
  };

  const defaultTime = `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`;
  const objectiveFallback =
    index === 0
      ? `Introduce foundational concepts of ${topic}.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? `Consolidate understanding and evaluate learning in ${topic}.`
        : index === 1
          ? `Develop understanding and application of ${topic}.`
          : `Deepen understanding and practical use of ${topic}.`;
  const contentFallback =
    index === 0
      ? `Orientation to ${topic}, relevance, and expected lesson outcomes.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? `Summary of key points in ${topic} and clarification of misconceptions.`
        : index === 1
          ? `Detailed content delivery for ${topic} with examples and guided discussion.`
          : `Detailed content delivery for ${topic} with explanation, examples, and guided application.`;
  const educatorFallback =
    index === 0
      ? "Introduces the topic, establishes expectations, and probes prior knowledge."
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Leads recap, reinforces major concepts, and closes with a focused reflection."
        : index === 1
          ? "Facilitates explanation, uses examples, asks probing questions, and gives feedback."
          : "Guides learner application, asks targeted probes, and corrects misconceptions.";
  const learnerFallback =
    index === 0
      ? "Respond to initial prompts, contribute prior ideas, and note objectives."
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Summarize learning points, ask clarifying questions, and reflect on understanding."
        : index === 1
          ? "Participate in guided discussion, analyze examples, and answer questions."
          : "Apply ideas in examples, discuss responses, and complete quick checks.";
  const materialFallback =
    index === 0
      ? "Whiteboard, marker, lesson guide"
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Summary notes"
        : index === 1
          ? "Handouts/slides, whiteboard, notebook"
          : "Handouts/case prompts, whiteboard";
  const assessmentFallback =
    index === 0
      ? `Oral baseline questions on ${topic}.`
      : index >= LESSON_PRESENTATION_ROW_COUNT - 1
        ? "Exit question and verbal summary check."
        : index === 1
          ? "Formative checks through questioning and mini-task responses."
          : "Focused formative checks aligned to the specific objective.";

  return {
    time:
      compactText(normalizeText(row.time), TABLE_CELL_CHAR_LIMITS.time) ||
      defaultTime,
    specificObjective: compactText(
      ensureDetail(row.specificObjective, objectiveFallback),
      TABLE_CELL_CHAR_LIMITS.specificObjective,
    ),
    content: formatContentCellText(
      ensureDetail(row.content, contentFallback),
      TABLE_CELL_CHAR_LIMITS.content,
    ),
    educatorActivities: compactText(
      ensureDetail(row.educatorActivities, educatorFallback),
      TABLE_CELL_CHAR_LIMITS.educatorActivities,
    ),
    learnerActivities: compactText(
      ensureDetail(row.learnerActivities, learnerFallback),
      TABLE_CELL_CHAR_LIMITS.learnerActivities,
    ),
    materials: compactText(
      ensureDetail(row.materials, materialFallback),
      TABLE_CELL_CHAR_LIMITS.materials,
    ),
    assessment: compactText(
      ensureDetail(row.assessment, assessmentFallback),
      TABLE_CELL_CHAR_LIMITS.assessment,
    ),
  };
}

function fallbackPresentationRows(topic: string): LessonPresentationRow[] {
  return [
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Describe the core concepts.",
      content: `Introduction to ${topic}.`,
      educatorActivities: "Introduce the topic and outline objectives.",
      learnerActivities: "Listen and take notes.",
      materials: "Whiteboard, Marker",
      assessment: "Q&A",
    },
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Analyze the main components.",
      content: `Detailed discussion on ${topic} features.`,
      educatorActivities: "Explain key features and lead discussion.",
      learnerActivities: "Participate in discussion.",
      materials: "Handouts",
      assessment: "Observation",
    },
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Apply concepts in a practical example.",
      content: `Applied case discussion for ${topic}.`,
      educatorActivities: "Facilitate a focused application example.",
      learnerActivities: "Interpret and discuss the example.",
      materials: "Case card",
      assessment: "Short oral check",
    },
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Differentiate key ideas and relationships.",
      content: "Compare major concepts and highlight distinctions.",
      educatorActivities: "Lead compare/contrast explanation.",
      learnerActivities: "Identify differences and similarities.",
      materials: "Comparison notes",
      assessment: "Pair response",
    },
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Reinforce nursing relevance.",
      content: "Relate key concepts to clinical context and safety.",
      educatorActivities: "Link lesson points to practice.",
      learnerActivities: "Share practice-linked insights.",
      materials: "Scenario prompt",
      assessment: "Targeted question",
    },
    {
      time: `${LESSON_PRESENTATION_SLOT_MINUTES} minutes`,
      specificObjective: "Summarize the lesson.",
      content: "Conclusion and wrap-up.",
      educatorActivities: "Summarize key points.",
      learnerActivities: "Ask clarifying questions.",
      materials: "None",
      assessment: "Exit Ticket",
    },
  ].slice(0, LESSON_PRESENTATION_ROW_COUNT);
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNeedle(value: string | null | undefined, needles: string[]) {
  const target = normalize(value);
  return needles.some((needle) => target.includes(needle));
}

function inferDocumentType(input: RenderInput) {
  const fromInput = normalize(input.documentType);
  if (fromInput) return fromInput;
  const metadata = safeRecord(input.contentJson.metadata);
  const type = typeof metadata.type === "string" ? metadata.type : "";
  return normalize(type);
}

function isLessonPlanRender(input: RenderInput) {
  const type = inferDocumentType(input);
  if (type.includes("lesson")) return true;
  return input.title.toLowerCase().includes("lesson plan");
}

function sectionByNeedle(sections: ParsedSection[], needles: string[]) {
  return (
    sections.find((section) => includesNeedle(section.id, needles)) ??
    sections.find((section) => includesNeedle(section.title, needles))
  );
}

function blocksToText(blocks: ContentBlock[]) {
  return blocks.map((block) => block.text).join("\n").trim();
}

function blocksToList(blocks: ContentBlock[]) {
  return blocks
    .map((block) => block.text.trim())
    .filter((value) => value.length > 0);
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function toHeaderRowsFromSection(section?: ParsedSection) {
  if (!section || !Array.isArray(section.content)) return [] as Array<{ label: string; value: string }>;
  return section.content
    .filter((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const label = sanitizeInlineMarkdown(
        normalizeText(rec.field ?? rec.label ?? rec.name ?? ""),
      );
      const value = sanitizeInlineMarkdown(
        normalizeText(rec.value ?? rec.content ?? rec.text ?? ""),
      );
      return { label, value };
    })
    .filter((row) => row.label && row.value);
}

function normalizeHeaderLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapHeaderRows(rows: Array<{ label: string; value: string }>) {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeHeaderLabel(row.label), sanitizeInlineMarkdown(row.value));
  }
  return map;
}

function readHeaderValue(
  rowMap: Map<string, string>,
  aliases: string[],
  fallback: string,
) {
  for (const alias of aliases) {
    const value = rowMap.get(normalizeHeaderLabel(alias));
    if (value && value.trim().length > 0) return value;
  }
  // If fallback is empty or whitespace-only, return underscores
  if (!fallback || fallback.trim().length === 0) {
    return "______________________";
  }
  return fallback;
}

type LessonPlanModel = {
  headerRows: Array<{ label: string; value: string }>;
  introduction: string;
  generalObjective: string;
  specificObjectives: string[];
  presentationRows: LessonPresentationRow[];
  summary: string;
  evaluation: string[];
  references: string[];
  assignmentItems: string[];
};

function mergeDefinitionsIntoRowContent(
  rows: LessonPresentationRow[],
  definitions: string[],
) {
  if (rows.length === 0 || definitions.length === 0) return rows;
  const cleanDefinitions = definitions
    .map((item) => sanitizeInlineMarkdown(normalizeText(item)))
    .filter(Boolean)
    .slice(0, Math.max(3, rows.length * 2));
  if (cleanDefinitions.length === 0) return rows;

  const next = rows.map((row) => ({ ...row }));
  let cursor = 0;
  for (let i = 0; i < next.length; i += 1) {
    if (next[i].content.toLowerCase().includes("definitions/descriptions:")) {
      next[i].content = formatContentCellText(
        next[i].content,
        TABLE_CELL_CHAR_LIMITS.content,
      );
      continue;
    }
    const selected = cleanDefinitions.slice(cursor, cursor + 2);
    cursor += 2;
    if (selected.length === 0) break;
    const detail = [
      "Definitions/Descriptions:",
      ...selected.map((item) => `- ${item}`),
    ].join("\n");
    const merged = next[i].content ? `${next[i].content}\n${detail}` : detail;
    next[i].content = formatContentCellText(
      merged,
      TABLE_CELL_CHAR_LIMITS.content,
    );
  }
  return next;
}

/**
 * Extract assignment items from various data structures.
 * Handles arrays, objects, and plain text with various numbering formats.
 * 
 * @param raw - The raw assignment content (string, array, or object)
 * @returns Array of assignment item strings
 */
function extractAssignmentItems(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(item => {
      if (typeof item === 'string') {
        return normalizeText(item);
      }
      if (typeof item === 'object' && item !== null) {
        // Use the enhanced extraction function
        const text = extractTextFromItem(item);
        return text;
      }
      if (typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      return "";
    }).filter(Boolean);
  }

  // Try to extract text from object
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const text = extractTextFromItem(raw);
    if (text) {
      raw = text;
    }
  }

  const text = normalizeText(raw);
  if (!text) return [];

  // Remove common instruction lines
  const cleaned = text
    .replace(/Indicate\s+whether\s+the\s+following\s+statements\s+are\s+True\s*\(T\)\s*or\s*False\s*\(F\)/i, "")
    .replace(/Answer\s+the\s+following\s+questions/i, "")
    .replace(/Complete\s+the\s+following/i, "")
    .trim();

  const items: string[] = [];
  const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match various numbering formats: "1. ", "1) ", "1.", "1)"
    const match = line.match(/^\s*(\d+)[\)\.]\s*(.+)$/);
    if (match?.[2]) {
      items.push(match[2].trim());
    } else if (items.length === 0 && line.length > 10) {
      // If no numbered items found yet and line is substantial, include it
      items.push(line);
    }
  }

  // If we found numbered items, return them; otherwise return all substantial lines
  if (items.length > 0) return items;
  return lines.filter(line => line.length > 10);
}

function buildLessonPlanModel(input: RenderInput, sections: ParsedSection[]): LessonPlanModel {
  const metadata = safeRecord(input.contentJson.metadata);
  const curriculumContext = safeRecord(metadata.curriculumContext);

  const metadataSection = sectionByNeedle(sections, ["lesson_metadata", "context", "header"]);
  const introSection = sectionByNeedle(sections, ["introduction", "overview"]);
  const generalObjectiveSection = sectionByNeedle(sections, [
    "general_objective",
    "general objective",
    "objective",
  ]);
  const specificObjectivesSection = sectionByNeedle(sections, [
    "specific_objectives",
    "specific objective",
    "outcome",
    "learning_outcomes",
  ]);
  const definitionsSection = sectionByNeedle(sections, [
    "key_definitions",
    "definition",
    "glossary",
    "terminology",
  ]);
  const presentationSection = sectionByNeedle(sections, [
    "lesson_presentation",
    "teaching_flow",
    "presentation",
    "activities",
  ]);
  const summarySection = sectionByNeedle(sections, ["summary", "conclusion"]);
  const evaluationSection = sectionByNeedle(sections, ["evaluation", "assessment"]);
  const referencesSection = sectionByNeedle(sections, ["reference"]);

  // Strict check for assignment - improved matching
  const assignmentSection = sections.find(s => {
    const titleLower = s.title.toLowerCase().trim();
    const idLower = s.id.toLowerCase();
    return titleLower === "assignment" ||
      titleLower === "assignments" ||
      titleLower.includes("assignment") ||
      idLower.includes("assignment");
  });

  const headerRows = toHeaderRowsFromSection(metadataSection);
  const headerMap = mapHeaderRows(headerRows);
  const canonicalHeaderRows = [
    { label: "NAME OF STUDENT", value: readHeaderValue(headerMap, ["name of student", "student"], "") },
    { label: "STUDENT NUMBER", value: readHeaderValue(headerMap, ["student number", "index number"], "") },
    {
      label: "COURSE NAME",
      value: readHeaderValue(
        headerMap,
        ["course name", "course/module", "course", "module"],
        sanitizeInlineMarkdown(normalizeText(curriculumContext.course ?? "")),
      ),
    },
    {
      label: "PROGRAMME",
      value: readHeaderValue(
        headerMap,
        ["programme", "programme level", "level"],
        sanitizeInlineMarkdown(normalizeText(curriculumContext.programmeLevel ?? "")),
      ),
    },
    {
      label: "NAME OF TOPIC",
      value: readHeaderValue(
        headerMap,
        ["name of topic", "topic"],
        sanitizeInlineMarkdown(
          [
            input.topic,
            normalizeText(curriculumContext.subtopic) ? ` - ${normalizeText(curriculumContext.subtopic)}` : "",
            normalizeText(curriculumContext.minorTopic) ? ` - ${normalizeText(curriculumContext.minorTopic)}` : "",
          ]
            .join("")
            .trim(),
        ) || "",
      ),
    },
    {
      label: "DATE",
      value: readHeaderValue(headerMap, ["date", "lesson date"], ""),
    },
    {
      label: "VENUE",
      value: readHeaderValue(headerMap, ["venue"], ""),
    },
    {
      label: "INTAKE",
      value: readHeaderValue(headerMap, ["intake"], ""),
    },
    {
      label: "SIZE OF CLASS",
      value: readHeaderValue(headerMap, ["size of class", "number of students", "students"], ""),
    },
    {
      label: "TIME",
      value: readHeaderValue(headerMap, ["time"], ""),
    },
    {
      label: "DURATION",
      value: readHeaderValue(headerMap, ["duration", "duration (minutes)"], ""),
    },
    {
      label: "METHOD OF TEACHING",
      value: readHeaderValue(headerMap, ["method of teaching", "method of instruction", "method"], ""),
    },
    {
      label: "MEDIA OF TEACHING",
      value: readHeaderValue(headerMap, ["media of teaching", "media", "teaching media"], ""),
    },
    {
      label: "NAME OF SUPERVISOR",
      value: readHeaderValue(headerMap, ["name of supervisor", "supervisor"], ""),
    },
  ];

  const introText = blocksToText(introSection?.blocks ?? []);
  const generalObjectiveText = blocksToText(generalObjectiveSection?.blocks ?? []);
  const specificObjectives = blocksToList(specificObjectivesSection?.blocks ?? []);
  const keyDefinitions = blocksToList(definitionsSection?.blocks ?? []);
  const basePresentationRows =
    toPresentationRows(presentationSection).length > 0
      ? toPresentationRows(presentationSection)
      : fallbackPresentationRows(input.topic);
  const seededRows = [...basePresentationRows].slice(0, LESSON_PRESENTATION_ROW_COUNT);
  while (seededRows.length < LESSON_PRESENTATION_ROW_COUNT) {
    seededRows.push({
      time: "",
      specificObjective: "",
      content: "",
      educatorActivities: "",
      learnerActivities: "",
      materials: "",
      assessment: "",
    });
  }
  const completedRows = seededRows.map((row, index) =>
    completePresentationRow(input.topic, row, index),
  );
  const presentationRows = mergeDefinitionsIntoRowContent(completedRows, keyDefinitions);
  const summaryText = blocksToText(summarySection?.blocks ?? []);
  const evaluation = blocksToList(evaluationSection?.blocks ?? []);

  // Extract assignment items
  let assignmentItems: string[] = [];
  if (assignmentSection) {
    // If blocks were already parsed into bullets, use them
    const fromBlocks = blocksToList(assignmentSection.blocks);
    if (fromBlocks.length > 0) {
      assignmentItems = fromBlocks;
    } else {
      // Fallback to raw content extraction
      assignmentItems = extractAssignmentItems(assignmentSection.content);
    }
  }

  const citations = sections.flatMap((section) => section.citations);
  const references = unique([
    ...blocksToList(referencesSection?.blocks ?? []),
    ...citations.map((citation) => citation.replace(/^Source:\s*/i, "")),
  ]);

  return {
    headerRows: canonicalHeaderRows,
    introduction: introText || `This lesson focuses on ${input.topic}.`,
    generalObjective:
      generalObjectiveText ||
      `By the end of the discussion/lecture, learners should understand key concepts in ${input.topic}.`,
    specificObjectives,
    presentationRows,
    summary:
      summaryText ||
      `The lesson covered key concepts of ${input.topic} and reinforced understanding through guided questions and discussion.`,
    evaluation,
    references,
    assignmentItems,
  };
}

function writeLabelLinePdf(pdf: InstanceType<typeof PDFDocument>, label: string, value: string) {
  pdf
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(`${label}: `, { continued: true })
    .font("Helvetica")
    .text(value);
}

function textWithPageBreakPdf(pdf: InstanceType<typeof PDFDocument>, text: string, opts?: PDFKit.Mixins.TextOptions) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;
  if (pdf.y > bottom - 40) {
    pdf.addPage();
  }
  pdf.text(text, opts);
}

function renderGenericPdfBuffer(input: RenderInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pdf = new PDFDocument({
      margin: 56,
      size: "A4",
      info: {
        Title: "EduNurse Export",
        Author: "EduNurse",
      },
    });

    pdf.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));

    const sections = parseSections(input);

    pdf.font("Helvetica-Bold").fontSize(24).text(sanitizeInlineMarkdown(input.title));
    pdf.moveDown(0.8);

    writeLabelLinePdf(pdf, "Programme", sanitizeInlineMarkdown(input.programme));
    writeLabelLinePdf(pdf, "Year", sanitizeInlineMarkdown(input.year ?? "Not specified"));
    writeLabelLinePdf(pdf, "Topic", sanitizeInlineMarkdown(input.topic));

    pdf
      .moveDown(0.8)
      .strokeColor("#D8DEE9")
      .lineWidth(1)
      .moveTo(pdf.page.margins.left, pdf.y)
      .lineTo(pdf.page.width - pdf.page.margins.right, pdf.y)
      .stroke();
    pdf.moveDown(0.8);

    sections.forEach((section, index) => {
      pdf.font("Helvetica-Bold").fontSize(15).text(`${index + 1}. ${section.title}`);
      pdf.moveDown(0.35);

      section.blocks.forEach((block) => {
        if (block.kind === "bullet") {
          pdf.font("Helvetica").fontSize(11.5).text(`- ${block.text}`, {
            indent: 14,
            paragraphGap: 5,
            lineGap: 1,
          });
        } else {
          pdf.font("Helvetica").fontSize(11.5).text(block.text, {
            paragraphGap: 6,
            lineGap: 1,
          });
        }
      });

      if (section.citations.length > 0) {
        pdf.moveDown(0.2);
        pdf.font("Helvetica-Oblique").fontSize(9.5).text("References:");
        section.citations.forEach((citation) => {
          pdf.font("Helvetica-Oblique").fontSize(9.5).text(`- ${citation}`, {
            indent: 10,
            lineGap: 1,
          });
        });
      }

      pdf.moveDown(0.8);
    });

    pdf.end();
  });
}

type TableColumn<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
  widthRatio: number;
};

function measurePdfTableCellHeight(
  pdf: InstanceType<typeof PDFDocument>,
  text: string,
  width: number,
  fontSize: number,
  lineGap: number,
  isContentColumn: boolean,
) {
  const normalized = isContentColumn
    ? formatContentCellText(text, TABLE_CELL_CHAR_LIMITS.content)
    : sanitizeInlineMarkdown(normalizeText(text));

  const markerMatch = isContentColumn
    ? normalized.match(/([\s\S]*?)\n\nDefinitions\/Descriptions:\s*([\s\S]*)/i)
    : null;

  if (!markerMatch) {
    pdf.font("Times-Roman").fontSize(fontSize);
    return pdf.heightOfString(normalized || " ", {
      width,
      align: "left",
      lineGap,
    });
  }

  const preface = (markerMatch[1] ?? "").trim();
  const details = (markerMatch[2] ?? "").trim();
  let height = 0;

  if (preface) {
    pdf.font("Times-Roman").fontSize(fontSize);
    height += pdf.heightOfString(preface, { width, align: "left", lineGap });
  }

  height += lineGap * 2;

  pdf.font("Times-Bold").fontSize(fontSize);
  height += pdf.heightOfString("Definitions/Descriptions:", {
    width,
    align: "left",
    lineGap,
  });

  if (details) {
    pdf.font("Times-Roman").fontSize(fontSize);
    height += pdf.heightOfString(details, { width, align: "left", lineGap });
  }

  return height;
}

function drawPdfTableCellContent(
  pdf: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  lineGap: number,
  isContentColumn: boolean,
) {
  const normalized = isContentColumn
    ? formatContentCellText(text, TABLE_CELL_CHAR_LIMITS.content)
    : sanitizeInlineMarkdown(normalizeText(text));

  const markerMatch = isContentColumn
    ? normalized.match(/([\s\S]*?)\n\nDefinitions\/Descriptions:\s*([\s\S]*)/i)
    : null;

  if (!markerMatch) {
    pdf.font("Times-Roman").fontSize(fontSize);
    pdf.text(normalized || " ", x, y, {
      width,
      align: "left",
      lineGap,
    });
    return;
  }

  let cursorY = y;
  const preface = (markerMatch[1] ?? "").trim();
  const details = (markerMatch[2] ?? "").trim();

  if (preface) {
    pdf.font("Times-Roman").fontSize(fontSize);
    pdf.text(preface, x, cursorY, { width, align: "left", lineGap });
    cursorY = pdf.y;
  }

  cursorY += lineGap;
  pdf.font("Times-Bold").fontSize(fontSize);
  pdf.text("Definitions/Descriptions:", x, cursorY, {
    width,
    align: "left",
    lineGap,
  });
  cursorY = pdf.y;

  if (details) {
    pdf.font("Times-Roman").fontSize(fontSize);
    pdf.text(details, x, cursorY, { width, align: "left", lineGap });
  }
}

function drawPdfTable<T extends Record<string, unknown>>(
  pdf: InstanceType<typeof PDFDocument>,
  columns: Array<TableColumn<T>>,
  rows: T[],
  options?: {
    fontSize?: number;
    headerFontSize?: number;
    rowPadding?: number;
    lineGap?: number;
    minHeaderHeight?: number;
    minRowHeight?: number;
  },
) {
  const left = pdf.page.margins.left;
  const right = pdf.page.width - pdf.page.margins.right;
  const width = right - left;

  const fontSize = options?.fontSize ?? 12;
  const headerFontSize = options?.headerFontSize ?? 12;
  const rowPadding = options?.rowPadding ?? 5;
  const lineGap = options?.lineGap ?? 2;
  const minHeaderHeight = options?.minHeaderHeight ?? 24;
  const minRowHeight = options?.minRowHeight ?? 20;

  const totalRatio = columns.reduce((a, b) => a + b.widthRatio, 0);
  const columnWidths = columns.map((col) => (col.widthRatio / totalRatio) * width);

  const bottomLimit = () => pdf.page.height - pdf.page.margins.bottom;

  pdf.font("Times-Bold").fontSize(headerFontSize);
  const headerHeight = Math.max(
    ...columns.map((col, idx) =>
      Math.max(
        minHeaderHeight,
        pdf.heightOfString(col.label, {
          width: columnWidths[idx] - rowPadding * 2,
          align: "left",
          lineGap,
        }) +
        rowPadding * 2,
      ),
    ),
  );

  const drawHeader = () => {
    if (pdf.y + headerHeight > bottomLimit()) pdf.addPage();

    const y0 = pdf.y; // lock Y
    let x = left;

    pdf.font("Times-Bold").fontSize(headerFontSize);

    for (let i = 0; i < columns.length; i += 1) {
      const w = columnWidths[i];

      pdf.rect(x, y0, w, headerHeight).stroke("#333333");
      pdf.text(columns[i].label, x + rowPadding, y0 + rowPadding, {
        width: w - rowPadding * 2,
        align: "left",
        lineGap,
      });

      // IMPORTANT: prevent pdf.text() advancing y (stair-step bug)
      pdf.y = y0;
      x += w;
    }

    pdf.y = y0 + headerHeight; // advance once
  };

  drawHeader();

  for (const row of rows) {
    const cellTexts = columns.map((col) =>
      normalizeText(row[col.key]),
    );

    const cellHeights = cellTexts.map((text, idx) =>
      Math.max(
        minRowHeight,
        measurePdfTableCellHeight(
          pdf,
          text || " ",
          columnWidths[idx] - rowPadding * 2,
          fontSize,
          lineGap,
          String(columns[idx].key) === "content",
        ) +
        rowPadding * 2,
      ),
    );

    const rowHeight = Math.max(...cellHeights);

    if (pdf.y + rowHeight > bottomLimit()) {
      pdf.addPage();
      drawHeader();
    }

    const y0 = pdf.y; // lock Y
    let x = left;

    for (let i = 0; i < columns.length; i += 1) {
      const w = columnWidths[i];
      const isContentColumn = String(columns[i].key) === "content";

      pdf.rect(x, y0, w, rowHeight).stroke("#6B7280");
      drawPdfTableCellContent(
        pdf,
        cellTexts[i] || " ",
        x + rowPadding,
        y0 + rowPadding,
        w - rowPadding * 2,
        fontSize,
        lineGap,
        isContentColumn,
      );

      // IMPORTANT: prevent pdf.text() advancing y (stair-step bug)
      pdf.y = y0;
      x += w;
    }

    pdf.y = y0 + rowHeight; // advance once per row
  }
}

function drawHeaderGrid(
  pdf: InstanceType<typeof PDFDocument>,
  input: RenderInput,
  model: LessonPlanModel,
) {
  const left = pdf.page.margins.left;
  const right = pdf.page.width - pdf.page.margins.right;
  const width = right - left;

  // Column width ratios: 22%, 39%, 16%, 23%
  const col1W = width * 0.22;
  const col2W = width * 0.39;
  const col3W = width * 0.16;
  const col4W = width * 0.23;

  const drawRow = (label1: string, val1: string, label2: string, val2: string) => {
    const y0 = pdf.y;
    const gap = 4;
    const rowPadding = 6;
    const safeVal1 = compactHeaderValue(val1);
    const safeVal2 = compactHeaderValue(val2);

    pdf.font("Times-Bold").fontSize(12);
    const h1 = pdf.heightOfString(label1, { width: col1W - 8, lineGap: gap });
    pdf.font("Times-Roman").fontSize(12);
    const h2 = pdf.heightOfString(safeVal1, { width: col2W - 8, lineGap: gap });
    pdf.font("Times-Bold").fontSize(12);
    const h3 = pdf.heightOfString(label2, { width: col3W - 8, lineGap: gap });
    pdf.font("Times-Roman").fontSize(12);
    const h4 = pdf.heightOfString(safeVal2, { width: col4W - 8, lineGap: gap });
    const rowHeight = Math.max(28, Math.max(h1, h2, h3, h4) + rowPadding * 2);

    if (y0 + rowHeight > pdf.page.height - pdf.page.margins.bottom) {
      pdf.addPage();
    }
    const rowY = pdf.y;

    pdf.font("Times-Bold").fontSize(12);
    pdf.text(label1, left + 4, rowY + rowPadding, {
      width: col1W - 8,
      lineGap: gap,
    });

    pdf.font("Times-Roman").fontSize(12);
    pdf.text(safeVal1, left + col1W + 4, rowY + rowPadding, {
      width: col2W - 8,
      lineGap: gap,
    });

    pdf.font("Times-Bold").fontSize(12);
    pdf.text(label2, left + col1W + col2W + 4, rowY + rowPadding, {
      width: col3W - 8,
      lineGap: gap,
    });

    pdf.font("Times-Roman").fontSize(12);
    pdf.text(safeVal2, left + col1W + col2W + col3W + 4, rowY + rowPadding, {
      width: col4W - 8,
      lineGap: gap,
    });

    pdf.y = rowY + rowHeight;
  };

  const headerMap = mapHeaderRows(model.headerRows);

  drawRow(
    "NAME OF STUDENT:",
    readHeaderValue(headerMap, ["name of student"], "______________________"),
    "STUDENT NUMBER:",
    readHeaderValue(headerMap, ["student number", "index number"], "______________________"),
  );
  drawRow(
    "COURSE NAME:",
    readHeaderValue(headerMap, ["course name"], "______________________"),
    "PROGRAMME:",
    readHeaderValue(headerMap, ["programme"], "______________________"),
  );
  drawRow(
    "NAME OF TOPIC:",
    readHeaderValue(headerMap, ["name of topic", "topic"], "______________________"),
    "VENUE:",
    readHeaderValue(headerMap, ["venue"], "______________________"),
  );
  drawRow(
    "INTAKE:",
    readHeaderValue(headerMap, ["intake"], "______________________"),
    "SIZE OF CLASS:",
    readHeaderValue(headerMap, ["size of class", "number of students"], "______________________"),
  );
  drawRow(
    "DATE:",
    readHeaderValue(headerMap, ["date"], "______________________"),
    "TIME:",
    readHeaderValue(headerMap, ["time"], "______________________"),
  );
  drawRow(
    "DURATION:",
    readHeaderValue(headerMap, ["duration"], "______________________"),
    "METHOD OF TEACHING:",
    readHeaderValue(headerMap, ["method of teaching", "method of instruction"], "______________________"),
  );
  drawRow(
    "NAME OF SUPERVISOR:",
    readHeaderValue(headerMap, ["name of supervisor"], "______________________"),
    "MEDIA OF TEACHING:",
    readHeaderValue(headerMap, ["media of teaching", "media"], "______________________"),
  );

  // Reset cursor to left margin after drawing the grid
  pdf.x = left;
}

function renderLessonPlanPdfBuffer(input: RenderInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pdf = new PDFDocument({
      margin: 56,
      size: "A4",
      layout: "landscape", // Changed to landscape
      info: { Title: "Lesson Plan", Author: "EduNurse" },
    });

    pdf.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));

    const sections = parseSections(input);
    const model = buildLessonPlanModel(input, sections);

    const left = pdf.page.margins.left;
    const fullW = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;

    // Line spacing for 1.5 spacing with 12pt font (6pt gap = 0.5 * 12pt)
    const bodyLineGap = 6;

    const ensureRemainingSpace = (minHeight: number) => {
      const bottom = pdf.page.height - pdf.page.margins.bottom;
      if (pdf.y + minHeight > bottom) {
        pdf.addPage();
      }
    };

    // ============================================================
    // PAGE 1: Institutional Header + Metadata Table ONLY
    // ============================================================
    pdf.font("Times-Bold").fontSize(14).text(LESSON_TEMPLATE.institutionName, { align: "center" });
    pdf.moveDown(0.2);
    pdf.font("Times-Bold").fontSize(12).text(LESSON_TEMPLATE.planTitle, { align: "center", underline: true });
    pdf.moveDown(1.5);
    drawHeaderGrid(pdf, input, model);

    // ============================================================
    // PAGE 2: Introduction ONLY
    // ============================================================
    pdf.addPage();
    pdf.moveDown(0.8);
    pdf.font("Times-Bold").fontSize(12).text("INTRODUCTION", { align: "left" });
    pdf.moveDown(0.6);
    pdf.font("Times-Roman").fontSize(12);
    textWithPageBreakPdf(pdf, model.introduction, {
      width: fullW,
      align: "justify",
      lineGap: bodyLineGap,
    });

    // ============================================================
    // PAGE 3: General Objective and Specific Objectives
    // ============================================================
    pdf.addPage();
    pdf.moveDown(0.8);

    // General Objective
    pdf.font("Times-Bold").fontSize(12).text("GENERAL OBJECTIVE", { align: "left" });
    pdf.moveDown(0.6);
    pdf.font("Times-Roman").fontSize(12);
    textWithPageBreakPdf(pdf, "By the end of the lecture/discussion, students should be able to:", {
      width: fullW,
      lineGap: bodyLineGap
    });
    pdf.moveDown(0.3);
    textWithPageBreakPdf(pdf, model.generalObjective, {
      width: fullW,
      lineGap: bodyLineGap,
    });

    // Specific Objectives (Learning Outcomes)
    if (model.specificObjectives.length > 0) {
      ensureRemainingSpace(220);
      pdf.moveDown(1);
      pdf.font("Times-Bold").fontSize(12).text("SPECIFIC OBJECTIVES", { align: "left" });
      pdf.moveDown(0.6);
      pdf.font("Times-Roman").fontSize(12);
      textWithPageBreakPdf(pdf, "By the end of the lecture/discussion student nurses should be able to:", {
        width: fullW,
        lineGap: bodyLineGap,
      });
      pdf.moveDown(0.3);
      model.specificObjectives.forEach((out, idx) => {
        textWithPageBreakPdf(pdf, `${idx + 1}. ${out}`, {
          width: fullW,
          indent: 14,
          lineGap: bodyLineGap,
        });
      });
    }

    // ============================================================
    // PAGE 4+: Lesson Presentation Table (continues across pages)
    // ============================================================
    pdf.addPage();
    pdf.x = left;
    pdf.moveDown(0.8);
    pdf.font("Times-Bold").fontSize(12).text("LESSON PRESENTATION", { align: "left" });
    pdf.moveDown(0.6);

    drawPdfTable<LessonPresentationRow>(pdf, LESSON_PRESENTATION_COLUMNS, model.presentationRows, {
      fontSize: 10.5,
      headerFontSize: 10.5,
      rowPadding: 4,
      lineGap: 2,
      minHeaderHeight: 20,
      minRowHeight: 18,
    });

    // ============================================================
    // LAST PAGES: Assignment, Facilitator Notes, Evaluation, References
    // ============================================================

    // Summary
    if (model.summary) {
      pdf.addPage();
      pdf.moveDown(0.8);
      pdf.font("Times-Bold").fontSize(12).text("SUMMARY", { align: "left" });
      pdf.moveDown(0.6);
      pdf.font("Times-Roman").fontSize(12);
      textWithPageBreakPdf(pdf, model.summary, { width: fullW, lineGap: bodyLineGap });
      pdf.moveDown(0.5);
    }

    // Evaluation
    if (model.evaluation.length > 0) {
      if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 200) {
        pdf.addPage();
        pdf.moveDown(0.8);
      } else {
        pdf.moveDown(1);
      }
      pdf.font("Times-Bold").fontSize(12).text("EVALUATION", { align: "left" });
      pdf.moveDown(0.6);
      pdf.font("Times-Roman").fontSize(12);
      model.evaluation.forEach((item, idx) => {
        textWithPageBreakPdf(pdf, `${idx + 1}. ${item}`, {
          width: fullW,
          indent: 14,
          lineGap: bodyLineGap,
        });
      });

      pdf.moveDown(0.5);
    }

    // Assignment
    if (model.assignmentItems.length > 0) {
      // Check if we need a new page
      if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 200) {
        pdf.addPage();
        pdf.moveDown(0.8);
      } else {
        pdf.moveDown(1);
      }

      pdf.font("Times-Bold").fontSize(12).text("ASSIGNMENT", { align: "left" });
      pdf.moveDown(0.6);

      pdf.font("Times-Roman").fontSize(12);
      textWithPageBreakPdf(
        pdf,
        "Indicate whether the following statements are True (T) or False (F)",
        { width: fullW, lineGap: bodyLineGap },
      );
      pdf.moveDown(0.5);

      model.assignmentItems.forEach((item, idx) => {
        const cleanItem = item.replace(/^\s*\d+[\)\.]\s*/, '').trim();
        textWithPageBreakPdf(pdf, `${idx + 1}) ${cleanItem}`, {
          width: fullW,
          indent: 14,
          lineGap: bodyLineGap,
        });
      });
    }

    // References
    if (model.references.length > 0) {
      // Check if we need a new page
      if (pdf.y > pdf.page.height - pdf.page.margins.bottom - 200) {
        pdf.addPage();
        pdf.moveDown(0.8);
      } else {
        pdf.moveDown(1);
      }

      pdf.font("Times-Bold").fontSize(12).text("REFERENCES", { align: "left" });
      pdf.moveDown(0.6);
      pdf.font("Times-Italic").fontSize(12);
      for (const item of model.references) {
        textWithPageBreakPdf(pdf, `- ${item}`, { width: fullW, lineGap: bodyLineGap });
      }
    }

    pdf.end();
  });
}

function labelParagraphDocx(label: string, value: string) {
  return new Paragraph({
    spacing: withDocxSpacing({ after: 100 }),
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: sanitizeInlineMarkdown(value) }),
    ],
  });
}

function genericDocxParagraphs(input: RenderInput, sections: ParsedSection[]) {
  const paragraphs: Paragraph[] = [];
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: withDocxSpacing({ after: 260 }),
      children: [new TextRun({ text: sanitizeInlineMarkdown(input.title), bold: true })],
    }),
  );
  paragraphs.push(labelParagraphDocx("Programme", input.programme));
  paragraphs.push(labelParagraphDocx("Year", input.year ?? "Not specified"));
  paragraphs.push(labelParagraphDocx("Topic", input.topic));
  paragraphs.push(new Paragraph({ text: "", spacing: withDocxSpacing({ after: 80 }) }));

  sections.forEach((section, index) => {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: withDocxSpacing({ before: 200, after: 120 }),
        children: [new TextRun(`${index + 1}. ${section.title}`)],
      }),
    );
    section.blocks.forEach((block) => {
      if (block.kind === "bullet") {
        paragraphs.push(
          new Paragraph({
            text: block.text,
            bullet: { level: 0 },
            spacing: withDocxSpacing({ after: 60 }),
          }),
        );
      } else {
        paragraphs.push(
          new Paragraph({
            text: block.text,
            spacing: withDocxSpacing({ after: 120 }),
          }),
        );
      }
    });
    if (section.citations.length > 0) {
      paragraphs.push(
        new Paragraph({
          spacing: withDocxSpacing({ before: 40, after: 40 }),
          children: [new TextRun({ text: "References:", italics: true })],
        }),
      );
      section.citations.forEach((citation) => {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: withDocxSpacing({ after: 50 }),
            children: [new TextRun({ text: citation, italics: true })],
          }),
        );
      });
    }
  });
  return paragraphs;
}

function docxCellParagraphs(text: string) {
  const clean = formatContentCellText(text, TABLE_CELL_CHAR_LIMITS.content * 2);
  if (!clean) {
    return [new Paragraph({ text: "", spacing: withDocxSpacing() })];
  }
  const lines = clean.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      paragraphs.push(
        new Paragraph({
          text: "",
          spacing: withDocxSpacing({ after: 40 }),
        }),
      );
      continue;
    }

    const markerMatch = line.match(/^Definitions\/Descriptions:\s*(.*)$/i);
    if (markerMatch) {
      paragraphs.push(
        new Paragraph({
          text: "",
          spacing: withDocxSpacing({ after: 40 }),
        }),
      );
      paragraphs.push(
        new Paragraph({
          spacing: withDocxSpacing({ after: 40 }),
          children: [new TextRun({ text: "Definitions/Descriptions:", bold: true })],
        }),
      );
      const detail = markerMatch[1]?.trim();
      if (detail) {
        paragraphs.push(
          new Paragraph({
            text: detail,
            spacing: withDocxSpacing({ after: 40 }),
          }),
        );
      }
      continue;
    }

    paragraphs.push(
      new Paragraph({
        text: line,
        spacing: withDocxSpacing({ after: 40 }),
      }),
    );
  }

  return paragraphs.length > 0
    ? paragraphs
    : [new Paragraph({ text: "", spacing: withDocxSpacing() })];
}

function renderDocxTable<T extends Record<string, unknown>>(
  columns: Array<TableColumn<T>>,
  rows: T[],
) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map(
          (column) =>
            new TableCell({
              width: { size: Math.round((column.widthRatio / columns.reduce((a, b) => a + b.widthRatio, 0)) * 100), type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "222222" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "222222" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "222222" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "222222" },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: withDocxSpacing({ after: 40 }),
                  children: [new TextRun({ text: column.label, bold: true })],
                }),
              ],
            }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: columns.map(
              (column) =>
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
                    bottom: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
                    left: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
                    right: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
                  },
                  children: docxCellParagraphs(normalizeText(row[column.key])),
                }),
            ),
          }),
      ),
    ],
  });
}

function renderClassTrialHeaderDocxTable(model: LessonPlanModel) {
  const headerMap = mapHeaderRows(model.headerRows);
  const rows = [
    {
      leftLabel: "NAME OF STUDENT:",
      leftValue: compactHeaderValue(
        readHeaderValue(headerMap, ["name of student"], "______________________"),
      ),
      rightLabel: "STUDENT NUMBER:",
      rightValue: compactHeaderValue(
        readHeaderValue(headerMap, ["student number", "index number"], "______________________"),
      ),
    },
    {
      leftLabel: "COURSE NAME:",
      leftValue: compactHeaderValue(readHeaderValue(headerMap, ["course name"], "______________________")),
      rightLabel: "PROGRAMME:",
      rightValue: compactHeaderValue(readHeaderValue(headerMap, ["programme"], "______________________")),
    },
    {
      leftLabel: "NAME OF TOPIC:",
      leftValue: compactHeaderValue(
        readHeaderValue(headerMap, ["name of topic", "topic"], "______________________"),
      ),
      rightLabel: "VENUE:",
      rightValue: compactHeaderValue(readHeaderValue(headerMap, ["venue"], "______________________")),
    },
    {
      leftLabel: "INTAKE:",
      leftValue: compactHeaderValue(readHeaderValue(headerMap, ["intake"], "______________________")),
      rightLabel: "SIZE OF CLASS:",
      rightValue: compactHeaderValue(
        readHeaderValue(headerMap, ["size of class", "number of students"], "______________________"),
      ),
    },
    {
      leftLabel: "DATE:",
      leftValue: compactHeaderValue(readHeaderValue(headerMap, ["date"], "______________________")),
      rightLabel: "TIME:",
      rightValue: compactHeaderValue(readHeaderValue(headerMap, ["time"], "______________________")),
    },
    {
      leftLabel: "DURATION:",
      leftValue: compactHeaderValue(readHeaderValue(headerMap, ["duration"], "______________________")),
      rightLabel: "METHOD OF TEACHING:",
      rightValue: compactHeaderValue(
        readHeaderValue(headerMap, ["method of teaching", "method of instruction"], "______________________"),
      ),
    },
    {
      leftLabel: "NAME OF SUPERVISOR:",
      leftValue: compactHeaderValue(
        readHeaderValue(headerMap, ["name of supervisor"], "______________________"),
      ),
      rightLabel: "MEDIA OF TEACHING:",
      rightValue: compactHeaderValue(
        readHeaderValue(headerMap, ["media of teaching", "media"], "______________________"),
      ),
    },
  ];

  const widths = [22, 39, 16, 23];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: widths[0], type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [
                new Paragraph({
                  spacing: withDocxSpacing(),
                  children: [new TextRun({ text: row.leftLabel, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: widths[1], type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [new Paragraph({ text: row.leftValue, spacing: withDocxSpacing() })],
            }),
            new TableCell({
              width: { size: widths[2], type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [
                new Paragraph({
                  spacing: withDocxSpacing(),
                  children: [new TextRun({ text: row.rightLabel, bold: true })],
                }),
              ],
            }),
            new TableCell({
              width: { size: widths[3], type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: [new Paragraph({ text: row.rightValue, spacing: withDocxSpacing() })],
            }),
          ],
        }),
    ),
  });
}

async function renderLessonPlanDocxBuffer(input: RenderInput) {
  const sections = parseSections(input);
  const model = buildLessonPlanModel(input, sections);

  // Create sections array for multi-page layout
  const docSections: Array<{ properties: any; children: Array<Paragraph | Table> }> = [];

  // ============================================================
  // PAGE 1: Institutional Header + Metadata Table ONLY
  // ============================================================
  const page1Children: Array<Paragraph | Table> = [];

  page1Children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: withDocxSpacing({ after: 120 }),
      children: [new TextRun({ text: LESSON_TEMPLATE.institutionName, bold: true, size: 28 })],
    }),
  );
  page1Children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: withDocxSpacing({ after: 300 }),
      children: [new TextRun({ text: LESSON_TEMPLATE.planTitle, bold: true, underline: {}, size: 24 })],
    }),
  );

  const headerTable = renderClassTrialHeaderDocxTable(model);
  page1Children.push(headerTable);

  docSections.push({
    properties: {
      page: {
        size: {
          orientation: "landscape",
          width: 16838,  // A4 landscape width (297mm in twentieths of a point)
          height: 11906, // A4 landscape height (210mm in twentieths of a point)
        },
        margin: {
          top: 1120,    // 56pt
          right: 1120,
          bottom: 1120,
          left: 1120,
        },
      },
    },
    children: page1Children,
  });

  // ============================================================
  // PAGE 2: Introduction ONLY
  // ============================================================
  const page2Children: Array<Paragraph | Table> = [];

  page2Children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "INTRODUCTION", bold: true })],
      spacing: withDocxSpacing({ before: 160, after: 120 }),
    }),
  );
  page2Children.push(
    new Paragraph({
      text: model.introduction,
      spacing: withDocxSpacing({ after: 120 }),
      alignment: AlignmentType.JUSTIFIED,
    }),
  );

  docSections.push({
    properties: {
      page: {
        size: {
          orientation: "landscape",
          width: 16838,
          height: 11906,
        },
        margin: {
          top: 1120,
          right: 1120,
          bottom: 1120,
          left: 1120,
        },
      },
    },
    children: page2Children,
  });

  // ============================================================
  // PAGE 3: General Objectives + Specific Objectives
  // ============================================================
  const page3Children: Array<Paragraph | Table> = [];

  // General Objective
  page3Children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "GENERAL OBJECTIVE", bold: true })],
      spacing: withDocxSpacing({ before: 160, after: 120 }),
    }),
  );
  page3Children.push(
    new Paragraph({
      text: "By the end of the lecture/discussion, students should be able to:",
      spacing: withDocxSpacing({ after: 80 }),
    }),
  );
  page3Children.push(
    new Paragraph({
      text: model.generalObjective,
      spacing: withDocxSpacing({ after: 60 }),
    }),
  );

  // Specific Objectives (Learning Outcomes)
  if (model.specificObjectives.length > 0) {
    page3Children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "SPECIFIC OBJECTIVES", bold: true })],
        spacing: withDocxSpacing({ before: 200, after: 120 }),
      }),
    );
    page3Children.push(
      new Paragraph({
        text: "By the end of the lecture/discussion student nurses should be able to:",
        spacing: withDocxSpacing({ after: 80 }),
      }),
    );
    model.specificObjectives.forEach((outcome, idx) => {
      page3Children.push(
        new Paragraph({
          text: `${idx + 1}. ${outcome}`,
          spacing: withDocxSpacing({ after: 60 }),
        }),
      );
    });
  }

  docSections.push({
    properties: {
      page: {
        size: {
          orientation: "landscape",
          width: 16838,
          height: 11906,
        },
        margin: {
          top: 1120,
          right: 1120,
          bottom: 1120,
          left: 1120,
        },
      },
    },
    children: page3Children,
  });

  // ============================================================
  // PAGE 4+: Lesson Presentation Table
  // ============================================================
  const page4Children: Array<Paragraph | Table> = [];

  page4Children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "LESSON PRESENTATION", bold: true })],
      spacing: withDocxSpacing({ before: 160, after: 120 }),
    }),
  );

  const presentationTable = renderDocxTable<LessonPresentationRow>(
    LESSON_PRESENTATION_COLUMNS,
    model.presentationRows,
  );
  page4Children.push(presentationTable);

  docSections.push({
    properties: {
      page: {
        size: {
          orientation: "landscape",
          width: 16838,
          height: 11906,
        },
        margin: {
          top: 1120,
          right: 1120,
          bottom: 1120,
          left: 1120,
        },
      },
    },
    children: page4Children,
  });

  // ============================================================
  // LAST PAGES: Summary, Evaluation, Assignment, References
  // ============================================================
  const lastPageChildren: Array<Paragraph | Table> = [];

  // Summary
  if (model.summary) {
    lastPageChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "SUMMARY", bold: true })],
        spacing: withDocxSpacing({ before: 160, after: 120 }),
      }),
    );
    lastPageChildren.push(
      new Paragraph({
        text: model.summary,
        spacing: withDocxSpacing({ after: 100 }),
      }),
    );
  }

  // Evaluation
  if (model.evaluation.length > 0) {
    lastPageChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "EVALUATION", bold: true })],
        spacing: withDocxSpacing({ before: 200, after: 120 }),
      }),
    );
    for (const [idx, item] of model.evaluation.entries()) {
      lastPageChildren.push(
        new Paragraph({
          text: `${idx + 1}. ${item}`,
          spacing: withDocxSpacing({ after: 60 }),
        }),
      );
    }
  }

  // Assignment
  if (model.assignmentItems.length > 0) {
    lastPageChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "ASSIGNMENT", bold: true })],
        spacing: withDocxSpacing({ before: 200, after: 120 }),
      }),
    );
    lastPageChildren.push(
      new Paragraph({
        text: "Indicate whether the following statements are True (T) or False (F)",
        spacing: withDocxSpacing({ after: 100 }),
      }),
    );
    model.assignmentItems.forEach((item, idx) => {
      const cleanItem = item.replace(/^\s*\d+[\)\.]\s*/, '').trim();
      lastPageChildren.push(
        new Paragraph({
          text: `${idx + 1}) ${cleanItem}`,
          spacing: withDocxSpacing({ after: 80, before: 40 }),
        }),
      );
    });
  }

  // References
  if (model.references.length > 0) {
    lastPageChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: "REFERENCES", bold: true })],
        spacing: withDocxSpacing({ before: 200, after: 120 }),
      }),
    );
    for (const item of model.references) {
      lastPageChildren.push(
        new Paragraph({
          text: item,
          bullet: { level: 0 },
          spacing: withDocxSpacing({ after: 50 }),
          children: [new TextRun({ text: item, italics: true })],
        }),
      );
    }
  }

  docSections.push({
    properties: {
      page: {
        size: {
          orientation: "landscape",
          width: 16838,
          height: 11906,
        },
        margin: {
          top: 1120,
          right: 1120,
          bottom: 1120,
          left: 1120,
        },
      },
    },
    children: lastPageChildren,
  });

  const doc = createDocxDocument(docSections);

  return Packer.toBuffer(doc);
}

type PresentationTheme = {
  bg: string;
  panel: string;
  panelAlt: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
};

const MODERN_CLINICAL_THEME: PresentationTheme = {
  bg: "F8FAFC",
  panel: "FFFFFF",
  panelAlt: "EEF2FF",
  accent: "1D4ED8",
  accentSoft: "DBEAFE",
  text: "0F172A",
  muted: "475569",
};

type PresentationVisual = {
  dataUri: string;
  source: "source" | "ai";
  attribution?: string;
};

type PresentationVisualMode =
  | "cover"
  | "core_concepts"
  | "objective_deep_dive"
  | "summary"
  | "generic";

function splitItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function clampPptText(value: string, maxChars: number) {
  const clean = sanitizeInlineMarkdown(value).replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  
  // Try to break at sentence boundary first
  const sentenceEnd = clean.slice(0, maxChars).lastIndexOf('. ');
  if (sentenceEnd > maxChars * 0.6) {
    return clean.slice(0, sentenceEnd + 1).trim();
  }
  
  // Otherwise break at word boundary
  const lastSpace = clean.slice(0, maxChars - 3).lastIndexOf(' ');
  if (lastSpace > maxChars * 0.7) {
    return `${clean.slice(0, lastSpace).trim()}...`;
  }
  
  // Fallback to hard cut
  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function pptxBullets(items: string[]) {
  return items
    .map((item) => clampPptText(`- ${item}`, 350)) // Increased from 220 to 350 for complete sentences
    .join("\n");
}

// Enhanced PowerPoint helper functions for ready-to-use presentations
function generateSpeakerNotes(slideType: string, content: string, topic: string): string {
  const notes: string[] = [];

  switch (slideType) {
    case 'title':
      notes.push(`Welcome students to today's session on ${topic}.`);
      notes.push(`Set the context: Explain why this topic is important for nursing practice.`);
      notes.push(`Share the session agenda and learning objectives.`);
      break;
    case 'objectives':
      notes.push(`Read each objective aloud and explain what students will be able to do.`);
      notes.push(`Connect objectives to real-world nursing scenarios.`);
      notes.push(`Ask: "Which of these objectives seems most challenging to you?"`);
      break;
    case 'concept':
      notes.push(`Pause after each key point to check understanding.`);
      notes.push(`Use clinical examples to illustrate abstract concepts.`);
      notes.push(`Ask: "Can anyone share a related experience from clinical practice?"`);
      break;
    case 'definition':
      notes.push(`Emphasize precise terminology for professional communication.`);
      notes.push(`Provide memory aids or mnemonics for complex terms.`);
      notes.push(`Ask students to use the term in a sentence.`);
      break;
    case 'case_study':
      notes.push(`Facilitate group discussion of the case.`);
      notes.push(`Guide students through clinical reasoning steps.`);
      notes.push(`Ask: "What would you do first in this situation?"`);
      break;
    case 'activity':
      notes.push(`Give clear instructions and time limits.`);
      notes.push(`Circulate to provide individual guidance.`);
      notes.push(`Debrief: "What did you learn from this activity?"`);
      break;
    case 'assessment':
      notes.push(`Use these questions for formative assessment.`);
      notes.push(`Allow think-pair-share for difficult questions.`);
      notes.push(`Review answers and clarify misconceptions.`);
      break;
    case 'summary':
      notes.push(`Recap the 3-5 most important takeaways.`);
      notes.push(`Connect back to learning objectives.`);
      notes.push(`Preview next session or assignment.`);
      break;
    default:
      notes.push(`Present key information clearly and concisely.`);
      notes.push(`Check for understanding with quick questions.`);
      notes.push(`Relate to nursing practice and patient care.`);
  }

  return notes.join('\n');
}

function estimateSlideTime(content: string, slideType: string): number {
  // Estimate time in minutes based on content length and slide type
  const wordCount = content.split(/\s+/).length;
  let baseTime = 1.5; // Minimum time per slide

  if (slideType === 'title' || slideType === 'summary') {
    baseTime = 2.0;
  } else if (slideType === 'activity' || slideType === 'case_study') {
    baseTime = 5.0;
  } else if (slideType === 'assessment') {
    baseTime = 3.0;
  }

  // Add time for content (approximately 15 seconds per 50 words)
  const contentTime = Math.ceil(wordCount / 50) * 0.25;

  return Math.min(baseTime + contentTime, 8.0); // Cap at 8 minutes per slide
}

function generateInteractiveElements(topic: string, slideType: string): string[] {
  const elements: string[] = [];

  if (slideType === 'concept' || slideType === 'definition') {
    elements.push(`Quick poll: "How confident are you with this concept?" (1-5 scale)`);
    elements.push(`Think-pair-share: Discuss with a neighbor for 2 minutes`);
    elements.push(`Muddiest point: "What's the most confusing part so far?"`);
  }

  if (slideType === 'case_study') {
    elements.push(`Group discussion: "What are the priority nursing interventions?"`);
    elements.push(`Role play: Act out the nurse-patient interaction`);
    elements.push(`Clinical reasoning: "What assessment data would you collect next?"`);
  }

  if (slideType === 'assessment') {
    elements.push(`Clicker questions: Multiple choice quiz`);
    elements.push(`One-minute paper: "Summarize the key takeaway"`);
    elements.push(`Exit ticket: "One question you still have"`);
  }

  // Add topic-specific interactive elements
  if (topic.toLowerCase().includes('infection') || topic.toLowerCase().includes('safety')) {
    elements.push(`Hand hygiene demonstration`);
    elements.push(`PPE donning/doffing practice`);
  }

  if (topic.toLowerCase().includes('medication') || topic.toLowerCase().includes('pharmacology')) {
    elements.push(`Medication calculation practice`);
    elements.push(`Drug card creation activity`);
  }

  return elements.slice(0, 3); // Return top 3 elements
}

function createClinicalScenario(topic: string): string {
  const scenarios: Record<string, string> = {
    'infection': `A 65-year-old patient with diabetes presents with a foot ulcer showing signs of cellulitis. Discuss infection prevention measures and wound care.`,
    'medication': `A patient is prescribed multiple medications including warfarin and antibiotics. Identify potential interactions and nursing considerations.`,
    'assessment': `A post-operative patient reports sudden shortness of breath and chest pain. Outline your immediate nursing assessment and interventions.`,
    'communication': `A family member is angry about perceived delays in care. Demonstrate therapeutic communication techniques.`,
    'ethics': `A patient refuses life-saving treatment due to religious beliefs. Discuss ethical principles and nursing responsibilities.`,
    'pediatrics': `A 3-year-old child is admitted with dehydration. Develop a family-centered care plan.`,
    'geriatrics': `An elderly patient with dementia is at risk for falls. Create a safety intervention plan.`,
    'mental health': `A patient with depression expresses hopelessness. Describe therapeutic approaches and safety monitoring.`,
  };

  // Find matching scenario or create generic one
  for (const [key, scenario] of Object.entries(scenarios)) {
    if (topic.toLowerCase().includes(key)) {
      return scenario;
    }
  }

  return `During a supervised ward teaching session on ${topic}, a learner must assess patient findings, explain their significance, and justify safe nursing actions using module guidance.`;
}

function generateMemoryAids(topic: string, keyTerms: string[]): string[] {
  const aids: string[] = [];

  // Create mnemonics for key terms
  if (keyTerms.length > 0) {
    const firstLetters = keyTerms.map(term => term.charAt(0).toUpperCase()).join('');
    if (firstLetters.length >= 3) {
      aids.push(`Mnemonic: "${firstLetters}" - ${keyTerms.join(', ')}`);
    }
  }

  // Topic-specific memory aids
  if (topic.toLowerCase().includes('abc')) {
    aids.push(`ABC: Airway, Breathing, Circulation (primary assessment)`);
  }

  if (topic.toLowerCase().includes('pain')) {
    aids.push(`OPQRST: Onset, Provocation, Quality, Radiation, Severity, Time (pain assessment)`);
  }

  if (topic.toLowerCase().includes('infection')) {
    aids.push(`5 Moments of Hand Hygiene: Before patient contact, before aseptic task, after body fluid exposure, after patient contact, after contact with patient surroundings`);
  }

  if (topic.toLowerCase().includes('medication')) {
    aids.push(`10 Rights of Medication Administration: Right patient, medication, dose, route, time, documentation, reason, response, education, refusal`);
  }

  // Add visual memory aids
  aids.push(`Create a concept map connecting key ideas`);
  aids.push(`Use color coding for related concepts`);
  aids.push(`Develop flashcards for key terminology`);

  return aids.slice(0, 3);
}

function createQuizQuestions(topic: string, count: number = 3): Array<{ question: string, options: string[], answer: string }> {
  const questions: Array<{ question: string, options: string[], answer: string }> = [];

  // Sample questions based on topic
  const questionTemplates = [
    {
      question: `Which nursing intervention is most appropriate for a patient with ${topic}?`,
      options: [
        `Monitor vital signs every 4 hours`,
        `Provide patient education about self-care`,
        `Administer prescribed medications as scheduled`,
        `All of the above`
      ],
      answer: `All of the above`
    },
    {
      question: `What is the priority assessment for a patient experiencing complications related to ${topic}?`,
      options: [
        `Pain level on a 0-10 scale`,
        `Airway, breathing, circulation`,
        `Nutritional intake for past 24 hours`,
        `Family support system availability`
      ],
      answer: `Airway, breathing, circulation`
    },
    {
      question: `Which documentation is essential when caring for a patient with ${topic}?`,
      options: [
        `Patient's response to interventions`,
        `Changes in condition`,
        `Communication with healthcare team`,
        `All of the above`
      ],
      answer: `All of the above`
    }
  ];

  return questionTemplates.slice(0, count).map(q => ({
    ...q,
    question: q.question.replace('${topic}', topic)
  }));
}

function formatTimeEstimate(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes === 1) return '1 min';
  return `${Math.ceil(minutes)} min`;
}

/**
 * Try to use AI content expansion if available
 * Falls back to basic content if AI is not available
 */
async function tryExpandContentWithAI(
  content: string,
  topic: string,
  context?: { programme?: string; course?: string }
): Promise<string> {
  try {
    // Lightweight local enhancement for generic slide text.
    return enhanceContentForPresentation(content, topic, context);
  } catch (error) {
    // Fall back to basic content
    return content;
  }
}

function enhanceContentForPresentation(
  content: string,
  topic: string,
  context?: { programme?: string; course?: string }
): string {
  if (!content || content.trim().length < 20) {
    return `Key concepts in ${topic} relevant to ${context?.programme || 'nursing'} education.`;
  }

  // Simple enhancement: add structure and clarity
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const enhanced = sentences.slice(0, 3).map((sentence, idx) => {
    const clean = sentence.trim();
    if (idx === 0) return `- ${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
    return `- ${clean}`;
  }).join('\n');

  return enhanced || content;
}

function extractUrlsFromText(text: string) {
  if (!text) return [] as string[];
  const urls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return urls
    .map((url) => url.trim())
    .filter((url) => /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(url));
}

function visualCandidatesFromMetadata(input: RenderInput) {
  const metadata = safeRecord(input.contentJson.metadata);
  const assets = metadata.visualAssets;
  if (!Array.isArray(assets)) return [] as string[];

  return assets
    .flatMap((asset) => {
      if (typeof asset === "string") return [asset];
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) return [];
      const record = asset as Record<string, unknown>;
      const candidates = [
        record.url,
        record.src,
        record.imageUrl,
        record.dataUri,
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean);
      return candidates;
    })
    .filter(Boolean);
}

function visualCandidatesFromSection(section?: ParsedSection) {
  if (!section) return [] as string[];

  const fromBlocks = section.blocks.flatMap((block) => extractUrlsFromText(block.text));
  const fromCitations = section.citations.flatMap((line) => extractUrlsFromText(line));

  return [...fromBlocks, ...fromCitations];
}

function uniqueStrings(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

async function fetchImageDataUri(url: string) {
  if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) return null;
  if (/^data:image\//i.test(url)) return url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PRESENTATION_IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildAcademicImagePrompt(input: {
  topic: string;
  sectionTitle: string;
  mode: PresentationVisualMode;
}) {
  const base = [
    "Create a clean academic illustration for a nursing education PowerPoint slide.",
    "No text inside the image.",
    "White or near-white background.",
    "Professional and suitable for tertiary education.",
    "No logos, no watermarks, no graphic medical scenes, no blood.",
    `Topic: ${input.topic}.`,
    `Concept: ${input.sectionTitle}.`,
  ];

  if (input.mode === "cover") {
    return [
      ...base,
      "Style: slightly realistic educational scene, polished lighting, modern classroom-clinical context.",
      "Keep composition clean and presentation-friendly.",
    ].join(" ");
  }

  return [
    ...base,
    "Style: modern flat vector, soft neutral colors, minimal detail, high readability for slides.",
    "Use conceptual visual metaphors suitable for teaching.",
  ].join(" ");
}

async function generateAiImageDataUri(prompt: string, mode: PresentationVisualMode = "generic") {
  if (!env.PRESENTATION_ENABLE_AI_IMAGES) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OPENAI_IMAGES_TIMEOUT_MS);
  try {
    if (env.PRESENTATION_AI_IMAGE_PROVIDER === "azure") {
      if (!env.AZURE_DALLE_ENDPOINT || !env.AZURE_DALLE_API_KEY) return null;
      const response = await fetch(env.AZURE_DALLE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_DALLE_API_KEY,
          Authorization: `Bearer ${env.AZURE_DALLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AZURE_DALLE_MODEL,
          prompt,
          size: mode === "cover" ? "1792x1024" : "1024x1024",
          style: mode === "cover" ? "vivid" : env.AZURE_DALLE_STYLE,
          quality: env.AZURE_DALLE_QUALITY,
          n: 1,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const b64 = payload.data?.[0]?.b64_json;
      if (b64) {
        return `data:image/png;base64,${b64}`;
      }
      const url = payload.data?.[0]?.url;
      if (!url) return null;
      return fetchImageDataUri(url);
    }

    if (!env.OPENAI_IMAGES_API_KEY) return null;
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_IMAGES_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_IMAGES_MODEL,
        prompt,
        size: "1024x1024",
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const b64 = payload.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    const url = payload.data?.[0]?.url;
    if (!url) return null;
    return fetchImageDataUri(url);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePresentationVisual(input: {
  topic: string;
  sectionTitle: string;
  candidates: string[];
  aiState: { used: number };
  mode?: PresentationVisualMode;
}) {
  for (const candidate of uniqueStrings(input.candidates)) {
    const dataUri = await fetchImageDataUri(candidate);
    if (dataUri) {
      return {
        dataUri,
        source: "source",
        attribution: candidate,
      } satisfies PresentationVisual;
    }
  }

  if (input.aiState.used >= env.PRESENTATION_IMAGES_MAX) return null;
  const mode = input.mode ?? "generic";
  const prompt = buildAcademicImagePrompt({
    topic: input.topic,
    sectionTitle: input.sectionTitle,
    mode,
  });
  const aiDataUri = await generateAiImageDataUri(prompt, mode);
  if (!aiDataUri) return null;
  input.aiState.used += 1;
  return {
    dataUri: aiDataUri,
    source: "ai",
    attribution: "AI-generated illustration",
  } satisfies PresentationVisual;
}

function slideCitation(section?: ParsedSection) {
  if (!section || section.citations.length === 0) return "";
  return clampPptText(section.citations[0], 180);
}

function addSlideScaffold(
  slide: any,
  title: string,
  subtitle?: string,
  citation?: string,
  theme: PresentationTheme = MODERN_CLINICAL_THEME,
) {
  slide.background = { color: theme.bg };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.68,
    line: { color: theme.accent, transparency: 100 },
    fill: { color: theme.accent },
  });
  slide.addText(clampPptText(title, 80), {
    x: 0.6,
    y: 0.18,
    w: 9.8,
    h: 0.36,
    color: "FFFFFF",
    fontFace: "Calibri",
    bold: true,
    fontSize: 18,
  });
  if (subtitle) {
    slide.addText(clampPptText(subtitle, 120), {
      x: 0.6,
      y: 0.78,
      w: 10.2,
      h: 0.42,
      color: theme.muted,
      fontFace: "Calibri",
      fontSize: 12,
    });
  }
  slide.addShape("line", {
    x: 0.6,
    y: 7.1,
    w: 12.1,
    h: 0,
    line: { color: "CBD5E1", pt: 1 },
  });
  if (citation) {
    slide.addText(`Source: ${citation}`, {
      x: 0.6,
      y: 7.12,
      w: 12,
      h: 0.3,
      color: "64748B",
      fontFace: "Calibri",
      fontSize: 8,
      italic: true,
    });
  }
}

function addVisualPanel(
  slide: any,
  visual: PresentationVisual | null,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: PresentationTheme = MODERN_CLINICAL_THEME,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    radius: 0.08,
    line: { color: "BFDBFE", pt: 1 },
    fill: { color: "EFF6FF" },
  });
  if (!visual) {
    slide.addText("Illustration slot\n(no source image available)", {
      x: x + 0.25,
      y: y + h / 2 - 0.3,
      w: w - 0.5,
      h: 0.7,
      color: theme.muted,
      align: "center",
      valign: "mid",
      fontFace: "Calibri",
      fontSize: 10,
      italic: true,
    });
    return;
  }

  slide.addImage({
    data: visual.dataUri,
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: h - 0.34,
  });
  slide.addText(
    visual.source === "ai"
      ? "AI-generated educational illustration"
      : "Source illustration",
    {
      x: x + 0.12,
      y: y + h - 0.22,
      w: w - 0.24,
      h: 0.16,
      color: "475569",
      fontFace: "Calibri",
      fontSize: 7,
      italic: true,
      align: "right",
    },
  );
}

function addSlideFooter(
  slide: any,
  slideNum: number,
  totalSlides: number,
  topic: string,
  theme: PresentationTheme = MODERN_CLINICAL_THEME,
) {
  slide.addText(`${clampPptText(topic, 60)} | Slide ${slideNum} of ${totalSlides}`, {
    x: 0.5,
    y: 6.9,
    w: 12.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 9,
    color: theme.muted,
    align: "center",
  });
}

function tokenizeForObjectiveMatch(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function overlapScore(tokens: string[], reference: Set<string>) {
  let score = 0;
  for (const token of tokens) {
    if (reference.has(token)) score += 1;
  }
  return score;
}

function pickPresentationRowForObjective(input: {
  rows: LessonPresentationRow[];
  objective: string;
  used: Set<number>;
}) {
  const objectiveTokens = tokenizeForObjectiveMatch(input.objective);
  const objectiveSet = new Set(objectiveTokens);

  let bestIndex = -1;
  let bestScore = -1;
  for (let i = 0; i < input.rows.length; i += 1) {
    if (input.used.has(i)) continue;
    const row = input.rows[i];
    const rowTokens = tokenizeForObjectiveMatch(
      [row.specificObjective, row.content, row.assessment].join(" "),
    );
    const score = overlapScore(rowTokens, objectiveSet);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    input.used.add(bestIndex);
    return input.rows[bestIndex];
  }

  const fallbackIndex = input.rows.findIndex((_, idx) => !input.used.has(idx));
  if (fallbackIndex >= 0) {
    input.used.add(fallbackIndex);
    return input.rows[fallbackIndex];
  }
  return input.rows[0];
}

function textToTeachingBullets(text: string, maxItems = 6, maxChars = 140) {
  const clean = sanitizeInlineMarkdown(normalizeText(text))
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();
  if (!clean) return [] as string[];

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fragments = lines.flatMap((line) =>
    line
      .split(/[.;]\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

  const picked: string[] = [];
  for (const fragment of fragments) {
    const normalized = fragment
      .replace(/^\-\s*/, "")
      .replace(/^\d+[\)\.]\s*/, "")
      .trim();
    if (!normalized) continue;
    picked.push(clampPptText(normalized, maxChars));
    if (picked.length >= maxItems) break;
  }

  if (picked.length > 0) return picked;
  return [clampPptText(clean, maxChars)];
}

function extractDefinitionBullets(rows: LessonPresentationRow[]) {
  const items: string[] = [];
  for (const row of rows) {
    const content = row.content;
    const markerIndex = content.toLowerCase().indexOf("definitions/descriptions:");
    if (markerIndex < 0) continue;
    const definitionText = content
      .slice(markerIndex + "definitions/descriptions:".length)
      .replace(/\n+/g, " ")
      .trim();
    if (!definitionText) continue;
    const parts = definitionText
      .split(/\s*;\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      items.push(clampPptText(part, 130));
    }
  }
  return unique(items).slice(0, 10);
}

const OBJECTIVE_TOKEN_STOPWORDS = new Set([
  "able",
  "about",
  "against",
  "apply",
  "classroom",
  "clinical",
  "concept",
  "content",
  "context",
  "course",
  "define",
  "describe",
  "detail",
  "discussion",
  "education",
  "example",
  "explain",
  "identify",
  "lesson",
  "learner",
  "learning",
  "module",
  "nursing",
  "objective",
  "outcome",
  "practice",
  "session",
  "student",
  "teaching",
  "topic",
  "understand",
  "using",
  "with",
]);

const GENERIC_PLACEHOLDER_PATTERNS = [
  /clarify the central concept/i,
  /break down .*teachable elements/i,
  /connect the concept/i,
  /guide learners through an overview/i,
  /a patient presents with symptoms related to/i,
  /what are the core principles of/i,
  /content area/i,
];

function isGenericPlaceholderLine(value: string) {
  const clean = normalizeText(value);
  if (!clean) return true;
  if (clean.length < 18) return true;
  return GENERIC_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(clean));
}

function extractFocusTermsForObjective(
  values: Array<string | undefined>,
  limit = 4,
) {
  const terms = values
    .flatMap((value) => normalize(value).split(" "))
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 4 &&
        !OBJECTIVE_TOKEN_STOPWORDS.has(token),
    );
  return unique(terms).slice(0, limit);
}

function definitionSentencesFromText(text: string, maxItems = 6) {
  const clean = sanitizeInlineMarkdown(normalizeText(text));
  if (!clean) return [] as string[];
  const sentences = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const lowered = sentence.toLowerCase();
      return (
        sentence.length >= 35 &&
        sentence.length <= 240 &&
        (
          lowered.includes(" is ") ||
          lowered.includes(" are ") ||
          lowered.includes(" refers to ") ||
          lowered.includes(" defined as ") ||
          lowered.includes(":")
        )
      );
    });
  return unique(sentences).slice(0, maxItems);
}

function cleanPptBulletItems(
  items: string[],
  maxItems: number,
  maxChars: number,
) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of items) {
    const item = clampPptText(sanitizeInlineMarkdown(normalizeText(raw)), maxChars);
    if (isGenericPlaceholderLine(item)) continue;
    const signature = normalize(item)
      .split(" ")
      .slice(0, 10)
      .join(" ");
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    next.push(item);
    if (next.length >= maxItems) break;
  }
  return next;
}

function objectiveFallbackLine(
  type: "concept" | "definition" | "discussion" | "quick_check" | "clinical_link" | "take_home",
  index: number,
  topic: string,
  objective: string,
  focusTerms: string[],
) {
  const focusLabel = focusTerms.length > 0 ? focusTerms.join(", ") : topic;
  const objectiveCore = clampPptText(sanitizeInlineMarkdown(normalizeText(objective)), 140);

  const catalog: Record<typeof type, string[]> = {
    concept: [
      `${objectiveCore} with clear explanation of ${focusLabel}.`,
      `Explain key components of ${focusLabel} and connect each to safe nursing decisions.`,
      `Use a practical classroom and ward example to demonstrate ${focusLabel}.`,
    ],
    definition: [
      `Provide a concise module-aligned definition of ${focusLabel}.`,
      `Differentiate ${focusLabel} from related terms used in this course.`,
      `Highlight defining characteristics of ${focusLabel} using one concrete example.`,
    ],
    discussion: [
      `Which part of ${focusLabel} is most critical during patient assessment and why?`,
      `What misconception about ${focusLabel} do learners commonly have, and how would you correct it?`,
      `Which module evidence best supports your explanation of ${focusLabel}?`,
    ],
    quick_check: [
      `Define ${focusLabel} in one accurate sentence.`,
      `Give one clinical example that demonstrates ${focusLabel}.`,
      `State one safe-practice implication linked to ${focusLabel}.`,
    ],
    clinical_link: [
      `Relate ${focusLabel} to assessment, planning, intervention, and evaluation in nursing care.`,
      `Link ${focusLabel} to patient education and communication in routine ward practice.`,
      `Use ${focusLabel} to justify one evidence-informed nursing action.`,
    ],
    take_home: [
      `${focusLabel} should be explained, applied, and evaluated during teaching.`,
      `Accurate use of ${focusLabel} improves clinical reasoning and patient safety.`,
      `Learners should connect ${focusLabel} to real nursing decisions, not memorization only.`,
    ],
  };

  return catalog[type][index % catalog[type].length];
}

function splitContentAndDefinitions(text: string) {
  const clean = sanitizeInlineMarkdown(normalizeText(text));
  if (!clean) return { content: "", definitions: "" };
  const marker = "definitions/descriptions:";
  const index = clean.toLowerCase().indexOf(marker);
  if (index < 0) {
    return { content: clean, definitions: "" };
  }
  return {
    content: clean.slice(0, index).trim(),
    definitions: clean.slice(index + marker.length).trim(),
  };
}

function ensureMinItems(
  items: string[],
  minCount: number,
  fallbackFactory: (index: number) => string,
  maxChars = 140,
) {
  const next = [...items];
  let i = 0;
  while (next.length < minCount) {
    next.push(clampPptText(fallbackFactory(i), maxChars));
    i += 1;
  }
  return next;
}

function buildDetailedObjectivePack(input: {
  topic: string;
  objective: string;
  row: LessonPresentationRow | undefined;
  evidenceText?: string;
}) {
  const row = input.row;
  const objective = input.objective;
  const split = splitContentAndDefinitions(row?.content ?? "");
  const focusTerms = extractFocusTermsForObjective([
    input.topic,
    objective,
    row?.specificObjective,
    split.definitions,
    split.content,
  ]);
  const mergedEvidenceText = [
    split.content,
    split.definitions,
    row?.specificObjective,
    row?.content,
    row?.educatorActivities,
    row?.learnerActivities,
    row?.assessment,
    input.evidenceText,
    objective,
  ]
    .filter(Boolean)
    .join("\n");

  const conceptPoints = ensureMinItems(
    cleanPptBulletItems(
      textToTeachingBullets(mergedEvidenceText || objective, 16, 175),
      7,
      175,
    ),
    6,
    (i) => objectiveFallbackLine("concept", i, input.topic, objective, focusTerms),
    175,
  ).slice(0, 7);

  const definitionCandidates = cleanPptBulletItems(
    [
      ...definitionSentencesFromText(mergedEvidenceText, 8),
      ...textToTeachingBullets(split.definitions, 6, 160),
      ...extractDefinitionBullets(row ? [row] : []),
    ],
    5,
    160,
  );
  const definitionPoints = ensureMinItems(
    definitionCandidates,
    3,
    (i) => objectiveFallbackLine("definition", i, input.topic, objective, focusTerms),
    160,
  ).slice(0, 5);

  const discussionSeed = [
    row?.educatorActivities ?? "",
    row?.learnerActivities ?? "",
    row?.assessment ?? "",
    objective,
    split.content,
  ]
    .filter(Boolean)
    .join(" ");
  const discussionPrompts = ensureMinItems(
    cleanPptBulletItems(
      textToTeachingBullets(discussionSeed, 10, 150),
      5,
      150,
    ),
    4,
    (i) => objectiveFallbackLine("discussion", i, input.topic, objective, focusTerms),
    150,
  ).slice(0, 5);

  const quickChecks = ensureMinItems(
    cleanPptBulletItems(
      [
        ...textToTeachingBullets(row?.assessment ?? "", 8, 145),
        ...textToTeachingBullets(objective, 4, 145),
      ],
      5,
      145,
    ),
    4,
    (i) => objectiveFallbackLine("quick_check", i, input.topic, objective, focusTerms),
    145,
  ).slice(0, 5);

  const clinicalLinks = ensureMinItems(
    cleanPptBulletItems(
      textToTeachingBullets(mergedEvidenceText, 10, 155),
      5,
      155,
    ),
    3,
    (i) => objectiveFallbackLine("clinical_link", i, input.topic, objective, focusTerms),
    155,
  ).slice(0, 5);

  const takeHomePoints = ensureMinItems(
    cleanPptBulletItems(
      textToTeachingBullets(
        [split.content, split.definitions, row?.assessment ?? "", objective]
          .filter(Boolean)
          .join(" "),
        10,
        150,
      ),
      4,
      150,
    ),
    3,
    (i) => objectiveFallbackLine("take_home", i, input.topic, objective, focusTerms),
    150,
  ).slice(0, 4);

  const focusLabel = focusTerms.length > 0 ? focusTerms.slice(0, 2).join(" and ") : input.topic;
  const scenarioSeed = cleanPptBulletItems(
    textToTeachingBullets(mergedEvidenceText, 3, 180),
    1,
    180,
  )[0];
  const scenarioSentence = scenarioSeed
    ? `During a supervised ward session, a learner must apply ${focusLabel}. ${scenarioSeed}`
    : `During a supervised ward session, a learner must apply ${focusLabel} to assess findings, explain clinical significance, and justify safe nursing actions.`;
  const clinicalScenario = clampPptText(`Scenario: ${scenarioSentence}`, 280);

  return {
    conceptPoints,
    definitionPoints,
    discussionPrompts,
    quickChecks,
    clinicalLinks,
    takeHomePoints,
    clinicalScenario,
  };
}

function parseCitationSourceAndPage(citation?: string) {
  const clean = normalizeText(citation);
  if (!clean) return { sourceName: "", page: null as number | null };
  const sourceName = clean.replace(/^source:\s*/i, "").split(" - ")[0].trim();
  const pageMatch = clean.match(/\(p\.?\s*(\d+)\)/i);
  const page = pageMatch?.[1] ? Number(pageMatch[1]) : null;
  return {
    sourceName,
    page: Number.isFinite(page as number) ? (page as number) : null,
  };
}

function buildPresentationNoteChunks(sections: ParsedSection[]): RetrievalChunkForPrompt[] {
  const chunks: RetrievalChunkForPrompt[] = [];
  for (const section of sections) {
    const { sourceName, page } = parseCitationSourceAndPage(section.citations[0]);
    const sourceLabel = sourceName || section.title || "Curriculum source";
    const sectionBlocks =
      section.blocks.length > 0
        ? section.blocks
        : [{ kind: "paragraph" as const, text: normalizeText(section.content) }];
    for (let i = 0; i < sectionBlocks.length; i += 1) {
      const text = sanitizeInlineMarkdown(normalizeText(sectionBlocks[i].text));
      if (!text || text.length < 30) continue;
      chunks.push({
        chunkId: `ppt-${section.id}-${i + 1}`,
        sourceId: `ppt-${section.id}`,
        sourceName: sourceLabel,
        page,
        heading: section.title,
        text: text.slice(0, 1600),
      });
    }
  }
  return chunks.slice(0, 120);
}

function scoreNoteChunkForQuery(chunk: RetrievalChunkForPrompt, query: string) {
  const q = normalize(query);
  const qTokens = q
    .split(" ")
    .filter((t) => t.length >= 4);
  if (qTokens.length === 0) return 0;
  const body = normalize(`${chunk.heading ?? ""} ${chunk.text}`);
  const heading = normalize(chunk.heading ?? "");
  let score = 0;
  for (const token of qTokens) {
    if (body.includes(token)) score += 1;
    if (heading.includes(token)) score += 2;
  }
  if (q.length >= 10 && body.includes(q)) score += 4;
  return score;
}

function selectNoteChunksForObjective(
  chunks: RetrievalChunkForPrompt[],
  query: string,
  limit = 6,
) {
  return chunks
    .map((chunk) => ({ chunk, score: scoreNoteChunkForQuery(chunk, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

type ObjectiveSlideEnhancement = {
  conceptPoints: string[];
  definitionPoints: string[];
  coreSpeakerNotes: string;
  applicationSpeakerNotes: string;
  usedAi: boolean;
};

async function buildObjectiveSlideEnhancement(input: {
  topic: string;
  objective: string;
  programme: string;
  course?: string;
  subtopic?: string;
  pack: ReturnType<typeof buildDetailedObjectivePack>;
  noteChunks: RetrievalChunkForPrompt[];
  enableAiNotes: boolean;
}): Promise<ObjectiveSlideEnhancement> {
  const baseCoreNotes = [
    generateSpeakerNotes(
      "concept",
      `${input.objective}\n${input.pack.conceptPoints.join(" ")}`,
      input.topic,
    ),
    "Discussion prompts:",
    ...input.pack.discussionPrompts.map((item, idx) => `${idx + 1}. ${item}`),
    "Quick checks:",
    ...input.pack.quickChecks.map((item, idx) => `${idx + 1}. ${item}`),
  ].join("\n");

  const baseApplicationNotes = [
    generateSpeakerNotes("case_study", input.pack.clinicalScenario, input.topic),
    "Clinical links:",
    ...input.pack.clinicalLinks.map((item, idx) => `${idx + 1}. ${item}`),
    "Take-home points:",
    ...input.pack.takeHomePoints.map((item, idx) => `${idx + 1}. ${item}`),
  ].join("\n");

  if (!input.enableAiNotes || input.noteChunks.length === 0) {
    return {
      conceptPoints: input.pack.conceptPoints,
      definitionPoints: input.pack.definitionPoints,
      coreSpeakerNotes: baseCoreNotes,
      applicationSpeakerNotes: baseApplicationNotes,
      usedAi: false,
    };
  }

  const retrievalQuery = [
    input.topic,
    input.subtopic ?? "",
    input.objective,
    ...input.pack.conceptPoints.slice(0, 3),
    ...input.pack.definitionPoints.slice(0, 2),
  ]
    .filter(Boolean)
    .join(" ");
  const selectedChunks = selectNoteChunksForObjective(input.noteChunks, retrievalQuery, 6);
  if (selectedChunks.length === 0) {
    return {
      conceptPoints: input.pack.conceptPoints,
      definitionPoints: input.pack.definitionPoints,
      coreSpeakerNotes: baseCoreNotes,
      applicationSpeakerNotes: baseApplicationNotes,
      usedAi: false,
    };
  }

  try {
    const result = await expandLessonContentWithProviderFallback({
      topic: input.topic,
      subtopic: input.subtopic,
      programme: input.programme,
      course: input.course,
      specificObjective: input.objective,
      contentBrief: [
        `Objective: ${input.objective}`,
        "Current key explanations:",
        ...input.pack.conceptPoints.map((p) => `- ${p}`),
        "Definitions to emphasize:",
        ...input.pack.definitionPoints.map((p) => `- ${p}`),
      ].join("\n"),
      retrievalChunks: selectedChunks,
    });

    const expandedBullets = cleanPptBulletItems(
      textToTeachingBullets(result.expandedContent, 14, 170),
      10,
      170,
    );
    const expandedDefinitions = cleanPptBulletItems(
      definitionSentencesFromText(result.expandedContent, 8),
      5,
      160,
    );

    const conceptPoints =
      expandedBullets.length >= 4
        ? expandedBullets.slice(0, 6)
        : input.pack.conceptPoints;
    const definitionPoints = cleanPptBulletItems(
      [...expandedDefinitions, ...input.pack.definitionPoints],
      5,
      160,
    );

    const deepCoreNotes = [
      `Lecturer deep notes (${result.provider} | ${result.model})`,
      ...expandedBullets.slice(0, 10).map((line, idx) => `${idx + 1}. ${line}`),
      "Discussion prompts:",
      ...input.pack.discussionPrompts.map((item, idx) => `${idx + 1}. ${item}`),
      "Quick checks:",
      ...input.pack.quickChecks.map((item, idx) => `${idx + 1}. ${item}`),
    ].join("\n");

    const deepApplicationNotes = [
      `Clinical scenario facilitation (${result.provider}):`,
      input.pack.clinicalScenario,
      ...textToTeachingBullets(result.expandedContent, 5, 220).map(
        (line, idx) => `${idx + 1}. ${line}`,
      ),
      "Clinical links:",
      ...input.pack.clinicalLinks.map((item, idx) => `${idx + 1}. ${item}`),
    ].join("\n");

    return {
      conceptPoints,
      definitionPoints: definitionPoints.length > 0 ? definitionPoints : input.pack.definitionPoints,
      coreSpeakerNotes: deepCoreNotes,
      applicationSpeakerNotes: deepApplicationNotes,
      usedAi: true,
    };
  } catch {
    return {
      conceptPoints: input.pack.conceptPoints,
      definitionPoints: input.pack.definitionPoints,
      coreSpeakerNotes: baseCoreNotes,
      applicationSpeakerNotes: baseApplicationNotes,
      usedAi: false,
    };
  }
}

async function renderGenericPptxBuffer(input: RenderInput) {
  const sections = parseSections(input);
  const aiState = { used: 0 };
  const pptx = createPptxInstance();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduNurse";
  pptx.company = "EduNurse Ops";
  pptx.subject = "Curriculum-grounded presentation";
  pptx.title = input.title;

  const metadataVisualCandidates = visualCandidatesFromMetadata(input);

  const titleSlide = pptx.addSlide();
  addSlideScaffold(
    titleSlide,
    "EduNurse Curriculum Presentation",
    `${input.programme} | ${input.topic}`,
    "",
  );
  titleSlide.addText(clampPptText(input.title, 120), {
    x: 0.8,
    y: 1.5,
    w: 8.0,
    h: 1.2,
    fontFace: "Calibri",
    fontSize: 30,
    bold: true,
    color: MODERN_CLINICAL_THEME.text,
  });
  titleSlide.addText(
    [
      `Programme: ${input.programme}`,
      `Year: ${input.year ?? "Not specified"}`,
      `Topic: ${input.topic}`,
    ].join("\n"),
    {
      x: 0.85,
      y: 2.9,
      w: 7.2,
      h: 1.5,
      fontFace: "Calibri",
      fontSize: 13,
      color: MODERN_CLINICAL_THEME.muted,
    },
  );
  const titleVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Cover",
    candidates: metadataVisualCandidates,
    aiState,
  });
  addVisualPanel(titleSlide, titleVisual, 8.8, 1.4, 3.8, 4.9);

  for (const section of sections) {
    const slide = pptx.addSlide();
    addSlideScaffold(
      slide,
      clampPptText(section.title, 80),
      "Curriculum-grounded section",
      slideCitation(section),
    );

    const paragraphText =
      section.blocks.length > 0
        ? section.blocks.map((block) => block.text).join("\n")
        : normalizeText(section.content);

    slide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 8.0,
      h: 5.85,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    slide.addText(clampPptText(paragraphText, 1300), {
      x: 1.05,
      y: 1.58,
      w: 7.45,
      h: 5.2,
      fontFace: "Calibri",
      fontSize: 12,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });

    const visual = await resolvePresentationVisual({
      topic: input.topic,
      sectionTitle: section.title,
      candidates: [
        ...visualCandidatesFromSection(section),
        ...metadataVisualCandidates,
      ],
      aiState,
    });
    addVisualPanel(slide, visual, 9.1, 1.4, 3.35, 5.55);
  }

  return pptx.write({ outputType: "nodebuffer" }) as Promise<Buffer>;
}

/**
 * Enhanced PowerPoint rendering with AI-powered ready-to-use features
 * Includes speaker notes, timing, interactive elements, clinical scenarios, and more
 */
async function renderEnhancedTeachingDeckPptxBuffer(input: RenderInput) {
  const sections = parseSections(input);
  const model = buildLessonPlanModel(input, sections);
  const metadata = safeRecord(input.contentJson.metadata);
  const curriculumContext = safeRecord(metadata.curriculumContext);
  const introSection = sectionByNeedle(sections, ["introduction", "overview"]);
  const objectivesSection = sectionByNeedle(sections, ["specific_objectives", "outcome"]);
  const definitionsSection = sectionByNeedle(sections, [
    "key_definitions",
    "definition",
    "glossary",
    "terminology",
  ]);
  const presentationSection = sectionByNeedle(sections, [
    "lesson_presentation",
    "teaching_flow",
    "presentation",
  ]);
  const summarySection = sectionByNeedle(sections, ["summary", "conclusion"]);
  const evaluationSection = sectionByNeedle(sections, ["evaluation", "assessment"]);
  const assignmentSection = sectionByNeedle(sections, ["assignment"]);
  const referencesSection = sectionByNeedle(sections, ["reference"]);

  const metadataVisualCandidates = visualCandidatesFromMetadata(input);
  const aiState = { used: 0 };
  const pptx = createPptxInstance();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduNurse Pro";
  pptx.company = "EduNurse Academic Suite";
  pptx.subject = "AI-Enhanced Teaching Presentation - Ready to Use";
  pptx.title = `${input.topic} - Teaching Deck`;

  // Track total estimated time
  let totalEstimatedTime = 0;

  const courseName =
    normalizeText(curriculumContext.course) ||
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("course"))?.value,
    ) ||
    "Course Module";
  const programmeLevel =
    normalizeText(curriculumContext.programmeLevel) ||
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("programme"))?.value,
    ) ||
    "Not specified";
  const semesterLabel =
    normalizeText(curriculumContext.semester) || normalizeText(input.year) || "Not specified";
  const durationLabel =
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("duration"))?.value,
    ) || "60 minutes";

  const objectiveItems =
    model.specificObjectives.length > 0
      ? model.specificObjectives
      : [
        `Define and explain key concepts in ${input.topic}.`,
        `Apply ${input.topic} knowledge to classroom and clinical examples.`,
        `Evaluate learner understanding through formative questions.`,
      ];

  // Enhance objectives with measurable outcomes
  const enhancedObjectives = objectiveItems.map((obj, idx) =>
    `By the end of this session, learners will be able to ${obj.toLowerCase().replace('define and explain', 'define')}`
  );

  const agendaItems = enhancedObjectives.slice(0, 6);
  const introBullets = textToTeachingBullets(model.introduction, 5, 140);
  const definitionItems = unique([
    ...blocksToList(definitionsSection?.blocks ?? []),
    ...extractDefinitionBullets(model.presentationRows),
  ]).slice(0, 8);
  const objectiveEvidenceText = [
    model.introduction,
    model.generalObjective,
    model.summary,
    ...definitionItems,
    ...model.presentationRows.map((row) =>
      [row.specificObjective, row.content, row.educatorActivities, row.learnerActivities, row.assessment]
        .filter(Boolean)
        .join(" "),
    ),
  ]
    .filter(Boolean)
    .join("\n");

  // Generate memory aids for key terms
  const memoryAids = generateMemoryAids(input.topic, definitionItems.slice(0, 5));

  // Generate clinical scenario
  const clinicalScenario = createClinicalScenario(input.topic);

  // Generate quiz questions
  const quizQuestions = createQuizQuestions(input.topic, 3);

  // ========== SLIDE 1: PREPARATION CHECKLIST ==========
  const prepSlide = pptx.addSlide();
  addSlideScaffold(
    prepSlide,
    "Before You Start",
    "Preparation checklist for effective teaching",
    "",
  );

  const prepContent = [
    "Review learning objectives and session agenda.",
    "Prepare teaching materials and resources.",
    "Set up classroom technology (projector and sound).",
    "Prepare handouts for distribution.",
    "Prepare formative assessment questions.",
    "Review clinical scenarios and case studies.",
    "Plan time allocation for interactive activities.",
    "Prepare answer keys for assessments.",
  ];

  prepSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 12.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "F0F9FF" },
    line: { color: "0EA5E9", pt: 2 },
  });

  prepSlide.addText("Teaching Preparation Checklist", {
    x: 1.1,
    y: 1.5,
    w: 11.0,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 16,
    bold: true,
    color: "0369A1",
  });

  prepSlide.addText(pptxBullets(prepContent), {
    x: 1.3,
    y: 2.0,
    w: 10.5,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 12,
    color: "1E3A8A",
    breakLine: true,
  });

  // Add speaker notes with timing
  const prepNotes = generateSpeakerNotes('title', `Preparation for ${input.topic}`, input.topic);
  const prepTime = estimateSlideTime(prepContent.join(' '), 'title');
  totalEstimatedTime += prepTime;
  prepSlide.addNotes(`Estimated time: ${formatTimeEstimate(prepTime)}\n\n${prepNotes}`);

  // ========== SLIDE 2: TITLE SLIDE WITH ENHANCED METADATA ==========
  const cover = pptx.addSlide();
  addSlideScaffold(
    cover,
    "AI-Enhanced Teaching Presentation",
    "Ready-to-use classroom delivery deck",
    "",
  );

  cover.addText(clampPptText(input.topic, 100), {
    x: 0.75,
    y: 1.18,
    w: 7.9,
    h: 0.92,
    fontFace: "Calibri",
    fontSize: 36,
    bold: true,
    color: MODERN_CLINICAL_THEME.text,
  });

  cover.addText(
    [
      `Course: ${clampPptText(courseName, 72)}`,
      `Programme: ${clampPptText(input.programme, 40)} (${clampPptText(programmeLevel, 24)})`,
      `Semester: ${clampPptText(semesterLabel, 36)}`,
      `Session Duration: ${clampPptText(durationLabel, 30)}`,
      `Total Slides: 12-15 | Estimated Teaching Time: ${durationLabel}`,
    ].join("\n"),
    {
      x: 0.8,
      y: 2.25,
      w: 7.7,
      h: 2.5,
      fontFace: "Calibri",
      fontSize: 13,
      color: MODERN_CLINICAL_THEME.muted,
    },
  );

  cover.addShape("roundRect", {
    x: 0.8,
    y: 4.9,
    w: 7.65,
    h: 1.55,
    radius: 0.08,
    fill: { color: MODERN_CLINICAL_THEME.panelAlt },
    line: { color: "BFDBFE", pt: 1 },
  });

  cover.addText("Session Focus", {
    x: 1.02,
    y: 5.1,
    w: 2.5,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 11,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });

  cover.addText(clampPptText(model.generalObjective, 350), {
    x: 1.02,
    y: 5.35,
    w: 7.18,
    h: 0.9,
    fontFace: "Calibri",
    fontSize: 11,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });

  const coverVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Title and context",
    candidates: metadataVisualCandidates,
    aiState,
    mode: "cover",
  });
  addVisualPanel(cover, coverVisual, 8.75, 1.2, 3.95, 5.85);

  // Add speaker notes with timing
  const coverNotes = generateSpeakerNotes('title', input.topic, input.topic);
  const coverTime = estimateSlideTime(model.generalObjective, 'title');
  totalEstimatedTime += coverTime;
  cover.addNotes(`Estimated time: ${formatTimeEstimate(coverTime)}\n\n${coverNotes}`);

  // ========== SLIDE 3: MEASURABLE LEARNING OUTCOMES ==========
  const outcomesSlide = pptx.addSlide();
  addSlideScaffold(
    outcomesSlide,
    "Measurable Learning Outcomes",
    "What learners will achieve by session end",
    slideCitation(objectivesSection),
  );

  outcomesSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.22,
    w: 12.0,
    h: 5.86,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });

  outcomesSlide.addText("By the end of this session, learners will be able to:", {
    x: 1.1,
    y: 1.5,
    w: 11.0,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });

  outcomesSlide.addText(pptxBullets(enhancedObjectives.slice(0, 6)), {
    x: 1.3,
    y: 2.0,
    w: 10.5,
    h: 3.0,
    fontFace: "Calibri",
    fontSize: 12,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });

  outcomesSlide.addShape("roundRect", {
    x: 0.8,
    y: 4.3,
    w: 12.0,
    h: 2.0,
    radius: 0.08,
    fill: { color: "FEF3C7" },
    line: { color: "F59E0B", pt: 1 },
  });

  outcomesSlide.addText("Assessment Methods", {
    x: 1.1,
    y: 4.5,
    w: 11.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: "92400E",
  });

  outcomesSlide.addText(pptxBullets([
    "Formative questioning during presentation",
    "Case study analysis and discussion",
    "Quick quiz at session end",
    "Clinical scenario application",
    "Peer teaching demonstration"
  ]), {
    x: 1.3,
    y: 4.8,
    w: 10.5,
    h: 1.2,
    fontFace: "Calibri",
    fontSize: 10,
    color: "92400E",
    breakLine: true,
  });

  // Add speaker notes with timing
  const outcomesNotes = generateSpeakerNotes('objectives', enhancedObjectives.join(' '), input.topic);
  const outcomesTime = estimateSlideTime(enhancedObjectives.join(' '), 'objectives');
  totalEstimatedTime += outcomesTime;
  outcomesSlide.addNotes(`Estimated time: ${formatTimeEstimate(outcomesTime)}\n\n${outcomesNotes}`);

  // ========== SLIDE 4: SESSION AGENDA WITH TIMING ==========
  const agendaSlide = pptx.addSlide();
  addSlideScaffold(
    agendaSlide,
    "Session Agenda & Timeline",
    "Structured teaching flow with time allocation",
    "",
  );

  const agendaWithTime = agendaItems.map((item, idx) => {
    const itemTime = idx === 0 ? 5 : idx === agendaItems.length - 1 ? 10 : 8;
    return `${formatTimeEstimate(itemTime)} - ${item}`;
  });

  agendaSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 8.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });

  agendaSlide.addText("Teaching Timeline", {
    x: 1.1,
    y: 1.5,
    w: 7.5,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });

  agendaSlide.addText(pptxBullets(agendaWithTime), {
    x: 1.3,
    y: 2.0,
    w: 7.0,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 11,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });

  agendaSlide.addShape("roundRect", {
    x: 9.0,
    y: 1.25,
    w: 3.8,
    h: 5.8,
    radius: 0.08,
    fill: { color: MODERN_CLINICAL_THEME.accentSoft },
    line: { color: "BFDBFE", pt: 1 },
  });

  agendaSlide.addText("Teaching Tips", {
    x: 9.3,
    y: 1.5,
    w: 3.2,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: "1E3A8A",
  });

  agendaSlide.addText(pptxBullets([
    "Start with baseline knowledge check",
    "Pause after key concepts for Q&A",
    "Use clinical examples for each point",
    "Incorporate active learning every 15 min",
    "Save time for summary and questions"
  ]), {
    x: 9.5,
    y: 1.9,
    w: 3.0,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 9,
    color: "1E3A8A",
    breakLine: true,
  });

  // Add speaker notes with timing
  const agendaNotes = generateSpeakerNotes('concept', agendaItems.join(' '), input.topic);
  const agendaTime = estimateSlideTime(agendaItems.join(' '), 'concept');
  totalEstimatedTime += agendaTime;
  agendaSlide.addNotes(`Estimated time: ${formatTimeEstimate(agendaTime)}\n\n${agendaNotes}`);

  // ========== SLIDE 5: KEY CONCEPTS & DEFINITIONS ==========
  const conceptsSlide = pptx.addSlide();
  addSlideScaffold(
    conceptsSlide,
    "Core Concepts & Definitions",
    "Essential terminology for professional practice",
    slideCitation(definitionsSection),
  );

  conceptsSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 8.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });

  conceptsSlide.addText("Key Terminology", {
    x: 1.1,
    y: 1.5,
    w: 7.5,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });

  conceptsSlide.addText(pptxBullets(definitionItems.slice(0, 6)), {
    x: 1.3,
    y: 2.0,
    w: 7.0,
    h: 3.0,
    fontFace: "Calibri",
    fontSize: 11,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });

  conceptsSlide.addShape("roundRect", {
    x: 9.0,
    y: 1.25,
    w: 3.8,
    h: 2.8,
    radius: 0.08,
    fill: { color: "F0F9FF" },
    line: { color: "0EA5E9", pt: 1 },
  });

  conceptsSlide.addText("Memory Aids", {
    x: 9.3,
    y: 1.5,
    w: 3.2,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 11,
    bold: true,
    color: "0369A1",
  });

  conceptsSlide.addText(pptxBullets(memoryAids), {
    x: 9.5,
    y: 1.9,
    w: 3.0,
    h: 1.8,
    fontFace: "Calibri",
    fontSize: 9,
    color: "0369A1",
    breakLine: true,
  });

  conceptsSlide.addShape("roundRect", {
    x: 9.0,
    y: 4.25,
    w: 3.8,
    h: 2.8,
    radius: 0.08,
    fill: { color: "FEF3C7" },
    line: { color: "F59E0B", pt: 1 },
  });

  conceptsSlide.addText("Interactive Activity", {
    x: 9.3,
    y: 4.5,
    w: 3.2,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 11,
    bold: true,
    color: "92400E",
  });

  const interactiveElements = generateInteractiveElements(input.topic, 'definition');
  conceptsSlide.addText(pptxBullets(interactiveElements), {
    x: 9.5,
    y: 4.9,
    w: 3.0,
    h: 1.8,
    fontFace: "Calibri",
    fontSize: 9,
    color: "92400E",
    breakLine: true,
  });

  // Add speaker notes with timing
  const conceptsNotes = generateSpeakerNotes('definition', definitionItems.join(' '), input.topic);
  const conceptsTime = estimateSlideTime(definitionItems.join(' '), 'definition');
  totalEstimatedTime += conceptsTime;
  conceptsSlide.addNotes(`Estimated time: ${formatTimeEstimate(conceptsTime)}\n\n${conceptsNotes}\n\nInteractive elements: ${interactiveElements.join(', ')}`);

  // ========== SLIDE 6: CLINICAL SCENARIO ==========
  const scenarioSlide = pptx.addSlide();
  addSlideScaffold(
    scenarioSlide,
    "Clinical Application Scenario",
    "Real-world case study for critical thinking",
    "",
  );

  scenarioSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 12.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "F0F9FF" },
    line: { color: "0EA5E9", pt: 2 },
  });

  scenarioSlide.addText("Case Study", {
    x: 1.1,
    y: 1.5,
    w: 11.0,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 16,
    bold: true,
    color: "0369A1",
  });

  scenarioSlide.addText(clampPptText(clinicalScenario, 800), {
    x: 1.3,
    y: 2.0,
    w: 10.5,
    h: 2.5,
    fontFace: "Calibri",
    fontSize: 12,
    color: "1E3A8A",
    breakLine: true,
  });

  scenarioSlide.addShape("roundRect", {
    x: 0.8,
    y: 3.8,
    w: 12.0,
    h: 3.0,
    radius: 0.08,
    fill: { color: "FEF3C7" },
    line: { color: "F59E0B", pt: 1 },
  });

  scenarioSlide.addText("Discussion Questions", {
    x: 1.1,
    y: 4.0,
    w: 11.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: "92400E",
  });

  const discussionQuestions = [
    "What are the priority nursing assessments?",
    "Which interventions would you implement first?",
    "What patient education is needed?",
    "How would you evaluate effectiveness?",
    "What documentation is essential?"
  ];

  scenarioSlide.addText(pptxBullets(discussionQuestions), {
    x: 1.3,
    y: 4.4,
    w: 10.5,
    h: 2.0,
    fontFace: "Calibri",
    fontSize: 11,
    color: "92400E",
    breakLine: true,
  });

  // Add speaker notes with timing
  const scenarioNotes = generateSpeakerNotes('case_study', clinicalScenario, input.topic);
  const scenarioTime = estimateSlideTime(clinicalScenario, 'case_study');
  totalEstimatedTime += scenarioTime;
  scenarioSlide.addNotes(`Estimated time: ${formatTimeEstimate(scenarioTime)}\n\n${scenarioNotes}\n\nDiscussion questions: ${discussionQuestions.join('; ')}`);

  // ========== SLIDE 7-9: CONTENT SLIDES FROM LESSON PLAN ==========
  // Use the existing detailed objective packs but enhance them
  const objectivePacks = model.presentationRows.slice(0, 3).map((row, idx) => {
    const objective = model.specificObjectives[idx] || `Understand key aspects of ${input.topic}`;
    const pack = buildDetailedObjectivePack({
      topic: input.topic,
      objective,
      row,
      evidenceText: objectiveEvidenceText,
    });
    return { objective, pack };
  });

  for (let i = 0; i < Math.min(objectivePacks.length, 3); i++) {
    const { objective, pack } = objectivePacks[i];

    // Content Slide
    const contentSlide = pptx.addSlide();
    addSlideScaffold(
      contentSlide,
      `Objective ${i + 1}`,
      clampPptText(objective, 110),
      "",
    );

    contentSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 8.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    contentSlide.addText(`Key Concepts`, {
      x: 1.1,
      y: 1.5,
      w: 7.5,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });

    contentSlide.addText(pptxBullets(pack.conceptPoints.slice(0, 5)), {
      x: 1.3,
      y: 2.0,
      w: 7.0,
      h: 2.5,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });

    contentSlide.addShape("roundRect", {
      x: 9.0,
      y: 1.25,
      w: 3.8,
      h: 5.8,
      radius: 0.08,
      fill: { color: MODERN_CLINICAL_THEME.accentSoft },
      line: { color: "BFDBFE", pt: 1 },
    });

    contentSlide.addText("Teaching Guidance", {
      x: 9.3,
      y: 1.5,
      w: 3.2,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: "1E3A8A",
    });

    const teachingTips = [
      "Demonstrate with clinical example",
      "Ask probing questions",
      "Use visual aids if available",
      "Connect to prior knowledge",
      "Check understanding frequently"
    ];

    contentSlide.addText(pptxBullets(teachingTips), {
      x: 9.5,
      y: 1.9,
      w: 3.0,
      h: 4.5,
      fontFace: "Calibri",
      fontSize: 9,
      color: "1E3A8A",
      breakLine: true,
    });

    // Add speaker notes with timing
    const contentNotes = generateSpeakerNotes('concept', pack.conceptPoints.join(' '), input.topic);
    const contentTime = estimateSlideTime(pack.conceptPoints.join(' '), 'concept');
    totalEstimatedTime += contentTime;
    contentSlide.addNotes(`Estimated time: ${formatTimeEstimate(contentTime)}\n\n${contentNotes}`);
  }

  // ========== SLIDE 10: FORMATIVE ASSESSMENT ==========
  const assessmentSlide = pptx.addSlide();
  addSlideScaffold(
    assessmentSlide,
    "Formative Assessment",
    "Check understanding before moving forward",
    slideCitation(evaluationSection),
  );

  assessmentSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 12.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "F0F9FF" },
    line: { color: "0EA5E9", pt: 2 },
  });

  assessmentSlide.addText("Quick Quiz", {
    x: 1.1,
    y: 1.5,
    w: 11.0,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 16,
    bold: true,
    color: "0369A1",
  });

  const quizContent = quizQuestions.map((q, idx) =>
    `${idx + 1}. ${q.question}\n   A) ${q.options[0]}\n   B) ${q.options[1]}\n   C) ${q.options[2]}\n   D) ${q.options[3]}\n   Answer: ${q.answer}`
  ).join('\n\n');

  assessmentSlide.addText(clampPptText(quizContent, 1200), {
    x: 1.3,
    y: 2.0,
    w: 10.5,
    h: 4.0,
    fontFace: "Calibri",
    fontSize: 11,
    color: "1E3A8A",
    breakLine: true,
  });

  // Add speaker notes with timing
  const assessmentNotes = generateSpeakerNotes('assessment', quizContent, input.topic);
  const assessmentTime = estimateSlideTime(quizContent, 'assessment');
  totalEstimatedTime += assessmentTime;
  assessmentSlide.addNotes(`Estimated time: ${formatTimeEstimate(assessmentTime)}\n\n${assessmentNotes}`);

  // ========== SLIDE 11: SUMMARY & KEY TAKEAWAYS ==========
  const summarySlide = pptx.addSlide();
  addSlideScaffold(
    summarySlide,
    "Session Summary",
    "Key takeaways and next steps",
    slideCitation(summarySection),
  );

  const summaryItems = textToTeachingBullets(model.summary, 6, 120).length > 0
    ? textToTeachingBullets(model.summary, 6, 120)
    : [
      `Mastery of ${input.topic} enhances clinical decision-making`,
      `Accurate terminology improves professional communication`,
      `Application in clinical scenarios builds competency`,
      `Continuous assessment ensures learning retention`
    ];

  summarySlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 8.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });

  summarySlide.addText("Key Takeaways", {
    x: 1.1,
    y: 1.5,
    w: 7.5,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });

  summarySlide.addText(pptxBullets(summaryItems.slice(0, 5)), {
    x: 1.3,
    y: 2.0,
    w: 7.0,
    h: 2.5,
    fontFace: "Calibri",
    fontSize: 11,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });

  summarySlide.addShape("roundRect", {
    x: 9.0,
    y: 1.25,
    w: 3.8,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FEF3C7" },
    line: { color: "F59E0B", pt: 1 },
  });

  summarySlide.addText("Next Steps", {
    x: 9.3,
    y: 1.5,
    w: 3.2,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: "92400E",
  });

  const nextSteps = [
    "Complete assigned readings",
    "Practice clinical scenarios",
    "Review key terminology",
    "Prepare for next session",
    "Seek clarification if needed"
  ];

  summarySlide.addText(pptxBullets(nextSteps), {
    x: 9.5,
    y: 1.9,
    w: 3.0,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 10,
    color: "92400E",
    breakLine: true,
  });

  // Add speaker notes with timing
  const summaryNotes = generateSpeakerNotes('summary', summaryItems.join(' '), input.topic);
  const summaryTime = estimateSlideTime(summaryItems.join(' '), 'summary');
  totalEstimatedTime += summaryTime;
  summarySlide.addNotes(`Estimated time: ${formatTimeEstimate(summaryTime)}\n\n${summaryNotes}`);

  // ========== SLIDE 12: RESOURCES & REFERENCES ==========
  const referenceItems = model.references.length > 0 ? model.references : ["Curriculum source"];
  const referenceChunks = splitItems(referenceItems, 9);

  referenceChunks.forEach((items, idx) => {
    const slide = pptx.addSlide();
    addSlideScaffold(
      slide,
      idx === 0 ? "Resources & References" : `Resources (continued ${idx + 1})`,
      "Further reading and curriculum sources",
      slideCitation(referencesSection),
    );

    slide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    slide.addText(pptxBullets(items), {
      x: 1.1,
      y: 1.65,
      w: 11.4,
      h: 5.2,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });

    // Add speaker notes
    const refNotes = `Reference slide ${idx + 1}. Direct students to these resources for further study.`;
    const refTime = 1.0; // 1 minute for references
    totalEstimatedTime += refTime;
    slide.addNotes(`Estimated time: ${formatTimeEstimate(refTime)}\n\n${refNotes}`);
  });

  // ========== FINAL SLIDE: TEACHING NOTES ==========
  const notesSlide = pptx.addSlide();
  addSlideScaffold(
    notesSlide,
    "Teaching Implementation Notes",
    "Practical guidance for classroom delivery",
    "",
  );

  notesSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 12.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "F0F9FF" },
    line: { color: "0EA5E9", pt: 2 },
  });

  const implementationNotes = [
    `Total estimated teaching time: ${formatTimeEstimate(totalEstimatedTime)}`,
    `Adjust timing based on student engagement and questions`,
    `Use interactive elements to maintain attention`,
    `Pace the session to cover all key concepts`,
    `Save 5-10 minutes for Q&A at the end`,
    `Follow up with students who need additional support`,
    `Collect feedback for continuous improvement`
  ];

  notesSlide.addText("Session Implementation Guide", {
    x: 1.1,
    y: 1.5,
    w: 11.0,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 16,
    bold: true,
    color: "0369A1",
  });

  notesSlide.addText(pptxBullets(implementationNotes), {
    x: 1.3,
    y: 2.0,
    w: 10.5,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 12,
    color: "1E3A8A",
    breakLine: true,
  });

  notesSlide.addNotes(`This AI-enhanced presentation includes:\n- Speaker notes on every slide\n- Time estimates for pacing\n- Interactive elements for engagement\n- Clinical scenarios for application\n- Assessment questions with answers\n- Memory aids for key concepts\n\nTotal slides: ${pptx.slides.length}\nTotal estimated time: ${formatTimeEstimate(totalEstimatedTime)}`);

  return pptx.write({ outputType: "nodebuffer" }) as Promise<Buffer>;
}

async function renderLessonTeachingDeckPptxBuffer(input: RenderInput) {
  const sections = parseSections(input);
  const model = buildLessonPlanModel(input, sections);
  const metadata = safeRecord(input.contentJson.metadata);
  const curriculumContext = safeRecord(metadata.curriculumContext);
  const introSection = sectionByNeedle(sections, ["introduction", "overview"]);
  const objectivesSection = sectionByNeedle(sections, ["specific_objectives", "outcome"]);
  const definitionsSection = sectionByNeedle(sections, [
    "key_definitions",
    "definition",
    "glossary",
    "terminology",
  ]);
  const presentationSection = sectionByNeedle(sections, [
    "lesson_presentation",
    "teaching_flow",
    "presentation",
  ]);
  const summarySection = sectionByNeedle(sections, ["summary", "conclusion"]);
  const evaluationSection = sectionByNeedle(sections, ["evaluation", "assessment"]);
  const assignmentSection = sectionByNeedle(sections, ["assignment"]);
  const referencesSection = sectionByNeedle(sections, ["reference"]);

  const metadataVisualCandidates = visualCandidatesFromMetadata(input);
  const aiState = { used: 0 };
  const pptx = createPptxInstance();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "EduNurse Pro";
  pptx.company = "EduNurse Academic Suite";
  pptx.subject = "Premium Academic Teaching Presentation";
  pptx.title = input.title;

  const courseName =
    normalizeText(curriculumContext.course) ||
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("course"))?.value,
    ) ||
    "Course Module";
  const programmeLevel =
    normalizeText(curriculumContext.programmeLevel) ||
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("programme"))?.value,
    ) ||
    "Not specified";
  const semesterLabel =
    normalizeText(curriculumContext.semester) || normalizeText(input.year) || "Not specified";
  const durationLabel =
    normalizeText(
      model.headerRows.find((row) => normalize(row.label).includes("duration"))?.value,
    ) || "60 minutes";

  const objectiveItems =
    model.specificObjectives.length > 0
      ? model.specificObjectives
      : [
        `Define and explain key concepts in ${input.topic}.`,
        `Apply ${input.topic} knowledge to classroom and clinical examples.`,
        `Evaluate learner understanding through formative questions.`,
      ];
  const agendaItems = objectiveItems.slice(0, 8);
  const introBullets = textToTeachingBullets(model.introduction, 5, 140);
  const definitionItems = unique([
    ...blocksToList(definitionsSection?.blocks ?? []),
    ...extractDefinitionBullets(model.presentationRows),
  ]).slice(0, 8);
  const objectiveEvidenceText = [
    model.introduction,
    model.generalObjective,
    model.summary,
    ...definitionItems,
    ...model.presentationRows.map((row) =>
      [row.specificObjective, row.content, row.educatorActivities, row.learnerActivities, row.assessment]
        .filter(Boolean)
        .join(" "),
    ),
  ]
    .filter(Boolean)
    .join("\n");
  const noteChunks = buildPresentationNoteChunks(sections);
  const aiNotesEnabled = env.PRESENTATION_ENABLE_AI_NOTES;
  const aiNotesMaxObjectives = Math.max(1, env.PRESENTATION_AI_NOTES_MAX_OBJECTIVES);
  let aiNotesUsed = 0;
  let slideNumber = 0;

  // ============================================================
  // SLIDE 1: PREMIUM TITLE SLIDE with AI-Generated Hero Image
  // ============================================================
  slideNumber++;
  const cover = pptx.addSlide();

  // Full-bleed gradient background
  cover.background = {
    fill: "0F172A", // Deep navy blue
  };

  // Add gradient overlay shape
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: {
      type: "solid",
      color: "0F172A",
      transparency: 20,
    },
  });

  // Hero image with AI generation
  const heroVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Hero image",
    candidates: metadataVisualCandidates,
    aiState,
    mode: "cover",
  });

  if (heroVisual?.dataUri) {
    cover.addImage({
      data: heroVisual.dataUri,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      sizing: { type: "cover" },
      transparency: 60, // Semi-transparent for text readability
    });
  }

  // Dark overlay for text contrast
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: {
      type: "solid",
      color: "000000",
      transparency: 40,
    },
  });

  // Institution branding bar
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.6,
    fill: { color: "3B82F6" }, // Bright blue
  });

  cover.addText("EduNurse Pro | Academic Excellence", {
    x: 0.5,
    y: 0.12,
    w: 12.0,
    h: 0.35,
    fontFace: "Calibri",
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
    align: "center",
  });

  // Main title with shadow effect
  cover.addText(clampPptText(input.topic, 100), {
    x: 1.0,
    y: 2.2,
    w: 11.0,
    h: 1.5,
    fontFace: "Calibri Light",
    fontSize: 44,
    bold: true,
    color: "FFFFFF",
    align: "center",
    shadow: {
      type: "outer",
      blur: 8,
      offset: 4,
      angle: 45,
      color: "000000",
      opacity: 0.5,
    },
  });

  // Subtitle bar
  cover.addShape("roundRect", {
    x: 2.0,
    y: 4.0,
    w: 9.0,
    h: 0.08,
    radius: 0.04,
    fill: { color: "3B82F6" },
  });

  // Course metadata in elegant cards
  const metadataCards = [
    { icon: "📚", label: "Course", value: clampPptText(courseName, 50) },
    { icon: "🎓", label: "Programme", value: `${clampPptText(input.programme, 30)} - ${clampPptText(programmeLevel, 20)}` },
    { icon: "📅", label: "Semester", value: clampPptText(semesterLabel, 30) },
    { icon: "⏱️", label: "Duration", value: clampPptText(durationLabel, 20) },
  ];

  metadataCards.forEach((card, idx) => {
    const xPos = 1.5 + (idx * 2.5);

    cover.addShape("roundRect", {
      x: xPos,
      y: 4.5,
      w: 2.2,
      h: 1.3,
      radius: 0.12,
      fill: { color: "FFFFFF", transparency: 10 },
      line: { color: "3B82F6", pt: 2 },
    });

    cover.addText(card.icon, {
      x: xPos + 0.1,
      y: 4.65,
      w: 2.0,
      h: 0.4,
      fontFace: "Segoe UI Emoji",
      fontSize: 24,
      align: "center",
    });

    cover.addText(card.label, {
      x: xPos + 0.1,
      y: 5.1,
      w: 2.0,
      h: 0.25,
      fontFace: "Calibri",
      fontSize: 9,
      bold: true,
      color: "FFFFFF",
      align: "center",
    });

    cover.addText(card.value, {
      x: xPos + 0.1,
      y: 5.4,
      w: 2.0,
      h: 0.3,
      fontFace: "Calibri",
      fontSize: 10,
      color: "E0E7FF",
      align: "center",
    });
  });

  // Footer with branding
  cover.addText("Curriculum-Grounded | Evidence-Based | Student-Centered", {
    x: 0.5,
    y: 6.7,
    w: 12.0,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 10,
    italic: true,
    color: "94A3B8",
    align: "center",
  });

  cover.addNotes([
    "🎯 TITLE SLIDE - Opening (2 minutes)",
    "",
    "Welcome and Introduction:",
    "• Greet students warmly and introduce yourself",
    "• State the lesson topic clearly and with enthusiasm",
    "• Explain why this topic is important for nursing practice",
    "• Set expectations for the session duration and format",
    "",
    "Engagement Strategy:",
    "• Ask: 'What do you already know about this topic?'",
    "• Share a brief clinical anecdote related to the topic",
    "• Create a positive, inclusive learning environment",
    "",
    `Course: ${courseName}`,
    `Programme: ${input.programme} - ${programmeLevel}`,
    `Duration: ${durationLabel}`,
  ].join("\n"));

  // ============================================================
  // SLIDE 2: LEARNING OBJECTIVES with Visual Icons
  // ============================================================
  slideNumber++;
  const objectivesSlide = pptx.addSlide();
  addSlideScaffold(
    objectivesSlide,
    "🎯 Learning Objectives",
    "What you will achieve by the end of this lesson",
    slideCitation(objectivesSection),
  );

  // Left panel: Objectives
  objectivesSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.3,
    w: 7.5,
    h: 5.5,
    radius: 0.15,
    fill: { color: "FFFFFF" },
    line: { color: "3B82F6", pt: 2 },
    shadow: {
      type: "outer",
      blur: 10,
      offset: 3,
      angle: 45,
      color: "000000",
      opacity: 0.15,
    },
  });

  objectivesSlide.addText("By the end of this lesson, you will be able to:", {
    x: 1.1,
    y: 1.6,
    w: 6.9,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: "1E40AF",
  });

  // Objectives with icons
  const objectiveIcons = ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓"];
  agendaItems.forEach((obj, idx) => {
    const yPos = 2.15 + (idx * 0.55);

    // Icon circle
    objectivesSlide.addShape("ellipse", {
      x: 1.2,
      y: yPos,
      w: 0.35,
      h: 0.35,
      fill: { color: "3B82F6" },
    });

    objectivesSlide.addText(objectiveIcons[idx], {
      x: 1.2,
      y: yPos + 0.05,
      w: 0.35,
      h: 0.25,
      fontFace: "Calibri",
      fontSize: 14,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
    });

    objectivesSlide.addText(`${idx + 1}. ${obj}`, {
      x: 1.7,
      y: yPos,
      w: 6.3,
      h: 0.5,
      fontFace: "Calibri",
      fontSize: 11,
      color: "1F2937",
      valign: "top",
    });
  });

  // Right panel: Visual + Key Message
  const objectivesVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Learning objectives",
    candidates: [...visualCandidatesFromSection(objectivesSection), ...metadataVisualCandidates],
    aiState,
    mode: "core_concepts",
  });

  objectivesSlide.addShape("roundRect", {
    x: 8.5,
    y: 1.3,
    w: 4.2,
    h: 3.5,
    radius: 0.15,
    fill: { color: "EFF6FF" },
    line: { color: "BFDBFE", pt: 1.5 },
  });

  if (objectivesVisual?.dataUri) {
    objectivesSlide.addImage({
      data: objectivesVisual.dataUri,
      x: 8.7,
      y: 1.5,
      w: 3.8,
      h: 3.1,
      sizing: { type: "contain" },
    });
  }

  // Key message box
  objectivesSlide.addShape("roundRect", {
    x: 8.5,
    y: 5.0,
    w: 4.2,
    h: 1.8,
    radius: 0.15,
    fill: { color: "DBEAFE" },
    line: { color: "3B82F6", pt: 2 },
  });

  objectivesSlide.addText("💡 Key Focus", {
    x: 8.7,
    y: 5.2,
    w: 3.8,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: "1E40AF",
  });

  objectivesSlide.addText(clampPptText(model.generalObjective, 280), {
    x: 8.7,
    y: 5.6,
    w: 3.8,
    h: 1.0,
    fontFace: "Calibri",
    fontSize: 11,
    color: "1F2937",
    breakLine: true,
  });

  addSlideFooter(objectivesSlide, slideNumber, 20, input.topic); // Estimate 20 total slides

  objectivesSlide.addNotes([
    "🎯 LEARNING OBJECTIVES (3 minutes)",
    "",
    "Presentation Strategy:",
    "• Read each objective clearly and pause for comprehension",
    "• Explain how each objective relates to nursing practice",
    "• Emphasize that these are measurable, achievable goals",
    "• Encourage students to take notes on objectives",
    "",
    "Interactive Element:",
    "• Ask: 'Which objective are you most interested in learning about?'",
    "• Briefly discuss why these competencies matter for patient care",
    "",
    "Objectives:",
    ...agendaItems.map((obj, idx) => `${idx + 1}. ${obj}`),
  ].join("\n"));

  // ============================================================
  // SLIDE 3: INTRODUCTION & CONTEXT with Infographic
  // ============================================================
  slideNumber++;
  const introSlide = pptx.addSlide();
  addSlideScaffold(
    introSlide,
    "📖 Introduction & Context",
    "Why this topic matters in nursing practice",
    slideCitation(introSection),
  );

  // Main content area
  introSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.3,
    w: 7.5,
    h: 5.5,
    radius: 0.15,
    fill: { color: "FFFFFF" },
    line: { color: "10B981", pt: 2 },
    shadow: {
      type: "outer",
      blur: 10,
      offset: 3,
      angle: 45,
      color: "000000",
      opacity: 0.15,
    },
  });

  introSlide.addText("Clinical Significance", {
    x: 1.1,
    y: 1.6,
    w: 6.9,
    h: 0.4,
    fontFace: "Calibri",
    fontSize: 14,
    bold: true,
    color: "047857",
  });

  introSlide.addText(pptxBullets(introBullets.length > 0 ? introBullets : [model.introduction]), {
    x: 1.1,
    y: 2.1,
    w: 6.9,
    h: 4.5,
    fontFace: "Calibri",
    fontSize: 12,
    color: "1F2937",
    breakLine: true,
  });

  // Right panel: Statistics/Facts + Visual
  const introVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Introduction context",
    candidates: [...visualCandidatesFromSection(introSection), ...metadataVisualCandidates],
    aiState,
    mode: "generic",
  });

  introSlide.addShape("roundRect", {
    x: 8.5,
    y: 1.3,
    w: 4.2,
    h: 3.2,
    radius: 0.15,
    fill: { color: "F0FDF4" },
    line: { color: "10B981", pt: 1.5 },
  });

  if (introVisual?.dataUri) {
    introSlide.addImage({
      data: introVisual.dataUri,
      x: 8.7,
      y: 1.5,
      w: 3.8,
      h: 2.8,
      sizing: { type: "contain" },
    });
  }

  // Did You Know? box
  introSlide.addShape("roundRect", {
    x: 8.5,
    y: 4.7,
    w: 4.2,
    h: 2.1,
    radius: 0.15,
    fill: { color: "FEF3C7" },
    line: { color: "F59E0B", pt: 2 },
  });

  introSlide.addText("💡 Did You Know?", {
    x: 8.7,
    y: 4.9,
    w: 3.8,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: "92400E",
  });

  // Extract interesting fact from introduction
  const interestingFact = introBullets[0] || model.introduction.split('.')[0] + '.';
  introSlide.addText(clampPptText(interestingFact, 250), {
    x: 8.7,
    y: 5.3,
    w: 3.8,
    h: 1.3,
    fontFace: "Calibri",
    fontSize: 11,
    color: "78350F",
    breakLine: true,
  });

  addSlideFooter(introSlide, slideNumber, 20, input.topic);

  introSlide.addNotes([
    "📖 INTRODUCTION & CONTEXT (4 minutes)",
    "",
    "Teaching Strategy:",
    "• Start with a compelling clinical scenario or statistic",
    "• Explain the prevalence and impact of this topic",
    "• Connect to students' prior knowledge and experiences",
    "• Emphasize real-world nursing applications",
    "",
    "Discussion Prompts:",
    "• 'Have you encountered this in clinical practice?'",
    "• 'Why do you think this is important for patient outcomes?'",
    "",
    "Key Points:",
    ...introBullets.map((b, i) => `${i + 1}. ${b}`),
  ].join("\n"));

  // ============================================================
  // REMAINING SLIDES: Use existing implementation
  // ============================================================
  // For now, continue with standard slides for remaining content
  // Premium slides for objectives will be added in next iteration

  const rowUsage = new Set<number>();
  for (const [idx, objective] of objectiveItems.entries()) {
    slideNumber++;
    const row = pickPresentationRowForObjective({
      rows: model.presentationRows,
      objective,
      used: rowUsage,
    });
    const pack = buildDetailedObjectivePack({
      topic: input.topic,
      objective,
      row,
      evidenceText: objectiveEvidenceText,
    });
    const enhancement = await buildObjectiveSlideEnhancement({
      topic: input.topic,
      objective,
      programme: input.programme,
      course: courseName,
      subtopic: normalizeText(curriculumContext.subtopic),
      pack,
      noteChunks,
      enableAiNotes: aiNotesEnabled && aiNotesUsed < aiNotesMaxObjectives,
    });
    if (enhancement.usedAi) {
      aiNotesUsed += 1;
    }

    const objectiveSlide = pptx.addSlide();
    addSlideScaffold(
      objectiveSlide,
      `Objective ${idx + 1}: Core Teaching`,
      clampPptText(objective, 120),
      slideCitation(presentationSection) || slideCitation(objectivesSection),
    );
    objectiveSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.24,
      w: 8.55,
      h: 5.85,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    objectiveSlide.addText("Key Explanations", {
      x: 1.08,
      y: 1.47,
      w: 8.0,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    objectiveSlide.addText(pptxBullets(enhancement.conceptPoints), {
      x: 1.08,
      y: 1.74,
      w: 8.05,
      h: 2.95,
      fontFace: "Calibri",
      fontSize: 10.4,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    objectiveSlide.addText("Definitions to Emphasize", {
      x: 1.08,
      y: 4.82,
      w: 8.0,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    objectiveSlide.addText(pptxBullets(enhancement.definitionPoints), {
      x: 1.08,
      y: 5.08,
      w: 8.05,
      h: 1.55,
      fontFace: "Calibri",
      fontSize: 10,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    objectiveSlide.addShape("roundRect", {
      x: 9.45,
      y: 1.24,
      w: 3.2,
      h: 2.95,
      radius: 0.08,
      fill: { color: MODERN_CLINICAL_THEME.accentSoft },
      line: { color: "BFDBFE", pt: 1 },
    });
    objectiveSlide.addText("Key Message", {
      x: 9.68,
      y: 1.45,
      w: 2.75,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: "1E3A8A",
    });
    objectiveSlide.addText(clampPptText(pack.clinicalScenario, 220), {
      x: 9.68,
      y: 1.78,
      w: 2.75,
      h: 2.25,
      fontFace: "Calibri",
      fontSize: 10,
      color: "1E3A8A",
      breakLine: true,
    });
    objectiveSlide.addShape("roundRect", {
      x: 9.45,
      y: 4.35,
      w: 3.2,
      h: 2.7,
      radius: 0.08,
      fill: { color: "FEF3C7" },
      line: { color: "F59E0B", pt: 1 },
    });
    objectiveSlide.addText("Clinical Scenario", {
      x: 9.68,
      y: 4.56,
      w: 2.75,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: "92400E",
    });
    objectiveSlide.addText(clampPptText(pack.clinicalScenario, 250), {
      x: 9.68,
      y: 4.89,
      w: 2.75,
      h: 2.0,
      fontFace: "Calibri",
      fontSize: 9.5,
      color: "78350F",
      breakLine: true,
    });

    addSlideFooter(objectiveSlide, slideNumber, 20, input.topic);

    objectiveSlide.addNotes(
      [
        enhancement.coreSpeakerNotes,
        "",
        "Clinical Application:",
        enhancement.applicationSpeakerNotes,
      ].join("\n"),
    );
  }

  // Summary slide
  slideNumber++;
  const summarySlide = pptx.addSlide();
  addSlideScaffold(
    summarySlide,
    "Summary and Independent Study",
    "Reinforcement, assignment, and next steps",
    slideCitation(summarySection) || slideCitation(assignmentSection),
  );
  summarySlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 8.25,
    h: 2.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });
  summarySlide.addText("Lesson Summary", {
    x: 1.1,
    y: 1.56,
    w: 7.7,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });
  summarySlide.addText(pptxBullets(textToTeachingBullets(model.summary, 4, 150)), {
    x: 1.1,
    y: 1.92,
    w: 7.7,
    h: 1.95,
    fontFace: "Calibri",
    fontSize: 11,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });
  summarySlide.addText("Assignment", {
    x: 1.1,
    y: 3.55,
    w: 7.7,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 12,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });
  const assignmentItems =
    model.assignmentItems.length > 0
      ? model.assignmentItems
      : [`Prepare a short reflection on ${input.topic} and its nursing relevance.`];
  summarySlide.addText(
    pptxBullets(assignmentItems.slice(0, 6).map((item, idx) => `${idx + 1}) ${item}`)),
    {
      x: 1.1,
      y: 3.91,
      w: 7.7,
      h: 2.95,
      fontFace: "Calibri",
      fontSize: 10.5,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    },
  );
  const summaryVisual = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Summary",
    candidates: [
      ...visualCandidatesFromSection(summarySection),
      ...visualCandidatesFromSection(assignmentSection),
      ...metadataVisualCandidates,
    ],
    aiState,
    mode: "summary",
  });
  addVisualPanel(summarySlide, summaryVisual, 9.3, 1.45, 3.35, 5.45);

  addSlideFooter(summarySlide, slideNumber, 20, input.topic);

  summarySlide.addNotes(
    [
      generateSpeakerNotes("summary", `${model.summary}\n${assignmentItems.join(" ")}`, input.topic),
      "Assignment clarification:",
      ...assignmentItems.slice(0, 6).map((item, idx) => `${idx + 1}. ${item}`),
    ].join("\n"),
  );

  // ============================================================
  // NEW: Dedicated Key Definitions Slide
  // ============================================================
  if (definitionItems.length > 0) {
    slideNumber++;
    const definitionsDetailSlide = pptx.addSlide();

    addSlideScaffold(
      definitionsDetailSlide,
      "📚 Key Definitions",
      "Essential terminology for this lesson",
      slideCitation(definitionsSection),
    );

    definitionsDetailSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    definitionsDetailSlide.addText("Master these terms to understand the lesson content:", {
      x: 1.1,
      y: 1.5,
      w: 11.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.muted,
      italic: true,
    });

    const defsToShow = definitionItems.slice(0, 8);
    defsToShow.forEach((def, idx) => {
      const yPos = 2.0 + (idx * 0.65);
      const match = def.match(/^([^:]+?)\s+(?:is|are|refers to|defined as|describes|characterized by|consists of|includes)\s+(.+)$/i);
      const term = match ? match[1].trim() : def.split(' ').slice(0, 3).join(' ');
      const definition = match ? match[2].trim() : def;

      // Term column - keep concise
      definitionsDetailSlide.addText(`${idx + 1}. ${clampPptText(term, 60)}:`, {
        x: 1.1,
        y: yPos,
        w: 3.5,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 11,
        bold: true,
        color: MODERN_CLINICAL_THEME.accent,
        valign: "top",
        breakLine: true,
      });

      // Definition column - allow longer text with wrapping
      definitionsDetailSlide.addText(clampPptText(definition, 250), {
        x: 4.7,
        y: yPos,
        w: 7.7,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 10.5,
        color: MODERN_CLINICAL_THEME.text,
        valign: "top",
        breakLine: true,
      });
    });

    addSlideFooter(definitionsDetailSlide, slideNumber, 20, input.topic);

    definitionsDetailSlide.addNotes(
      [
        "Key Definitions - Teaching Tips:",
        "• Write these terms on the board at the start of class",
        "• Ask students to define terms in their own words",
        "• Use these definitions when explaining concepts",
        "• Quiz students on terminology at the end",
        "",
        "Definitions:",
        ...defsToShow.map((item, idx) => `${idx + 1}. ${item}`),
      ].join("\n"),
    );
  }

  if (model.evaluation.length > 0) {
    slideNumber++;
    const evaluationSlide = pptx.addSlide();
    addSlideScaffold(
      evaluationSlide,
      "✅ Evaluation Questions",
      "Assess student understanding",
      slideCitation(evaluationSection),
    );

    evaluationSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    evaluationSlide.addText("Use these questions to check learning objectives:", {
      x: 1.1,
      y: 1.5,
      w: 11.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.muted,
      italic: true,
    });

    evaluationSlide.addText(
      pptxBullets(model.evaluation.slice(0, 8).map((q, idx) => `${idx + 1}. ${q}`)),
      {
        x: 1.1,
        y: 2.0,
        w: 11.4,
        h: 4.8,
        fontFace: "Calibri",
        fontSize: 11,
        color: MODERN_CLINICAL_THEME.text,
        breakLine: true,
      }
    );

    addSlideFooter(evaluationSlide, slideNumber, 20, input.topic);

    evaluationSlide.addNotes(
      [
        "Evaluation Questions - Facilitation Guide:",
        "• Use these as formative assessment throughout the lesson",
        "• Can be used for class discussion or individual reflection",
        "• Encourage students to explain their reasoning",
        "• Link answers back to specific objectives",
        "",
        "Questions:",
        ...model.evaluation.slice(0, 8).map((q, idx) => `${idx + 1}. ${q}`),
      ].join("\n"),
    );
  }

  const referenceItems = model.references.length > 0 ? model.references : ["Curriculum source"];
  const referenceChunks = splitItems(referenceItems, 9);
  referenceChunks.forEach((items, idx) => {
    const slide = pptx.addSlide();
    addSlideScaffold(
      slide,
      idx === 0 ? "References" : `References (continued ${idx + 1})`,
      "Curriculum grounding and teaching sources",
      slideCitation(referencesSection),
    );
    slide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    slide.addText(pptxBullets(items), {
      x: 1.1,
      y: 1.65,
      w: 11.4,
      h: 5.2,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    slide.addNotes(
      [
        "Reference slide guidance:",
        "1. Cite these sources when discussing definitions and examples.",
        "2. Remind learners to use module references during independent study.",
      ].join("\n"),
    );
  });

  for (const [idx, objective] of objectiveItems.entries()) {
    const row = pickPresentationRowForObjective({
      rows: model.presentationRows,
      objective,
      used: rowUsage,
    });
    const pack = buildDetailedObjectivePack({
      topic: input.topic,
      objective,
      row,
      evidenceText: objectiveEvidenceText,
    });
    const enhancement = await buildObjectiveSlideEnhancement({
      topic: input.topic,
      objective,
      programme: input.programme,
      course: courseName,
      subtopic: normalizeText(curriculumContext.subtopic),
      pack,
      noteChunks,
      enableAiNotes: aiNotesEnabled && aiNotesUsed < aiNotesMaxObjectives,
    });
    if (enhancement.usedAi) {
      aiNotesUsed += 1;
    }

    const objectiveSlide = pptx.addSlide();
    addSlideScaffold(
      objectiveSlide,
      `Objective ${idx + 1}: Core Teaching`,
      clampPptText(objective, 120),
      slideCitation(presentationSection) || slideCitation(objectivesSection),
    );
    objectiveSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.24,
      w: 8.55,
      h: 5.85,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    objectiveSlide.addText("Key Explanations", {
      x: 1.08,
      y: 1.47,
      w: 8.0,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    objectiveSlide.addText(pptxBullets(enhancement.conceptPoints), {
      x: 1.08,
      y: 1.74,
      w: 8.05,
      h: 2.95,
      fontFace: "Calibri",
      fontSize: 10.4,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    objectiveSlide.addText("Definitions to Emphasize", {
      x: 1.08,
      y: 4.82,
      w: 8.0,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 12,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    objectiveSlide.addText(pptxBullets(enhancement.definitionPoints), {
      x: 1.08,
      y: 5.08,
      w: 8.05,
      h: 1.55,
      fontFace: "Calibri",
      fontSize: 10,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    objectiveSlide.addShape("roundRect", {
      x: 9.45,
      y: 1.24,
      w: 3.2,
      h: 2.95,
      radius: 0.08,
      fill: { color: MODERN_CLINICAL_THEME.accentSoft },
      line: { color: "BFDBFE", pt: 1 },
    });
    objectiveSlide.addText("Key Message", {
      x: 9.68,
      y: 1.45,
      w: 2.75,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: "1E3A8A",
    });
    objectiveSlide.addText(
      pptxBullets(pack.takeHomePoints.slice(0, 3)),
      {
        x: 9.68,
        y: 1.74,
        w: 2.72,
        h: 2.25,
        fontFace: "Calibri",
        fontSize: 9.2,
        color: "1E293B",
        breakLine: true,
      },
    );
    const objectiveVisual = await resolvePresentationVisual({
      topic: input.topic,
      sectionTitle: `Objective ${idx + 1} core teaching`,
      candidates: [...visualCandidatesFromSection(presentationSection), ...metadataVisualCandidates],
      aiState,
      mode: "objective_deep_dive",
    });
    addVisualPanel(objectiveSlide, objectiveVisual, 9.45, 4.33, 3.2, 2.76);
    objectiveSlide.addNotes(enhancement.coreSpeakerNotes);

    const applicationSlide = pptx.addSlide();
    addSlideScaffold(
      applicationSlide,
      `Objective ${idx + 1}: Application and Discussion`,
      clampPptText(objective, 120),
      slideCitation(presentationSection) || slideCitation(objectivesSection),
    );
    applicationSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.24,
      w: 6.1,
      h: 2.7,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    applicationSlide.addText("Clinical Scenario", {
      x: 1.05,
      y: 1.45,
      w: 5.6,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    applicationSlide.addText(pack.clinicalScenario, {
      x: 1.05,
      y: 1.75,
      w: 5.65,
      h: 1.95,
      fontFace: "Calibri",
      fontSize: 9.8,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });

    applicationSlide.addShape("roundRect", {
      x: 0.8,
      y: 4.08,
      w: 6.1,
      h: 3.0,
      radius: 0.08,
      fill: { color: MODERN_CLINICAL_THEME.panelAlt },
      line: { color: "BFDBFE", pt: 1 },
    });
    applicationSlide.addText("Guided Discussion Prompts", {
      x: 1.05,
      y: 4.3,
      w: 5.55,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: "1E3A8A",
    });
    applicationSlide.addText(pptxBullets(pack.discussionPrompts), {
      x: 1.05,
      y: 4.58,
      w: 5.7,
      h: 2.3,
      fontFace: "Calibri",
      fontSize: 9.6,
      color: "1E293B",
      breakLine: true,
    });

    applicationSlide.addShape("roundRect", {
      x: 7.15,
      y: 1.24,
      w: 5.55,
      h: 2.7,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    applicationSlide.addText("Practice Links", {
      x: 7.38,
      y: 1.45,
      w: 5.1,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: MODERN_CLINICAL_THEME.accent,
    });
    applicationSlide.addText(pptxBullets(pack.clinicalLinks), {
      x: 7.38,
      y: 1.74,
      w: 5.1,
      h: 1.95,
      fontFace: "Calibri",
      fontSize: 9.6,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });

    applicationSlide.addShape("roundRect", {
      x: 7.15,
      y: 4.08,
      w: 5.55,
      h: 3.0,
      radius: 0.08,
      fill: { color: MODERN_CLINICAL_THEME.panelAlt },
      line: { color: "BFDBFE", pt: 1 },
    });
    applicationSlide.addText("Quick Check Questions", {
      x: 7.38,
      y: 4.3,
      w: 5.1,
      h: 0.28,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: "1E3A8A",
    });
    applicationSlide.addText(pptxBullets(pack.quickChecks), {
      x: 7.38,
      y: 4.58,
      w: 5.1,
      h: 2.3,
      fontFace: "Calibri",
      fontSize: 9.6,
      color: "1E293B",
      breakLine: true,
    });
    applicationSlide.addNotes(enhancement.applicationSpeakerNotes);
  }

  const evaluationItems =
    model.evaluation.length > 0
      ? model.evaluation
      : [`What are the core principles of ${input.topic}?`];
  const assessmentSlide = pptx.addSlide();
  addSlideScaffold(
    assessmentSlide,
    "Formative Assessment",
    "Check comprehension before lesson closure",
    slideCitation(evaluationSection),
  );
  assessmentSlide.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 12.0,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });
  assessmentSlide.addText("Questions for Learners", {
    x: 1.1,
    y: 1.56,
    w: 11.4,
    h: 0.35,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });
  assessmentSlide.addText(pptxBullets(evaluationItems.slice(0, 8)), {
    x: 1.1,
    y: 1.93,
    w: 11.4,
    h: 3.8,
    fontFace: "Calibri",
    fontSize: 11.2,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });
  assessmentSlide.addShape("roundRect", {
    x: 1.1,
    y: 5.88,
    w: 11.4,
    h: 1.0,
    radius: 0.05,
    fill: { color: MODERN_CLINICAL_THEME.panelAlt },
    line: { color: "BFDBFE", pt: 1 },
  });
  assessmentSlide.addText("Use oral questioning, brief written checks, and peer explanation before moving on.", {
    x: 1.3,
    y: 6.2,
    w: 11.0,
    h: 0.45,
    fontFace: "Calibri",
    fontSize: 9.8,
    italic: true,
    color: "334155",
  });
  assessmentSlide.addNotes(
    [
      generateSpeakerNotes("assessment", evaluationItems.join(" "), input.topic),
      "Questions to emphasize:",
      ...evaluationItems.slice(0, 8).map((item, idx) => `${idx + 1}. ${item}`),
    ].join("\n"),
  );
  const summarySlide2 = pptx.addSlide();
  addSlideScaffold(
    summarySlide2,
    "Summary and Independent Study",
    "Reinforcement, assignment, and next steps",
    slideCitation(summarySection) || slideCitation(assignmentSection),
  );
  summarySlide2.addShape("roundRect", {
    x: 0.8,
    y: 1.25,
    w: 8.3,
    h: 5.8,
    radius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: "CBD5E1", pt: 1 },
  });
  summarySlide2.addText("Lesson Summary", {
    x: 1.1,
    y: 1.56,
    w: 7.6,
    h: 0.35,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });
  summarySlide2.addText(pptxBullets(textToTeachingBullets(model.summary, 4, 150)), {
    x: 1.1,
    y: 1.92,
    w: 7.7,
    h: 1.5,
    fontFace: "Calibri",
    fontSize: 11.2,
    color: MODERN_CLINICAL_THEME.text,
    breakLine: true,
  });
  summarySlide2.addText("Assignment", {
    x: 1.1,
    y: 3.55,
    w: 7.6,
    h: 0.3,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: MODERN_CLINICAL_THEME.accent,
  });
  const assignmentItems2 =
    model.assignmentItems.length > 0
      ? model.assignmentItems
      : [`Prepare a short reflection on ${input.topic} and its nursing relevance.`];
  summarySlide2.addText(
    pptxBullets(assignmentItems2.slice(0, 6).map((item, idx) => `${idx + 1}) ${item}`)),
    {
      x: 1.1,
      y: 3.88,
      w: 7.7,
      h: 2.78,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    },
  );
  const summaryVisual2 = await resolvePresentationVisual({
    topic: input.topic,
    sectionTitle: "Summary and assignment",
    candidates: [
      ...visualCandidatesFromSection(summarySection),
      ...visualCandidatesFromSection(assignmentSection),
      ...metadataVisualCandidates,
    ],
    aiState,
    mode: "summary",
  });
  addVisualPanel(summarySlide2, summaryVisual2, 9.3, 1.45, 3.35, 5.45);
  summarySlide2.addNotes(
    [
      generateSpeakerNotes("summary", `${model.summary}\n${assignmentItems2.join(" ")}`, input.topic),
      "Assignment clarification:",
      ...assignmentItems2.slice(0, 6).map((item, idx) => `${idx + 1}. ${item}`),
    ].join("\n"),
  );

  // ============================================================
  // NEW: Dedicated Key Definitions Slide
  // ============================================================
  if (definitionItems.length > 0) {
    const definitionsDetailSlide = pptx.addSlide();
    addSlideScaffold(
      definitionsDetailSlide,
      "📚 Key Definitions",
      "Essential terminology for this lesson",
      slideCitation(definitionsSection),
    );

    definitionsDetailSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    definitionsDetailSlide.addText("Master these terms to understand the lesson content:", {
      x: 1.1,
      y: 1.5,
      w: 11.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.muted,
      italic: true,
    });

    // Display definitions in clean two-column format
    const defsToShow = definitionItems.slice(0, 8);
    defsToShow.forEach((def, idx) => {
      const yPos = 2.0 + (idx * 0.65);

      // Extract term from definition sentence
      // Pattern: "Term is/are/refers to/defined as definition"
      const match = def.match(/^([^:]+?)\s+(?:is|are|refers to|defined as|describes|characterized by|consists of|includes)\s+(.+)$/i);
      const term = match ? match[1].trim() : def.split(' ').slice(0, 3).join(' ');
      const definition = match ? match[2].trim() : def;

      // Term (bold, colored)
      definitionsDetailSlide.addText(`${idx + 1}. ${term}:`, {
        x: 1.1,
        y: yPos,
        w: 3.5,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 11,
        bold: true,
        color: MODERN_CLINICAL_THEME.accent,
        valign: "top",
      });

      // Definition (regular text)
      definitionsDetailSlide.addText(definition, {
        x: 4.7,
        y: yPos,
        w: 7.7,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 10.5,
        color: MODERN_CLINICAL_THEME.text,
        valign: "top",
      });
    });

    definitionsDetailSlide.addNotes(
      [
        "Key Definitions - Teaching Tips:",
        "• Write these terms on the board at the start of class",
        "• Ask students to define terms in their own words",
        "• Use these definitions when explaining concepts",
        "• Quiz students on terminology at the end",
        "",
        "Definitions:",
        ...defsToShow.map((item, idx) => `${idx + 1}. ${item}`),
      ].join("\n"),
    );
  }

  // ============================================================
  // NEW: Evaluation Questions Slide (if available)
  // ============================================================
  if (model.evaluation.length > 0) {
    const evaluationSlide = pptx.addSlide();
    addSlideScaffold(
      evaluationSlide,
      "✅ Evaluation Questions",
      "Assess student understanding",
      slideCitation(evaluationSection),
    );

    evaluationSlide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });

    evaluationSlide.addText("Use these questions to check learning objectives:", {
      x: 1.1,
      y: 1.5,
      w: 11.4,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.muted,
      italic: true,
    });

    evaluationSlide.addText(
      pptxBullets(model.evaluation.slice(0, 8).map((q, idx) => `${idx + 1}. ${q}`)),
      {
        x: 1.1,
        y: 2.0,
        w: 11.4,
        h: 4.8,
        fontFace: "Calibri",
        fontSize: 11,
        color: MODERN_CLINICAL_THEME.text,
        breakLine: true,
      }
    );

    evaluationSlide.addNotes(
      [
        "Evaluation Questions - Facilitation Guide:",
        "• Use these as formative assessment throughout the lesson",
        "• Can be used for class discussion or individual reflection",
        "• Encourage students to explain their reasoning",
        "• Link answers back to specific objectives",
        "",
        "Questions:",
        ...model.evaluation.slice(0, 8).map((q, idx) => `${idx + 1}. ${q}`),
      ].join("\n"),
    );
  }

  const referenceItems2 = model.references.length > 0 ? model.references : ["Curriculum source"];
  const referenceChunks2 = splitItems(referenceItems2, 9);
  referenceChunks2.forEach((items, idx) => {
    const slide = pptx.addSlide();
    addSlideScaffold(
      slide,
      idx === 0 ? "References" : `References (continued ${idx + 1})`,
      "Curriculum grounding and teaching sources",
      slideCitation(referencesSection),
    );
    slide.addShape("roundRect", {
      x: 0.8,
      y: 1.25,
      w: 12.0,
      h: 5.8,
      radius: 0.08,
      fill: { color: "FFFFFF" },
      line: { color: "CBD5E1", pt: 1 },
    });
    slide.addText(pptxBullets(items), {
      x: 1.1,
      y: 1.65,
      w: 11.4,
      h: 5.2,
      fontFace: "Calibri",
      fontSize: 11,
      color: MODERN_CLINICAL_THEME.text,
      breakLine: true,
    });
    slide.addNotes(
      [
        "Reference slide guidance:",
        "1. Cite these sources when discussing definitions and examples.",
        "2. Remind learners to use module references during independent study.",
      ].join("\n"),
    );
  });

  return pptx.write({ outputType: "nodebuffer" }) as Promise<Buffer>;
}

async function renderPptxBuffer(input: RenderInput) {
  if (isLessonPlanRender(input)) {
    // Lecturer delivery deck: derive a presentation narrative from lesson-plan structure.
    return renderLessonTeachingDeckPptxBuffer(input);
  }
  return renderGenericPptxBuffer(input);
}

async function renderDocxBuffer(input: RenderInput) {
  if (isLessonPlanRender(input)) {
    return renderLessonPlanDocxBuffer(input);
  }

  const sections = parseSections(input);
  const children = genericDocxParagraphs(input, sections);
  const doc = createDocxDocument([
    {
      properties: {
        page: {
          size: {
            orientation: "landscape",
            width: 16838, // A4 landscape width (297mm)
            height: 11906, // A4 landscape height (210mm)
          },
          margin: {
            top: 1120, // 56pt = 1120 twentieths of a point
            right: 1120, // 56pt = 1120 twentieths of a point
            bottom: 1120, // 56pt = 1120 twentieths of a point
            left: 1120, // 56pt = 1120 twentieths of a point
          },
        },
      },
      children,
    },
  ]);
  return Packer.toBuffer(doc);
}

function renderPdfBuffer(input: RenderInput) {
  if (isLessonPlanRender(input)) {
    return renderLessonPlanPdfBuffer(input);
  }
  return renderGenericPdfBuffer(input);
}

export async function renderExportBuffer(
  format: "pdf" | "docx" | "pptx",
  input: RenderInput,
) {
  if (format === "pdf") {
    return renderPdfBuffer(input);
  }
  if (format === "docx") {
    return renderDocxBuffer(input);
  }
  return renderPptxBuffer(input);
}

export function computeChecksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

