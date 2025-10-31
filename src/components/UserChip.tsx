interface UserChipProps {
  name: string
  email: string
  size?: 'sm' | 'md'
  showEmail?: boolean
}

export default function UserChip({ name, email, size = 'md', showEmail = false }: UserChipProps) {
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

  const initials = getInitials(name, email)
  const displayName = name || email

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs'
    : 'px-2.5 py-1.5 text-sm'

  return (
    <div className={`inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 rounded-full ${sizeClasses}`}>
      <div className={`flex items-center justify-center rounded-full bg-blue-500 text-white font-medium ${size === 'sm' ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-xs'}`}>
        {initials}
      </div>
      <span className="font-medium truncate max-w-[120px]">
        {displayName}
      </span>
      {showEmail && email !== name && (
        <span className="text-blue-600 opacity-75 text-xs truncate max-w-[100px]">
          ({email})
        </span>
      )}
    </div>
  )
}

