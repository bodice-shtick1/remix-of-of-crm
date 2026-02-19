
-- Fix chat_participants: drop all policies and recreate clean ones
DROP POLICY IF EXISTS "Manage participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Room creator can add any participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can delete own participation" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view room participants" ON public.chat_participants;

-- SELECT: authenticated users can see participants (no self-reference)
CREATE POLICY "Authenticated can view participants"
ON public.chat_participants FOR SELECT TO authenticated
USING (true);

-- INSERT: room creator can add participants
CREATE POLICY "Room creator can add participants"
ON public.chat_participants FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_rooms cr
    WHERE cr.id = chat_participants.room_id
      AND cr.created_by = auth.uid()
  )
);

-- UPDATE: own participation only
CREATE POLICY "Users can update own participation"
ON public.chat_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- DELETE: own participation only
CREATE POLICY "Users can delete own participation"
ON public.chat_participants FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Fix chat_rooms SELECT policy (had bug: compared wrong columns)
DROP POLICY IF EXISTS "View joined rooms" ON public.chat_rooms;

CREATE POLICY "View joined rooms"
ON public.chat_rooms FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = chat_rooms.id
      AND cp.user_id = auth.uid()
  )
);

-- Also drop duplicate INSERT policy
DROP POLICY IF EXISTS "Allow users to create rooms" ON public.chat_rooms;
