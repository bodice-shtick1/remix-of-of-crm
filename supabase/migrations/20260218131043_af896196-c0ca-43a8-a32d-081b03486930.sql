
-- Clean up duplicate/conflicting policies on chat_rooms
DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view their chat rooms" ON public.chat_rooms;

-- Recreate clean INSERT policy for chat_rooms
CREATE POLICY "Authenticated can insert chat rooms"
ON public.chat_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Clean up duplicate/conflicting policies on chat_participants
DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can insert own participation" ON public.chat_participants;
DROP POLICY IF EXISTS "Room creator can add participants" ON public.chat_participants;

-- Allow room creator to add any participants (needed for DM + group creation)
CREATE POLICY "Room creator can add any participants"
ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_rooms cr
    WHERE cr.id = chat_participants.room_id
    AND cr.created_by = auth.uid()
  )
);

-- Allow users to see participants of rooms they belong to (needed for resolving names)
DROP POLICY IF EXISTS "Users can view own participations" ON public.chat_participants;
CREATE POLICY "Users can view room participants"
ON public.chat_participants FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants my
    WHERE my.room_id = chat_participants.room_id
    AND my.user_id = auth.uid()
  )
);

-- Allow users to update their own participation (mark read)
CREATE POLICY "Users can update own participation"
ON public.chat_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Clean up duplicate INSERT policies on chat_messages
DROP POLICY IF EXISTS "Users can send messages to their rooms" ON public.chat_messages;
