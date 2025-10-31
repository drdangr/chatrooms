# 🚀 Быстрый деплой на Vercel

## Шаг 1: Подготовка проекта
✅ Проект уже собран и готов (`npm run build` успешно выполнен)

## Шаг 2: Создание проекта в Vercel

### Вариант A: Через веб-интерфейс
1. Зайдите на https://vercel.com
2. Нажмите "Add New Project"
3. Подключите ваш GitHub репозиторий
4. Vercel автоматически определит настройки для Vite

### Вариант B: Через CLI
```bash
npm i -g vercel
vercel login
vercel
```

## Шаг 3: Переменные окружения (ОБЯЗАТЕЛЬНО!)

В настройках проекта Vercel → Environment Variables добавьте:

| Переменная | Пример значения |
|-----------|-----------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_OPENAI_API_KEY` | `sk-proj-xxxxx...` |

**Важно:** Выберите все окружения: Production, Preview, Development

## Шаг 4: Настройка OAuth в Supabase

После получения URL от Vercel (например: `https://your-project.vercel.app`):

1. Зайдите в Supabase Dashboard
2. Authentication → URL Configuration
3. Добавьте в Redirect URLs:
   ```
   https://your-project.vercel.app/auth/callback
   https://your-project.vercel.app/**
   ```

## Шаг 5: Деплой

Если использовали веб-интерфейс - просто нажмите "Deploy"
Если использовали CLI:
```bash
vercel --prod
```

## ✅ Проверка после деплоя

- [ ] Аутентификация работает (Google OAuth)
- [ ] Создание комнат работает
- [ ] Отправка сообщений работает
- [ ] LLM отвечает на сообщения
- [ ] Настройки комнаты (промпт, модель) работают
- [ ] Real-time синхронизация работает (откройте в двух браузерах)

---

📖 Подробная инструкция: `VERCEL_DEPLOY.md`

