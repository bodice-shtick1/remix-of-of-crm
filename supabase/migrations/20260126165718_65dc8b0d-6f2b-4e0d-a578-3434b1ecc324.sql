
-- Create banks table
CREATE TABLE public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent_settings table
CREATE TABLE public.agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  last_osago_series TEXT DEFAULT 'ХХХ',
  preferred_rounding_service_id UUID REFERENCES public.services_catalog(id),
  rounding_step INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sale_audit_log table
CREATE TABLE public.sale_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add is_installment column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for banks
CREATE POLICY "Authenticated can view banks" ON public.banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage banks" ON public.banks FOR ALL TO authenticated USING (true);

-- RLS policies for agent_settings
CREATE POLICY "Users can view own settings" ON public.agent_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.agent_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.agent_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS policies for sale_audit_log
CREATE POLICY "Authenticated can view audit log" ON public.sale_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit log" ON public.sale_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Add trigger for agent_settings updated_at
CREATE TRIGGER update_agent_settings_updated_at
  BEFORE UPDATE ON public.agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_agent_settings_user_id ON public.agent_settings(user_id);
CREATE INDEX idx_sale_audit_log_sale_id ON public.sale_audit_log(sale_id);
