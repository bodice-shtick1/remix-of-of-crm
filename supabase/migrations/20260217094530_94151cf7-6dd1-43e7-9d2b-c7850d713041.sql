-- Seed europrotocol_view permission for all existing roles
INSERT INTO public.role_permissions (role, permission_key, is_enabled)
SELECT r.role_name, 'europrotocol_view', (r.role_name = 'admin')
FROM public.user_roles_list r
ON CONFLICT DO NOTHING;