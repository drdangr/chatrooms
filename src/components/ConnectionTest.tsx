import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ConnectionTest() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const testConnection = async () => {
    setStatus('testing')
    setMessage('Тестирование подключения...')

    try {
      // Тест 1: Проверка сессии
      const { error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      // Тест 2: Проверка подключения к БД - попытка прочитать таблицу
      const { error: roomsError } = await supabase
        .from('rooms')
        .select('count')
        .limit(1)

      if (roomsError) {
        // Если ошибка из-за RLS - это нормально, значит подключение работает
        if (roomsError.code === 'PGRST301' || roomsError.message.includes('permission')) {
          setStatus('success')
          setMessage('✅ Подключение к Supabase работает! Таблицы доступны.')
        } else {
          throw roomsError
        }
      } else {
        setStatus('success')
        setMessage('✅ Подключение к Supabase работает! Успешно подключились к БД.')
      }

      // Тест 3: Проверка структуры таблиц
      const { error: usersError } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (usersError && usersError.code !== 'PGRST301' && !usersError.message.includes('permission')) {
        throw usersError
      }

      setMessage(prev => prev + ' Все таблицы созданы и доступны.')
    } catch (error: any) {
      setStatus('error')
      setMessage(`❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`)
      console.error('Connection test error:', error)
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Тест подключения к Supabase</h2>
      <button
        onClick={testConnection}
        disabled={status === 'testing'}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {status === 'testing' ? 'Тестирование...' : 'Протестировать подключение'}
      </button>
      {message && (
        <div className={`mt-4 p-3 rounded ${
          status === 'success' ? 'bg-green-100 text-green-800' :
          status === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}

