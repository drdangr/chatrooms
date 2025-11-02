import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback - current URL:', window.location.href)
        console.log('Auth callback - current origin:', window.location.origin)
        
        // Check if we're on Vercel but should be on localhost
        // This can happen if Supabase redirects to Site URL instead of redirectTo
        const isVercel = window.location.origin.includes('vercel.app')
        const isLocalhost = window.location.origin.includes('localhost')
        
        // Handle the OAuth callback - Supabase may have added tokens to the URL hash
        // First, try to exchange the code/tokens from URL
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          // If we're on Vercel but should be local, redirect back to localhost
          if (isVercel && !isLocalhost) {
            console.warn('On Vercel but should be localhost - redirecting...')
            window.location.href = 'http://localhost:5173/auth/callback' + window.location.search + window.location.hash
          } else {
            navigate('/')
          }
          return
        }

        if (session) {
          // Successfully authenticated
          console.log('Session obtained, redirecting to /')
          
          // If we're on Vercel but should be localhost, redirect back
          if (isVercel && !isLocalhost) {
            console.warn('On Vercel after auth but should be localhost - redirecting to localhost')
            window.location.href = 'http://localhost:5173/'
          } else {
            navigate('/')
          }
        } else {
          // No session, redirect to home
          console.log('No session found, redirecting to /')
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

