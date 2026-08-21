-- ============================================================
-- Bootstrap admin: the first user to sign up on a fresh database
-- automatically becomes admin with is_approved=true.
-- All subsequent users get role='etudiant' and is_approved=false.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
  is_first boolean;
BEGIN
  SELECT count(*) INTO user_count FROM profiles;
  is_first := (user_count = 0);

  INSERT INTO profiles (id, email, full_name, role, is_approved, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN is_first THEN 'admin'::user_role ELSE 'etudiant'::user_role END,
    is_first,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
