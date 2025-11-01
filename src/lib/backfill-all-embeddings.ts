// Utility to backfill embeddings for all messages in all rooms
// This can be called from browser console or added as an admin feature

import { supabase } from './supabase'
import { generateEmbeddingsBatch } from './embeddings'

/**
 * Backfill embeddings for all messages in all rooms
 * Processes in batches to avoid rate limits
 */
export async function backfillAllEmbeddings(): Promise<void> {
  try {
    console.log('🚀 Starting backfill of all embeddings...')

    // Get all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, title')

    if (roomsError) throw roomsError

    if (!rooms || rooms.length === 0) {
      console.log('No rooms found')
      return
    }

    console.log(`Found ${rooms.length} rooms`)

    let totalProcessed = 0
    let totalErrors = 0

    // Process each room
    for (const room of rooms) {
      console.log(`\n📁 Processing room: ${room.title} (${room.id.substring(0, 8)}...)`)

      // Get messages without embeddings in this room
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id, text, sender_name')
        .eq('room_id', room.id)
        .is('embedding', null)
        .limit(100) // Process in batches

      if (fetchError) {
        console.error(`Error fetching messages for room ${room.id}:`, fetchError)
        totalErrors++
        continue
      }

      if (!messages || messages.length === 0) {
        console.log('  ✅ No messages without embeddings in this room')
        continue
      }

      console.log(`  📝 Found ${messages.length} messages without embeddings`)

      // Process in batches of 50 (OpenAI batch limit)
      const batchSize = 50
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        console.log(`  🔄 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} messages)...`)

        try {
          // Generate embeddings in batch
          const texts = batch.map(m => m.text)
          const embeddings = await generateEmbeddingsBatch(texts)

          // Update messages with embeddings
          for (let j = 0; j < batch.length; j++) {
            const { error } = await supabase
              .from('messages')
              .update({ embedding: embeddings[j] })
              .eq('id', batch[j].id)

            if (error) {
              console.error(`    ❌ Error updating message ${batch[j].id}:`, error)
              totalErrors++
            } else {
              totalProcessed++
              if ((j + 1) % 10 === 0) {
                console.log(`    ✅ Updated ${j + 1}/${batch.length} in this batch`)
              }
            }
          }

          console.log(`    ✅ Batch complete: ${batch.length} messages processed`)
          
          // Small delay between batches to avoid rate limits
          if (i + batchSize < messages.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (batchError) {
          console.error(`    ❌ Error processing batch:`, batchError)
          totalErrors += batch.length
        }
      }

      console.log(`  ✅ Room complete: ${messages.length} messages processed`)
      
      // Delay between rooms
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log(`\n🎉 Backfill complete!`)
    console.log(`   ✅ Processed: ${totalProcessed} messages`)
    console.log(`   ❌ Errors: ${totalErrors} messages`)
  } catch (error) {
    console.error('❌ Error in backfill:', error)
    throw error
  }
}

/**
 * Backfill embeddings for a specific room
 */
export async function backfillRoomEmbeddings(roomId: string): Promise<void> {
  try {
    console.log(`🚀 Starting backfill for room: ${roomId}`)

    // Get messages without embeddings
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, text, sender_name')
      .eq('room_id', roomId)
      .is('embedding', null)

    if (fetchError) throw fetchError

    if (!messages || messages.length === 0) {
      console.log('✅ No messages without embeddings')
      return
    }

    console.log(`📝 Found ${messages.length} messages without embeddings`)

    // Process in batches
    const batchSize = 50
    let processed = 0

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}...`)

      const texts = batch.map(m => m.text)
      const embeddings = await generateEmbeddingsBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const { error } = await supabase
          .from('messages')
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id)

        if (error) {
          console.error(`❌ Error updating ${batch[j].id}:`, error)
        } else {
          processed++
        }
      }

      console.log(`✅ Processed ${Math.min(i + batchSize, messages.length)}/${messages.length}`)
      
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`✅ Backfill complete: ${processed}/${messages.length} messages processed`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

