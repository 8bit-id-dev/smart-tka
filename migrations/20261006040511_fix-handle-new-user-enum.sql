-- Update handle_new_user to cast role and jenjang to enum types
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_anonymous THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, jenjang, is_active)
  VALUES (
    NEW.id::text,
    COALESCE(
      NULLIF(NEW.profile->>'full_name', ''),
      NULLIF(NEW.profile->>'name', ''),
      NULLIF(NEW.metadata->>'full_name', ''),
      NULLIF(NEW.metadata->>'name', ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      'Pengguna'
    ),
    COALESCE(NULLIF(NEW.profile->>'role', ''), NULLIF(NEW.metadata->>'role', ''), 'siswa')::user_role,
    COALESCE(NULLIF(NEW.profile->>'jenjang', ''), NULLIF(NEW.metadata->>'jenjang', ''), 'sma')::jenjang,
    TRUE
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    jenjang = EXCLUDED.jenjang;

  RETURN NEW;
END;
$$;