-- CreateTable
CREATE TABLE "curriculum_hierarchy_nodes" (
    "id" UUID NOT NULL,
    "curriculum_version_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "parent_id" UUID,
    "node_type" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "curriculum_hierarchy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_hierarchy_nodes_curriculum_version_id_source_id_path_key"
ON "curriculum_hierarchy_nodes"("curriculum_version_id", "source_id", "path");

-- CreateIndex
CREATE INDEX "curriculum_hierarchy_nodes_curriculum_version_id_source_id_depth_sort_order_idx"
ON "curriculum_hierarchy_nodes"("curriculum_version_id", "source_id", "depth", "sort_order");

-- CreateIndex
CREATE INDEX "curriculum_hierarchy_nodes_curriculum_version_id_node_type_title_idx"
ON "curriculum_hierarchy_nodes"("curriculum_version_id", "node_type", "title");

-- CreateIndex
CREATE INDEX "curriculum_hierarchy_nodes_parent_id_idx"
ON "curriculum_hierarchy_nodes"("parent_id");

-- AddForeignKey
ALTER TABLE "curriculum_hierarchy_nodes"
ADD CONSTRAINT "curriculum_hierarchy_nodes_curriculum_version_id_fkey"
FOREIGN KEY ("curriculum_version_id") REFERENCES "curriculum_versions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_hierarchy_nodes"
ADD CONSTRAINT "curriculum_hierarchy_nodes_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "curriculum_sources"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_hierarchy_nodes"
ADD CONSTRAINT "curriculum_hierarchy_nodes_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "curriculum_hierarchy_nodes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

