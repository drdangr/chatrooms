import { useState } from 'react'
import { Role } from '../lib/roles'

interface UserChipProps {
  name: string
  email: string
  avatarUrl?: string | null
  role?: Role | null
  size?: 'sm' | 'md'
  showEmail?: boolean
}

export default function UserChip({ name, email, avatarUrl, role, size = 'md', showEmail = false }: UserChipProps) {
  const [imageError, setImageError] = useState(false)

  // Get initials from name or email
  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return name[0].toUpperCase()
    }
    return email[0].toUpperCase()
  }

  // Get role icon
  const getRoleIcon = (role: Role | null | undefined): string => {
    if (!role) return ''
    switch (role) {
      case 'viewer': return '👁️'
      case 'writer': return '✍️'
      case 'admin': return '⚙️'
      case 'owner': return '👑'
      default: return ''
    }
  }

  const initials = getInitials(name, email)
  const displayName = name || email
  const avatarSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'
  const roleIcon = getRoleIcon(role)

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs'
    : 'px-2.5 py-1.5 text-sm'

  const showAvatar = avatarUrl && !imageError

  return (
    <div className={`inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 rounded-full ${sizeClasses}`}>
      {showAvatar ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className={`rounded-full ${avatarSize} object-cover`}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`flex items-center justify-center rounded-full bg-blue-500 text-white font-medium ${avatarSize} text-xs`}>
          {initials}
        </div>
      )}
      <span className="font-medium truncate max-w-[120px]">
        {displayName}
      </span>
      {roleIcon && (
        <span className={`flex items-center justify-center ${avatarSize} text-base leading-none`} title={role || ''}>
          {roleIcon}
        </span>
      )}
      {showEmail && email !== name && (
        <span className="text-blue-600 opacity-75 text-xs truncate max-w-[100px]">
          ({email})
        </span>
      )}
    </div>
  )
}
