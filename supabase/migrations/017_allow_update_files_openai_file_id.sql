-- Разрешить обновление поля openai_file_id для файлов
-- Это необходимо для сохранения OpenAI File ID после загрузки файлов в OpenAI

-- Аутентифицированные пользователи могут обновлять openai_file_id для файлов в доступных им комнатах
CREATE POLICY "Authenticated users can update files openai_file_id"
  ON public.files FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = files.room_id
      AND (
        -- Пользователь имеет роль в комнате
        EXISTS (
          SELECT 1 FROM public.room_roles rr
          WHERE rr.room_id = r.id
          AND rr.user_id = auth.uid()
        )
        -- ИЛИ пользователь создал комнату
        OR r.created_by = auth.uid()
        -- ИЛИ пользователь загрузил файл
        OR files.uploaded_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    -- Разрешаем обновление только если пользователь имеет доступ к комнате
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = files.room_id
      AND (
        EXISTS (
          SELECT 1 FROM public.room_roles rr
          WHERE rr.room_id = r.id
          AND rr.user_id = auth.uid()
        )
        OR r.created_by = auth.uid()
        OR files.uploaded_by = auth.uid()
      )
    )
  );

