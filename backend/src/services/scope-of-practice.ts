/**
 * Scope of Practice Validation Service
 *
 * Validates generated content against HPCZ/NMCZ scope-of-practice rules.
 * Flags procedures or clinical actions that exceed the student's training level.
 *
 * Uses a two-layer approach:
 * 1. Rule-based keyword matching against the ScopeOfPracticeRule table
 * 2. Optional AI-powered review for nuanced scope boundary detection
 */

import { PrismaClient } from "@prisma/client";

// Use type-safe dynamic access to handle pre-migration state
type PrismaAny = PrismaClient & Record<string, any>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScopeValidationInput {
  /** The generated content text to validate */
  content: string;
  /** Student's programme level */
  programmeLevel: "diploma" | "bsc" | "masters";
  /** Student's year of study (1-4) */
  yearLevel: number;
  /** The type of document being validated */
  documentType?: string;
}

export interface ScopeViolation {
  /** The matched procedure or action */
  procedureName: string;
  /** Keywords that triggered the match */
  matchedKeywords: string[];
  /** Required minimum programme level */
  requiredLevel: string;
  /** Required minimum year */
  requiredYear: number;
  /** Whether supervision is required */
  requiresSupervision: boolean;
  /** Risk level of the procedure */
  riskLevel: string;
  /** Regulatory note from HPCZ/NMCZ */
  regulatoryNote: string | null;
  /** The portion of content that triggered the violation */
  contextSnippet: string;
}

export interface ScopeValidationResult {
  /** Whether the content passed validation */
  passed: boolean;
  /** List of scope-of-practice violations found */
  violations: ScopeViolation[];
  /** Warnings (procedures within scope but requiring supervision) */
  warnings: ScopeViolation[];
  /** Summary message */
  summary: string;
}

// ---------------------------------------------------------------------------
// Programme level ordering for comparison
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<string, number> = {
  diploma: 1,
  bsc: 2,
  masters: 3,
};

function levelMeetsMinimum(
  studentLevel: string,
  requiredLevel: string,
): boolean {
  return (LEVEL_ORDER[studentLevel] ?? 0) >= (LEVEL_ORDER[requiredLevel] ?? 0);
}

// ---------------------------------------------------------------------------
// Built-in scope rules (used when database has no rules yet)
// These reflect common NMCZ/HPCZ boundaries for Zambian nursing education
// ---------------------------------------------------------------------------

