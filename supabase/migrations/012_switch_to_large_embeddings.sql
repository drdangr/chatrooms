-- Migration to switch from text-embedding-3-small (1536 dim) to text-embedding-3-large with reduced dimensions (1024 dim)
-- This provides better quality for non-English languages, including Russian
-- Note: pgvector indexes (HNSW/IVFFlat) are limited to 2000 dimensions max
-- Using 1024 dimensions allows indexing while maintaining better quality than small model
-- 
-- IMPORTANT: This will require regenerating all embeddings!
-- Run the backfill function after applying this migration.

-- Drop existing indexes
DROP INDEX IF EXISTS idx_messages_embedding;
DROP INDEX IF EXISTS idx_messages_room_id_embedding;

-- IMPORTANT: Clear existing embeddings first (they need to be regenerated with new dimensions)
-- Set all embeddings to NULL before changing column type
UPDATE public.messages SET embedding = NULL WHERE embedding IS NOT NULL;

-- Change column type from vector(1536) to vector(1024)
-- Using 1024 dimensions from text-embedding-3-large (via dimensions parameter)
-- This fits within pgvector index limits (2000 max) and provides better quality than small model
-- This will only work if all embeddings are NULL
ALTER TABLE public.messages 
ALTER COLUMN embedding TYPE vector(1024);

-- Recreate indexes for 1024 dimensions
-- Can use either IVFFlat or HNSW - HNSW is generally faster and more accurate
CREATE INDEX idx_messages_embedding ON public.messages 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index already handles filtering efficiently
-- Separate B-tree index on room_id for fast filtering before vector search
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages (room_id);

-- Update the search function to work with 1024 dimensions
-- Drop existing function first (it has different parameter types)
-- Try to drop with old signature (1536 dimensions)
DROP FUNCTION IF EXISTS public.search_messages_semantic(uuid, vector(1536), integer);
-- Also try to drop with generic vector type (in case signature is different)
DROP FUNCTION IF EXISTS public.search_messages_semantic(uuid, vector, integer);

CREATE FUNCTION public.search_messages_semantic(
  p_room_id UUID,
  p_query_embedding vector(1024),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  sender_id UUID,
  sender_name TEXT,
  text TEXT,
  message_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.room_id,
    m.sender_id,
    m.sender_name,
    m.text,
    m.timestamp AS message_timestamp,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.messages m
  WHERE 
    m.room_id = p_room_id
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_messages_semantic TO authenticated;

