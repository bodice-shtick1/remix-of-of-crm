
-- Add mentioned_user_ids column to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] DEFAULT '{}';
