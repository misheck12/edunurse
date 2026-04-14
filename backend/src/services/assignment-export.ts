/**
 * Assignment DOCX Export Builder
 * Produces a clean, properly formatted academic assignment document.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  convertInchesToTwip,
} from "docx";

// ── Types ──

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
  dueDate?: string;
  wordCount?: number;
  references?: ExportReference[];
}

// ── Constants ──

const FONT = "Times New Roman";
const BODY_SIZE = 24;  // 12pt in half-points
const H2_SIZE = 28;    // 14pt
const H3_SIZE = 26;    // 13pt
const COVER_TITLE_SIZE = 36;
const LINE_SPACING = 480; // double-spacing
const PARA_AFTER = 120;

// ── Content parsing ──

type ContentBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "body"; runs: TextRun[] }
  | { kind: "blank" };

const SECTION_HEADING_RE =
  /^(Introduction|Conclusion|Discussion|Methodology|Literature Review|Background|Findings|Recommendations|Abstract|Summary|Analysis|Results|References|Bibliography)/i;

function parseBlocks(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const line of raw.split("\n")) {
    const t = line.trim();

    if (!t) { blocks.push({ kind: "blank" }); continue; }

    // Markdown headings → H2 / H3
    if (t.startsWith("### ")) { blocks.push({ kind: "h3", text: t.slice(4).trim() }); continue; }
    if (t.startsWith("## "))  { blocks.push({ kind: "h2", text: t.slice(3).trim() }); continue; }
    if (t.startsWith("# "))   { blocks.push({ kind: "h2", text: t.slice(2).trim() }); continue; }

    // Standalone section headings
    if (
      t.length < 80 &&
      !t.endsWith(",") && !t.endsWith(";") &&
      (SECTION_HEADING_RE.test(t) || /^[A-Z][A-Z\s:]{2,}$/.test(t) || /^\d+(\.\d+)*\s+[A-Z]/.test(t))
    ) {
      const major = SECTION_HEADING_RE.test(t) || /^[A-Z][A-Z\s:]{2,}$/.test(t) || /^\d+\s+[A-Z]/.test(t);
      blocks.push({ kind: major ? "h2" : "h3", text: t });
      continue;
    }

    // Body paragraph — parse inline **bold** and *italic*
    const runs: TextRun[] = [];
    const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m[2])      runs.push(new TextRun({ text: m[2], bold: true, italics: true, size: BODY_SIZE, font: FONT }));
      else if (m[3]) runs.push(new TextRun({ text: m[3], bold: true, size: BODY_SIZE, font: FONT }));
      else if (m[4]) runs.push(new TextRun({ text: m[4], italics: true, size: BODY_SIZE, font: FONT }));
      else if (m[5]) runs.push(new TextRun({ text: m[5], size: BODY_SIZE, font: FONT }));
    }
    if (runs.length === 0) runs.push(new TextRun({ text: t, size: BODY_SIZE, font: FONT }));
    blocks.push({ kind: "body", runs });
  }

  return blocks;
}

// ── Cover page ──

function buildCoverPage(input: AssignmentExportInput): Paragraph[] {
  const p: Paragraph[] = [];
  const center = AlignmentType.CENTER;
  const run = (text: string, opts?: { bold?: boolean; size?: number }) =>
    new TextRun({ text, font: FONT, size: opts?.size ?? BODY_SIZE, bold: opts?.bold });

  // Push down from top
  p.push(new Paragraph({ children: [], spacing: { before: 3600 } }));

  // Institution
  if (input.school) {
    p.push(new Paragraph({
      children: [run(input.school.toUpperCase(), { bold: true, size: 28 })],
      alignment: center, spacing: { after: 160 },
    }));
  }

  // Programme & course
  const subLine = [input.programme, input.course ? `Course: ${input.course}` : ""].filter(Boolean).join("  •  ");
  if (subLine) {
    p.push(new Paragraph({
      children: [run(subLine)],
      alignment: center, spacing: { after: 600 },
    }));
  }

  // Title
  p.push(new Paragraph({
    children: [run(input.title, { bold: true, size: COVER_TITLE_SIZE })],
    alignment: center,
    spacing: { before: 200, after: 200 },
    border: {
      top: { color: "000000", space: 8, style: BorderStyle.SINGLE, size: 6 },
      bottom: { color: "000000", space: 8, style: BorderStyle.SINGLE, size: 6 },
    },
  }));

  // Student info block
  const details: string[] = [];
  if (input.studentName)   details.push(`Name: ${input.studentName}`);
  if (input.studentNumber) details.push(`Student No: ${input.studentNumber}`);
  if (input.dueDate)       details.push(`Due: ${input.dueDate}`);
  details.push(`Date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);

  p.push(new Paragraph({ children: [], spacing: { before: 600 } }));
  for (const d of details) {
    p.push(new Paragraph({ children: [run(d)], alignment: center, spacing: { after: 80 } }));
  }

  // Page break
  p.push(new Paragraph({ children: [new PageBreak()] }));
  return p;
}

// ── Body paragraphs ──

function buildBody(blocks: ContentBlock[]): Paragraph[] {
  const p: Paragraph[] = [];

  for (const b of blocks) {
    switch (b.kind) {
      case "h2":
        p.push(new Paragraph({
          children: [new TextRun({ text: b.text, bold: true, size: H2_SIZE, font: FONT })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 200 },
        }));
        break;

      case "h3":
        p.push(new Paragraph({
          children: [new TextRun({ text: b.text, bold: true, italics: true, size: H3_SIZE, font: FONT })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 160 },
        }));
        break;

      case "body":
        p.push(new Paragraph({
          children: b.runs,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: PARA_AFTER, line: LINE_SPACING },
          indent: { firstLine: convertInchesToTwip(0.5) },
        }));
        break;

      case "blank":
        p.push(new Paragraph({ children: [], spacing: { after: 80 } }));
        break;
    }
  }

  return p;
}

// ── Reference list ──

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
  const p: Paragraph[] = [];

  p.push(new Paragraph({ children: [new PageBreak()] }));

  const heading = style === "vancouver" ? "REFERENCES" : "REFERENCE LIST";
  p.push(new Paragraph({
    children: [new TextRun({ text: heading, bold: true, size: H2_SIZE, font: FONT })],
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  const sorted = [...refs].sort((a, b) => a.authors.localeCompare(b.authors));

  for (let i = 0; i < sorted.length; i++) {
    p.push(new Paragraph({
      children: [new TextRun({ text: formatReference(sorted[i], i, style).trim(), size: BODY_SIZE, font: FONT })],
      spacing: { after: 160, line: LINE_SPACING },
      indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
    }));
  }

  return p;
}

// ── Main export function ──

export async function buildAssignmentDocx(input: AssignmentExportInput): Promise<Buffer> {
  const blocks = parseBlocks(input.content);
  const style = input.citationStyle ?? "apa7";

  const children: Paragraph[] = [
    ...buildCoverPage(input),
    ...buildBody(blocks),
    ...(input.references && input.references.length > 0 ? buildReferenceList(input.references, style) : []),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: LINE_SPACING } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
          },
          pageNumbers: { start: 1 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({
              text: input.title.length > 50 ? input.title.slice(0, 50) + "…" : input.title,
              italics: true, size: 18, font: FONT, color: "888888",
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
      children,
    }],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
