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
  return data.data[0].embedding
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
  return data.data.sort((a, b) => a.index - b.index).map(item => item.embedding)
}

