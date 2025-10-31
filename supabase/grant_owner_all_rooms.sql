-- Grant owner role to drdangr@gmail.com for ALL existing rooms
-- Run this script in Supabase SQL Editor

DO $$
DECLARE
  v_user_id UUID;
  v_rooms_count INTEGER;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'drdangr@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email drdangr@gmail.com not found. Please check the email address.';
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- Grant owner role for all existing rooms (upsert - update if exists, insert if not)
  INSERT INTO public.room_roles (room_id, user_id, role, assigned_by, updated_at)
  SELECT 
    r.id AS room_id,
    v_user_id AS user_id,
    'owner' AS role,
    v_user_id AS assigned_by,
    NOW() AS updated_at
  FROM public.rooms r
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    role = 'owner',
    assigned_by = v_user_id,
    updated_at = NOW();

  GET DIAGNOSTICS v_rooms_count = ROW_COUNT;
  RAISE NOTICE 'Successfully granted owner role to drdangr@gmail.com for % room(s)', v_rooms_count;

  -- Verify the result
  SELECT COUNT(*) INTO v_rooms_count
  FROM public.room_roles
  WHERE user_id = v_user_id AND role = 'owner';

  RAISE NOTICE 'Total rooms with owner role for drdangr@gmail.com: %', v_rooms_count;

END $$;

-- Show current rooms and roles for drdangr@gmail.com (verification query)
SELECT 
  r.id AS room_id,
  r.title AS room_title,
  r.created_by,
  rr.role,
  u.email AS room_creator_email
FROM public.rooms r
LEFT JOIN public.room_roles rr ON rr.room_id = r.id 
  AND rr.user_id = (SELECT id FROM public.users WHERE email = 'drdangr@gmail.com')
LEFT JOIN public.users u ON u.id = r.created_by
ORDER BY r.created_at DESC;

