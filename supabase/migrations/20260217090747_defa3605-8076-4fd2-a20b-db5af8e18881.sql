
-- 1. Add missing roles to user_roles_list
INSERT INTO public.user_roles_list (role_name, description)
VALUES 
  ('admin', 'Администратор'),
  ('agent', 'Агент'),
  ('viewer', 'Наблюдатель')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Change default for custom_role_name to 'agent' (valid FK value)
ALTER TABLE public.profiles ALTER COLUMN custom_role_name SET DEFAULT 'agent';

-- 3. Create missing profiles for all existing users in user_roles
INSERT INTO public.profiles (user_id, full_name, custom_role_name)
SELECT ur.user_id, 
       COALESCE(
         (SELECT si.full_name FROM public.staff_invitations si WHERE si.claimed_by = ur.user_id LIMIT 1),
         'Сотрудник'
       ),
       ur.role
FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id);

-- 4. Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
