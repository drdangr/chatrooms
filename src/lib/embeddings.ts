// Service for generating embeddings using OpenAI API
// Used for semantic search functionality

// Model selection: 'text-embedding-3-small' (1536 dim, cheaper) or 'text-embedding-3-large' (3072 dim, better quality, especially for non-English)
// For Russian/multilingual content, 'large' may provide better semantic understanding
const OPENAI_EMBEDDING_MODEL = import.meta.env.VITE_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

// For text-embedding-3-small: 512, 1024, 1536 (default)
// For text-embedding-3-large: 256, 1024, 3072 (default)
// Lower dimensions = cheaper but slightly less accurate
const EMBEDDING_DIMENSIONS = import.meta.env.VITE_OPENAI_EMBEDDING_DIMENSIONS 
  ? parseInt(import.meta.env.VITE_OPENAI_EMBEDDING_DIMENSIONS) 
  : undefined // Use model default

// Log configuration on module load (only once)
if (typeof window !== 'undefined') {
  console.log('🔧 Embedding configuration:', {
    model: OPENAI_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS || 'default',
    envModel: import.meta.env.VITE_OPENAI_EMBEDDING_MODEL || 'not set',
    envDimensions: import.meta.env.VITE_OPENAI_EMBEDDING_DIMENSIONS || 'not set'
  })
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
}

/**
 * Generate embedding for a text using OpenAI Embeddings API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      ...(EMBEDDING_DIMENSIONS && { dimensions: EMBEDDING_DIMENSIONS }),
      // Optional: specify encoding_format if needed (default is float)
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data: EmbeddingResponse = await response.json()
  const embedding = data.data[0].embedding
  
  // Verify embedding dimensions match expected
  if (EMBEDDING_DIMENSIONS && embedding.length !== EMBEDDING_DIMENSIONS) {
    console.warn(`⚠️ Warning: Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`)
  }
  
  console.log(`✅ Generated embedding: ${embedding.length} dimensions (model: ${OPENAI_EMBEDDING_MODEL})`)
  
  return embedding
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // OpenAI supports batch embeddings
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
      ...(EMBEDDING_DIMENSIONS && { dimensions: EMBEDDING_DIMENSIONS }),
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data: EmbeddingResponse = await response.json()
  // Sort by index to ensure order matches input
  const embeddings = data.data.sort((a, b) => a.index - b.index).map(item => item.embedding)
  
  // Verify embedding dimensions match expected
  if (EMBEDDING_DIMENSIONS && embeddings.length > 0 && embeddings[0].length !== EMBEDDING_DIMENSIONS) {
    console.warn(`⚠️ Warning: Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embeddings[0].length}`)
  }
  
  if (embeddings.length > 0) {
    console.log(`✅ Generated ${embeddings.length} embeddings: ${embeddings[0].length} dimensions each (model: ${OPENAI_EMBEDDING_MODEL})`)
  }
  
  return embeddings
}

