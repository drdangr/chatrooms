// Test script to verify database connection and schema
import { supabase } from './lib/supabase'

async function testDatabaseConnection() {
  console.log('🧪 Тестирование подключения к базе данных...\n')

  try {
    // Test 1: Check session
    console.log('1. Проверка сессии...')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      console.error('   ❌ Ошибка получения сессии:', sessionError.message)
    } else {
      console.log('   ✅ Сессия:', sessionData.session ? 'Активна' : 'Неактивна')
    }

    // Test 2: Check if tables exist by trying to query them
    console.log('\n2. Проверка таблиц...')
    
    const { error: roomsError } = await supabase
      .from('rooms')
      .select('count', { count: 'exact', head: true })
    
    if (roomsError) {
      console.error('   ❌ Ошибка при запросе таблицы rooms:', roomsError.message)
      console.error('   💡 Убедитесь, что миграция применена в Supabase Dashboard')
    } else {
      console.log('   ✅ Таблица rooms доступна')
    }

    const { error: messagesError } = await supabase
      .from('messages')
      .select('count', { count: 'exact', head: true })
    
    if (messagesError) {
      console.error('   ❌ Ошибка при запросе таблицы messages:', messagesError.message)
    } else {
      console.log('   ✅ Таблица messages доступна')
    }

    const { error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
    
    if (usersError) {
      console.error('   ❌ Ошибка при запросе таблицы users:', usersError.message)
    } else {
      console.log('   ✅ Таблица users доступна')
    }

    const { error: filesError } = await supabase
      .from('files')
      .select('count', { count: 'exact', head: true })
    
    if (filesError) {
      console.error('   ❌ Ошибка при запросе таблицы files:', filesError.message)
    } else {
      console.log('   ✅ Таблица files доступна')
    }

    // Test 3: Test Realtime subscription (just check if it's available)
    console.log('\n3. Проверка Realtime...')
    console.log('   ℹ️  Realtime будет протестирован при создании комнат')

    console.log('\n✅ Тестирование подключения завершено!')
    console.log('\n📝 Следующие шаги:')
    console.log('   1. Настройте Google OAuth в Supabase Dashboard')
    console.log('   2. Запустите приложение: npm run dev')
    console.log('   3. Попробуйте войти через Google')

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error)
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseConnection()
}

export { testDatabaseConnection }

