
-- Add new columns to notification_logs
ALTER TABLE public.notification_logs 
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS broadcast_id uuid;

-- Create automation_rules table
CREATE TABLE public.automation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  slug text NOT NULL,
  trigger_type text NOT NULL, -- 'policy_expiry', 'birthday', 'debt_reminder'
  is_active boolean NOT NULL DEFAULT false,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"days_before": 14}
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automation rules"
  ON public.automation_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own automation rules"
  ON public.automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules"
  ON public.automation_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules"
  ON public.automation_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Create mass_broadcasts table
CREATE TABLE public.mass_broadcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  audience_filter text NOT NULL DEFAULT 'all', -- 'all', 'with_debts', 'by_company'
  audience_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mass_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own broadcasts"
  ON public.mass_broadcasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own broadcasts"
  ON public.mass_broadcasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own broadcasts"
  ON public.mass_broadcasts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own broadcasts"
  ON public.mass_broadcasts FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for broadcast_id in notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_broadcast_id ON public.notification_logs(broadcast_id);

-- Timestamp trigger for automation_rules
CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Timestamp trigger for mass_broadcasts
CREATE TRIGGER update_mass_broadcasts_updated_at
  BEFORE UPDATE ON public.mass_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
