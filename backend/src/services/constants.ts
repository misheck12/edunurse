export const DOCUMENT_TYPES = [
  "Lesson Plan",
  "OSCE Station",
  "Clinical Plan",
  "Assessment Tool",
  "Scheme of Work",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

const DOCUMENT_TYPE_MAP = {
  "Lesson Plan": "lesson_plan",
  "OSCE Station": "osce_station",
  "Clinical Plan": "clinical_plan",
  "Assessment Tool": "assessment_tool",
  "Scheme of Work": "scheme_of_work",
} as const;

const DOCUMENT_TYPE_REVERSE_MAP = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_MAP).map(([display, db]) => [db, display]),
) as Record<string, DocumentType>;

export function toDocumentTypeDb(value: DocumentType) {
  return DOCUMENT_TYPE_MAP[value];
}

export function fromDocumentTypeDb(value: string) {
  return DOCUMENT_TYPE_REVERSE_MAP[value] ?? value;
}
