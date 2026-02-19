
-- Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "All authenticated can read permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can insert permissions"
ON public.role_permissions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update permissions"
ON public.role_permissions FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete permissions"
ON public.role_permissions FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-populate default permissions
-- Permission keys by category
DO $$
DECLARE
  perm_key text;
  all_permissions text[] := ARRAY[
    -- Dashboard
    'dash_view', 'dash_income_view', 'dash_debts_view', 'dash_birthdays_view', 'dash_tasks_view', 'dash_expiring_view',
    -- Clients
    'clients_view', 'clients_create', 'clients_edit', 'clients_delete', 'clients_export', 'clients_import',
    -- Sales
    'sales_view', 'sales_create', 'sales_edit', 'sales_delete', 'sale_payment_methods',
    -- Policies
    'policies_view', 'policies_create', 'policies_edit', 'policies_delete',
    -- Catalog
    'catalog_view', 'catalog_manage',
    -- Communication
    'communication_view', 'communication_send',
    -- Finances
    'finances_view', 'finances_manage',
    -- Reports
    'reports_shifts_view', 'reports_cash_view', 'reports_prolongation_view',
    -- Analytics
    'analytics_view',
    -- Notifications
    'notifications_view', 'notifications_manage',
    -- Team
    'team_view', 'team_manage',
    -- Settings
    'settings_view', 'settings_manage', 'settings_permissions',
    -- Event Log
    'event_log_view',
    -- Europrotocol
    'europrotocol_view', 'europrotocol_create'
  ];
BEGIN
  FOREACH perm_key IN ARRAY all_permissions LOOP
    -- Admin: all true
    INSERT INTO public.role_permissions (role, permission_key, is_enabled)
    VALUES ('admin', perm_key, true)
    ON CONFLICT (role, permission_key) DO NOTHING;

    -- Agent: view + create + edit, no delete/manage admin stuff
    INSERT INTO public.role_permissions (role, permission_key, is_enabled)
    VALUES ('agent', perm_key, 
      perm_key NOT IN ('clients_delete', 'sales_delete', 'policies_delete', 'analytics_view', 'team_view', 'team_manage', 'event_log_view', 'settings_permissions')
    )
    ON CONFLICT (role, permission_key) DO NOTHING;

    -- Viewer: only view permissions
    INSERT INTO public.role_permissions (role, permission_key, is_enabled)
    VALUES ('viewer', perm_key, 
      perm_key LIKE '%_view' AND perm_key NOT IN ('analytics_view', 'team_view', 'event_log_view', 'settings_permissions')
    )
    ON CONFLICT (role, permission_key) DO NOTHING;
  END LOOP;
END $$;
