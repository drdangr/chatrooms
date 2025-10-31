import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import DBConnectionTest from './DBConnectionTest'

export default function Auth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      // Auto-redirect to rooms if authenticated
      if (session?.user && window.location.pathname === '/') {
        window.location.href = '/rooms'
      }
    })

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Auto-redirect to rooms if authenticated
      if (session?.user && window.location.pathname === '/') {
        window.location.href = '/rooms'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error('Error signing in:', error.message)
      alert('Ошибка входа: ' + error.message)
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white p-8 rounded-lg shadow-md mb-6">
            <h2 className="text-2xl font-bold mb-4">Добро пожаловать!</h2>
            <div className="mb-4">
              <p className="text-gray-700">
                <strong>Email:</strong> {user.email}
              </p>
              {user.user_metadata?.name && (
                <p className="text-gray-700">
                  <strong>Имя:</strong> {user.user_metadata.name}
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              Выйти
            </button>
          </div>
          
          <div className="mt-6">
            <a
              href="/rooms"
              className="block w-full text-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
            >
              Перейти к комнатам →
            </a>
          </div>

          <div className="mt-6">
            <DBConnectionTest />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">
          Multi-User LLM Chat
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          Войдите, чтобы продолжить
        </p>
        <button
          onClick={handleSignInWithGoogle}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Войти через Google
        </button>
        <p className="text-xs text-gray-500 text-center mt-4">
          Продолжая, вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  )
}
