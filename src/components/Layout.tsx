import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Multi-User LLM Chat
          </h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold"
          >
            Выйти
          </button>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
