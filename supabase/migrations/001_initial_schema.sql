-- Create users table (extends Supabase auth.users)
-- Note: Supabase Auth automatically creates auth.users table
-- We create a public.users table for additional user data
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  system_prompt TEXT DEFAULT '',
  model TEXT DEFAULT 'gpt-4o-mini',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.users(id),
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON public.rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_files_room_id ON public.files(room_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON public.files(uploaded_by);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for rooms table
-- Anyone authenticated can create a room
CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can view rooms they created or are participants in (for now, all authenticated users)
CREATE POLICY "Authenticated users can view rooms"
  ON public.rooms FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can update rooms they created
CREATE POLICY "Users can update own rooms"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete rooms they created
CREATE POLICY "Users can delete own rooms"
  ON public.rooms FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for messages table
-- Authenticated users can insert messages
CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can view messages in rooms they have access to
CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- RLS Policies for files table
-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload files"
  ON public.files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can view files in rooms they have access to
CREATE POLICY "Authenticated users can view files"
  ON public.files FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can delete files they uploaded
CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Function to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

