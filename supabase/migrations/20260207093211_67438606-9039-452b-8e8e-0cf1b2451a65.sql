
-- Add is_automated flag to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_automated boolean NOT NULL DEFAULT false;

-- Create index for autopilot filter queries
CREATE INDEX IF NOT EXISTS idx_messages_is_automated ON public.messages (client_id, is_automated, created_at DESC) WHERE is_automated = true;
