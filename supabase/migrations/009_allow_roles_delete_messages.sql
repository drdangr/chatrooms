-- Allow users with writer/admin/owner roles to delete any messages in the room
-- This enables role-based access control for message deletion

-- Drop the old policy that only allowed users to delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

-- Create new policy: users can delete their own messages OR users with writer/admin/owner roles can delete any messages in the room
CREATE POLICY "Users and role holders can delete messages"
  ON public.messages FOR DELETE
  USING (
    -- Users can delete their own messages
    auth.uid() = sender_id
    OR
    -- Users with writer, admin, or owner roles can delete any messages in the room
    EXISTS (
      SELECT 1 FROM public.room_roles
      WHERE room_id = messages.room_id
      AND user_id = auth.uid()
      AND role IN ('writer', 'admin', 'owner')
    )
  );

