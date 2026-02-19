-- Add delivery_status column to messages table for tracking sent/read/error states
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sent';

-- Add index for efficient read-status queries
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status 
ON public.messages (delivery_status) 
WHERE delivery_status != 'read';