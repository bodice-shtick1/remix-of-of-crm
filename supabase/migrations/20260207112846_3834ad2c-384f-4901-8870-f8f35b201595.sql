
ALTER TABLE public.agent_settings
ADD COLUMN IF NOT EXISTS monthly_goal numeric NOT NULL DEFAULT 1000000;
