import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import AuthCallback from './components/AuthCallback'
import Layout from './components/Layout'
import ChatList from './components/ChatList'
import ChatRoom from './components/ChatRoom'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Загрузка...</div>
      </div>
    )
  }

  return authenticated ? <>{children}</> : <Navigate to="/" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Auth />} />
        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <Layout>
                <ChatList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute>
              <Layout>
                <ChatRoom />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
