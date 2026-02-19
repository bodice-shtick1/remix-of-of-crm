
-- Add columns for tracking Telegram message read status
ALTER TABLE public.notification_logs 
ADD COLUMN IF NOT EXISTS external_message_id text,
ADD COLUMN IF NOT EXISTS external_peer_id text;
