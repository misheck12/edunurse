-- DropForeignKey
ALTER TABLE "service_controls" DROP CONSTRAINT "service_controls_updated_by_user_id_fkey";

-- DropIndex
DROP INDEX "curriculum_chunks_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "curriculum_chunks_tsv_gin_idx";

-- AlterTable
ALTER TABLE "service_controls" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "curriculum_hierarchy_nodes_curriculum_version_id_node_type_titl" RENAME TO "curriculum_hierarchy_nodes_curriculum_version_id_node_type__idx";

-- RenameIndex
ALTER INDEX "curriculum_hierarchy_nodes_curriculum_version_id_source_id_dept" RENAME TO "curriculum_hierarchy_nodes_curriculum_version_id_source_id__idx";

-- RenameIndex
ALTER INDEX "curriculum_hierarchy_nodes_curriculum_version_id_source_id_path" RENAME TO "curriculum_hierarchy_nodes_curriculum_version_id_source_id__key";
