-- Allow users with 'owner' role to delete rooms, not just room creators
-- This enables role-based access control for room deletion

-- Drop the old policy that only allowed room creators to delete
DROP POLICY IF EXISTS "Users can delete own rooms" ON public.rooms;

-- Create new policy: room creators OR users with 'owner' role can delete rooms
CREATE POLICY "Owners and creators can delete rooms"
  ON public.rooms FOR DELETE
  USING (
    -- Room creator can delete
    auth.uid() = created_by
    OR
    -- User with 'owner' role can delete
    EXISTS (
      SELECT 1 FROM public.room_roles
      WHERE room_id = rooms.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

