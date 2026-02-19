
-- Add trigger_id and policy_id columns to notification_logs for anti-spam dedup
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS trigger_id uuid REFERENCES public.notification_triggers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.policies(id) ON DELETE SET NULL;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_dedup
ON public.notification_logs (client_id, trigger_id, policy_id)
WHERE trigger_id IS NOT NULL;
