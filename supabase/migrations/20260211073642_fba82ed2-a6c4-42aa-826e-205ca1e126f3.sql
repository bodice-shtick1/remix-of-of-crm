-- Allow all authenticated users to READ audit_log_config (needed for checkCanReveal)
CREATE POLICY "Authenticated can read audit config"
ON public.audit_log_config
FOR SELECT
USING (true);