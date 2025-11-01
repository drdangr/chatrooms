# Инструкция по деплою на Vercel

## Подготовка

1. Убедитесь, что проект собран локально:
```bash
npm run build
```

2. Проверьте, что все зависимости установлены:
```bash
npm install
```

## Деплой через Vercel Dashboard

### Шаг 1: Создание проекта в Vercel

1. Зайдите на [vercel.com](https://vercel.com) и авторизуйтесь (через GitHub)
2. Нажмите "Add New Project"
3. Подключите репозиторий GitHub (или импортируйте проект)
4. Vercel автоматически определит Vite проект

### Шаг 2: Настройка переменных окружения

**ОБЯЗАТЕЛЬНО** добавьте следующие переменные окружения в настройках проекта Vercel:

- `VITE_SUPABASE_URL` - URL вашего Supabase проекта
- `VITE_SUPABASE_ANON_KEY` - Anon key из Supabase Dashboard
- `VITE_OPENAI_API_KEY` - API ключ OpenAI
- `VITE_OPENAI_EMBEDDING_MODEL` - Модель для эмбеддингов (опционально, по умолчанию: `text-embedding-3-small`)
- `VITE_OPENAI_EMBEDDING_DIMENSIONS` - Размерность эмбеддингов (опционально, используется для уменьшения размерности)

**Для русскоязычного контента рекомендуется:**
- `VITE_OPENAI_EMBEDDING_MODEL` = `text-embedding-3-large`
- `VITE_OPENAI_EMBEDDING_DIMENSIONS` = `1024`

**Как добавить:**
1. В настройках проекта Vercel перейдите в "Environment Variables"
2. Добавьте каждую переменную:
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://your-project.supabase.co`
   - Environment: Production, Preview, Development (выберите все три)
3. Повторите для всех трех переменных

### Шаг 3: Настройка Build Settings

Vercel автоматически определит настройки для Vite, но убедитесь:

- **Build Command:** `npm run build` (должен быть автоматически)
- **Output Directory:** `dist` (должен быть автоматически)
- **Install Command:** `npm install` (должен быть автоматически)

### Шаг 4: Деплой

1. Нажмите "Deploy"
2. Дождитесь завершения сборки
3. Получите публичный URL

## Деплой через Vercel CLI

### Установка CLI

```bash
npm i -g vercel
```

### Авторизация

```bash
vercel login
```

### Деплой

```bash
# Первый деплой (указать переменные окружения)
vercel

# Последующие деплои
vercel --prod
```

### Установка переменных окружения через CLI

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_OPENAI_API_KEY
vercel env add VITE_OPENAI_EMBEDDING_MODEL
vercel env add VITE_OPENAI_EMBEDDING_DIMENSIONS
```

**Важно:** После добавления переменных окружения **обязательно пересоберите проект**:
1. Через Dashboard: Settings → Environment Variables → Redeploy
2. Через CLI: сделайте новый commit и push, или используйте `vercel --prod`

## Проверка после деплоя

1. ✅ Проверьте работу аутентификации (Google OAuth)
2. ✅ Проверьте создание комнат
3. ✅ Проверьте отправку сообщений
4. ✅ Проверьте работу LLM (ответы ассистента)
5. ✅ Проверьте настройки комнаты (промпт, модель)
6. ✅ Проверьте real-time синхронизацию (откройте в двух браузерах)

## Важные замечания

- **Переменные окружения с префиксом `VITE_`** доступны в клиентском коде. Не храните секретные ключи с этим префиксом!
- Для production используйте только `VITE_SUPABASE_ANON_KEY` (публичный ключ), не используйте service_role key
- OpenAI API ключ будет виден в клиентском коде, это нормально для данного MVP
- Убедитесь, что в Supabase Dashboard настроены правильные URL для OAuth redirect (добавьте домен Vercel)

## Настройка OAuth Redirect URL в Supabase

После получения URL от Vercel:

1. Зайдите в Supabase Dashboard → Authentication → URL Configuration
2. Добавьте в "Redirect URLs":
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app/**` (для preview деплоев)

## Troubleshooting

### Ошибка "Module not found"
- Проверьте, что все зависимости в `package.json`
- Запустите `npm install` перед деплоем

### Ошибка "Environment variable not found"
- Убедитесь, что переменные добавлены в Vercel Dashboard
- Проверьте, что они доступны для нужного окружения (Production/Preview)
- Пересоберите проект после добавления переменных

### OAuth не работает
- Проверьте Redirect URLs в Supabase
- Убедитесь, что используете правильный URL (https, без trailing slash)

