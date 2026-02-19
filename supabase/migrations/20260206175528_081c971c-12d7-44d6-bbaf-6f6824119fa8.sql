
-- Table for storing messenger channel configurations per user
CREATE TABLE public.messenger_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL, -- 'whatsapp', 'telegram', 'max'
  is_active BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'not_configured', -- 'connected', 'error', 'not_configured'
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- channel-specific settings (api_key, phone, mode, bot_token)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

-- Enable RLS
ALTER TABLE public.messenger_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own settings
CREATE POLICY "Users can view own messenger settings"
  ON public.messenger_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messenger settings"
  ON public.messenger_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messenger settings"
  ON public.messenger_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messenger settings"
  ON public.messenger_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_messenger_settings_updated_at
  BEFORE UPDATE ON public.messenger_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
