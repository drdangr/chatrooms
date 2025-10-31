# Настройка Supabase Realtime

## Проблема: Real-time синхронизация не работает

Если сообщения появляются только после обновления браузера, возможно, Realtime не включен для таблиц в Supabase.

## Решение: Включить Realtime для таблиц

1. Откройте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)

2. Перейдите в раздел **Database** → **Replication**

3. Найдите таблицы:
   - `messages`
   - `rooms`

4. Для каждой таблицы:
   - Переключите тумблер в положение **ON** (включено)
   - Это позволит Supabase отслеживать изменения в этих таблицах и отправлять события через Realtime

5. Убедитесь, что для обеих таблиц Realtime включен:
   - ✅ `messages` - включено
   - ✅ `rooms` - включено

## Альтернативный способ (через SQL)

Если у вас нет доступа к разделу Replication, можно включить через SQL Editor:

```sql
-- Включить Realtime для таблицы messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Включить Realtime для таблицы rooms
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
```

## Проверка включения Realtime

Чтобы проверить, какие таблицы уже включены в Realtime, выполните в SQL Editor:

```sql
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

Должны быть в списке:
- ✅ `messages`
- ✅ `rooms`

## Если rooms не включен

Выполните в SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
```

Или используйте готовый файл: `supabase/enable_realtime_rooms.sql`

## Проверка работы

После включения Realtime для rooms:
1. Откройте комнату в двух разных браузерах/вкладках
2. В первой вкладке измените системный промпт и сохраните
3. Во второй вкладке в консоли должно появиться:
   ```
   📢 Room updated via Realtime: ...
   ```
4. Настройки должны обновиться автоматически во второй вкладке

## Отладка

Если Realtime все еще не работает, проверьте консоль браузера:
- Должны быть сообщения "Successfully subscribed to messages"
- Должны быть сообщения "Room updates subscription status: SUBSCRIBED"
- Не должно быть ошибок типа "CHANNEL_ERROR"

