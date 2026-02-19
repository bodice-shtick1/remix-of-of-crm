-- Ensure default roles always exist in user_roles_list
INSERT INTO public.user_roles_list (role_name, description) VALUES
  ('admin', 'Администратор'),
  ('agent', 'Агент'),
  ('viewer', 'Наблюдатель')
ON CONFLICT (role_name) DO NOTHING;

-- Create a trigger function to prevent deletion of default roles
CREATE OR REPLACE FUNCTION public.protect_default_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.role_name IN ('admin', 'agent', 'viewer') THEN
    RAISE EXCEPTION 'Cannot delete default role: %', OLD.role_name;
  END IF;
  RETURN OLD;
END;
$$;

-- Attach the trigger
DROP TRIGGER IF EXISTS prevent_default_role_deletion ON public.user_roles_list;
CREATE TRIGGER prevent_default_role_deletion
  BEFORE DELETE ON public.user_roles_list
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_default_roles();
