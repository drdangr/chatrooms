import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
  const navigate = useNavigate()

  useEffect(() => {
    loadRooms()

    // Subscribe to changes in rooms table
    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        () => {
          loadRooms()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRooms(data || [])
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
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/room/${room.id}`)}
                className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                <div className="font-semibold text-gray-800">{room.title}</div>
                <div className="text-sm text-gray-500 mt-1">
                  Создано: {new Date(room.created_at).toLocaleDateString('ru-RU')}
                </div>
              </button>
            ))
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
