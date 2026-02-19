
-- Drop and recreate the bootstrap function with improved logic
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  _user_id uuid,
  _full_name text,
  _org_name text,
  _org_inn text DEFAULT NULL,
  _org_address text DEFAULT NULL,
  _org_currency text DEFAULT '₽',
  _org_timezone text DEFAULT 'Europe/Moscow'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if no organization exists yet
  IF EXISTS (SELECT 1 FROM public.organization_settings LIMIT 1) THEN
    RAISE EXCEPTION 'Organization already exists';
  END IF;

  -- Create organization
  INSERT INTO public.organization_settings (name, inn, address, currency, timezone, is_setup_complete, created_by)
  VALUES (_org_name, _org_inn, _org_address, _org_currency, _org_timezone, true, _user_id);

  -- Upsert profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_user_id, _full_name)
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Delete any existing roles for this user, then insert admin
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');
END;
$$;

-- Ensure profiles has unique constraint on user_id for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END$$;
