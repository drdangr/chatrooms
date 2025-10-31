import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callOpenAI } from '../lib/openai'
import PromptSettings from './PromptSettings'
import { getUserRoleInRoom, permissions, Role } from '../lib/roles'
import UserChip from './UserChip'

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
  updated_at?: string
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
  const [showSystemPrompt, setShowSystemPrompt] = useState(true)
  const [isEditingSystemPrompt, setIsEditingSystemPrompt] = useState(false)
  const [editingPromptValue, setEditingPromptValue] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [roomUsers, setRoomUsers] = useState<Array<{ id: string; name: string; email: string; avatarUrl: string | null; role: Role }>>([])

  useEffect(() => {
    loadRoom()
    loadUser()
    loadUserRole()
    loadRoomUsers()

    // Listen for room settings updates (local event from settings modal)
    const handleSettingsUpdate = (event: CustomEvent) => {
      if (event.detail.roomId === roomId) {
        console.log('⚡ Room settings updated (local event), reloading room data...')
        console.log('⚡ Current room state before reload:', room?.system_prompt)
        // Longer delay to ensure DB write and Realtime propagation is complete
        setTimeout(() => {
          console.log('⚡ Loading room data after local update...')
          loadRoom()
        }, 1500) // Increased delay to avoid race condition
      }
    }

    window.addEventListener('roomSettingsUpdated', handleSettingsUpdate as EventListener)

    // Subscribe to room changes via Realtime (for changes from other users)
    if (roomId) {
      console.log('🔌 Setting up Realtime subscription for room:', roomId)
      console.log('🔌 Channel name: room-updates:' + roomId)
      
      const roomChannel = supabase
        .channel(`room-updates:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            console.log('📢 ===== ROOM UPDATED VIA REALTIME =====')
            console.log('📢 Full payload:', JSON.stringify(payload, null, 2))
            console.log('📢 Event type:', payload.eventType)
            console.log('📢 Table:', payload.table)
            console.log('📢 Schema:', payload.schema)
            console.log('📢 New settings:', payload.new)
            console.log('📢 Old settings:', payload.old)
            console.log('📢 Timestamp:', new Date().toISOString())
            
            // Check if this is actually a meaningful update
            if (!payload.new) {
              console.warn('⚠️ Realtime payload.new is missing')
              return
            }
            
            // Check timestamp to avoid overwriting newer updates
            const payloadTime = payload.new.updated_at ? new Date(payload.new.updated_at).getTime() : 0
            const currentTime = room?.updated_at ? new Date(room.updated_at).getTime() : 0

            if (payloadTime < currentTime && currentTime > 0) {
              console.warn('⚠️ Ignoring older Realtime update:', {
                payloadTime: payload.new.updated_at,
                currentTime: room?.updated_at,
              })
              return // Don't overwrite with older data
            }

            // Immediately update room state with new data
            setRoom((prevRoom) => {
              if (!prevRoom) {
                console.warn('⚠️ Previous room state is null, reloading...')
                loadRoom()
                return prevRoom
              }
              
              const updated: Room = {
                ...prevRoom,
                system_prompt: payload.new.system_prompt ?? prevRoom.system_prompt,
                model: payload.new.model ?? prevRoom.model,
                updated_at: payload.new.updated_at,
              }
              
              console.log('✅ Room state updated from Realtime:', {
                oldPrompt: prevRoom.system_prompt,
                newPrompt: updated.system_prompt,
                oldModel: prevRoom.model,
                newModel: updated.model,
                promptChanged: prevRoom.system_prompt !== updated.system_prompt,
                modelChanged: prevRoom.model !== updated.model,
                timestamp: payload.new.updated_at,
              })
              
              return updated
            })
            
            // Also reload from DB to be sure we have all fields
            setTimeout(() => {
              console.log('🔄 Reloading room data from DB to verify...')
              loadRoom()
            }, 300)
          }
        )
            .subscribe((status, err) => {
          console.log('📡 Room updates subscription status:', status, 'for room:', roomId)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to room updates for room:', roomId)
            console.log('✅ This client will now receive UPDATE events from other users')
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('❌ Channel error - Realtime may not be enabled for rooms table:', err)
            console.error('💡 Check: ALTER TABLE rooms REPLICA IDENTITY FULL;')
          }
          if (status === 'TIMED_OUT') {
            console.error('❌ Subscription timed out - Realtime connection issue')
          }
          if (status === 'CLOSED') {
            console.log('⚠️ Subscription closed')
          }
        })
        
      // Subscribe to room_roles changes to update user role and room users list
      const rolesChannel = supabase
        .channel(`room-roles:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'room_roles',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            console.log('📢 Room role changed:', payload)
            if (user?.id && (payload.new as any)?.user_id === user.id) {
              loadUserRole()
            }
            // Reload room users list when roles change
            loadRoomUsers()
          }
        )
        .subscribe()

      return () => {
        window.removeEventListener('roomSettingsUpdated', handleSettingsUpdate as EventListener)
        console.log('Unsubscribing from room updates channel')
        supabase.removeChannel(roomChannel)
        supabase.removeChannel(rolesChannel)
      }
    }

    return () => {
      window.removeEventListener('roomSettingsUpdated', handleSettingsUpdate as EventListener)
    }
  }, [roomId, user?.id])

  useEffect(() => {
    if (!roomId) return

    loadMessages()
    loadRoomUsers()
    
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
    if (user && roomId) {
      await loadUserRole()
    }
  }

  const loadUserRole = async () => {
    if (!roomId || !user?.id) return
    const role = await getUserRoleInRoom(roomId, user.id, supabase)
    setUserRole(role)
  }

  const loadRoomUsers = async () => {
    if (!roomId) return

    try {
      // Get all roles in this room
      const { data: rolesData, error: rolesError } = await supabase
        .from('room_roles')
        .select('user_id, role')
        .eq('room_id', roomId)

      if (rolesError) {
        console.error('Error loading room roles:', rolesError)
        return
      }

      if (!rolesData || rolesData.length === 0) {
        setRoomUsers([])
        return
      }

      // Get user details for all users with roles
      const userIds = rolesData.map(r => r.user_id)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .in('id', userIds)

      if (usersError) {
        console.error('Error loading users:', usersError)
        return
      }

      // Combine roles with user data
      const usersMap = new Map(usersData?.map(u => [u.id, u]) || [])
      const usersWithRoles = rolesData
        .map(item => {
          const user = usersMap.get(item.user_id)
          if (!user) return null
          return {
            id: user.id,
            name: user.name || user.email,
            email: user.email,
            avatarUrl: user.avatar_url,
            role: item.role as Role
          }
        })
        .filter((u): u is { id: string; name: string; email: string; avatarUrl: string | null; role: Role } => u !== null)
        .sort((a, b) => {
          // Sort by role: owner first, then admin, writer, viewer
          const roleOrder: Record<Role, number> = { owner: 0, admin: 1, writer: 2, viewer: 3 }
          return roleOrder[a.role] - roleOrder[b.role]
        })

      setRoomUsers(usersWithRoles)
    } catch (error) {
      console.error('Error loading room users:', error)
    }
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
        updated_at: data.updated_at,
        timestamp: new Date().toISOString(),
      })
      
      // Check if this is overwriting a newer value
      if (room && room.system_prompt && data.system_prompt !== room.system_prompt) {
        console.log('⚠️ Room data changed during load:', {
          previous: room.system_prompt,
          new: data.system_prompt,
          previousUpdated: room.updated_at,
          newUpdated: data.updated_at,
        })
      }
      
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

    if (!permissions.canSendMessages(userRole)) {
      alert('У вас нет прав для отправки сообщений в этой комнате')
      return
    }

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

  const handleStartEditPrompt = () => {
    if (!permissions.canEditPrompt(userRole)) {
      alert('У вас нет прав для редактирования системного промпта')
      return
    }
    setEditingPromptValue(room?.system_prompt || '')
    setIsEditingSystemPrompt(true)
    setShowSystemPrompt(true) // Ensure it's visible when editing
  }

  const handleCancelEditPrompt = () => {
    setIsEditingSystemPrompt(false)
    setEditingPromptValue('')
  }

  const handleSavePrompt = async () => {
    if (!roomId || !editingPromptValue.trim()) return

    setSavingPrompt(true)
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({
          system_prompt: editingPromptValue.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .select()
        .single()

      if (error) throw error

      setRoom((prev) => prev ? { ...prev, system_prompt: editingPromptValue.trim(), updated_at: data.updated_at } : null)
      setIsEditingSystemPrompt(false)
      
      // Reload user role in case it changed
      await loadUserRole()
      
      // Trigger event for local update
      window.dispatchEvent(new CustomEvent('roomSettingsUpdated', { detail: { roomId } }))
    } catch (error) {
      console.error('Error saving prompt:', error)
      alert('Ошибка при сохранении промпта: ' + (error as Error).message)
    } finally {
      setSavingPrompt(false)
    }
  }

  const handleToggleMessageSelection = (messageId: string) => {
    setSelectedMessages((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedMessages.size === messages.length) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(messages.map(m => m.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return

    if (!permissions.canDeleteMessages(userRole)) {
      alert('У вас нет прав для удаления сообщений')
      return
    }

    if (!confirm(`Удалить ${selectedMessages.size} сообщение(ий)?`)) return

    setDeleting(true)
    try {
      const messageIds = Array.from(selectedMessages)
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', messageIds)

      if (error) throw error

      // Remove deleted messages from local state immediately
      setMessages((prev) => prev.filter(m => !messageIds.includes(m.id)))
      
      setSelectedMessages(new Set())
      setIsSelectionMode(false)
    } catch (error) {
      console.error('Error deleting messages:', error)
      alert('Ошибка при удалении сообщений: ' + (error as Error).message)
    } finally {
      setDeleting(false)
    }
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
        <div className="bg-gray-50 border-b">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{room.title}</h2>
                <p className="text-sm text-gray-500 mb-2">Модель: {room.model}</p>
                {roomUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {roomUsers.map((user) => (
                      <UserChip
                        key={user.id}
                        name={user.name}
                        email={user.email}
                        avatarUrl={user.avatarUrl}
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {isSelectionMode ? (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold"
                    >
                      {selectedMessages.size === messages.length ? 'Снять все' : 'Выделить все'}
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedMessages.size === 0 || deleting}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {deleting ? 'Удаление...' : `Удалить (${selectedMessages.size})`}
                    </button>
                    <button
                      onClick={() => {
                        setIsSelectionMode(false)
                        setSelectedMessages(new Set())
                      }}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors text-sm font-semibold"
                    >
                      Отменить
                    </button>
                  </>
                ) : (
                  <>
                    {permissions.canDeleteMessages(userRole) && (
                      <button
                        onClick={() => setIsSelectionMode(true)}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold"
                      >
                        Выделить
                      </button>
                    )}
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
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* System Prompt Display */}
          <div className="px-4 pb-3 border-t border-gray-200 pt-3 bg-blue-50">
            <div className="flex items-start gap-2">
              <button
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                className="flex-shrink-0 mt-0.5 hover:bg-blue-100 rounded p-1 -m-1 transition-colors"
              >
                <span className={`inline-block transition-transform duration-200 ${showSystemPrompt ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-blue-700">
                    Системный промпт LLM:
                  </div>
                  {showSystemPrompt && !isEditingSystemPrompt && permissions.canEditPrompt(userRole) && (
                    <button
                      onClick={handleStartEditPrompt}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Редактировать
                    </button>
                  )}
                </div>
                {showSystemPrompt && (
                  <div className="relative">
                    {isEditingSystemPrompt ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingPromptValue}
                          onChange={(e) => setEditingPromptValue(e.target.value)}
                          className="w-full text-sm text-blue-900 bg-white p-2 rounded border-2 border-blue-400 font-mono whitespace-pre-wrap break-words min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Вы - полезный ассистент."
                          autoFocus
                          disabled={savingPrompt}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={handleSavePrompt}
                            disabled={savingPrompt}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Сохранить"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEditPrompt}
                            disabled={savingPrompt}
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Отменить"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-blue-900 bg-white p-2 rounded border border-blue-200 font-mono whitespace-pre-wrap break-words"
                      >
                        {room.system_prompt?.trim() || (
                          <span className="text-gray-400 italic">Вы - полезный ассистент.</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
              const isSelected = selectedMessages.has(message.id)
              
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleMessageSelection(message.id)}
                      className="mt-2 w-5 h-5 cursor-pointer"
                    />
                  )}
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isUser
                        ? 'bg-blue-500 text-white'
                        : isLLM
                        ? 'bg-green-500 text-white'
                        : isSystem
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    } ${isSelected ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
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
              placeholder={permissions.canSendMessages(userRole) ? "Введите сообщение..." : "У вас нет прав для отправки сообщений"}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending || !permissions.canSendMessages(userRole)}
            />
            <button
              type="submit"
              disabled={sending || !messageText.trim() || !permissions.canSendMessages(userRole)}
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

