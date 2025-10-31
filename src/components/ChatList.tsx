import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserRoleInRoom, permissions, Role } from '../lib/roles'
import UserChip from './UserChip'

interface Room {
  id: string
  title: string
  system_prompt: string
  model: string
  created_by: string
  created_at: string
}

export default function ChatList() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newRoomTitle, setNewRoomTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingRoomTitle, setEditingRoomTitle] = useState('')
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [roomRoles, setRoomRoles] = useState<Map<string, Role>>(new Map())
  const [roomCreators, setRoomCreators] = useState<Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>>(new Map())
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) {
      loadRooms()
    }
  }, [currentUser])

  useEffect(() => {
    loadUser()

    // Subscribe to changes in rooms table
    const channel = supabase
      .channel('rooms-changes', {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        (payload) => {
          console.log('Rooms change detected:', payload)
          loadRooms()
        }
      )
      .subscribe((status) => {
        console.log('Rooms subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to rooms changes')
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error - Realtime may not be enabled for rooms table')
        }
      })

    return () => {
      console.log('Unsubscribing from rooms channel')
      supabase.removeChannel(channel)
    }
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRooms(data || [])
      
      // Load roles for current user in all rooms
      if (currentUser?.id) {
        const rolesMap = new Map<string, Role>()
        for (const room of data || []) {
          const role = await getUserRoleInRoom(room.id, currentUser.id, supabase)
          if (role) {
            rolesMap.set(room.id, role)
          }
        }
        setRoomRoles(rolesMap)
      }

      // Load creator info for all rooms
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(r => r.created_by))]
        const { data: creators, error: creatorsError } = await supabase
          .from('users')
          .select('id, name, email, avatar_url')
          .in('id', creatorIds)

        if (!creatorsError && creators) {
          const creatorsMap = new Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>()
          creators.forEach(creator => {
            creatorsMap.set(creator.id, {
              id: creator.id,
              name: creator.name || creator.email,
              email: creator.email,
              avatarUrl: creator.avatar_url
            })
          })
          setRoomCreators(creatorsMap)
        }
      }
    } catch (error) {
      console.error('Error loading rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          title: newRoomTitle.trim(),
          system_prompt: 'Вы - полезный ассистент.',
          model: 'gpt-4o-mini',
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      setShowCreateModal(false)
      setNewRoomTitle('')
      navigate(`/room/${data.id}`)
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Ошибка при создании комнаты: ' + (error as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleStartEditRoom = (room: Room) => {
    setEditingRoomId(room.id)
    setEditingRoomTitle(room.title)
  }

  const handleSaveEditRoom = async () => {
    if (!editingRoomId || !editingRoomTitle.trim()) return

    const userRole = roomRoles.get(editingRoomId) ?? null
    if (!permissions.canRenameRoom(userRole)) {
      alert('У вас нет прав для переименования этой комнаты')
      return
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ title: editingRoomTitle.trim() })
        .eq('id', editingRoomId)

      if (error) throw error

      setEditingRoomId(null)
      setEditingRoomTitle('')
      loadRooms()
    } catch (error) {
      console.error('Error updating room:', error)
      alert('Ошибка при переименовании комнаты: ' + (error as Error).message)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    const userRole = roomRoles.get(roomId) ?? null
    if (!permissions.canDeleteRoom(userRole)) {
      alert('У вас нет прав для удаления этой комнаты')
      return
    }

    if (!confirm('Вы уверены, что хотите удалить эту комнату? Все сообщения будут удалены.')) return

    setDeletingRoomId(roomId)
    try {
      console.log('Attempting to delete room:', roomId, 'with role:', userRole)
      const { data, error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)
        .select()

      if (error) {
        console.error('Delete error:', error)
        throw error
      }

      console.log('Delete successful, deleted rows:', data)

      // Navigate away if we're in this room
      if (window.location.pathname.includes(roomId)) {
        navigate('/rooms')
      }
      
      loadRooms()
    } catch (error) {
      console.error('Error deleting room:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert('Ошибка при удалении комнаты: ' + errorMessage)
    } finally {
      setDeletingRoomId(null)
    }
  }

  const filteredRooms = rooms.filter(room =>
    room.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Загрузка комнат...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Комнаты чата</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
          >
            + Создать комнату
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Поиск комнат..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          {filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'Комнаты не найдены' : 'Нет созданных комнат'}
            </div>
          ) : (
            filteredRooms.map((room) => {
              const userRole = roomRoles.get(room.id) ?? null
              const isEditing = editingRoomId === room.id
              const canEdit = permissions.canRenameRoom(userRole)
              const canDelete = permissions.canDeleteRoom(userRole)
              
              return (
                <div
                  key={room.id}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingRoomTitle}
                        onChange={(e) => setEditingRoomTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEditRoom()
                          }
                          if (e.key === 'Escape') {
                            setEditingRoomId(null)
                            setEditingRoomTitle('')
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEditRoom}
                        className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingRoomId(null)
                          setEditingRoomTitle('')
                        }}
                        className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/room/${room.id}`)}
                        className="flex-1 text-left hover:opacity-80 transition-opacity"
                        type="button"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-gray-800">{room.title}</div>
                          {roomCreators.has(room.created_by) && (() => {
                            const creator = roomCreators.get(room.created_by)!
                            return <UserChip name={creator.name} email={creator.email} avatarUrl={creator.avatarUrl} size="sm" />
                          })()}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Создано: {new Date(room.created_at).toLocaleDateString('ru-RU')}
                        </div>
                      </button>
                      {(canEdit || canDelete) && (
                        <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleStartEditRoom(room)
                              }}
                              className="p-2 rounded transition-colors flex-shrink-0 relative z-10 text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="Переименовать"
                              type="button"
                              style={{ pointerEvents: 'auto' }}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleDeleteRoom(room.id)
                              }}
                              disabled={deletingRoomId === room.id}
                              className={`p-2 rounded transition-colors flex-shrink-0 relative z-10 ${
                                deletingRoomId !== room.id
                                  ? 'text-red-600 hover:bg-red-50 cursor-pointer' 
                                  : 'text-gray-400 cursor-not-allowed opacity-50'
                              }`}
                              title="Удалить"
                              type="button"
                              style={{ pointerEvents: 'auto' }}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Создать новую комнату</h3>
            <input
              type="text"
              placeholder="Название комнаты"
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  handleCreateRoom()
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleCreateRoom}
                disabled={creating || !newRoomTitle.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewRoomTitle('')
                }}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors disabled:bg-gray-200 font-semibold"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
