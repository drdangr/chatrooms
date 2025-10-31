import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Role, getUserRoleInRoom, canAssignRole, permissions } from '../lib/roles'

interface RoleManagementProps {
  roomId: string
  currentUserId: string
}

interface UserWithRole {
  user_id: string
  email: string
  name: string
  role: Role | null
}

export default function RoleManagement({ roomId, currentUserId }: RoleManagementProps) {
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<Role | ''>('')
  const [userRolesMap, setUserRolesMap] = useState<Map<string, Role>>(new Map())

  useEffect(() => {
    loadData()
    loadAllUsers()
  }, [roomId, currentUserId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get current user role
      const role = await getUserRoleInRoom(roomId, currentUserId, supabase)
      setCurrentUserRole(role)

      // Get all users with roles in this room
      const { data: rolesData, error: rolesError } = await supabase
        .from('room_roles')
        .select('user_id, role')
        .eq('room_id', roomId)

      if (rolesError) throw rolesError

      // Get user details for each role
      const userIds = (rolesData || []).map((r: any) => r.user_id)
      let usersData: any[] = []
      
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', userIds)
        
        if (!usersError && users) {
          usersData = users
        }
      }

      // Combine roles with user data
      const usersMap = new Map(usersData.map((u: any) => [u.id, u]))
      const usersWithRoles: UserWithRole[] = (rolesData || []).map((item: any) => {
        const user = usersMap.get(item.user_id)
        return {
          user_id: item.user_id,
          email: user?.email || 'unknown',
          name: user?.name || user?.email || 'unknown',
          role: item.role,
        }
      })

      setUsers(usersWithRoles)
    } catch (error) {
      console.error('Error loading roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name')
        .order('email', { ascending: true })

      if (error) {
        console.error('Error loading users:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }

      console.log('Loaded users:', data?.length || 0, 'users')
      console.log('Users data:', data)
      setAllUsers(data || [])

      // Load roles for all users in this room
      if (data && data.length > 0) {
        const userIds = data.map(u => u.id)
        const { data: rolesData, error: rolesError } = await supabase
          .from('room_roles')
          .select('user_id, role')
          .eq('room_id', roomId)
          .in('user_id', userIds)

        if (!rolesError && rolesData) {
          const rolesMap = new Map<string, Role>()
          rolesData.forEach((item: any) => {
            rolesMap.set(item.user_id, item.role)
          })
          setUserRolesMap(rolesMap)
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
      alert('Ошибка при загрузке пользователей. Убедитесь, что применена миграция 004_allow_view_all_users.sql')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleAssignRoleToSelected = async () => {
    if (!selectedUserId || !selectedRole) return

    await handleAssignRole(selectedUserId, selectedRole)
    // Reset selection
    setSelectedUserId('')
    setSelectedRole('')
  }

  const handleAssignRole = async (userId: string, newRole: Role) => {
    if (!currentUserRole) return

    if (!canAssignRole(currentUserRole, newRole)) {
      alert('У вас нет прав для назначения этой роли')
      return
    }

    setAssigning(userId)
    try {
      // Check if role already exists
      const { data: existing, error: checkError } = await supabase
        .from('room_roles')
        .select('id, role')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existing) {
        // Update existing role (user already has a role, just change it)
        console.log(`Updating role from ${existing.role} to ${newRole} for user ${userId}`)
        const { error } = await supabase
          .from('room_roles')
          .update({
            role: newRole,
            assigned_by: currentUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Insert new role (user doesn't have a role yet)
        console.log(`Creating new role ${newRole} for user ${userId}`)
        const { error } = await supabase
          .from('room_roles')
          .insert({
            room_id: roomId,
            user_id: userId,
            role: newRole,
            assigned_by: currentUserId,
          })

        if (error) {
          // If duplicate key error, role was created between check and insert (race condition)
          // Try update instead
          if (error.code === '23505' || error.message?.includes('duplicate key')) {
            console.log('Race condition detected, updating instead')
            const { error: updateError } = await supabase
              .from('room_roles')
              .update({
                role: newRole,
                assigned_by: currentUserId,
                updated_at: new Date().toISOString(),
              })
              .eq('room_id', roomId)
              .eq('user_id', userId)

            if (updateError) throw updateError
          } else {
            throw error
          }
        }
      }

      // Reload data and update roles map
      await loadData()
      // Also reload user roles map
      if (allUsers.length > 0) {
        const userIds = allUsers.map(u => u.id)
        const { data: rolesData } = await supabase
          .from('room_roles')
          .select('user_id, role')
          .eq('room_id', roomId)
          .in('user_id', userIds)

        if (rolesData) {
          const rolesMap = new Map<string, Role>()
          rolesData.forEach((item: any) => {
            rolesMap.set(item.user_id, item.role)
          })
          setUserRolesMap(rolesMap)
        }
      }
    } catch (error) {
      console.error('Error assigning role:', error)
      alert('Ошибка при назначении роли: ' + (error as Error).message)
    } finally {
      setAssigning(null)
    }
  }

  const handleRemoveRole = async (userId: string) => {
    if (!currentUserRole || currentUserRole !== 'owner') {
      alert('Только владелец может удалять роли')
      return
    }

    if (!confirm('Удалить роль у этого пользователя?')) return

    try {
      const { error } = await supabase
        .from('room_roles')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId)

      if (error) throw error

      await loadData()
      // Also reload user roles map
      if (allUsers.length > 0) {
        const userIds = allUsers.map(u => u.id)
        const { data: rolesData } = await supabase
          .from('room_roles')
          .select('user_id, role')
          .eq('room_id', roomId)
          .in('user_id', userIds)

        if (rolesData) {
          const rolesMap = new Map<string, Role>()
          rolesData.forEach((item: any) => {
            rolesMap.set(item.user_id, item.role)
          })
          setUserRolesMap(rolesMap)
        }
      }
    } catch (error) {
      console.error('Error removing role:', error)
      alert('Ошибка при удалении роли: ' + (error as Error).message)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Загрузка ролей...</div>
  }

  if (!permissions.canManageRoles(currentUserRole)) {
    return (
      <div className="text-center py-4 text-gray-500">
        У вас нет прав для управления ролями в этой комнате
      </div>
    )
  }

  const assignableRoles: Role[] = currentUserRole === 'owner'
    ? ['viewer', 'writer', 'admin', 'owner']
    : ['viewer', 'writer', 'admin']

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold mb-3">Управление ролями</h4>
        <p className="text-sm text-gray-600 mb-4">
          Ваша роль: <span className="font-semibold">{currentUserRole || 'нет роли'}</span>
        </p>
      </div>

      {/* Add user with role */}
      <div className="border-b pb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Добавить пользователя
        </label>
        <div className="flex gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={loadingUsers}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Выберите пользователя</option>
            {allUsers
              .filter((user) => !users.some((u) => u.user_id === user.id))
              .map((user) => {
                const currentRole = userRolesMap.get(user.id)
                const roleLabel = currentRole 
                  ? currentRole === 'viewer' ? '👁️ Viewer' :
                    currentRole === 'writer' ? '✍️ Writer' :
                    currentRole === 'admin' ? '⚙️ Admin' :
                    currentRole === 'owner' ? '👑 Owner' : currentRole
                  : ''
                const displayName = `${user.name || user.email}${currentRole ? ` - ${roleLabel}` : ''}`
                return (
                  <option key={user.id} value={user.id}>
                    {displayName}
                  </option>
                )
              })}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role | '')}
            disabled={!selectedUserId}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Роль</option>
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {role === 'viewer' && '👁️ Viewer'}
                {role === 'writer' && '✍️ Writer'}
                {role === 'admin' && '⚙️ Admin'}
                {role === 'owner' && '👑 Owner'}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssignRoleToSelected}
            disabled={!selectedUserId || !selectedRole || assigning !== null}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* Current users with roles */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Пользователи комнаты
        </label>
        {users.length === 0 ? (
          <div className="text-center py-4 text-gray-500">Нет назначенных пользователей</div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <div className="flex-1">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignRole(user.user_id, e.target.value as Role)
                      }
                    }}
                    disabled={assigning === user.user_id || !canAssignRole(currentUserRole, user.role || 'viewer')}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role === 'viewer' && '👁️ Viewer'}
                        {role === 'writer' && '✍️ Writer'}
                        {role === 'admin' && '⚙️ Admin'}
                        {role === 'owner' && '👑 Owner'}
                      </option>
                    ))}
                  </select>
                  {currentUserRole === 'owner' && user.user_id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveRole(user.user_id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Удалить роль"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role descriptions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs">
        <div className="font-semibold mb-2">Описание ролей:</div>
        <div className="space-y-1 text-gray-700">
          <div><strong>👁️ Viewer:</strong> может только просматривать чат</div>
          <div><strong>✍️ Writer:</strong> может писать и удалять сообщения</div>
          <div><strong>⚙️ Admin:</strong> может менять настройки комнаты, но не удалять её</div>
          <div><strong>👑 Owner:</strong> полный доступ, включая удаление комнаты</div>
        </div>
      </div>
    </div>
  )
}

