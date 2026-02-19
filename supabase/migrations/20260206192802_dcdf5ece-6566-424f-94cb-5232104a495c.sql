
-- Add days-of-week schedule to agent_settings
-- Stored as integer array: 1=Mon, 2=Tue, ..., 7=Sun (ISO weekday)
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS auto_process_days integer[] DEFAULT '{1,2,3,4,5}';

COMMENT ON COLUMN public.agent_settings.auto_process_days IS 'ISO weekday numbers (1=Mon..7=Sun) when autopilot should run';

-- Add source column to notification_logs to distinguish manual vs scheduled
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN public.notification_logs.source IS 'Origin of the notification: manual, scheduled, or broadcast';
