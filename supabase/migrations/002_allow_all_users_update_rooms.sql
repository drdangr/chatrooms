-- Allow all authenticated users to update room settings (system_prompt, model)
-- This enables collaborative editing of room settings in multi-user scenarios

-- Drop the old policy that only allowed room creators to update
DROP POLICY IF EXISTS "Users can update own rooms" ON public.rooms;

-- Create new policy: all authenticated users can update rooms
-- This allows any user in a room to modify the system prompt and model settings
CREATE POLICY "Authenticated users can update rooms"
  ON public.rooms FOR UPDATE
  USING (auth.role() = 'authenticated');

