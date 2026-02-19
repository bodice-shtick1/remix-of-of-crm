
-- Make client_id nullable for non-client events
ALTER TABLE public.access_logs ALTER COLUMN client_id DROP NOT NULL;

-- Add new columns for general event logging
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'access';
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS old_value text;
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS new_value text;
ALTER TABLE public.access_logs ADD COLUMN IF NOT EXISTS details jsonb;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_access_logs_category ON public.access_logs (category);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON public.access_logs (action);
