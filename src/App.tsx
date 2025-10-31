import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Auth from './components/Auth'
import AuthCallback from './components/AuthCallback'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

