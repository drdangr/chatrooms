-- Очистка мокап файлов с openai_file_id
-- Этот скрипт очищает openai_file_id у мокап файлов, чтобы они не использовались

-- Сначала посмотрим, что будет удалено
SELECT 
  f.id,
  f.filename,
  f.file_url,
  f.openai_file_id,
  'Будет очищен openai_file_id' as action
FROM public.files f
JOIN public.rooms r ON r.id = f.room_id
WHERE f.file_url LIKE 'mock://%'
  AND f.openai_file_id IS NOT NULL;

-- Очищаем openai_file_id у мокап файлов
UPDATE public.files
SET openai_file_id = NULL
WHERE file_url LIKE 'mock://%'
  AND openai_file_id IS NOT NULL;

-- Проверяем результат
SELECT 
  COUNT(*) as mock_files_with_openai_id
FROM public.files
WHERE file_url LIKE 'mock://%'
  AND openai_file_id IS NOT NULL;
-- Должно вернуть 0

