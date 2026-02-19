-- Seed granular notification permission keys for all existing roles
INSERT INTO public.role_permissions (role, permission_key, is_enabled)
SELECT r.role_name, p.key, true
FROM public.user_roles_list r
CROSS JOIN (
  VALUES ('notify_queue_view'), ('notify_templates_manage'), ('notify_manual_send'), ('notify_automation_config'), ('notify_mass_bulk')
) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role_name AND rp.permission_key = p.key
);

-- Clean up the old non-existent key
DELETE FROM public.role_permissions WHERE permission_key = 'notifications_view';