const BUILTIN_SCOPE_RULES: Array<{
  procedureName: string;
  keywords: string[];
  minLevel: string;
  minYear: number;
  requiresSupervision: boolean;
  riskLevel: string;
  note: string;
}> = [
  // Critical / Advanced procedures
  {
    procedureName: "Central venous catheter insertion",
    keywords: ["central line", "central venous", "cvp line", "subclavian", "jugular cannulation"],
    minLevel: "bsc",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "critical",
    note: "Beyond NMCZ Diploma scope. Requires qualified medical officer supervision per HPCZ Act.",
  },
  {
    procedureName: "Chest tube insertion",
    keywords: ["chest tube", "intercostal drain", "chest drain insertion", "thoracostomy"],
    minLevel: "bsc",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "critical",
    note: "Medical procedure. Nursing role limited to assisting and post-insertion care per NMCZ scope.",
  },
  {
    procedureName: "Endotracheal intubation",
    keywords: ["intubation", "endotracheal tube", "ett insertion", "laryngoscopy"],
    minLevel: "bsc",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "critical",
    note: "Emergency airway management. Nurses assist; insertion is medical officer scope per HPCZ.",
  },
  {
    procedureName: "Blood transfusion initiation",
    keywords: ["blood transfusion", "transfuse blood", "packed red cells", "blood products administration"],
    minLevel: "diploma",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "high",
    note: "Requires qualified RN supervision. Diploma Year 1-2 students may only observe per NMCZ training standards.",
  },
  {
    procedureName: "Epidural administration",
    keywords: ["epidural", "spinal anaesthesia", "spinal block", "lumbar puncture"],
    minLevel: "bsc",
    minYear: 4,
    requiresSupervision: true,
    riskLevel: "critical",
    note: "Anaesthetic procedure. Nursing role limited to patient monitoring per NMCZ/HPCZ scope.",
  },
  // High-risk procedures
  {
    procedureName: "IV medication administration",
    keywords: ["iv push", "intravenous medication", "iv drug", "iv bolus", "iv infusion medication"],
    minLevel: "diploma",
    minYear: 2,
    requiresSupervision: true,
    riskLevel: "high",
    note: "Requires direct supervision for Diploma Year 2. Independent practice from Year 3 per NMCZ competency framework.",
  },
  {
    procedureName: "Controlled substance administration",
    keywords: ["morphine", "pethidine", "diazepam", "controlled drug", "narcotic", "opioid administration", "schedule ii"],
    minLevel: "diploma",
    minYear: 2,
    requiresSupervision: true,
    riskLevel: "high",
    note: "Controlled substances require double-checking and RN co-signature per HPCZ regulations and ZAMRA requirements.",
  },
  {
    procedureName: "Wound debridement",
    keywords: ["debridement", "wound debride", "surgical debridement", "sharp debridement"],
    minLevel: "diploma",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "high",
    note: "Surgical debridement requires medical supervision. Autolytic debridement within RN scope from Year 3.",
  },
  // Standard procedures with level requirements
  {
    procedureName: "Urinary catheterisation",
    keywords: ["catheterisation", "catheterization", "urinary catheter", "foley catheter", "indwelling catheter"],
    minLevel: "diploma",
    minYear: 2,
    requiresSupervision: false,
    riskLevel: "standard",
    note: "NMCZ competency: assisted level in Year 2, performed independently from Year 3.",
  },
  {
    procedureName: "Nasogastric tube insertion",
    keywords: ["nasogastric", "ng tube", "ngt insertion", "ryles tube"],
    minLevel: "diploma",
    minYear: 2,
    requiresSupervision: true,
    riskLevel: "standard",
    note: "Requires supervision in Year 2. Independent practice from Year 3 per NMCZ clinical competencies.",
  },
  {
    procedureName: "Suturing",
    keywords: ["suturing", "suture wound", "wound closure", "skin suture"],
    minLevel: "diploma",
    minYear: 3,
    requiresSupervision: true,
    riskLevel: "standard",
    note: "Limited suturing within NMCZ midwifery scope (perineal repair). General suturing requires medical officer.",
  },
  {
    procedureName: "Prescribing medication",
    keywords: ["prescribe", "prescription", "prescribing authority", "medication order"],
    minLevel: "bsc",
    minYear: 4,
    requiresSupervision: false,
    riskLevel: "high",
    note: "Limited prescribing authority for nurse practitioners (BSc level) per HPCZ Act. Diploma nurses administer prescribed medications only.",
  },
];

// ---------------------------------------------------------------------------
// Core validation logic
// ---------------------------------------------------------------------------

/**
 * Validate content against scope-of-practice rules.
 *
 * First checks database rules, then falls back to built-in rules.
 * Returns violations (out-of-scope) and warnings (requires supervision).
 */
