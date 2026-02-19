-- Performance indexes for read receipts
CREATE INDEX IF NOT EXISTS idx_chat_participants_last_read ON public.chat_participants(last_read_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON public.chat_messages(room_id, created_at);

-- Enable realtime for chat_participants so read receipt updates are instant
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;