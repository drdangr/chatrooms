-- Добавляем поддержку OpenAI Assistants API

-- Таблица для связи комнат с OpenAI Assistants и Threads
CREATE TABLE IF NOT EXISTS public.room_assistants (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE PRIMARY KEY,
  assistant_id TEXT NOT NULL,  -- OpenAI Assistant ID
  thread_id TEXT NOT NULL,      -- OpenAI Thread ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавляем поле для хранения OpenAI File ID в таблице files
ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS openai_file_id TEXT;

-- Добавляем поле для маркировки тестовых комнат (опционально)
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS is_test_room BOOLEAN DEFAULT FALSE;

-- Индекс для быстрого поиска файлов с openai_file_id
CREATE INDEX IF NOT EXISTS idx_files_openai_file_id 
ON public.files(openai_file_id) 
WHERE openai_file_id IS NOT NULL;

-- Индекс для поиска тестовых комнат
CREATE INDEX IF NOT EXISTS idx_rooms_is_test_room 
ON public.rooms(is_test_room) 
WHERE is_test_room = TRUE;

-- RLS политики для room_assistants
ALTER TABLE public.room_assistants ENABLE ROW LEVEL SECURITY;

-- Аутентифицированные пользователи могут просматривать assistants для комнат, к которым у них есть доступ
CREATE POLICY "Authenticated users can view room assistants"
  ON public.room_assistants FOR SELECT
  USING (auth.role() = 'authenticated');

-- Аутентифицированные пользователи могут создавать/обновлять assistants для комнат
CREATE POLICY "Authenticated users can manage room assistants"
  ON public.room_assistants FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

