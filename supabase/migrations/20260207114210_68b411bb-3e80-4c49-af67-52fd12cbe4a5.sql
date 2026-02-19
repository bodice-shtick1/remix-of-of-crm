
-- Organization settings for first-run wizard
CREATE TABLE public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  inn text,
  address text,
  logo_url text,
  is_setup_complete boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view org settings"
  ON public.organization_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage org settings"
  ON public.organization_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Access logs for anti-leak tracking
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'view_contact',
  field_accessed text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own access logs"
  ON public.access_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all access logs"
  ON public.access_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for client search performance
CREATE INDEX IF NOT EXISTS idx_clients_last_name ON public.clients (last_name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients (phone);
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON public.clients (agent_id);
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON public.policies (client_id);
CREATE INDEX IF NOT EXISTS idx_policies_end_date ON public.policies (end_date);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id_created ON public.access_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_client_id ON public.access_logs (client_id);

-- Trigger for updated_at on org settings
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
