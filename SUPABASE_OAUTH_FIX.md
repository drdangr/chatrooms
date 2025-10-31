# Исправление проблемы с OAuth редиректом на localhost

## Проблема
После авторизации через Google OAuth Supabase перенаправляет на `localhost` вместо Vercel URL.

## Решение

### Шаг 1: Обновить Site URL в Supabase

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Найдите секцию **Project URL** (или **Site URL**)
5. Измените URL на ваш Vercel production URL:
   ```
   https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app
   ```
6. Сохраните изменения

### Шаг 2: Добавить Redirect URLs

1. В Supabase Dashboard перейдите в **Authentication** → **URL Configuration**
2. В разделе **Redirect URLs** добавьте следующие URL (по одному, нажимая Enter после каждого):
   ```
   https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/auth/callback
   https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/**
   ```
3. **Важно:** Также оставьте localhost URL для локальной разработки:
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173/**
   ```
4. Сохраните изменения

### Шаг 3: Проверить Google Cloud Console

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите ваш проект
3. Перейдите в **APIs & Services** → **Credentials**
4. Найдите ваш OAuth 2.0 Client ID
5. В **Authorized redirect URIs** должно быть:
   ```
   https://okjpzxdsjlpjfifdykjc.supabase.co/auth/v1/callback
   ```
   (Этот URL должен уже быть там - он не меняется)
6. Сохраните, если вносили изменения

### Шаг 4: Проверка

После внесения изменений:

1. Подождите 1-2 минуты (настройки могут применяться с задержкой)
2. Очистите cookies и кеш браузера для вашего Vercel домена
3. Попробуйте войти снова через Google OAuth
4. Должен произойти редирект на `https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/auth/callback`

## Если проблема сохраняется

1. Проверьте консоль браузера на наличие ошибок
2. Убедитесь, что в коде используется правильный URL:
   - В `Auth.tsx` строка 39: `redirectTo: ${window.location.origin}/auth/callback`
   - Это автоматически использует текущий домен (Vercel или localhost)

3. Проверьте, что переменные окружения в Vercel правильные:
   - `VITE_SUPABASE_URL` должен быть вашим Supabase проектом
   - `VITE_SUPABASE_ANON_KEY` должен быть правильным ключом

4. Если используется кастомный домен:
   - Добавьте кастомный домен в Redirect URLs
   - Обновите Site URL на кастомный домен

