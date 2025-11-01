-- Diagnostic queries to check embedding status

-- 1. Check if messages have embeddings
SELECT 
  COUNT(*) as total_messages,
  COUNT(embedding) as messages_with_embeddings,
  COUNT(*) - COUNT(embedding) as messages_without_embeddings
FROM messages;

-- 2. Check messages in a specific room (replace YOUR_ROOM_ID)
-- SELECT 
--   id,
--   sender_name,
--   LEFT(text, 100) as text_preview,
--   LENGTH(text) as text_length,
--   embedding IS NOT NULL as has_embedding,
--   created_at
-- FROM messages 
-- WHERE room_id = 'YOUR_ROOM_ID'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- 3. Check if pgvector extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 4. Check column type
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'embedding';

-- 5. Test embedding insertion manually (replace with actual values)
-- UPDATE messages 
-- SET embedding = '[0.1,0.2,0.3]'::vector(1536)
-- WHERE id = 'YOUR_MESSAGE_ID'
-- RETURNING id, embedding IS NOT NULL as has_embedding;

