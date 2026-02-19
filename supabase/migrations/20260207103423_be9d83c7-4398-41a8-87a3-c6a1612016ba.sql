
-- Drop the overly permissive policy and replace with service-role-only insert
DROP POLICY "Service role full access" ON public.messenger_activity_logs;

-- Edge functions use service_role_key which bypasses RLS, so no extra policy needed
