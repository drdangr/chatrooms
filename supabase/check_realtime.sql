-- Проверка включения Realtime для таблиц

-- Проверить, какие таблицы уже добавлены в Realtime публикацию
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Если таблицы rooms нет в списке выше, выполните:
-- ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Если таблицы messages нет в списке выше, выполните:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

