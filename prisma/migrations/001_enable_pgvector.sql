-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for fast similarity search on DocumentChunk embeddings
-- Run this AFTER initial migration when the table exists
-- CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
--   ON "DocumentChunk"
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
