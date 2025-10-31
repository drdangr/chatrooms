import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          navigate('/')
          return
        }

        if (data.session) {
          // Successfully authenticated
          navigate('/')
        } else {
          // No session, redirect to home
          navigate('/')
        }
      } catch (error) {
        console.error('Error in auth callback:', error)
        navigate('/')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg mb-2">Обработка авторизации...</div>
        <div className="text-gray-500">Пожалуйста, подождите</div>
      </div>
    </div>
  )
}

