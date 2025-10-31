-- Проверка и настройка REPLICA IDENTITY для таблицы rooms
-- Это нужно для корректной работы Realtime UPDATE событий

-- Проверить текущую настройку
SELECT 
    schemaname,
    tablename,
    relreplident
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' 
AND tablename = 'rooms';

-- Если relreplident = 'n' (none) или 'd' (default), нужно установить 'f' (full)
-- Это гарантирует, что Realtime будет отправлять полные данные при UPDATE

-- Установить REPLICA IDENTITY FULL для таблицы rooms
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- Проверка после установки
SELECT 
    schemaname,
    tablename,
    CASE relreplident
        WHEN 'd' THEN 'default'
        WHEN 'n' THEN 'nothing'
        WHEN 'f' THEN 'full'
        WHEN 'i' THEN 'index'
    END as replica_identity
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' 
AND tablename = 'rooms';

-- Должно быть: replica_identity = 'full'

