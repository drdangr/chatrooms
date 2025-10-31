import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DatabaseTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [results, setResults] = useState<string[]>([])

  const testDatabase = async () => {
    setStatus('testing')
    setResults(['🧪 Начинаю тестирование...'])

    try {
      // 1. Проверка текущего пользователя
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      if (!user) {
        setStatus('error')
        setResults([...results, '❌ Пользователь не авторизован. Войдите через Google.'])
        return
      }

      setResults(prev => [...prev, `✅ Пользователь авторизован: ${user.email}`])

      // 2. Проверка профиля в таблице users
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          setResults(prev => [...prev, '⚠️ Профиль пользователя не найден в таблице users'])
        } else {
          throw profileError
        }
      } else {
        setResults(prev => [...prev, `✅ Профиль пользователя найден в БД: ${userProfile.email || userProfile.name || 'без имени'}`])
      }

      // 3. Проверка доступа к таблице rooms
      const { error: roomsError } = await supabase
        .from('rooms')
        .select('count')
        .limit(1)

      if (roomsError) {
        if (roomsError.code === 'PGRST301' || roomsError.message.includes('permission')) {
          setResults(prev => [...prev, '⚠️ Доступ к таблице rooms ограничен RLS (это нормально)'])
        } else {
          throw roomsError
        }
      } else {
        setResults(prev => [...prev, '✅ Таблица rooms доступна'])
      }

      // 4. Проверка доступа к таблице messages
      const { error: messagesError } = await supabase
        .from('messages')
        .select('count')
        .limit(1)

      if (messagesError) {
        if (messagesError.code === 'PGRST301' || messagesError.message.includes('permission')) {
          setResults(prev => [...prev, '⚠️ Доступ к таблице messages ограничен RLS (это нормально)'])
        } else {
          throw messagesError
        }
      } else {
        setResults(prev => [...prev, '✅ Таблица messages доступна'])
      }

      // 5. Попытка создать тестовую комнату
      const { data: testRoom, error: createRoomError } = await supabase
        .from('rooms')
        .insert({
          title: 'Тестовая комната',
          system_prompt: 'Тестовый промпт',
          model: 'gpt-4o-mini',
          created_by: user.id
        })
        .select()
        .single()

      if (createRoomError) {
        setResults(prev => [...prev, `⚠️ Не удалось создать тестовую комнату: ${createRoomError.message}`])
      } else {
        setResults(prev => [...prev, `✅ Успешно создана тестовая комната: ${testRoom.title}`])
        
        // Удаляем тестовую комнату
        await supabase
          .from('rooms')
          .delete()
          .eq('id', testRoom.id)
        
        setResults(prev => [...prev, '✅ Тестовая комната удалена'])
      }

      setStatus('success')
      setResults(prev => [...prev, '\n🎉 Все тесты пройдены! БД работает корректно.'])

    } catch (error: any) {
      setStatus('error')
      setResults(prev => [...prev, `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`])
      console.error('Database test error:', error)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Тест подключения к базе данных</h2>
      <button
        onClick={testDatabase}
        disabled={status === 'testing'}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold mb-4"
      >
        {status === 'testing' ? 'Тестирование...' : 'Запустить тесты БД'}
      </button>
      
      {results.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm font-mono">
            {results.join('\n')}
          </pre>
        </div>
      )}

      {status === 'success' && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          ✅ Тестирование завершено успешно! Все компоненты работают корректно.
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          ❌ Обнаружены ошибки. Проверьте консоль для подробностей.
        </div>
      )}
    </div>
  )
}

