
-- Create messenger activity logs table
CREATE TABLE public.messenger_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'max_web',
  event_type TEXT NOT NULL, -- 'auth', 'message_out', 'message_in', 'session_error', 'logout', 'suspicious_login'
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error'
  description TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messenger_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own activity logs"
  ON public.messenger_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity logs"
  ON public.messenger_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role full access"
  ON public.messenger_activity_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_messenger_activity_logs_user_channel
  ON public.messenger_activity_logs (user_id, channel, created_at DESC);

-- Auto-cleanup: delete logs older than 30 days via a trigger on insert
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.messenger_activity_logs
  WHERE created_at < now() - INTERVAL '30 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_activity_logs
  AFTER INSERT ON public.messenger_activity_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_activity_logs();
