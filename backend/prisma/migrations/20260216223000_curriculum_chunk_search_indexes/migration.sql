-- Ensure vector extension is active (safe to re-run)
CREATE EXTENSION IF NOT EXISTS vector;

-- Fix embedding column type if it was created as text instead of vector
-- (happens when the extension wasn't loaded during the init migration)
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'curriculum_chunks' AND column_name = 'embedding') = 'text' THEN
    ALTER TABLE "curriculum_chunks" ALTER COLUMN "embedding" TYPE vector(1536) USING NULL::vector(1536);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS curriculum_chunks_embedding_hnsw_idx
ON "curriculum_chunks"
USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS curriculum_chunks_tsv_gin_idx
ON "curriculum_chunks"
USING gin ("tsv");

CREATE OR REPLACE FUNCTION curriculum_chunks_set_tsv()
RETURNS trigger AS $$
BEGIN
  NEW.tsv := to_tsvector('english', coalesce(NEW.heading, '') || ' ' || coalesce(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_curriculum_chunks_set_tsv ON "curriculum_chunks";

CREATE TRIGGER trg_curriculum_chunks_set_tsv
BEFORE INSERT OR UPDATE OF "heading", "text"
ON "curriculum_chunks"
FOR EACH ROW
EXECUTE FUNCTION curriculum_chunks_set_tsv();
