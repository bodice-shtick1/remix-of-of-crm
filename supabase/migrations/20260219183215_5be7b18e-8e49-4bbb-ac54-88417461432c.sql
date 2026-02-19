
-- Create chat_message_reactions table
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- Participants in the room can view reactions
CREATE POLICY "Users can view reactions in their rooms"
ON public.chat_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_participants cp ON cp.room_id = cm.room_id
    WHERE cm.id = chat_message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

-- Participants can add their own reactions
CREATE POLICY "Users can add reactions in their rooms"
ON public.chat_message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_participants cp ON cp.room_id = cm.room_id
    WHERE cm.id = message_id AND cp.user_id = auth.uid()
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can delete own reactions"
ON public.chat_message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
