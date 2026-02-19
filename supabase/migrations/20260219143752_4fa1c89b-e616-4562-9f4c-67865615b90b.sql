
-- Add is_deleted column for soft delete
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
