// Temporary file to test Supabase connection
import { supabase } from './lib/supabase'

async function testConnection() {
  try {
    console.log('Testing Supabase connection...')
    
    // Simple test query - try to get current user
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Connection error:', error.message)
    } else {
      console.log('✅ Supabase connection successful!')
      console.log('Session:', data.session ? 'Active' : 'No active session')
    }
  } catch (error) {
    console.error('Failed to connect:', error)
  }
}

testConnection()

