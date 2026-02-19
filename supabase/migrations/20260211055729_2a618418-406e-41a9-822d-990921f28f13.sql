
-- Drop all existing INSERT policies on access_logs
DROP POLICY IF EXISTS "Allow anon insert login_failed" ON public.access_logs;
DROP POLICY IF EXISTS "Allow authenticated insert logs" ON public.access_logs;
DROP POLICY IF EXISTS "Users can insert own access logs" ON public.access_logs;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Authenticated users can insert own logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon can insert login_failed logs"
ON public.access_logs
FOR INSERT
TO anon
WITH CHECK (action = 'login_failed');
