# Настройка OAuth провайдеров в Supabase

## Настройка Google OAuth

1. Откройте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)

2. Перейдите в раздел **Authentication** → **Providers**

3. Найдите провайдер **Google** и нажмите на него

4. Включите провайдер, переключив тумблер

5. Для настройки Google OAuth вам нужно:
   - Перейти в [Google Cloud Console](https://console.cloud.google.com/)
   - Создать новый проект или выбрать существующий
   - Включить Google+ API
   - Создать OAuth 2.0 Client ID:
     - Тип приложения: Web application
     - Authorized redirect URIs: `https://okjpzxdsjlpjfifdykjc.supabase.co/auth/v1/callback`
   - Скопировать Client ID и Client Secret

6. Вставьте Client ID и Client Secret в настройки Google провайдера в Supabase

7. Сохраните настройки

## Настройка Apple OAuth (опционально)

1. В разделе **Authentication** → **Providers** найдите **Apple**

2. Включите провайдер

3. Для настройки Apple Sign In вам понадобится:
   - Apple Developer Account
   - Service ID в Apple Developer
   - Настроить redirect URI в Apple Developer Console

4. Заполните необходимые поля (Services ID, Secret Key) в настройках Supabase

5. Сохраните настройки

## Проверка

После настройки OAuth провайдеров:

1. Запустите приложение: `npm run dev`
2. Нажмите кнопку "Войти через Google"
3. Должно произойти перенаправление на страницу авторизации Google
4. После успешной авторизации вы вернетесь в приложение

## Важно

- Убедитесь, что redirect URI в Google Cloud Console точно совпадает с URI в Supabase
- Для локальной разработки можно добавить дополнительный redirect URI: `http://localhost:5173/auth/v1/callback`
- После деплоя нужно будет добавить production redirect URI

