
-- Add last_seen_at to profiles for online status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now();

-- Fix chat_rooms: add created_by, updated_at
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone DEFAULT now();

-- Fix chat_messages: add updated_at, media support
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS media_type text;

-- Fix chat_participants: add joined_at, last_read_at
ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS joined_at timestamp with time zone DEFAULT now();
ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS last_read_at timestamp with time zone;

-- Enable RLS on all chat tables
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS for chat_participants: users can see/manage rooms they're in
CREATE POLICY "Users can view own participations"
  ON public.chat_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own participation"
  ON public.chat_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own participation"
  ON public.chat_participants FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for chat_rooms: users can view rooms they participate in
CREATE POLICY "Users can view their chat rooms"
  ON public.chat_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.room_id = chat_rooms.id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated can create chat rooms"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants can update chat rooms"
  ON public.chat_rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.room_id = chat_rooms.id AND cp.user_id = auth.uid()
    )
  );

-- RLS for chat_messages: users can view/send messages in rooms they're in
CREATE POLICY "Users can view messages in their rooms"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.room_id = chat_messages.room_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their rooms"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.room_id = chat_messages.room_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Admin policies for chat_participants (to add others to group chats)
CREATE POLICY "Room creator can add participants"
  ON public.chat_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      WHERE cr.id = chat_participants.room_id AND cr.created_by = auth.uid()
    )
  );

-- Enable realtime for chat_messages and chat_participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

-- Function to update last_message_at on room when message is sent
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms SET last_message_at = now(), updated_at = now()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_room_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_last_message();

-- Function to update last_seen_at (called periodically from frontend)
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET last_seen_at = now()
  WHERE user_id = auth.uid();
END;
$$;
