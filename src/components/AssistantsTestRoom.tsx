import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  sendMessageViaAssistant, 
  getOrCreateAssistantForRoom 
} from '../lib/assistants'
import { initializeTestAssistant } from '../lib/test-assistants'

interface Room {
  id: string
  title: string
  system_prompt: string
  model: string
  is_test_room: boolean
}

interface File {
  id: string
  filename: string
  file_type: string
  size: number
  openai_file_id: string | null
  created_at: string
}

interface Message {
  id: string
  sender_name: string
  text: string
  timestamp: string
}

export default function AssistantsTestRoom() {
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [runStatus, setRunStatus] = useState<string>('')
  const [assistantConfig, setAssistantConfig] = useState<{
    assistantId: string
    threadId: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTestRoom()
  }, [])

  const loadTestRoom = async () => {
    try {
      setLoading(true)
      
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/')
        return
      }

      // Находим тестовую комнату
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_test_room', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (roomsError) {
        throw new Error(`Ошибка загрузки комнаты: ${roomsError.message}`)
      }

      if (!rooms || rooms.length === 0) {
        setError('Тестовая комната не найдена. Сначала выполните миграцию 015_create_test_room_with_mock_files.sql')
        setLoading(false)
        return
      }

      const testRoom = rooms[0]
      setRoom(testRoom)

      // Загружаем файлы комнаты
      const { data: roomFiles, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('room_id', testRoom.id)
        .order('created_at', { ascending: true })

      if (filesError) {
        console.error('Ошибка загрузки файлов:', filesError)
      } else {
        setFiles(roomFiles || [])
      }

      // Загружаем сообщения
      const { data: roomMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', testRoom.id)
        .order('timestamp', { ascending: true })

      if (messagesError) {
        console.error('Ошибка загрузки сообщений:', messagesError)
      } else {
        setMessages(roomMessages || [])
      }

      // Проверяем, есть ли уже настроенный Assistant
      const { data: existingAssistant } = await supabase
        .from('room_assistants')
        .select('*')
        .eq('room_id', testRoom.id)
        .single()

      if (existingAssistant) {
        setAssistantConfig({
          assistantId: existingAssistant.assistant_id,
          threadId: existingAssistant.thread_id,
        })
      }
    } catch (err) {
      console.error('Error loading test room:', err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleInitializeAssistant = async () => {
    if (!room) return

    try {
      setInitializing(true)
      setError(null)
      setRunStatus('Инициализация Assistant...')

      const config = await initializeTestAssistant(room.id, room.system_prompt, room.model)
      
      setAssistantConfig({
        assistantId: config.assistantId,
        threadId: config.threadId,
      })

      setRunStatus(`✅ Assistant инициализирован! Загружено файлов: ${config.fileIds.length}`)
      
      // Перезагружаем файлы для отображения openai_file_id
      await loadTestRoom()
    } catch (err) {
      const errorMessage = (err as Error).message
      setError(errorMessage)
      setRunStatus('❌ Ошибка инициализации')
      console.error('Error initializing assistant:', err)
    } finally {
      setInitializing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !assistantConfig || !room) return

    try {
      setSending(true)
      setError(null)
      setRunStatus('Отправка сообщения...')

      const response = await sendMessageViaAssistant(
        assistantConfig.assistantId,
        assistantConfig.threadId,
        messageText.trim()
      )

      // Сохраняем сообщение пользователя
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('messages').insert({
          room_id: room.id,
          sender_id: user.id,
          sender_name: user.user_metadata?.name || user.email || 'Test User',
          text: messageText.trim(),
        })
      }

      // Сохраняем ответ Assistant
      await supabase.from('messages').insert({
        room_id: room.id,
        sender_id: null,
        sender_name: 'LLM (Assistants API)',
        text: response,
      })

      setMessageText('')
      setRunStatus('✅ Сообщение отправлено и ответ получен')
      
      // Перезагружаем сообщения
      await loadTestRoom()
    } catch (err) {
      const errorMessage = (err as Error).message
      setError(errorMessage)
      setRunStatus('❌ Ошибка отправки сообщения')
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleTestRetrieval = async () => {
    if (!assistantConfig) return

    setMessageText('Что содержится в загруженных файлах? Перечисли основные темы и информацию.')
    // Не отправляем автоматически, пользователь может нажать кнопку отправки
  }

  const handleTestCodeInterpreter = async () => {
    if (!assistantConfig) return

    setMessageText('Проанализируй CSV файл с данными. Создай сводку и график.')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка тестовой комнаты...</div>
      </div>
    )
  }

  if (error && !room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl">
          <h2 className="text-xl font-bold text-red-800 mb-4">Ошибка</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    )
  }

  if (!room) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-500 hover:text-blue-700 mb-4"
        >
          ← Вернуться к списку комнат
        </button>
        
        <h1 className="text-2xl font-bold mb-2">{room.title}</h1>
        <p className="text-gray-600 mb-4">
          Тестовая комната для проверки Assistants API
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {runStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-700">{runStatus}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка: Файлы */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-semibold mb-4">Файлы комнаты</h2>
            
            {files.length === 0 ? (
              <p className="text-gray-500 text-sm">Нет файлов</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="border rounded p-2 text-sm"
                  >
                    <div className="font-medium">{file.filename}</div>
                    <div className="text-gray-500 text-xs">
                      {file.file_type} • {(file.size / 1024).toFixed(1)} KB
                    </div>
                    {file.openai_file_id ? (
                      <div className="text-green-600 text-xs mt-1">
                        ✅ Загружен в OpenAI
                      </div>
                    ) : (
                      <div className="text-yellow-600 text-xs mt-1">
                        ⏳ Ожидает загрузки
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!assistantConfig && (
              <button
                onClick={handleInitializeAssistant}
                disabled={initializing}
                className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {initializing ? 'Инициализация...' : 'Инициализировать Assistant'}
              </button>
            )}

            {assistantConfig && (
              <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                <div className="text-sm text-green-800">
                  ✅ Assistant настроен
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Assistant ID: {assistantConfig.assistantId.substring(0, 20)}...
                </div>
              </div>
            )}
          </div>

          {/* Тестовые кнопки */}
          {assistantConfig && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-md font-semibold mb-3">Быстрые тесты</h3>
              <div className="space-y-2">
                <button
                  onClick={handleTestRetrieval}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                >
                  Тест Retrieval
                </button>
                <button
                  onClick={handleTestCodeInterpreter}
                  className="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                >
                  Тест Code Interpreter
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Правая колонка: Чат */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Чат с Assistant</h2>
              {!assistantConfig && (
                <p className="text-sm text-gray-500 mt-1">
                  Нажмите "Инициализировать Assistant" для начала работы
                </p>
              )}
            </div>

            <div className="p-4 h-96 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.sender_name === 'LLM (Assistants API)'
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">
                    {msg.sender_name}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder={
                    assistantConfig
                      ? 'Введите сообщение...'
                      : 'Сначала инициализируйте Assistant'
                  }
                  disabled={!assistantConfig || sending}
                  className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!assistantConfig || sending || !messageText.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

