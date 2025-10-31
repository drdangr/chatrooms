import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callOpenAI } from '../lib/openai'
import PromptSettings from './PromptSettings'

interface Message {
  id: string
  room_id: string
  sender_id: string | null
  sender_name: string
  text: string
  timestamp: string
  created_at: string
}

interface Room {
  id: string
  title: string
  system_prompt: string
  model: string
  created_by: string
  created_at: string
}

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    loadRoom()
    loadUser()

    // Listen for room settings updates
    const handleSettingsUpdate = (event: CustomEvent) => {
      if (event.detail.roomId === roomId) {
        console.log('Room settings updated, reloading room data...')
        loadRoom()
      }
    }

    window.addEventListener('roomSettingsUpdated', handleSettingsUpdate as EventListener)

    return () => {
      window.removeEventListener('roomSettingsUpdated', handleSettingsUpdate as EventListener)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return

    loadMessages()
    
    // Subscribe to messages
    const channel = supabase
      .channel(`messages:${roomId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('New message received:', payload)
          setMessages((prev) => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some((msg) => msg.id === payload.new.id)
            if (exists) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to messages')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - Realtime may not be enabled')
        }
      })

    // Cleanup subscription on unmount or room change
    return () => {
      console.log('Unsubscribing from messages channel')
      supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadRoom = async () => {
    if (!roomId) return

    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (error) throw error
      
      console.log('📂 Loaded room:', {
        id: data.id,
        title: data.title,
        system_prompt: data.system_prompt,
        model: data.model,
      })
      
      setRoom(data)
    } catch (error) {
      console.error('Error loading room:', error)
      alert('Комната не найдена')
      navigate('/')
    }
  }

  const loadMessages = async () => {
    if (!roomId) return

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }


  const handleSendMessage = async () => {
    if (!messageText.trim() || !roomId || !user) return

    setSending(true)
    const userMessageText = messageText.trim()
    setMessageText('') // Clear input immediately

    try {
      // Save user message
      const { error: userMessageError } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.user_metadata?.name || user.email || 'Пользователь',
          text: userMessageText,
        })

      if (userMessageError) throw userMessageError

      // Reload room data to ensure we have the latest settings
      const { data: currentRoom, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (roomError) {
        console.error('Error loading room for LLM call:', roomError)
        throw roomError
      }

      console.log('📋 Current room settings:', {
        system_prompt: currentRoom?.system_prompt,
        model: currentRoom?.model,
        roomId,
      })

      // Get recent messages for context (last 10 messages)
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('timestamp', { ascending: false })
        .limit(10)

      // Reverse to get chronological order
      const messagesForContext = (recentMessages || []).reverse().map((msg) => ({
        sender_name: msg.sender_name,
        text: msg.text,
      }))

      // Call LLM API with current room settings
      if (currentRoom) {
        try {
          const systemPrompt = currentRoom.system_prompt?.trim() || 'Вы - полезный ассистент.'
          const model = currentRoom.model || 'gpt-4o-mini'
          
          console.log('🤖 Calling LLM with:', {
            prompt: systemPrompt,
            promptLength: systemPrompt.length,
            model: model,
            messagesCount: messagesForContext.length,
          })
          
          // Get LLM response
          const llmResponse = await callOpenAI(
            systemPrompt,
            messagesForContext,
            model
          )

          // Save LLM response
          const { error: llmMessageError } = await supabase
            .from('messages')
            .insert({
              room_id: roomId,
              sender_id: null,
              sender_name: 'LLM',
              text: llmResponse,
            })

          if (llmMessageError) {
            console.error('Error saving LLM response:', llmMessageError)
            // Don't throw, just log - user message is already saved
          }
        } catch (llmError) {
          console.error('Error calling LLM:', llmError)
          // Save error message
          await supabase.from('messages').insert({
            room_id: roomId,
            sender_id: null,
            sender_name: 'Система',
            text: `Ошибка получения ответа от LLM: ${(llmError as Error).message}`,
          })
        }
      } else {
        console.error('Room not found for LLM call')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Ошибка при отправке сообщения: ' + (error as Error).message)
      // Restore message text on error
      setMessageText(userMessageText)
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">Комната не найдена</div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Вернуться к списку комнат
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Room Header */}
        <div className="bg-gray-50 border-b p-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800">{room.title}</h2>
              <p className="text-sm text-gray-500">Модель: {room.model}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold"
              >
                ⚙️ Настройки
              </button>
              <button
                onClick={() => navigate('/rooms')}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors text-sm font-semibold"
              >
                ← Назад
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Пока нет сообщений. Начните общение!
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.sender_id === user?.id
              const isLLM = message.sender_name === 'LLM'
              const isSystem = message.sender_name === 'Система'
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isUser
                        ? 'bg-blue-500 text-white'
                        : isLLM
                        ? 'bg-green-500 text-white'
                        : isSystem
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="text-sm font-semibold mb-1">
                      {message.sender_name}
                    </div>
                    <div className="text-sm">{message.text}</div>
                    <div
                      className={`text-xs mt-1 ${
                        isUser || isLLM || isSystem
                          ? 'text-opacity-75'
                          : 'text-gray-500'
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t p-4 bg-gray-50">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && roomId && (
        <PromptSettings
          roomId={roomId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

