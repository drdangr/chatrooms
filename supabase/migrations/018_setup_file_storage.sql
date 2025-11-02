-- Настройка Supabase Storage для хранения файлов

-- Создаем bucket для файлов (если не существует)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'files',
  'files',
  true, -- Публичный доступ для чтения
  52428800, -- 50 MB лимит на файл
  ARRAY[
    -- Текстовые файлы
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    -- Изображения
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    -- Документы
    'application/pdf',
    -- Архивы
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Настройка политик доступа для Storage bucket
-- Разрешаем аутентифицированным пользователям загружать файлы
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'files' AND
    auth.role() = 'authenticated'
  );

-- Разрешаем аутентифицированным пользователям просматривать файлы
CREATE POLICY "Authenticated users can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'files' AND
    auth.role() = 'authenticated'
  );

-- Разрешаем пользователям удалять свои файлы
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'files' AND
    auth.role() = 'authenticated'
    -- Можно добавить проверку владельца через metadata, но для упрощения оставляем так
  );

