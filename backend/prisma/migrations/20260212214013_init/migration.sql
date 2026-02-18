CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('educator', 'admin');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('lesson_plan', 'osce_station', 'clinical_plan', 'assessment_tool', 'scheme_of_work');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'final');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('syllabus', 'standards', 'guideline');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('uploaded', 'parsed', 'indexed', 'active', 'deprecated', 'failed');

-- CreateEnum
CREATE TYPE "GenerationRunType" AS ENUM ('create', 'regenerate_section', 'expand', 'simplify');

-- CreateEnum
CREATE TYPE "GenerationRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('info', 'warning', 'blocking');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ingestion', 'embedding', 'export', 'generation');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('pdf', 'docx');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'educator',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "default_programme" TEXT,
    "default_year" TEXT,
    "default_document_type" TEXT,
    "export_defaults" JSONB NOT NULL DEFAULT '{}',
    "ui_preferences" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_price_cents" INTEGER NOT NULL,
    "limits_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_subscription_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "template_schema_version" INTEGER NOT NULL DEFAULT 1,
    "template_json" JSONB NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "programme" TEXT NOT NULL,
    "year" TEXT,
    "course" TEXT,
    "topic" TEXT NOT NULL,
    "duration_minutes" INTEGER,
    "curriculum_version_id" UUID,
    "template_id" UUID,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "latest_version_num" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_num" INTEGER NOT NULL,
    "content_json" JSONB NOT NULL,
    "change_summary" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sections" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "section_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_citations" (
    "id" UUID NOT NULL,
    "document_section_id" UUID NOT NULL,
    "curriculum_chunk_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "page" INTEGER,
    "quote_snippet" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "programme" TEXT,
    "url" TEXT,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'uploaded',
    "uploaded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "curriculum_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_versions" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_version_sources" (
    "curriculum_version_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,

    CONSTRAINT "curriculum_version_sources_pkey" PRIMARY KEY ("curriculum_version_id","source_id")
);

-- CreateTable
CREATE TABLE "curriculum_chunks" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "curriculum_version_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "page" INTEGER,
    "heading" TEXT,
    "programme_tag" TEXT,
    "year_tag" TEXT,
    "course_code" TEXT,
    "competency_code" TEXT,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "tsv" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "developer_prompt" TEXT,
    "schema_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID,
    "document_version_id" UUID,
    "run_type" "GenerationRunType" NOT NULL,
    "status" "GenerationRunStatus" NOT NULL,
    "input_json" JSONB NOT NULL,
    "strict_curriculum_alignment" BOOLEAN NOT NULL DEFAULT true,
    "model_provider" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version_id" UUID,
    "output_json" JSONB,
    "output_checksum" TEXT,
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_run_retrievals" (
    "id" UUID NOT NULL,
    "generation_run_id" UUID NOT NULL,
    "curriculum_chunk_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "vector_score" DECIMAL(8,6),
    "keyword_score" DECIMAL(8,6),
    "rerank_score" DECIMAL(8,6),
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_run_retrievals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_flags" (
    "id" UUID NOT NULL,
    "generation_run_id" UUID NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "details_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "storage_key" TEXT,
    "signed_url_expires_at" TIMESTAMPTZ(6),
    "checksum" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "templates_owner_user_id_document_type_idx" ON "templates"("owner_user_id", "document_type");

-- CreateIndex
CREATE INDEX "documents_user_id_updated_at_idx" ON "documents"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "documents_user_id_document_type_idx" ON "documents"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "document_versions_document_id_version_num_idx" ON "document_versions"("document_id", "version_num" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_num_key" ON "document_versions"("document_id", "version_num");

-- CreateIndex
CREATE INDEX "document_sections_document_id_position_idx" ON "document_sections"("document_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "document_sections_document_version_id_section_key_key" ON "document_sections"("document_version_id", "section_key");

-- CreateIndex
CREATE INDEX "section_citations_document_section_id_idx" ON "section_citations"("document_section_id");

-- CreateIndex
CREATE INDEX "section_citations_source_id_idx" ON "section_citations"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_sources_checksum_key" ON "curriculum_sources"("checksum");

-- CreateIndex
CREATE INDEX "curriculum_sources_status_created_at_idx" ON "curriculum_sources"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_versions_label_key" ON "curriculum_versions"("label");

-- CreateIndex
CREATE INDEX "curriculum_versions_is_active_idx" ON "curriculum_versions"("is_active");

-- CreateIndex
CREATE INDEX "curriculum_chunks_curriculum_version_id_programme_tag_year__idx" ON "curriculum_chunks"("curriculum_version_id", "programme_tag", "year_tag");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_chunks_source_id_chunk_index_key" ON "curriculum_chunks"("source_id", "chunk_index");

-- CreateIndex
CREATE INDEX "prompt_versions_document_type_is_active_idx" ON "prompt_versions"("document_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_name_document_type_key" ON "prompt_versions"("name", "document_type");

-- CreateIndex
CREATE INDEX "generation_runs_user_id_created_at_idx" ON "generation_runs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generation_runs_document_id_idx" ON "generation_runs"("document_id");

-- CreateIndex
CREATE INDEX "generation_run_retrievals_generation_run_id_rank_idx" ON "generation_run_retrievals"("generation_run_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "generation_run_retrievals_generation_run_id_curriculum_chun_key" ON "generation_run_retrievals"("generation_run_id", "curriculum_chunk_id");

-- CreateIndex
CREATE INDEX "generation_flags_generation_run_id_severity_idx" ON "generation_flags"("generation_run_id", "severity");

-- CreateIndex
CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "export_jobs_user_id_created_at_idx" ON "export_jobs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "export_jobs_document_id_status_idx" ON "export_jobs"("document_id", "status");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_curriculum_version_id_fkey" FOREIGN KEY ("curriculum_version_id") REFERENCES "curriculum_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_citations" ADD CONSTRAINT "section_citations_document_section_id_fkey" FOREIGN KEY ("document_section_id") REFERENCES "document_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_citations" ADD CONSTRAINT "section_citations_curriculum_chunk_id_fkey" FOREIGN KEY ("curriculum_chunk_id") REFERENCES "curriculum_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_citations" ADD CONSTRAINT "section_citations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "curriculum_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_sources" ADD CONSTRAINT "curriculum_sources_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_version_sources" ADD CONSTRAINT "curriculum_version_sources_curriculum_version_id_fkey" FOREIGN KEY ("curriculum_version_id") REFERENCES "curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_version_sources" ADD CONSTRAINT "curriculum_version_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "curriculum_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_chunks" ADD CONSTRAINT "curriculum_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "curriculum_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_chunks" ADD CONSTRAINT "curriculum_chunks_curriculum_version_id_fkey" FOREIGN KEY ("curriculum_version_id") REFERENCES "curriculum_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_run_retrievals" ADD CONSTRAINT "generation_run_retrievals_generation_run_id_fkey" FOREIGN KEY ("generation_run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_run_retrievals" ADD CONSTRAINT "generation_run_retrievals_curriculum_chunk_id_fkey" FOREIGN KEY ("curriculum_chunk_id") REFERENCES "curriculum_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_flags" ADD CONSTRAINT "generation_flags_generation_run_id_fkey" FOREIGN KEY ("generation_run_id") REFERENCES "generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
