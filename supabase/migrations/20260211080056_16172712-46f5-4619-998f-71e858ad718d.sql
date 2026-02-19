
-- Add config_value column to audit_log_config for storing numeric settings
ALTER TABLE public.audit_log_config ADD COLUMN IF NOT EXISTS config_value integer;

-- Insert default rate limit setting (30 views per hour)
INSERT INTO public.audit_log_config (rule_type, action_type, is_enabled, config_value)
VALUES ('rate_limit', 'contact_view_limit', true, 30);
