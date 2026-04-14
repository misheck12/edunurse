-- AlterTable
ALTER TABLE "document_competency_tags" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "nmcz_competencies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scope_of_practice_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "document_competency_tags_section_competency_key" RENAME TO "document_competency_tags_document_section_id_competency_id_key";

-- RenameIndex
ALTER INDEX "scope_of_practice_rules_level_year_idx" RENAME TO "scope_of_practice_rules_min_programme_level_min_year_level_idx";
