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

## Проверка

После включения Realtime:
1. Откройте приложение в двух разных браузерах/вкладках
2. Отправьте сообщение в одной вкладке
3. Сообщение должно появиться во второй вкладке без обновления страницы

## Отладка

Если Realtime все еще не работает, проверьте консоль браузера:
- Должны быть сообщения "Successfully subscribed to messages"
- Не должно быть ошибок типа "CHANNEL_ERROR"

