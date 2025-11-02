-- Создание тестовой комнаты для проверки Assistants API
-- ВНИМАНИЕ: Этот скрипт создает тестовую комнату с мокап-данными файлов
-- Реальная загрузка файлов в OpenAI будет выполнена через API

-- Создаем тестовую комнату
-- Используем текущего пользователя из auth.users (или можно указать конкретный UUID)
INSERT INTO public.rooms (id, title, system_prompt, model, created_by, is_test_room)
SELECT 
  gen_random_uuid(),
  'Test Assistants API',
  'Ты - полезный ассистент, который помогает работать с файлами. Ты умеешь анализировать документы, изображения и данные. Отвечай на русском языке.',
  'gpt-4o',
  id,
  TRUE
FROM auth.users
WHERE email = 'drdangr@gmail.com'  -- Замените на ваш email или используйте первый доступный
LIMIT 1
ON CONFLICT DO NOTHING;

-- Получаем ID созданной комнаты для дальнейших операций
DO $$
DECLARE
  test_room_id UUID;
  test_user_id UUID;
BEGIN
  -- Получаем ID пользователя и комнаты
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'drdangr@gmail.com'
  LIMIT 1;
  
  SELECT id INTO test_room_id
  FROM public.rooms
  WHERE is_test_room = TRUE
  AND created_by = test_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Если комната не найдена, создаем новую
  IF test_room_id IS NULL THEN
    INSERT INTO public.rooms (title, system_prompt, model, created_by, is_test_room)
    VALUES (
      'Test Assistants API',
      'Ты - полезный ассистент, который помогает работать с файлами. Ты умеешь анализировать документы, изображения и данные. Отвечай на русском языке.',
      'gpt-4o',
      test_user_id,
      TRUE
    )
    RETURNING id INTO test_room_id;
  END IF;
  
  -- Создаем мокап-данные файлов (без реальной загрузки в OpenAI на этом этапе)
  -- openai_file_id будет заполнен позже через API
  
  -- Текстовый файл с описанием проекта
  INSERT INTO public.files (room_id, uploaded_by, filename, file_url, file_type, size)
  VALUES (
    test_room_id,
    test_user_id,
    'project_description.txt',
    'mock://project_description.txt',
    'text/plain',
    1234
  )
  ON CONFLICT DO NOTHING;
  
  -- PDF файл (симуляция)
  INSERT INTO public.files (room_id, uploaded_by, filename, file_url, file_type, size)
  VALUES (
    test_room_id,
    test_user_id,
    'technical_spec.pdf',
    'mock://technical_spec.pdf',
    'application/pdf',
    56789
  )
  ON CONFLICT DO NOTHING;
  
  -- Изображение (симуляция)
  INSERT INTO public.files (room_id, uploaded_by, filename, file_url, file_type, size)
  VALUES (
    test_room_id,
    test_user_id,
    'diagram.png',
    'mock://diagram.png',
    'image/png',
    45678
  )
  ON CONFLICT DO NOTHING;
  
  -- CSV файл с данными
  INSERT INTO public.files (room_id, uploaded_by, filename, file_url, file_type, size)
  VALUES (
    test_room_id,
    test_user_id,
    'data.csv',
    'mock://data.csv',
    'text/csv',
    2345
  )
  ON CONFLICT DO NOTHING;
  
  -- Добавляем несколько тестовых сообщений в комнату
  INSERT INTO public.messages (room_id, sender_id, sender_name, text)
  VALUES
    (
      test_room_id,
      test_user_id,
      'Test User',
      'Это тестовая комната для проверки Assistants API. Здесь будут тестироваться возможности работы с файлами.'
    ),
    (
      test_room_id,
      NULL,
      'LLM',
      'Привет! Я готов помочь вам с анализом файлов. Загрузите файлы и задайте вопросы.'
    )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Тестовая комната создана с ID: %', test_room_id;
END $$;

