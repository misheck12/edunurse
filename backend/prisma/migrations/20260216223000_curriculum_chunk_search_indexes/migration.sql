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
