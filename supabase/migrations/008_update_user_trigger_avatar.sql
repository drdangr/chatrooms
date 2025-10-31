-- Update the trigger function to save avatar_url from Google OAuth
-- Google OAuth provides avatar in user_metadata.avatar_url or user_metadata.picture

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update existing users who might have avatars in auth.users but not in public.users
UPDATE public.users u
SET avatar_url = COALESCE(
  (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = u.id),
  (SELECT raw_user_meta_data->>'picture' FROM auth.users WHERE id = u.id),
  u.avatar_url
)
WHERE u.avatar_url IS NULL
AND EXISTS (
  SELECT 1 FROM auth.users au 
  WHERE au.id = u.id 
  AND (au.raw_user_meta_data->>'avatar_url' IS NOT NULL OR au.raw_user_meta_data->>'picture' IS NOT NULL)
);

