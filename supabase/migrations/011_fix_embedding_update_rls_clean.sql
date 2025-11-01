DROP POLICY IF EXISTS "Users can update embeddings in accessible rooms" ON public.messages;

CREATE POLICY "Users can update embeddings in accessible rooms"
  ON public.messages FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = messages.room_id
      AND (
        EXISTS (
          SELECT 1 FROM public.room_roles rr
          WHERE rr.room_id = r.id
          AND rr.user_id = auth.uid()
        )
        OR r.created_by = auth.uid()
        OR messages.sender_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
  );

