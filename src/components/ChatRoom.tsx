import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { callOpenAI } from '../lib/openai'
import PromptSettings from './PromptSettings'
import { getUserRoleInRoom, permissions, Role } from '../lib/roles'
import UserChip from './UserChip'
import { searchMessagesSemantic } from '../lib/semantic-search'
import type { SearchResult } from '../lib/semantic-search'

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
  temperature?: number
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
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [isEditingSystemPrompt, setIsEditingSystemPrompt] = useState(false)
  const [editingPromptValue, setEditingPromptValue] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [userRole, setUserRole] = useState<Role | null>(null)
  const [roomUsers, setRoomUsers] = useState<Array<{ id: string; name: string; email: string; avatarUrl: string | null; role: Role }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [backfilling, setBackfilling] = useState(false)

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
                temperature: typeof payload.new.temperature === 'number'
                  ? payload.new.temperature
                  : prevRoom.temperature,
                updated_at: payload.new.updated_at,
              }
              
              console.log('✅ Room state updated from Realtime:', {
                oldPrompt: prevRoom.system_prompt,
                newPrompt: updated.system_prompt,
                oldModel: prevRoom.model,
                newModel: updated.model,
                oldTemperature: prevRoom.temperature,
                newTemperature: updated.temperature,
                promptChanged: prevRoom.system_prompt !== updated.system_prompt,
                modelChanged: prevRoom.model !== updated.model,
                temperatureChanged: prevRoom.temperature !== updated.temperature,
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
        temperature: data.temperature,
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
      
      setRoom({
        ...data,
        temperature: typeof data.temperature === 'number' ? data.temperature : 1,
      })
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
      const { data: newMessage, error: userMessageError } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          sender_id: user.id,
          sender_name: user.user_metadata?.name || user.email || 'Пользователь',
          text: userMessageText,
        })
        .select()
        .single()

      if (userMessageError) throw userMessageError

      // Generate embedding for semantic search (async, non-blocking)
      if (newMessage?.id) {
        import('../lib/semantic-search').then(({ generateAndStoreEmbedding }) => {
          generateAndStoreEmbedding(newMessage.id, userMessageText).catch(err => {
            console.warn('Failed to generate embedding (non-critical):', err)
          })
        })
      }

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
        temperature: currentRoom?.temperature,
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
          const temperature = typeof currentRoom.temperature === 'number' ? currentRoom.temperature : undefined
          
          console.log('🤖 Calling LLM with:', {
            prompt: systemPrompt,
            promptLength: systemPrompt.length,
            model: model,
            messagesCount: messagesForContext.length,
            temperature,
          })
          
          // Get LLM response
          const llmResponse = await callOpenAI(
            systemPrompt,
            messagesForContext,
            model,
            temperature
          )

          // Save LLM response
          const { data: llmMessage, error: llmMessageError } = await supabase
            .from('messages')
            .insert({
              room_id: roomId,
              sender_id: null,
              sender_name: 'LLM',
              text: llmResponse,
            })
            .select()
            .single()

          if (llmMessageError) {
            console.error('Error saving LLM response:', llmMessageError)
            // Don't throw, just log - user message is already saved
          } else if (llmMessage?.id) {
            // Generate embedding for LLM response (async, non-blocking)
            import('../lib/semantic-search').then(({ generateAndStoreEmbedding }) => {
              generateAndStoreEmbedding(llmMessage.id, llmResponse).catch(err => {
                console.warn('Failed to generate embedding for LLM message (non-critical):', err)
              })
            })
          }
        } catch (llmError) {
          console.error('Error calling LLM:', llmError)
          // Save error message
          const { data: errorMessage, error: errorMessageError } = await supabase
            .from('messages')
            .insert({
              room_id: roomId,
              sender_id: null,
              sender_name: 'Система',
              text: `Ошибка получения ответа от LLM: ${(llmError as Error).message}`,
            })
            .select()
            .single()

          if (!errorMessageError && errorMessage?.id) {
            // Generate embedding for error message too (for searchability)
            import('../lib/semantic-search').then(({ generateAndStoreEmbedding }) => {
              generateAndStoreEmbedding(errorMessage.id, errorMessage.text).catch(err => {
                console.warn('Failed to generate embedding for error message (non-critical):', err)
              })
            })
          }
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
      console.log('Deleting messages:', messageIds)
      
      const { data, error } = await supabase
        .from('messages')
        .delete()
        .in('id', messageIds)
        .select()

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      console.log('Delete result:', data)

      // Remove deleted messages from local state immediately
      setMessages((prev) => prev.filter(m => !messageIds.includes(m.id)))
      
      setSelectedMessages(new Set())
      setIsSelectionMode(false)
      
      // Reload messages to ensure consistency
      await loadMessages()
    } catch (error) {
      console.error('Error deleting messages:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert('Ошибка при удалении сообщений: ' + errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const handleSemanticSearch = async () => {
    if (!roomId || !searchQuery.trim()) return

    setSearching(true)
    try {
      console.log('🔍 User triggered search:', searchQuery.trim())
      const results = await searchMessagesSemantic(roomId, searchQuery.trim(), 5)
      console.log('📋 Search results received:', results.length, 'results')
      setSearchResults(results)
      
      if (results.length === 0) {
        // Check if any messages have embeddings
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .not('embedding', 'is', null)
        
        console.log(`📊 Total messages with embeddings in room: ${count || 0}`)
        
        if (count === 0) {
          console.warn('⚠️ No messages have embeddings! Embeddings may not be generating.')
        }
      }
    } catch (error) {
      console.error('❌ Error searching messages:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert('Ошибка при поиске: ' + errorMessage + '\n\nПроверьте консоль для подробностей.')
    } finally {
      setSearching(false)
    }
  }

  const handleSearchResultClick = (messageId: string) => {
    // Scroll to message in chat
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight message briefly
      messageElement.classList.add('bg-yellow-100')
      setTimeout(() => {
        messageElement.classList.remove('bg-yellow-100')
      }, 2000)
    }
    setShowSearch(false)
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
                        role={user.role}
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
                      className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      title={selectedMessages.size === messages.length ? 'Снять все' : 'Выделить все'}
                    >
                      {selectedMessages.size === messages.length ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedMessages.size === 0 || deleting}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed relative"
                      title={deleting ? 'Удаление...' : `Удалить (${selectedMessages.size})`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {selectedMessages.size > 0 && !deleting && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {selectedMessages.size}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsSelectionMode(false)
                        setSelectedMessages(new Set())
                      }}
                      className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                      title="Отменить"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    {permissions.canDeleteMessages(userRole) && (
                      <button
                        onClick={() => setIsSelectionMode(true)}
                        className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        title="Выделить"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => setShowSearch(!showSearch)}
                      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      title="Семантический поиск"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      title="Настройки"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => navigate('/rooms')}
                      className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                      title="Назад"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Semantic Search Panel */}
          {showSearch && (
            <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-sm font-semibold text-green-800">Семантический поиск</span>
                <button
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="ml-auto p-1 hover:bg-green-100 rounded transition-colors"
                  title="Закрыть"
                >
                  <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSemanticSearch()
                    }
                  }}
                  placeholder="Введите запрос для поиска по смыслу..."
                  className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <button
                  onClick={handleSemanticSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {searching ? 'Поиск...' : 'Найти'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  <div className="text-xs text-green-700 font-semibold mb-1">
                    Найдено {searchResults.length} сообщений:
                  </div>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => handleSearchResultClick(result.id)}
                      className="p-2 bg-white border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{result.sender_name}</span>
                        <span className="text-xs text-green-600 font-semibold">
                          {(result.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-800 line-clamp-2">{result.text}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(result.message_timestamp).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && searchResults.length === 0 && !searching && (
                <div className="text-sm text-gray-500 text-center py-2">
                  Результаты не найдены. Попробуйте другой запрос.
                </div>
              )}
              {!searchQuery && (
                <div className="text-xs text-gray-600 text-center py-2 space-y-1">
                  <div>💡 Подсказка: поиск работает по смыслу, а не по точному совпадению слов</div>
                  {permissions.canManageRoles(userRole) && (
                    <button
                      onClick={async () => {
                        if (!confirm('Пересоздать эмбединги для всех сообщений в этой комнате? Это может занять несколько минут.')) return
                        
                        setBackfilling(true)
                        try {
                          const { backfillRoomEmbeddings } = await import('../lib/backfill-all-embeddings')
                          await backfillRoomEmbeddings(roomId!)
                          alert('✅ Эмбединги пересозданы! Теперь поиск должен работать.')
                          setShowSearch(false)
                        } catch (error) {
                          console.error('Error backfilling:', error)
                          alert('Ошибка: ' + (error as Error).message)
                        } finally {
                          setBackfilling(false)
                        }
                      }}
                      disabled={backfilling}
                      className="mt-2 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {backfilling ? '⏳ Пересоздание...' : '🔄 Пересоздать эмбединги'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          
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
                  id={`message-${message.id}`}
                  key={message.id}
                  className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'} transition-colors duration-300`}
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

