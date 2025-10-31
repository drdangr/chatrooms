# Multi-User LLM Chat MVP

Приложение для многопользовательского чата с интеграцией LLM (Large Language Model).

## Технологии

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **LLM**: OpenAI / Mistral API

## Начало работы

### Установка зависимостей

```bash
npm install
```

### Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Настройка базы данных

1. Откройте проект в Supabase Dashboard
2. Перейдите в SQL Editor
3. Выполните SQL скрипт из `supabase/migrations/001_initial_schema.sql`

### Запуск приложения

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`

## Структура проекта

```
chatrooms/
├── Docs/              # Документация проекта
├── src/
│   ├── lib/          # Утилиты и конфигурация
│   ├── components/   # React компоненты
│   └── App.tsx       # Главный компонент
├── supabase/
│   └── migrations/   # SQL миграции
└── package.json
```

## Деплой

См. подробную инструкцию по деплою на Vercel в `VERCEL_DEPLOY.md`

### Быстрый старт деплоя

1. Зайдите на [vercel.com](https://vercel.com) и подключите репозиторий
2. Добавьте переменные окружения:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OPENAI_API_KEY`
3. Нажмите "Deploy"

**Важно:** После деплоя настройте OAuth Redirect URLs в Supabase Dashboard, добавив домен Vercel.

## Разработка

См. подробный план разработки в `Docs/DevelopmentPlan.md`

