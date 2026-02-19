
-- Add granular payment method permission keys for all existing roles
INSERT INTO public.role_permissions (role, permission_key, is_enabled)
SELECT r.role_name, p.key, true
FROM public.user_roles_list r
CROSS JOIN (
  VALUES ('pay_cash'), ('pay_card'), ('pay_sbp'), ('pay_transfer'), ('pay_debt')
) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role_name AND rp.permission_key = p.key
);
