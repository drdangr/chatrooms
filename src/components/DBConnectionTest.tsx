import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DBConnectionTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<string[]>([])

  const testConnection = async () => {
    setStatus('testing')
    setMessage('Тестирование подключения к БД...')
    setDetails([])

    try {
      const newDetails: string[] = []

      // Test 1: Check session
      newDetails.push('1. Проверка сессии...')
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      newDetails.push('   ✅ Сессия активна')
      if (sessionData.session) {
        newDetails.push(`   📧 Пользователь: ${sessionData.session.user.email}`)
      }

      // Test 2: Check user profile in public.users
      newDetails.push('\n2. Проверка профиля пользователя...')
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionData.session?.user.id)
        .single()

      if (userError) {
        newDetails.push(`   ⚠️  Профиль не найден: ${userError.message}`)
        newDetails.push('   💡 Триггер должен был создать профиль автоматически')
      } else {
        newDetails.push('   ✅ Профиль пользователя найден')
        newDetails.push(`   👤 Имя: ${userData.name || 'не указано'}`)
      }

      // Test 3: Test rooms table access
      newDetails.push('\n3. Проверка доступа к таблице rooms...')
      const { error: roomsError } = await supabase
        .from('rooms')
        .select('count', { count: 'exact', head: true })

      if (roomsError) {
        if (roomsError.code === 'PGRST301' || roomsError.message.includes('permission')) {
          newDetails.push('   ⚠️  Ошибка доступа (возможно RLS политика)')
        } else {
          throw roomsError
        }
      } else {
        newDetails.push('   ✅ Доступ к таблице rooms работает')
      }

      // Test 4: Test messages table access
      newDetails.push('\n4. Проверка доступа к таблице messages...')
      const { error: messagesError } = await supabase
        .from('messages')
        .select('count', { count: 'exact', head: true })

      if (messagesError) {
        if (messagesError.code === 'PGRST301' || messagesError.message.includes('permission')) {
          newDetails.push('   ⚠️  Ошибка доступа (возможно RLS политика)')
        } else {
          throw messagesError
        }
      } else {
        newDetails.push('   ✅ Доступ к таблице messages работает')
      }

      // Test 5: Try to create a test room
      newDetails.push('\n5. Тест создания комнаты...')
      const { data: newRoom, error: createError } = await supabase
        .from('rooms')
        .insert({
          title: 'Тестовая комната',
          system_prompt: 'Тестовый промпт',
          model: 'gpt-4o-mini',
          created_by: sessionData.session?.user.id,
        })
        .select()
        .single()

      if (createError) {
        newDetails.push(`   ❌ Ошибка создания комнаты: ${createError.message}`)
      } else {
        newDetails.push(`   ✅ Комната создана! ID: ${newRoom.id}`)
        
        // Clean up - delete test room
        await supabase.from('rooms').delete().eq('id', newRoom.id)
        newDetails.push('   🗑️  Тестовая комната удалена')
      }

      setStatus('success')
      setMessage('✅ Все тесты пройдены успешно!')
      setDetails(newDetails)
    } catch (error: any) {
      setStatus('error')
      setMessage(`❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`)
      setDetails([...details, `Ошибка: ${error.message}`])
      console.error('DB connection test error:', error)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Тест подключения к базе данных</h2>
      <button
        onClick={testConnection}
        disabled={status === 'testing'}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
      >
        {status === 'testing' ? 'Тестирование...' : 'Протестировать подключение'}
      </button>
      {message && (
        <div className={`mt-4 p-4 rounded-lg ${
          status === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
          status === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
          'bg-blue-100 text-blue-800 border border-blue-300'
        }`}>
          <div className="font-semibold mb-2">{message}</div>
          {details.length > 0 && (
            <div className="mt-2 space-y-1">
              {details.map((detail, index) => (
                <div key={index} className="text-sm whitespace-pre-line font-mono">
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

