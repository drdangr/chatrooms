# Настройка Supabase для работы с локальной и Vercel версиями

## Проблема
При локальном запуске после аутентификации происходит редирект на Vercel вместо локального домена.

## Правильная настройка Supabase Dashboard

### 1. Site URL
**Рекомендуется:** Оставить на production URL (Vercel)
```
https://chatrooms-phi.vercel.app
```

**Примечание:** Site URL используется только как fallback, если `redirectTo` не указан в коде. Приложение явно указывает `redirectTo: ${window.location.origin}/auth/callback`, поэтому это значение должно использоваться.

### 2. Redirect URLs (Authentication → URL Configuration)

**Обязательно должны быть следующие URL:**

#### Для локальной разработки:
```
http://localhost:5173/auth/callback
http://localhost:5173/**
```

#### Для Vercel production:
```
https://chatrooms-phi.vercel.app/auth/callback
https://chatrooms-phi.vercel.app/**
```

#### Для preview deployments (опционально):
```
https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/auth/callback
https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/**
```

### Что удалить из Redirect URLs:
- ❌ `http://localhost:3000` - неправильный порт
- ❌ `https://chatrooms-phi.vercel.app/` - избыточный (без `/auth/callback`)

### Итоговый список Redirect URLs должен быть:
1. `http://localhost:5173/auth/callback`
2. `http://localhost:5173/**`
3. `https://chatrooms-phi.vercel.app/auth/callback`
4. `https://chatrooms-phi.vercel.app/**`
5. `https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/auth/callback` (если используете preview)
6. `https://chatrooms-o8xqqjqe8-drdangrs-projects.vercel.app/**` (если используете preview)

## Как работает редирект

В коде (`src/components/Auth.tsx`) используется:
```typescript
redirectTo: `${window.location.origin}/auth/callback`
```

Это означает:
- При локальном запуске: `http://localhost:5173/auth/callback`
- На Vercel: `https://chatrooms-phi.vercel.app/auth/callback`

Supabase проверяет, находится ли указанный URL в списке разрешенных Redirect URLs. Если да - использует его. Если нет - использует Site URL как fallback.

## Проверка работы

1. **Локально:**
   - Откройте консоль браузера (F12)
   - При клике на "Войти через Google" должны увидеть:
     ```
     Current origin: http://localhost:5173
     Redirecting to: http://localhost:5173/auth/callback
     ```
   - После аутентификации должны вернуться на `http://localhost:5173/auth/callback`

2. **На Vercel:**
   - Аналогично, но origin будет `https://chatrooms-phi.vercel.app`

## Критически важно: Site URL

**Проблема:** Если Site URL установлен на Vercel, а `redirectTo` не точно соответствует разрешенным Redirect URLs, Supabase может использовать Site URL вместо `redirectTo`.

**Решение 1 (Рекомендуется):** Измените Site URL на localhost для локальной разработки:
```
http://localhost:5173
```

**Решение 2:** Убедитесь, что `redirectTo` URL **ТОЧНО** соответствует одному из разрешенных URL (включая `/auth/callback`):
- ✅ `http://localhost:5173/auth/callback` - должен быть в списке
- ✅ `http://localhost:5173/**` - wildcard тоже должен быть

## Проверка в консоли браузера

После внесения изменений, при локальном запуске откройте консоль (F12) и нажмите "Войти через Google". Должны увидеть:

```
=== OAuth Sign In Debug ===
Current origin: http://localhost:5173
Redirect URL: http://localhost:5173/auth/callback
OAuth URL generated: https://...supabase.co/auth/v1/authorize?...
```

**⚠️ ВАЖНО:** Если в логах видите, что `OAuth URL` не содержит `localhost:5173/auth/callback`, значит Supabase игнорирует ваш `redirectTo` и использует Site URL.

## Если проблема сохраняется

1. **Измените Site URL на localhost:** В Supabase Dashboard → Settings → API → Site URL измените на `http://localhost:5173`
2. **Проверьте cookies:** Очистите cookies для localhost и Vercel домена
3. **Проверьте консоль:** Посмотрите, какие URL логируются (должен быть localhost, а не Vercel)
4. **Подождите 1-2 минуты:** Настройки Supabase могут применяться с задержкой
5. **Перезапустите dev сервер:** `npm run dev`
6. **Проверьте URL в Redirect URLs:** Убедитесь, что там есть ТОЧНО `http://localhost:5173/auth/callback` (без лишних слэшей)

## Альтернативное решение

Если постоянно переключать Site URL неудобно, можно использовать два разных Supabase проекта:
- Один для локальной разработки (Site URL = localhost)
- Один для production (Site URL = Vercel)

И переключать переменные окружения в `.env` файле.

