
-- Add restriction_bypass_until column to audit_log_config
ALTER TABLE public.audit_log_config
ADD COLUMN IF NOT EXISTS restriction_bypass_until timestamptz DEFAULT NULL;
