/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_EMBEDDING_MODEL?: string // 'text-embedding-3-small' (default) or 'text-embedding-3-large'
  readonly VITE_OPENAI_EMBEDDING_DIMENSIONS?: string // Optional: override model default dimensions
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

