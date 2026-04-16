/**
 * Assignment DOCX Export Builder
 * Produces a clean, properly formatted academic assignment document.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  SectionType,
  TextRun,
  convertInchesToTwip,
} from "docx";

export interface ExportReference {
  type: "book" | "journal" | "website" | "other";
  title: string;
  authors: string;
  year: string;
  source: string;
  url?: string;
}

export type CitationStyle = "apa7" | "harvard" | "vancouver" | "mla" | "chicago";

export interface AssignmentExportInput {
  title: string;
  content: string;
  citationStyle?: CitationStyle;
  studentName?: string;
  studentNumber?: string;
  school?: string;
  course?: string;
  programme?: string;
  moduleCode?: string;
  lecturerName?: string;
  dueDate?: string;
  submissionDate?: string;
  wordCount?: number;
  references?: ExportReference[];
}

const FONT = "Times New Roman";
const BODY_SIZE = 24;
const H2_SIZE = 28;
const H3_SIZE = 26;
const COVER_TITLE_SIZE = 36;
const LINE_SPACING = 480;
const PARA_AFTER = 120;
const HEADER_SIZE = 18;
const META_SIZE = 21;
const COVER_LABEL_SIZE = 22;

type ContentBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "body"; runs: TextRun[] }
  | { kind: "blank" };

const SECTION_HEADING_RE =
  /^(Introduction|Conclusion|Discussion|Methodology|Literature Review|Background|Findings|Recommendations|Abstract|Summary|Analysis|Results|References|Bibliography)/i;

const REFERENCE_SECTION_RE = /^(#{1,3}\s*)?(references|reference list|bibliography)\s*:?$/i;

function stripGeneratedReferenceSection(raw: string) {
  const lines = raw.split("\n");

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (REFERENCE_SECTION_RE.test(lines[index].trim())) {
      return lines.slice(0, index).join("\n").trimEnd();
    }
  }

  return raw;
}

function parseBlocks(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ kind: "blank" });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "h3", text: trimmed.slice(4).trim() });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(3).trim() });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(2).trim() });
      continue;
    }

    if (
      trimmed.length < 80 &&
      !trimmed.endsWith(",") &&
      !trimmed.endsWith(";") &&
      (SECTION_HEADING_RE.test(trimmed) ||
        /^[A-Z][A-Z\s:]{2,}$/.test(trimmed) ||
        /^\d+(\.\d+)*\s+[A-Z]/.test(trimmed))
    ) {
      const major =
        SECTION_HEADING_RE.test(trimmed) ||
        /^[A-Z][A-Z\s:]{2,}$/.test(trimmed) ||
        /^\d+\s+[A-Z]/.test(trimmed);

      blocks.push({ kind: major ? "h2" : "h3", text: trimmed });
      continue;
    }

    const runs: TextRun[] = [];
    const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
    let match: RegExpExecArray | null;

    while ((match = re.exec(trimmed)) !== null) {
      if (match[2]) {
        runs.push(
          new TextRun({ text: match[2], bold: true, italics: true, size: BODY_SIZE, font: FONT }),
        );
      } else if (match[3]) {
        runs.push(new TextRun({ text: match[3], bold: true, size: BODY_SIZE, font: FONT }));
      } else if (match[4]) {
        runs.push(new TextRun({ text: match[4], italics: true, size: BODY_SIZE, font: FONT }));
      } else if (match[5]) {
        runs.push(new TextRun({ text: match[5], size: BODY_SIZE, font: FONT }));
      }
    }

    if (runs.length === 0) {
      runs.push(new TextRun({ text: trimmed, size: BODY_SIZE, font: FONT }));
    }

    blocks.push({ kind: "body", runs });
  }

  return blocks;
}

function formatAcademicDate(value?: string) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildMetaSummary(input: AssignmentExportInput) {
  return [
    input.moduleCode ? `Module: ${input.moduleCode}` : "",
    input.programme,
    input.course ? `Course: ${input.course}` : "",
    input.citationStyle ? `Style: ${input.citationStyle.toUpperCase()}` : "",
    input.wordCount ? `Target: ${input.wordCount} words` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildShortHeaderTitle(title: string) {
  const compact = title.replace(/\s+/g, " ").trim();
  if (compact.length <= 60) return compact;
  return `${compact.slice(0, 57).trimEnd()}...`;
}

function buildCoverDetailParagraph(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, font: FONT, size: BODY_SIZE, bold: true }),
      new TextRun({ text: value, font: FONT, size: BODY_SIZE }),
    ],
    alignment: AlignmentType.LEFT,
    indent: { left: convertInchesToTwip(1.15) },
    spacing: { after: 120 },
  });
}

function buildCoverPage(input: AssignmentExportInput): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const center = AlignmentType.CENTER;
  const run = (text: string, opts?: { bold?: boolean; italics?: boolean; size?: number; color?: string }) =>
    new TextRun({
      text,
      font: FONT,
      size: opts?.size ?? BODY_SIZE,
      bold: opts?.bold,
      italics: opts?.italics,
      color: opts?.color,
    });
  const submissionDate =
    formatAcademicDate(input.submissionDate ?? new Date().toISOString()) ??
    new Date().toLocaleDateString("en-GB");
  const programmeLine = [input.programme, input.course ? `Course: ${input.course}` : ""]
    .filter(Boolean)
    .join(" | ");
  const detailLines = [
    input.studentName ? { label: "Student name", value: input.studentName } : null,
    input.studentNumber ? { label: "Student number", value: input.studentNumber } : null,
    input.programme ? { label: "Programme", value: input.programme } : null,
    input.course ? { label: "Course / module", value: input.course } : null,
    input.moduleCode ? { label: "Module code", value: input.moduleCode } : null,
    input.lecturerName ? { label: "Lecturer / tutor", value: input.lecturerName } : null,
    input.citationStyle ? { label: "Citation style", value: input.citationStyle.toUpperCase() } : null,
    input.wordCount ? { label: "Target word count", value: `${input.wordCount} words` } : null,
    input.dueDate ? { label: "Due date", value: formatAcademicDate(input.dueDate) ?? input.dueDate } : null,
    { label: "Submission date", value: submissionDate },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail));

  paragraphs.push(new Paragraph({ children: [], spacing: { before: 2600 } }));

  if (input.school) {
    paragraphs.push(new Paragraph({
      children: [run(input.school.toUpperCase(), { bold: true, size: 28 })],
      alignment: center,
      spacing: { after: 140 },
    }));
  }

  if (programmeLine) {
    paragraphs.push(new Paragraph({
      children: [run(programmeLine, { italics: true, size: META_SIZE })],
      alignment: center,
      spacing: { after: 320 },
    }));
  }

  paragraphs.push(new Paragraph({
    children: [run("ACADEMIC ASSIGNMENT", { bold: true, size: COVER_LABEL_SIZE })],
    alignment: center,
    spacing: { after: 220 },
  }));

  paragraphs.push(new Paragraph({
    children: [run(input.title, { bold: true, size: COVER_TITLE_SIZE })],
    alignment: center,
    spacing: { before: 120, after: 260 },
    border: {
      top: { color: "000000", space: 8, style: BorderStyle.SINGLE, size: 6 },
      bottom: { color: "000000", space: 8, style: BorderStyle.SINGLE, size: 6 },
    },
  }));

  const metaSummary = buildMetaSummary(input);
  if (metaSummary) {
    paragraphs.push(new Paragraph({
      children: [run(metaSummary, { italics: true, size: META_SIZE, color: "666666" })],
      alignment: center,
      spacing: { after: 320 },
    }));
  }

  paragraphs.push(new Paragraph({
    children: [run("Submission Details", { bold: true, size: META_SIZE })],
    alignment: AlignmentType.LEFT,
    indent: { left: convertInchesToTwip(1.15) },
    spacing: { before: 180, after: 160 },
  }));

  for (const detail of detailLines) {
    paragraphs.push(buildCoverDetailParagraph(detail.label, detail.value));
  }

  return paragraphs;
}

function buildBodyOpening(input: AssignmentExportInput): Paragraph[] {
  const bodyContext = [
    input.moduleCode ? `Module code: ${input.moduleCode}` : "",
    input.lecturerName ? `Lecturer: ${input.lecturerName}` : "",
    `Submitted: ${formatAcademicDate(input.submissionDate ?? new Date().toISOString()) ?? new Date().toLocaleDateString("en-GB")}`,
  ]
    .filter(Boolean)
    .join(" | ");
  const opening: Paragraph[] = [];

  opening.push(new Paragraph({
    children: [new TextRun({ text: input.title, font: FONT, size: H2_SIZE + 2, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  }));

  const metaSummary = buildMetaSummary(input);
  if (metaSummary) {
    opening.push(new Paragraph({
      children: [new TextRun({ text: metaSummary, font: FONT, size: META_SIZE, italics: true, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: bodyContext ? 90 : 280 },
    }));
  }

  if (bodyContext) {
    opening.push(new Paragraph({
      children: [new TextRun({ text: bodyContext, font: FONT, size: BODY_SIZE, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
    }));
  } else if (!metaSummary) {
    opening.push(new Paragraph({ children: [], spacing: { after: 180 } }));
  }

  return opening;
}

function buildBody(blocks: ContentBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case "h2":
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, size: H2_SIZE, font: FONT })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 200 },
        }));
        break;

      case "h3":
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: block.text, bold: true, italics: true, size: H3_SIZE, font: FONT })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 160 },
        }));
        break;

      case "body":
        paragraphs.push(new Paragraph({
          children: block.runs,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: PARA_AFTER, line: LINE_SPACING },
          indent: { firstLine: convertInchesToTwip(0.5) },
        }));
        break;

      case "blank":
        paragraphs.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        break;
    }
  }

  return paragraphs;
}

function formatReference(ref: ExportReference, index: number, style: CitationStyle): string {
  switch (style) {
    case "harvard":
      return [
        `${ref.authors} (${ref.year}). ${ref.title}.`,
        ref.source ? ` ${ref.source}.` : "",
        ref.url ? ` Available at: ${ref.url}.` : "",
      ].join("");

    case "vancouver":
      return [
        `${index + 1}. ${ref.authors}. ${ref.title}.`,
        ref.source ? ` ${ref.source};` : "",
        ` ${ref.year}.`,
        ref.url ? ` Available from: ${ref.url}.` : "",
      ].join("");

    case "mla":
      return [
        `${ref.authors}. "${ref.title}."`,
        ref.source ? ` ${ref.source},` : "",
        ` ${ref.year}.`,
        ref.url ? ` ${ref.url}.` : "",
      ].join("");

    case "chicago":
      return [
        `${ref.authors}. ${ref.title}.`,
        ref.source ? ` ${ref.source}.` : "",
        ` ${ref.year}.`,
        ref.url ? ` ${ref.url}.` : "",
      ].join("");

    case "apa7":
    default:
      return [
        `${ref.authors} (${ref.year}). ${ref.title}.`,
        ref.source ? ` ${ref.source}.` : "",
        ref.url ? ` ${ref.url}` : "",
      ].join("");
  }
}

function buildReferenceList(refs: ExportReference[], style: CitationStyle): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

  const heading = style === "vancouver" ? "REFERENCES" : "REFERENCE LIST";
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: heading, bold: true, size: H2_SIZE, font: FONT })],
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  const sorted = [...refs].sort((a, b) => a.authors.localeCompare(b.authors));

  for (let index = 0; index < sorted.length; index += 1) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: formatReference(sorted[index], index, style).trim(), size: BODY_SIZE, font: FONT })],
      spacing: { after: 160, line: LINE_SPACING },
      indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
    }));
  }

  return paragraphs;
}

export async function buildAssignmentDocx(input: AssignmentExportInput): Promise<Buffer> {
  const contentForBody =
    input.references && input.references.length > 0
      ? stripGeneratedReferenceSection(input.content)
      : input.content;
  const blocks = parseBlocks(contentForBody);
  const style = input.citationStyle ?? "apa7";
  const margins = {
    top: convertInchesToTwip(1),
    right: convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left: convertInchesToTwip(1),
  };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: LINE_SPACING } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: margins },
        },
        children: buildCoverPage(input),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: margins,
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              children: [new TextRun({
                text: buildShortHeaderTitle(input.title),
                italics: true,
                size: HEADER_SIZE,
                font: FONT,
                color: "888888",
              })],
              alignment: AlignmentType.RIGHT,
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 20, font: FONT })],
              alignment: AlignmentType.CENTER,
            })],
          }),
        },
        children: [
          ...buildBodyOpening(input),
          ...buildBody(blocks),
          ...(input.references && input.references.length > 0 ? buildReferenceList(input.references, style) : []),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
