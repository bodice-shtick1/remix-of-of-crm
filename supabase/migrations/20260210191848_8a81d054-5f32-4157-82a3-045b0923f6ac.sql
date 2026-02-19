-- Allow anonymous users to insert login_failed events
CREATE POLICY "Allow anon insert login_failed"
ON public.access_logs
FOR INSERT
TO anon
WITH CHECK (action = 'login_failed');