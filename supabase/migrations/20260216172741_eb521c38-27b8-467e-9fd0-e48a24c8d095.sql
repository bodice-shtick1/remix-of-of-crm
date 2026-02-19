
-- Add granular receipt permission keys for all existing roles
INSERT INTO public.role_permissions (role, permission_key, is_enabled)
SELECT r.role_name, p.key, true
FROM public.user_roles_list r
CROSS JOIN (
  VALUES ('receipt_none'), ('receipt_cash'), ('receipt_bill')
) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role_name AND rp.permission_key = p.key
);
