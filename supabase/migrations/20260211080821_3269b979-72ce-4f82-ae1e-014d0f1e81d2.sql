
-- Allow authenticated users to read their OWN access_logs (needed for rate limit counter)
CREATE POLICY "Users can read own access logs"
ON public.access_logs
FOR SELECT
USING (auth.uid() = user_id);
