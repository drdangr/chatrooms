export interface Room {
  id: string
  title: string
  system_prompt: string
  model: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  room_id: string
  sender_id: string | null
  sender_name: string
  text: string
  timestamp: string
  created_at: string
}

export interface User {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
}

