-- Включить Realtime для таблицы rooms
-- Выполните эту команду в SQL Editor в Supabase Dashboard

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Проверка (опционально)
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename = 'rooms';

-- Если запрос вернул строку с tablename = 'rooms', значит Realtime включен ✅