export async function validateScopeOfPractice(
  prisma: PrismaClient,
  input: ScopeValidationInput,
): Promise<ScopeValidationResult> {
  const contentLower = input.content.toLowerCase();
  const violations: ScopeViolation[] = [];
  const warnings: ScopeViolation[] = [];

  // 1. Check database rules first
  try {
    const dbRules = await (prisma as PrismaAny).scopeOfPracticeRule.findMany({
      where: { isActive: true },
    });

    if (dbRules.length > 0) {
      for (const rule of dbRules) {
        const matchedKeywords = (rule.procedureKeywords ?? []).filter(
          (kw: string) => contentLower.includes(kw.toLowerCase()),
        );

        if (matchedKeywords.length === 0) continue;

        const violation: ScopeViolation = {
          procedureName: rule.procedureName,
          matchedKeywords,
          requiredLevel: rule.minProgrammeLevel,
          requiredYear: rule.minYearLevel,
          requiresSupervision: rule.requiresSupervision,
          riskLevel: rule.riskLevel,
          regulatoryNote: rule.regulatoryNote,
          contextSnippet: extractSnippet(contentLower, matchedKeywords[0]),
        };

        const withinLevel = levelMeetsMinimum(
          input.programmeLevel,
          rule.minProgrammeLevel,
        );
        const withinYear = input.yearLevel >= rule.minYearLevel;

        if (!withinLevel || !withinYear) {
          violations.push(violation);
        } else if (rule.requiresSupervision) {
          warnings.push(violation);
        }
      }

      return buildResult(violations, warnings);
    }
  } catch {
    // Database may not have the table yet — fall through to built-in rules
  }

  // 2. Fall back to built-in rules
  for (const rule of BUILTIN_SCOPE_RULES) {
    const matchedKeywords = rule.keywords.filter((kw) =>
      contentLower.includes(kw),
    );

    if (matchedKeywords.length === 0) continue;

    const violation: ScopeViolation = {
      procedureName: rule.procedureName,
      matchedKeywords,
      requiredLevel: rule.minLevel,
      requiredYear: rule.minYear,
      requiresSupervision: rule.requiresSupervision,
      riskLevel: rule.riskLevel,
      regulatoryNote: rule.note,
      contextSnippet: extractSnippet(contentLower, matchedKeywords[0]),
    };

    const withinLevel = levelMeetsMinimum(
      input.programmeLevel,
      rule.minLevel,
    );
    const withinYear = input.yearLevel >= rule.minYear;

    if (!withinLevel || !withinYear) {
      violations.push(violation);
    } else if (rule.requiresSupervision) {
      warnings.push(violation);
    }
  }

  return buildResult(violations, warnings);
}

function extractSnippet(content: string, keyword: string): string {
  const idx = content.indexOf(keyword);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + keyword.length + 60);
  return "…" + content.slice(start, end).trim() + "…";
}

function buildResult(
  violations: ScopeViolation[],
  warnings: ScopeViolation[],
): ScopeValidationResult {
  const passed = violations.length === 0;

  let summary: string;
  if (passed && warnings.length === 0) {
    summary = "Content is within NMCZ/HPCZ scope of practice for the specified level.";
  } else if (passed) {
    summary = `Content is within scope but includes ${warnings.length} procedure(s) requiring qualified supervision.`;
  } else {
    const criticalCount = violations.filter(
      (v) => v.riskLevel === "critical",
    ).length;
    summary = `⚠️ ${violations.length} scope-of-practice violation(s) detected${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}. Review flagged procedures against NMCZ competency framework.`;
  }

  return { passed, violations, warnings, summary };
}

// ---------------------------------------------------------------------------
// Seed helper — populates the database with built-in rules
// ---------------------------------------------------------------------------

