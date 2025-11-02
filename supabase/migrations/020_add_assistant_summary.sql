-- Добавляем поля для хранения суммарного контекста ассистента

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS assistant_summary TEXT;

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS assistant_summary_updated_at TIMESTAMP WITH TIME ZONE;

-- Индекс по времени обновления может пригодиться для анализа
CREATE INDEX IF NOT EXISTS idx_rooms_assistant_summary_updated_at
  ON public.rooms(assistant_summary_updated_at DESC);

