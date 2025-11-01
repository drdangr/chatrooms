# 🔧 Исправление ошибки эмбеддингов на Vercel

## Проблема
Ошибка: `expected 1024 dimensions, not 1536`

Приложение на Vercel всё ещё использует старые настройки (1536 измерений), хотя база данных обновлена на 1024.

## Решение

### Шаг 1: Добавить переменные окружения в Vercel

1. Зайдите в [Vercel Dashboard](https://vercel.com)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте следующие переменные:

| Имя переменной | Значение | Окружения |
|--------------|----------|-----------|
| `VITE_OPENAI_EMBEDDING_MODEL` | `text-embedding-3-large` | Production, Preview, Development |
| `VITE_OPENAI_EMBEDDING_DIMENSIONS` | `1024` | Production, Preview, Development |

**Важно:** Выберите все три окружения (Production, Preview, Development) для каждой переменной.

### Шаг 2: Пересобрать проект

После добавления переменных **обязательно пересоберите проект**:

#### Вариант A: Через Dashboard
1. В настройках проекта нажмите **Redeploy** на последнем деплое
2. Или создайте новый деплой (вкладка **Deployments** → **...** → **Redeploy**)

#### Вариант B: Через Git (рекомендуется)
```bash
git commit --allow-empty -m "Trigger redeploy with new env vars"
git push
```

#### Вариант C: Через Vercel CLI
```bash
vercel --prod
```

### Шаг 3: Проверка

После пересборки:

1. Откройте приложение на Vercel
2. Откройте консоль браузера (F12)
3. Должно появиться сообщение:
```
🔧 Embedding configuration: {
  model: "text-embedding-3-large",
  dimensions: 1024,
  ...
}
```

Если видите `model: "text-embedding-3-small"` или `dimensions: "default"` - переменные не подхватились. Проверьте:
- Правильность написания имен переменных (чувствительны к регистру)
- Что переменные добавлены для всех окружений
- Что проект пересобран после добавления переменных

### Шаг 4: Пересоздать эмбединги

После успешной проверки конфигурации:

1. Откройте любую комнату в приложении
2. Нажмите кнопку поиска (зеленая лупа)
3. Нажмите **"🔄 Пересоздать эмбединги"**
4. Подтвердите операцию

Эмбединги будут созданы с правильной размерностью (1024).

## Быстрая проверка через CLI

Если используете Vercel CLI:

```bash
# Проверить текущие переменные
vercel env ls

# Добавить переменные (если еще не добавлены)
vercel env add VITE_OPENAI_EMBEDDING_MODEL production
# Введите: text-embedding-3-large

vercel env add VITE_OPENAI_EMBEDDING_DIMENSIONS production
# Введите: 1024

# Пересобрать
vercel --prod
```

