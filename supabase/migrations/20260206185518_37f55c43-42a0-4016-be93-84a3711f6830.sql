
-- Add test_mode column to agent_settings
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS notification_test_mode BOOLEAN NOT NULL DEFAULT true;
