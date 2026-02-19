
-- Drop all policies that reference the role column or app_role enum
DROP POLICY IF EXISTS "Admins manage permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Only admins can insert permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Only admins can update permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Only admins can delete permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "All authenticated can read permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can view permissions" ON public.role_permissions;

-- Change role column from enum to text
ALTER TABLE public.role_permissions 
  ALTER COLUMN role TYPE text USING role::text;

-- Recreate RLS policies without enum casts
CREATE POLICY "All authenticated can read permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert permissions"
  ON public.role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update permissions"
  ON public.role_permissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete permissions"
  ON public.role_permissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
