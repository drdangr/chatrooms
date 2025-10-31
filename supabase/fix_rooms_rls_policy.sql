-- Исправление RLS политики для обновления комнат
-- Проблема: возможно, пользователь не может обновить комнату, если он не создатель

-- Проверить текущие политики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'rooms'
AND cmd = 'UPDATE';

-- Если нужно разрешить всем авторизованным пользователям обновлять комнаты:
-- (раскомментируйте следующую строку)
-- DROP POLICY IF EXISTS "Users can update own rooms" ON public.rooms;
-- CREATE POLICY "Authenticated users can update rooms"
--   ON public.rooms FOR UPDATE
--   USING (auth.role() = 'authenticated');

-- Или если нужно оставить только для создателей, но проверить текущую политику:
-- Проверить, работает ли текущая политика:
SELECT 
    auth.uid() as current_user_id,
    r.id as room_id,
    r.created_by,
    CASE 
        WHEN auth.uid() = r.created_by THEN 'Can update'
        ELSE 'Cannot update'
    END as update_permission
FROM public.rooms r
WHERE r.id = 'your-room-id-here'; -- замените на реальный ID комнаты

