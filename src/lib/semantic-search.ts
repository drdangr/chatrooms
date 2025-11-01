// Semantic search service using vector embeddings

import { supabase } from './supabase'
import { generateEmbedding, generateEmbeddingsBatch } from './embeddings'

export interface SearchResult {
  id: string
  room_id: string
  sender_id: string | null
  sender_name: string
  text: string
  message_timestamp: string // Renamed from timestamp to avoid PostgreSQL reserved word conflict
  created_at: string
  similarity: number // 0-1, higher = more similar
}

/**
 * Search messages semantically in a room
 * Returns top N most similar messages based on semantic meaning
 */
export async function searchMessagesSemantic(
  roomId: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    console.log(`🔍 Starting semantic search: query="${query}", roomId=${roomId}`)
    
    // 1. Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)
    console.log(`✅ Query embedding generated: ${queryEmbedding.length} dimensions`)

    // 2. Check how many messages have embeddings in this room
    const { count, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .not('embedding', 'is', null)

    if (countError) {
      console.warn('Could not count messages with embeddings:', countError)
    } else {
      console.log(`📊 Messages with embeddings in room: ${count || 0}`)
    }

    // 3. Call PostgreSQL function for vector similarity search
    // Supabase should accept array directly for vector type
    const { data, error } = await supabase.rpc('search_messages_semantic', {
      p_room_id: roomId,
      p_query_embedding: queryEmbedding, // Pass array directly
      p_limit: limit,
    })

    if (error) {
      console.error('❌ Error in semantic search:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Query embedding length:', queryEmbedding.length)
      
      // If error persists, check the error code
      if (error.code === '42883' || error.message?.includes('does not exist')) {
        console.error('⚠️ Function may not exist or have wrong signature')
      }
      
      throw error
    }

    console.log(`✅ Found ${data?.length || 0} results`)
    if (data && data.length > 0) {
      console.log('Top result similarity:', data[0].similarity)
    }

    return (data || []) as SearchResult[]
  } catch (error) {
    console.error('Error searching messages semantically:', error)
    throw error
  }
}

/**
 * Generate and store embedding for a message
 * Should be called after message is created
 */
export async function generateAndStoreEmbedding(
  messageId: string,
  messageText: string
): Promise<void> {
  try {
    // Skip empty or very short messages
    if (!messageText || messageText.trim().length < 10) {
      return
    }

    // Generate embedding
    console.log(`🔍 Generating embedding for message: ${messageId.substring(0, 8)}... (${messageText.substring(0, 50)}...)`)
    const embedding = await generateEmbedding(messageText)
    console.log(`✅ Embedding generated: ${embedding.length} dimensions`)

    // Store in database
    // Supabase with pgvector accepts JavaScript array directly, which gets converted to vector type
    const { data, error } = await supabase
      .from('messages')
      .update({ embedding: embedding }) // Pass JavaScript array - Supabase PostgREST converts it
      .eq('id', messageId)
      .select('id, embedding')

    if (error) {
      console.error('❌ Error storing embedding:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Embedding length:', embedding.length)
      console.error('First 5 values:', embedding.slice(0, 5))
      
      // Note: This should not fail if pgvector is properly configured
      // If it does fail, check:
      // 1. Is pgvector extension enabled?
      // 2. Is the embedding column type correct (check DB schema)?
    } else {
      console.log('✅ Embedding stored successfully for message:', messageId.substring(0, 8))
      
      // Verify embedding was actually stored
      if (data && data[0]) {
        const hasEmbedding = data[0].embedding !== null && data[0].embedding !== undefined
        console.log('✅ Verified: message has embedding:', hasEmbedding)
        if (!hasEmbedding) {
          console.warn('⚠️ WARNING: Embedding update returned success but embedding is null!')
        }
      }
    }
  } catch (error) {
    console.error('Error generating embedding for message:', error)
    // Don't throw - embedding generation is optional
  }
}

/**
 * Batch generate embeddings for existing messages that don't have them
 * Useful for backfilling embeddings for existing messages
 * 
 * @deprecated Use backfillRoomEmbeddings from backfill-all-embeddings.ts for better batch processing
 */
export async function backfillEmbeddingsForRoom(roomId: string): Promise<void> {
  try {
    // Get messages without embeddings
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, text')
      .eq('room_id', roomId)
      .is('embedding', null)
      .limit(100) // Process in batches to avoid rate limits

    if (fetchError) throw fetchError

    if (!messages || messages.length === 0) {
      console.log('No messages to backfill')
      return
    }

    console.log(`Backfilling embeddings for ${messages.length} messages`)

    // Generate embeddings in batch
    const texts = messages.map(m => m.text)
    const embeddings = await generateEmbeddingsBatch(texts)

    // Update messages with embeddings
    for (let i = 0; i < messages.length; i++) {
      const { error } = await supabase
        .from('messages')
        .update({ embedding: embeddings[i] }) // Array is automatically converted to vector
        .eq('id', messages[i].id)

      if (error) {
        console.error(`Error updating embedding for message ${messages[i].id}:`, error)
      }
    }

    console.log(`Successfully backfilled ${messages.length} embeddings`)
  } catch (error) {
    console.error('Error backfilling embeddings:', error)
    throw error
  }
}

