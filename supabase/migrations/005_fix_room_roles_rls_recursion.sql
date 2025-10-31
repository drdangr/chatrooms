-- Fix infinite recursion in room_roles RLS policy
-- The policy was checking room_roles table from within room_roles policy, causing recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view roles in accessible rooms" ON public.room_roles;

-- Create new policy that avoids recursion
-- All authenticated users can view roles (security is handled by application logic)
CREATE POLICY "Authenticated users can view roles"
  ON public.room_roles FOR SELECT
  USING (auth.role() = 'authenticated');