export async function seedScopeOfPracticeRules(
  prisma: PrismaClient,
): Promise<number> {
  let count = 0;
  for (const rule of BUILTIN_SCOPE_RULES) {
    try {
      await (prisma as PrismaAny).scopeOfPracticeRule.upsert({
        where: {
          id: undefined as unknown as string, // force create path
        } as never,
        update: {},
        create: {
          procedureName: rule.procedureName,
          procedureKeywords: rule.keywords,
          minProgrammeLevel: rule.minLevel as "diploma" | "bsc" | "masters",
          minYearLevel: rule.minYear,
          requiresSupervision: rule.requiresSupervision,
          riskLevel: rule.riskLevel,
          regulatoryNote: rule.note,
          practitionerTypes: ["rn"],
        },
      });
      count += 1;
    } catch {
      // Skip duplicates or schema mismatches gracefully
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// NMCZ Competency seed data
// ---------------------------------------------------------------------------

export const NMCZ_COMPETENCY_SEEDS = [
  // Clinical domain
  { code: "NMCZ-C-001", domain: "clinical", title: "Patient Assessment", description: "Perform comprehensive patient assessment including vital signs, physical examination, and health history", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-C-002", domain: "clinical", title: "Medication Administration", description: "Safely administer medications via oral, parenteral, and topical routes following the 10 rights", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },
  { code: "NMCZ-C-003", domain: "clinical", title: "Wound Care Management", description: "Assess, clean, dress, and manage wounds using aseptic technique", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },
  { code: "NMCZ-C-004", domain: "clinical", title: "IV Therapy and Fluid Management", description: "Initiate, monitor, and manage intravenous therapy and fluid balance", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },
  { code: "NMCZ-C-005", domain: "clinical", title: "Emergency Nursing Care", description: "Provide immediate nursing interventions in emergency situations including BLS", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },
  { code: "NMCZ-C-006", domain: "clinical", title: "Perioperative Nursing", description: "Provide nursing care in pre-operative, intra-operative, and post-operative phases", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-C-007", domain: "clinical", title: "Maternal and Newborn Care", description: "Provide antenatal, intrapartum, and postnatal care to mothers and newborns", programmeLevel: "diploma", practitionerType: "rm", yearLevel: 2 },
  { code: "NMCZ-C-008", domain: "clinical", title: "Paediatric Nursing Care", description: "Assess and manage common childhood illnesses following IMCI guidelines", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-C-009", domain: "clinical", title: "Mental Health Nursing", description: "Assess mental health status and provide therapeutic nursing interventions", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-C-010", domain: "clinical", title: "Community Health Nursing", description: "Plan and implement community health programmes using the PHC approach", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },

  // Professional domain
  { code: "NMCZ-P-001", domain: "professional", title: "Professional Conduct", description: "Practice within HPCZ Act Cap 302 and NMCZ Code of Professional Conduct", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-P-002", domain: "professional", title: "Documentation and Reporting", description: "Maintain accurate, complete, and timely patient records following NMCZ standards", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-P-003", domain: "professional", title: "Quality Improvement", description: "Participate in quality improvement activities and clinical audit processes", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-P-004", domain: "professional", title: "Evidence-Based Practice", description: "Apply research findings and evidence-based guidelines to nursing practice", programmeLevel: "bsc", practitionerType: "rn", yearLevel: 3 },

  // Ethical domain
  { code: "NMCZ-E-001", domain: "ethical", title: "Patient Rights and Advocacy", description: "Protect patient rights, maintain confidentiality, and advocate for vulnerable populations", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-E-002", domain: "ethical", title: "Informed Consent", description: "Ensure informed consent is obtained following HPCZ ethical guidelines", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-E-003", domain: "ethical", title: "Ethical Decision-Making", description: "Apply ethical principles (beneficence, non-maleficence, autonomy, justice) in clinical situations", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },

  // Communication domain
  { code: "NMCZ-CM-001", domain: "communication", title: "Therapeutic Communication", description: "Use therapeutic communication techniques with patients, families, and communities", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 1 },
  { code: "NMCZ-CM-002", domain: "communication", title: "Health Education", description: "Plan and deliver health education to individuals, families, and communities", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },
  { code: "NMCZ-CM-003", domain: "communication", title: "Interprofessional Collaboration", description: "Communicate effectively with the multidisciplinary healthcare team", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 2 },

  // Leadership domain
  { code: "NMCZ-L-001", domain: "leadership", title: "Clinical Leadership", description: "Demonstrate leadership in clinical settings including delegation and team coordination", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-L-002", domain: "leadership", title: "Resource Management", description: "Manage ward resources, supplies, and equipment effectively", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },

  // Research domain
  { code: "NMCZ-R-001", domain: "research", title: "Research Utilization", description: "Read, interpret, and apply nursing research findings to practice", programmeLevel: "diploma", practitionerType: "rn", yearLevel: 3 },
  { code: "NMCZ-R-002", domain: "research", title: "Research Methodology", description: "Design and conduct nursing research projects following ethical guidelines", programmeLevel: "bsc", practitionerType: "rn", yearLevel: 4 },
] as const;

/**
 * Seed the NMCZ competency framework into the database.
 */
export async function seedNmczCompetencies(
  prisma: PrismaClient,
): Promise<number> {
  let count = 0;
  for (const seed of NMCZ_COMPETENCY_SEEDS) {
    try {
      await (prisma as PrismaAny).nmczCompetency.upsert({
        where: { code: seed.code },
        update: {
          title: seed.title,
          description: seed.description,
        },
        create: {
          code: seed.code,
          domain: seed.domain as "clinical" | "professional" | "ethical" | "communication" | "leadership" | "research",
          title: seed.title,
          description: seed.description,
          programmeLevel: seed.programmeLevel as "diploma" | "bsc" | "masters",
          practitionerType: seed.practitionerType as "rn" | "rm" | "en" | "enm",
          yearLevel: seed.yearLevel,
        },
      });
      count += 1;
    } catch {
      // Skip on error
    }
  }
  return count;
}
