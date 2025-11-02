-- Проверка файлов в тестовой комнате
-- Этот скрипт показывает все файлы в тестовых комнатах и их статус

-- Находим тестовые комнаты
SELECT 
  r.id as room_id,
  r.title as room_title,
  r.is_test_room,
  COUNT(f.id) as total_files,
  COUNT(CASE WHEN f.file_url LIKE 'mock://%' THEN 1 END) as mock_files,
  COUNT(CASE WHEN f.openai_file_id IS NOT NULL THEN 1 END) as files_with_openai_id,
  COUNT(CASE WHEN f.file_url NOT LIKE 'mock://%' AND f.openai_file_id IS NOT NULL THEN 1 END) as real_files_with_openai_id
FROM public.rooms r
LEFT JOIN public.files f ON f.room_id = r.id
WHERE r.is_test_room = TRUE
GROUP BY r.id, r.title, r.is_test_room
ORDER BY r.created_at DESC;

-- Детальная информация о файлах в тестовых комнатах
SELECT 
  r.title as room_title,
  f.id as file_id,
  f.filename,
  f.file_url,
  f.file_type,
  CASE 
    WHEN f.file_url LIKE 'mock://%' THEN 'Мокап файл'
    ELSE 'Реальный файл'
  END as file_type_category,
  f.openai_file_id,
  f.created_at,
  CASE 
    WHEN f.file_url LIKE 'mock://%' AND f.openai_file_id IS NOT NULL THEN '⚠️ Мокап файл с OpenAI ID!'
    WHEN f.file_url LIKE 'mock://%' THEN '✅ Мокап файл (OK)'
    WHEN f.openai_file_id IS NOT NULL THEN '✅ Реальный файл с OpenAI ID'
    ELSE '⚠️ Реальный файл без OpenAI ID'
  END as status
FROM public.rooms r
JOIN public.files f ON f.room_id = r.id
WHERE r.is_test_room = TRUE
ORDER BY r.created_at DESC, f.created_at DESC;

-- Файлы с изображениями (которые могут использоваться в Vision API)
SELECT 
  r.title as room_title,
  f.filename,
  f.file_url,
  f.file_type,
  CASE 
    WHEN f.file_url LIKE 'mock://%' THEN 'МОКАП'
    ELSE 'РЕАЛЬНЫЙ'
  END as file_category,
  f.openai_file_id,
  CASE 
    WHEN f.file_url LIKE 'mock://%' THEN '❌ НЕ ДОЛЖЕН ИСПОЛЬЗОВАТЬСЯ'
    WHEN f.openai_file_id IS NULL THEN '❌ НЕТ OpenAI ID'
    WHEN f.file_type LIKE 'image/%' THEN '✅ МОЖЕТ ИСПОЛЬЗОВАТЬСЯ'
    ELSE '⚠️ ПРОВЕРИТЬ'
  END as can_be_used_in_vision_api
FROM public.rooms r
JOIN public.files f ON f.room_id = r.id
WHERE r.is_test_room = TRUE
  AND (f.file_type LIKE 'image/%' OR f.filename LIKE '%.png' OR f.filename LIKE '%.jpg' OR f.filename LIKE '%.jpeg' OR f.filename LIKE '%.gif' OR f.filename LIKE '%.webp')
ORDER BY f.file_url LIKE 'mock://%' DESC, f.created_at DESC;

