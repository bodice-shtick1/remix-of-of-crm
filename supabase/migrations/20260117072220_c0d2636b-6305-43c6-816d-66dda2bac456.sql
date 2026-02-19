-- Add rounding_step column to agent_settings table
ALTER TABLE public.agent_settings
ADD COLUMN rounding_step integer NOT NULL DEFAULT 100;