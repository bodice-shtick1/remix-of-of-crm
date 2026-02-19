
-- organization_settings policies
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow initial insert if empty"
ON public.organization_settings
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM public.organization_settings)
);

CREATE POLICY "Allow authenticated select"
ON public.organization_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin update"
ON public.organization_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- access_logs policies
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated insert logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow admin select logs"
ON public.access_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Allow admin delete logs"
ON public.access_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
