-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('google_drive', 'web_url', 'postgres', 'mysql', 'manual_upload');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('active', 'paused', 'error');

-- CreateEnum
CREATE TYPE "ConnectorRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');

-- AlterTable
ALTER TABLE "curriculum_sources" ADD COLUMN     "connector_id" UUID;

-- CreateTable
CREATE TABLE "connectors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "connector_type" "ConnectorType" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'active',
    "config_json" JSONB NOT NULL,
    "secret_json" JSONB,
    "default_curriculum_version_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "status" "ConnectorRunStatus" NOT NULL DEFAULT 'queued',
    "discovered_count" INTEGER NOT NULL DEFAULT 0,
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "indexed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "log_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_documents" (
    "id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_url" TEXT,
    "mime_type" TEXT,
    "owner" TEXT,
    "access_scope" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "latest_version_id" UUID,
    "curriculum_source_id" UUID,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_document_versions" (
    "id" UUID NOT NULL,
    "external_document_id" UUID NOT NULL,
    "revision_id" TEXT,
    "checksum" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk_lineages" (
    "id" UUID NOT NULL,
    "curriculum_chunk_id" UUID NOT NULL,
    "external_document_version_id" UUID NOT NULL,
    "connector_run_id" UUID NOT NULL,
    "external_chunk_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_lineages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connectors_connector_type_status_idx" ON "connectors"("connector_type", "status");

-- CreateIndex
CREATE INDEX "connectors_created_by_user_id_created_at_idx" ON "connectors"("created_by_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "connector_runs_connector_id_created_at_idx" ON "connector_runs"("connector_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "connector_runs_status_created_at_idx" ON "connector_runs"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "external_documents_curriculum_source_id_key" ON "external_documents"("curriculum_source_id");

-- CreateIndex
CREATE INDEX "external_documents_connector_id_updated_at_idx" ON "external_documents"("connector_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "external_documents_connector_id_external_id_key" ON "external_documents"("connector_id", "external_id");

-- CreateIndex
CREATE INDEX "external_document_versions_external_document_id_created_at_idx" ON "external_document_versions"("external_document_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "external_document_versions_external_document_id_checksum_key" ON "external_document_versions"("external_document_id", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "chunk_lineages_curriculum_chunk_id_key" ON "chunk_lineages"("curriculum_chunk_id");

-- CreateIndex
CREATE INDEX "chunk_lineages_external_document_version_id_idx" ON "chunk_lineages"("external_document_version_id");

-- CreateIndex
CREATE INDEX "chunk_lineages_connector_run_id_idx" ON "chunk_lineages"("connector_run_id");

-- AddForeignKey
ALTER TABLE "curriculum_sources" ADD CONSTRAINT "curriculum_sources_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_default_curriculum_version_id_fkey" FOREIGN KEY ("default_curriculum_version_id") REFERENCES "curriculum_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_runs" ADD CONSTRAINT "connector_runs_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_documents" ADD CONSTRAINT "external_documents_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_documents" ADD CONSTRAINT "external_documents_latest_version_id_fkey" FOREIGN KEY ("latest_version_id") REFERENCES "external_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_documents" ADD CONSTRAINT "external_documents_curriculum_source_id_fkey" FOREIGN KEY ("curriculum_source_id") REFERENCES "curriculum_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_document_versions" ADD CONSTRAINT "external_document_versions_external_document_id_fkey" FOREIGN KEY ("external_document_id") REFERENCES "external_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_lineages" ADD CONSTRAINT "chunk_lineages_curriculum_chunk_id_fkey" FOREIGN KEY ("curriculum_chunk_id") REFERENCES "curriculum_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_lineages" ADD CONSTRAINT "chunk_lineages_external_document_version_id_fkey" FOREIGN KEY ("external_document_version_id") REFERENCES "external_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_lineages" ADD CONSTRAINT "chunk_lineages_connector_run_id_fkey" FOREIGN KEY ("connector_run_id") REFERENCES "connector_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
