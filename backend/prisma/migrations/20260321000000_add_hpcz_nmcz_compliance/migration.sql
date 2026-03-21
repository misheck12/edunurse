-- HPCZ/NMCZ Compliance: Add competency framework and scope-of-practice validation

-- NMCZ Competency Domain enum
CREATE TYPE "NmczCompetencyDomain" AS ENUM ('clinical', 'professional', 'ethical', 'communication', 'leadership', 'research');

-- NMCZ Programme Level enum
CREATE TYPE "NmczProgrammeLevel" AS ENUM ('diploma', 'bsc', 'masters');

-- NMCZ Practitioner Type enum
CREATE TYPE "NmczPractitionerType" AS ENUM ('rn', 'rm', 'en', 'enm');

-- NMCZ Competencies table
CREATE TABLE "nmcz_competencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "domain" "NmczCompetencyDomain" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "programme_level" "NmczProgrammeLevel" NOT NULL,
    "practitioner_type" "NmczPractitionerType" NOT NULL,
    "year_level" INTEGER,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nmcz_competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nmcz_competencies_code_key" ON "nmcz_competencies"("code");
CREATE INDEX "nmcz_competencies_domain_programme_level_idx" ON "nmcz_competencies"("domain", "programme_level");
CREATE INDEX "nmcz_competencies_practitioner_type_year_level_idx" ON "nmcz_competencies"("practitioner_type", "year_level");

ALTER TABLE "nmcz_competencies"
    ADD CONSTRAINT "nmcz_competencies_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "nmcz_competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Document Competency Tags table (links generated document sections to NMCZ competencies)
CREATE TABLE "document_competency_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_section_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "confidence" DECIMAL(5,4),
    "tagged_by_ai" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_competency_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_competency_tags_section_competency_key"
    ON "document_competency_tags"("document_section_id", "competency_id");
CREATE INDEX "document_competency_tags_competency_id_idx"
    ON "document_competency_tags"("competency_id");

ALTER TABLE "document_competency_tags"
    ADD CONSTRAINT "document_competency_tags_document_section_id_fkey"
    FOREIGN KEY ("document_section_id") REFERENCES "document_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_competency_tags"
    ADD CONSTRAINT "document_competency_tags_competency_id_fkey"
    FOREIGN KEY ("competency_id") REFERENCES "nmcz_competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope of Practice Rules table
CREATE TABLE "scope_of_practice_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "competency_id" UUID,
    "procedure_name" TEXT NOT NULL,
    "procedure_keywords" TEXT[] NOT NULL,
    "min_programme_level" "NmczProgrammeLevel" NOT NULL,
    "min_year_level" INTEGER NOT NULL,
    "requires_supervision" BOOLEAN NOT NULL DEFAULT false,
    "practitioner_types" "NmczPractitionerType"[] NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'standard',
    "regulatory_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_of_practice_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scope_of_practice_rules_level_year_idx"
    ON "scope_of_practice_rules"("min_programme_level", "min_year_level");
CREATE INDEX "scope_of_practice_rules_procedure_name_idx"
    ON "scope_of_practice_rules"("procedure_name");

ALTER TABLE "scope_of_practice_rules"
    ADD CONSTRAINT "scope_of_practice_rules_competency_id_fkey"
    FOREIGN KEY ("competency_id") REFERENCES "nmcz_competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
