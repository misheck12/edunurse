import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

export const SERVICE_CONTROL_KEYS = [
  "generation",
  "content_expansion",
  "exports",
  "curriculum_query",
  "curriculum_planner",
  "rag_connector_sync",
  "studio_theory_lesson_plan",
  "studio_skills_lab_plan",
  "studio_clinical_teaching_plan",
  "studio_osce_station",
  "studio_assessment_tool",
  "studio_scheme_of_work",
] as const;

export type ServiceControlKey = (typeof SERVICE_CONTROL_KEYS)[number];

export const STUDIO_DOCUMENT_SERVICE_KEYS = [
  "studio_theory_lesson_plan",
  "studio_skills_lab_plan",
  "studio_clinical_teaching_plan",
  "studio_osce_station",
  "studio_assessment_tool",
  "studio_scheme_of_work",
] as const;

export type StudioDocumentServiceKey = (typeof STUDIO_DOCUMENT_SERVICE_KEYS)[number];

type ServiceControlDefinition = {
  key: ServiceControlKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  clientMessage: string;
};

type ServiceControlRecord = {
  enabled: boolean;
  reason: string | null;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

const SERVICE_CONTROL_TTL_MS = 5000;

const SERVICE_CONTROL_DEFINITIONS: ServiceControlDefinition[] = [
  {
    key: "generation",
    label: "Document Generation",
    description: "Create/regenerate structured AI documents.",
    defaultEnabled: true,
    clientMessage: "Document generation is temporarily unavailable.",
  },
  {
    key: "content_expansion",
    label: "Content Expansion",
    description: "Expand lesson table content with AI.",
    defaultEnabled: true,
    clientMessage: "Content expansion is temporarily unavailable.",
  },
  {
    key: "exports",
    label: "Exports",
    description: "Create PDF/DOCX export jobs.",
    defaultEnabled: true,
    clientMessage: "Export service is temporarily unavailable.",
  },
  {
    key: "curriculum_query",
    label: "Curriculum Q&A",
    description: "Curriculum question answering with retrieval and citations.",
    defaultEnabled: true,
    clientMessage: "Curriculum question service is temporarily unavailable.",
  },
  {
    key: "curriculum_planner",
    label: "Curriculum Planner",
    description: "Planner options and objective/outcome auto-population.",
    defaultEnabled: true,
    clientMessage: "Curriculum planner is temporarily unavailable.",
  },
  {
    key: "rag_connector_sync",
    label: "Connector Sync",
    description: "Queue and run connector ingestion sync jobs.",
    defaultEnabled: true,
    clientMessage: "Connector sync is temporarily unavailable.",
  },
  {
    key: "studio_theory_lesson_plan",
    label: "Theory Lesson Plan",
    description: "Allow users to create Theory Lesson Plan documents.",
    defaultEnabled: true,
    clientMessage: "Theory Lesson Plan service is temporarily unavailable.",
  },
  {
    key: "studio_skills_lab_plan",
    label: "Skills Lab Plan",
    description: "Allow users to create Skills Lab Plan documents.",
    defaultEnabled: true,
    clientMessage: "Skills Lab Plan service is temporarily unavailable.",
  },
  {
    key: "studio_clinical_teaching_plan",
    label: "Clinical Teaching Plan",
    description: "Allow users to create Clinical Teaching Plan documents.",
    defaultEnabled: true,
    clientMessage: "Clinical Teaching Plan service is temporarily unavailable.",
  },
  {
    key: "studio_osce_station",
    label: "OSCE Station",
    description: "Allow users to create OSCE Station documents.",
    defaultEnabled: true,
    clientMessage: "OSCE Station service is temporarily unavailable.",
  },
  {
    key: "studio_assessment_tool",
    label: "Assessment Tool",
    description: "Allow users to create Assessment Tool documents.",
    defaultEnabled: true,
    clientMessage: "Assessment Tool service is temporarily unavailable.",
  },
  {
    key: "studio_scheme_of_work",
    label: "Scheme of Work",
    description: "Allow users to create Scheme of Work documents.",
    defaultEnabled: true,
    clientMessage: "Scheme of Work service is temporarily unavailable.",
  },
];

const SERVICE_DEFINITION_MAP = new Map(
  SERVICE_CONTROL_DEFINITIONS.map((item) => [item.key, item]),
);

let cachedControls: Map<ServiceControlKey, ServiceControlRecord> | null = null;
let cacheExpiresAt = 0;

function trimReason(input?: string | null) {
  if (typeof input !== "string") return null;
  const reason = input.trim();
  return reason.length > 0 ? reason.slice(0, 500) : null;
}

async function loadControlMap(app: FastifyInstance) {
  const now = Date.now();
  if (cachedControls && cacheExpiresAt > now) {
    return cachedControls;
  }

  const rows = await app.prisma
    .$queryRaw<
      Array<{
        service_key: string;
        enabled: boolean;
        reason: string | null;
        updated_at: Date | null;
        updated_by_user_id: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          service_key,
          enabled,
          reason,
          updated_at,
          updated_by_user_id
        FROM service_controls
      `,
    )
    .catch(() => []);
  const map = new Map<ServiceControlKey, ServiceControlRecord>();
  for (const definition of SERVICE_CONTROL_DEFINITIONS) {
    const row = rows.find((item) => item.service_key === definition.key);
    map.set(definition.key, {
      enabled: row?.enabled ?? definition.defaultEnabled,
      reason: row?.reason ?? null,
      updatedAt: row?.updated_at ?? null,
      updatedByUserId: row?.updated_by_user_id ?? null,
    });
  }

  cachedControls = map;
  cacheExpiresAt = now + SERVICE_CONTROL_TTL_MS;
  return map;
}

function clearControlCache() {
  cachedControls = null;
  cacheExpiresAt = 0;
}

export async function listServiceControls(app: FastifyInstance) {
  const map = await loadControlMap(app);
  return SERVICE_CONTROL_DEFINITIONS.map((definition) => {
    const state = map.get(definition.key)!;
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      defaultEnabled: definition.defaultEnabled,
      enabled: state.enabled,
      reason: state.reason,
      updatedAt: state.updatedAt?.toISOString() ?? null,
      updatedByUserId: state.updatedByUserId,
    };
  });
}

export async function setServiceControl(
  app: FastifyInstance,
  input: {
    key: ServiceControlKey;
    enabled: boolean;
    reason?: string | null;
    updatedByUserId?: string | null;
  },
) {
  const definition = SERVICE_DEFINITION_MAP.get(input.key);
  if (!definition) {
    throw new Error(`Unknown service control key: ${input.key}`);
  }

  const rows = await app.prisma.$queryRaw<
    Array<{
      service_key: string;
      enabled: boolean;
      reason: string | null;
      updated_at: Date;
      updated_by_user_id: string | null;
    }>
  >(
    Prisma.sql`
      INSERT INTO service_controls (
        service_key,
        enabled,
        reason,
        updated_by_user_id,
        updated_at
      )
      VALUES (
        ${input.key},
        ${input.enabled},
        ${trimReason(input.reason)},
        ${input.updatedByUserId ?? null}::uuid,
        NOW()
      )
      ON CONFLICT (service_key)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        reason = EXCLUDED.reason,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING
        service_key,
        enabled,
        reason,
        updated_at,
        updated_by_user_id
    `,
  );
  const updated = rows[0];
  if (!updated) {
    throw new Error("Failed to update service control.");
  }

  clearControlCache();

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    defaultEnabled: definition.defaultEnabled,
    enabled: updated.enabled,
    reason: updated.reason ?? null,
    updatedAt: updated.updated_at.toISOString(),
    updatedByUserId: updated.updated_by_user_id ?? null,
  };
}

export async function ensureServiceEnabled(
  app: FastifyInstance,
  key: ServiceControlKey,
) {
  const definition = SERVICE_DEFINITION_MAP.get(key);
  if (!definition) return;

  const map = await loadControlMap(app);
  const state = map.get(key);

  if (!state || state.enabled) return;

  throw app.httpErrors.serviceUnavailable(
    state.reason?.trim() || definition.clientMessage,
  );
}

function normalizeStudioSelection(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function serviceEnabledByMap(
  map: Map<ServiceControlKey, ServiceControlRecord>,
  key: ServiceControlKey,
) {
  const state = map.get(key);
  if (state) return state.enabled;
  return SERVICE_DEFINITION_MAP.get(key)?.defaultEnabled ?? true;
}

export function resolveStudioServiceKey(input: {
  documentType: string;
  selectedType?: string | null;
}): StudioDocumentServiceKey | null {
  const selectedType = normalizeStudioSelection(input.selectedType);
  switch (input.documentType) {
    case "Lesson Plan":
      return "studio_theory_lesson_plan";
    case "OSCE Station":
      return "studio_osce_station";
    case "Assessment Tool":
      return "studio_assessment_tool";
    case "Scheme of Work":
      return "studio_scheme_of_work";
    case "Clinical Plan":
      if (selectedType.includes("skills lab")) {
        return "studio_skills_lab_plan";
      }
      if (selectedType.includes("clinical teaching")) {
        return "studio_clinical_teaching_plan";
      }
      return null;
    default:
      return null;
  }
}

export async function ensureStudioDocumentServiceEnabled(
  app: FastifyInstance,
  input: {
    documentType: string;
    selectedType?: string | null;
  },
) {
  const directKey = resolveStudioServiceKey(input);
  if (directKey) {
    await ensureServiceEnabled(app, directKey);
    return;
  }

  if (input.documentType !== "Clinical Plan") {
    return;
  }

  const map = await loadControlMap(app);
  const allowSkills = serviceEnabledByMap(map, "studio_skills_lab_plan");
  const allowClinical = serviceEnabledByMap(
    map,
    "studio_clinical_teaching_plan",
  );
  if (allowSkills || allowClinical) {
    return;
  }

  const skillsReason = map.get("studio_skills_lab_plan")?.reason?.trim();
  const clinicalReason = map
    .get("studio_clinical_teaching_plan")
    ?.reason?.trim();
  throw app.httpErrors.serviceUnavailable(
    skillsReason ||
    clinicalReason ||
    "Clinical Plan services are temporarily unavailable.",
  );
}
