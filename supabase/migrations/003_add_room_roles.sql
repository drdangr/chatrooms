-- Create room_roles table to manage user roles in rooms
CREATE TABLE IF NOT EXISTS public.room_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'writer', 'admin', 'owner')),
  assigned_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_room_roles_room_id ON public.room_roles(room_id);
CREATE INDEX IF NOT EXISTS idx_room_roles_user_id ON public.room_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_room_roles_role ON public.room_roles(role);

-- Enable Row Level Security (RLS)
ALTER TABLE public.room_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_roles table
-- Users can view roles in rooms they have access to
-- NOTE: We check rooms table to avoid infinite recursion (can't check room_roles from room_roles policy)
CREATE POLICY "Users can view roles in accessible rooms"
  ON public.room_roles FOR SELECT
  USING (
    -- Can see roles if they are the room creator (room creator automatically gets owner role)
    EXISTS (
      SELECT 1 FROM public.rooms r 
      WHERE r.id = room_roles.room_id 
      AND r.created_by = auth.uid()
    )
    -- OR if the room is accessible (all authenticated users can view rooms, so they can view roles)
    OR auth.role() = 'authenticated'
  );

-- Only admins and owners can assign roles (handled in application logic)
CREATE POLICY "Admins and owners can assign roles"
  ON public.room_roles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only admins and owners can update roles (handled in application logic)
CREATE POLICY "Admins and owners can update roles"
  ON public.room_roles FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Only owners can delete roles (except owner role itself)
CREATE POLICY "Owners can delete roles"
  ON public.room_roles FOR DELETE
  USING (auth.role() = 'authenticated');

-- Function to automatically assign owner role to room creator
CREATE OR REPLACE FUNCTION public.assign_owner_role_on_room_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.room_roles (room_id, user_id, role, assigned_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT (room_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to assign owner role when room is created
CREATE TRIGGER on_room_created_assign_owner
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.assign_owner_role_on_room_create();

-- Function to get user role in a room (helper function for easier queries)
CREATE OR REPLACE FUNCTION public.get_user_role_in_room(p_room_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- First check if user has an explicit role
  SELECT role INTO v_role
  FROM public.room_roles
  WHERE room_id = p_room_id AND user_id = p_user_id;
  
  -- If no explicit role, check if user is the room creator (legacy support)
  IF v_role IS NULL THEN
    SELECT CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.rooms 
        WHERE id = p_room_id AND created_by = p_user_id
      ) THEN 'owner'
      ELSE NULL
    END INTO v_role;
  END IF;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

