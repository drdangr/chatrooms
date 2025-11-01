-- Add vector embeddings support for semantic search
-- This requires pgvector extension (install via: CREATE EXTENSION IF NOT EXISTS vector;)

-- Enable pgvector extension (if not already enabled)
-- Note: You may need to enable this manually in Supabase Dashboard -> Database -> Extensions
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS embedding vector(1536); -- OpenAI text-embedding-3-small uses 1536 dimensions

-- Create index for vector similarity search (IVFFlat index for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON public.messages 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100); -- Adjust 'lists' based on your data size (rule of thumb: sqrt(total_rows))

-- Function to generate embedding for a message
-- This will be called from application code when creating messages
CREATE OR REPLACE FUNCTION public.update_message_embedding(
  p_message_id UUID,
  p_text TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function is a placeholder
  -- Actual embedding generation will happen in the application layer
  -- using OpenAI Embeddings API, then update this field
  -- We can't call external APIs directly from PostgreSQL
  
  -- The application should:
  -- 1. Call OpenAI Embeddings API: POST https://api.openai.com/v1/embeddings
  -- 2. Get embedding vector (1536 dimensions)
  -- 3. Update messages.embedding with the vector
  
  -- Example update (will be done from app):
  -- UPDATE messages SET embedding = '[0.1, 0.2, ...]'::vector WHERE id = p_message_id;
END;
$$;

-- Add index for room_id + embedding search (for faster filtering)
CREATE INDEX IF NOT EXISTS idx_messages_room_id_embedding ON public.messages(room_id) 
WHERE embedding IS NOT NULL;

-- Function for semantic search in a room
CREATE OR REPLACE FUNCTION public.search_messages_semantic(
  p_room_id UUID,
  p_query_embedding vector(1536),
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
    1 - (m.embedding <=> p_query_embedding) AS similarity -- Cosine distance -> similarity
  FROM public.messages m
  WHERE m.room_id = p_room_id
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query_embedding -- Cosine distance (lower = more similar)
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_messages_semantic TO authenticated;

