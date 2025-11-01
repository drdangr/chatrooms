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
    // 1. Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query)

    // 2. Call PostgreSQL function for vector similarity search
    const { data, error } = await supabase.rpc('search_messages_semantic', {
      p_room_id: roomId,
      p_query_embedding: queryEmbedding,
      p_limit: limit,
    })

    if (error) {
      console.error('Error in semantic search:', error)
      throw error
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
    const embedding = await generateEmbedding(messageText)

    // Store in database (Supabase automatically converts array to vector type)
    const { error } = await supabase
      .from('messages')
      .update({ embedding: embedding }) // Array is automatically converted to vector
      .eq('id', messageId)

    if (error) {
      console.error('Error storing embedding:', error)
      // Don't throw - embedding generation is optional, shouldn't break message creation
    } else {
      console.log('✅ Embedding generated and stored for message:', messageId)
    }
  } catch (error) {
    console.error('Error generating embedding for message:', error)
    // Don't throw - embedding generation is optional
  }
}

/**
 * Batch generate embeddings for existing messages that don't have them
 * Useful for backfilling embeddings for existing messages
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

