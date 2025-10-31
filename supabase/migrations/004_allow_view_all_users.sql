-- Allow authenticated users to view all user profiles
-- This is needed for role management - admins and owners need to see all users to assign roles

-- Add new policy to allow viewing all users
CREATE POLICY "Authenticated users can view all users"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated');

