-- Grant owner role to drdangr@gmail.com for all existing and future rooms

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'drdangr@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email drdangr@gmail.com not found';
  END IF;

  -- Grant owner role for all existing rooms
  INSERT INTO public.room_roles (room_id, user_id, role, assigned_by)
  SELECT 
    r.id AS room_id,
    v_user_id AS user_id,
    'owner' AS role,
    v_user_id AS assigned_by
  FROM public.rooms r
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET 
    role = 'owner',
    assigned_by = v_user_id,
    updated_at = NOW();

  RAISE NOTICE 'Granted owner role to drdangr@gmail.com for all existing rooms';
END $$;

-- Modify the trigger function to also assign owner role to drdangr@gmail.com for future rooms
CREATE OR REPLACE FUNCTION public.assign_owner_role_on_room_create()
RETURNS TRIGGER AS $$
DECLARE
  v_drdangr_user_id UUID;
BEGIN
  -- Assign owner role to room creator
  INSERT INTO public.room_roles (room_id, user_id, role, assigned_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  -- Also assign owner role to drdangr@gmail.com
  SELECT id INTO v_drdangr_user_id
  FROM public.users
  WHERE email = 'drdangr@gmail.com';

  IF v_drdangr_user_id IS NOT NULL THEN
    INSERT INTO public.room_roles (room_id, user_id, role, assigned_by)
    VALUES (NEW.id, v_drdangr_user_id, 'owner', v_drdangr_user_id)
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

