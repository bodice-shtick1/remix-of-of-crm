
-- Audit log configuration table
-- Stores which action types are enabled/disabled per role, plus user blacklist
CREATE TABLE public.audit_log_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'role_rule' or 'blacklist'
  rule_type text NOT NULL DEFAULT 'role_rule',
  -- For role_rule: 'admin' or 'agent'. For blacklist: null
  target_role text,
  -- For blacklist: specific user_id. For role_rule: null
  target_user_id text,
  -- action type: 'login','create','update','delete','view_contact','print' or '*' for blacklist
  action_type text NOT NULL DEFAULT '*',
  -- whether this logging is enabled
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write audit config
CREATE POLICY "Admins can manage audit config"
ON public.audit_log_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default config: everything enabled for both roles
INSERT INTO public.audit_log_config (rule_type, target_role, action_type, is_enabled) VALUES
  ('role_rule', 'admin', 'login', true),
  ('role_rule', 'admin', 'create', true),
  ('role_rule', 'admin', 'update', true),
  ('role_rule', 'admin', 'delete', true),
  ('role_rule', 'admin', 'view_contact', true),
  ('role_rule', 'admin', 'print', true),
  ('role_rule', 'agent', 'login', true),
  ('role_rule', 'agent', 'create', true),
  ('role_rule', 'agent', 'update', true),
  ('role_rule', 'agent', 'delete', true),
  ('role_rule', 'agent', 'view_contact', true),
  ('role_rule', 'agent', 'print', true);
