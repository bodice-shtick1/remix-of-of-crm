
-- 1. RPC function to bootstrap the first admin (bypasses RLS via SECURITY DEFINER)
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

  -- Create profile if missing
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (_user_id, _full_name)
  ON CONFLICT DO NOTHING;

  -- Assign admin role (upsert)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT DO NOTHING;
END;
$$;

-- 2. Prevent multiple admins race condition
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_first_admin 
ON public.organization_settings ((true));
