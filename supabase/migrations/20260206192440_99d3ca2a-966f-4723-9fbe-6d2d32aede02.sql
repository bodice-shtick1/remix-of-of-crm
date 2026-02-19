
-- Add auto_process_time and last_auto_run columns to agent_settings
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS auto_process_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS last_auto_run_date date;

-- Comment for clarity
COMMENT ON COLUMN public.agent_settings.auto_process_time IS 'HH:MM format - time of day for automatic trigger processing';
COMMENT ON COLUMN public.agent_settings.last_auto_run_date IS 'Date of last automatic trigger run to prevent duplicate runs';
