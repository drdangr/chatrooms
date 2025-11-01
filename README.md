# Multi-User LLM Chat MVP

Приложение для многопользовательского чата с интеграцией LLM (Large Language Model) и семантическим поиском по истории сообщений.

## Возможности

- 💬 **Многопользовательские чаты** - создавайте комнаты и общайтесь с командой
- 🤖 **Интеграция LLM** - получайте ответы от AI ассистента с настраиваемым промптом
- 🔍 **Семантический поиск** - ищите сообщения по смыслу, а не по точному совпадению слов
- 🔐 **Ролевая модель доступа** - viewer, writer, admin, owner роли для управления доступом
- ⚡ **Real-time синхронизация** - изменения видны всем участникам в реальном времени
- 🇷🇺 **Поддержка русского языка** - оптимизировано для русскоязычного контента

## Технологии

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **LLM**: OpenAI API (GPT-4, GPT-3.5)
- **Embeddings**: OpenAI text-embedding-3-large (для семантического поиска)
- **Vector Database**: PostgreSQL с pgvector extension

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
VITE_OPENAI_API_KEY=your_openai_api_key

# Опционально: для лучшего качества поиска на русском языке
VITE_OPENAI_EMBEDDING_MODEL=text-embedding-3-large
VITE_OPENAI_EMBEDDING_DIMENSIONS=1024
```

### Настройка базы данных

1. Откройте проект в Supabase Dashboard
2. Перейдите в SQL Editor
3. Примените миграции по порядку:
   - `001_initial_schema.sql` - базовая схема
   - `002_allow_all_users_update_rooms.sql` - разрешения для обновления комнат
   - `003_add_room_roles.sql` - ролевая модель доступа
   - `004_allow_view_all_users.sql` - видимость всех пользователей
   - `005_fix_room_roles_rls_recursion.sql` - исправление рекурсии в RLS
   - `006_grant_owner_to_drdangr.sql` - назначение owner прав (опционально)
   - `007_allow_owners_delete_rooms.sql` - разрешения на удаление комнат
   - `008_update_user_trigger_avatar.sql` - сохранение аватаров из OAuth
   - `009_allow_roles_delete_messages.sql` - разрешения на удаление сообщений
   - `010_add_message_embeddings.sql` - поддержка векторных эмбеддингов
   - `011_fix_embedding_update_rls.sql` - исправление RLS для эмбеддингов
   - `012_switch_to_large_embeddings.sql` - переключение на large модель (для русского языка)

4. Включите Realtime для таблиц `messages` и `rooms` (см. `supabase/REALTIME_SETUP.md`)
5. Установите `REPLICA IDENTITY FULL` для таблицы `rooms` (см. `supabase/check_replica_identity.sql`)

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
   - `VITE_OPENAI_EMBEDDING_MODEL` (опционально, для русского языка: `text-embedding-3-large`)
   - `VITE_OPENAI_EMBEDDING_DIMENSIONS` (опционально, для русского языка: `1024`)
3. Нажмите "Deploy"

**Важно:** 
- После деплоя настройте OAuth Redirect URLs в Supabase Dashboard, добавив домен Vercel
- После добавления переменных окружения **обязательно пересоберите проект** (Redeploy)

## Основные функции

### Семантический поиск
- Поиск сообщений по смыслу, а не по точному совпадению слов
- Использует векторные эмбеддинги OpenAI (text-embedding-3-large)
- Оптимизировано для русского языка
- Показывает показатель сходства для каждого результата

### Ролевая модель доступа
- **viewer** - только просмотр
- **writer** - отправка и удаление сообщений
- **admin** - управление промптом и переименование комнат
- **owner** - полный доступ, включая удаление комнат

### Real-time синхронизация
- Изменения в сообщениях видны всем участникам мгновенно
- Обновления настроек комнаты синхронизируются в реальном времени
- Изменения ролей применяются моментально

## Документация

- **План разработки**: `Docs/DevelopmentPlan.md`
- **Настройка эмбеддингов для русского языка**: `Docs/EMBEDDINGS_RUSSIAN.md`
- **Деплой на Vercel**: `VERCEL_DEPLOY.md`
- **Настройка OAuth**: `supabase/OAUTH_SETUP.md`
- **Настройка Realtime**: `supabase/REALTIME_SETUP.md`

