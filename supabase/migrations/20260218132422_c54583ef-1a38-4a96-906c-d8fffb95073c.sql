
-- Ensure clean state: drop and recreate
DROP POLICY IF EXISTS "Authenticated can insert chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow users to create rooms" ON public.chat_rooms;

-- Single permissive INSERT policy
CREATE POLICY "Authenticated can insert chat rooms"
ON public.chat_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Also fix the UPDATE policy to be properly scoped to authenticated
DROP POLICY IF EXISTS "Participants can update chat rooms" ON public.chat_rooms;
CREATE POLICY "Participants can update chat rooms"
ON public.chat_rooms FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = chat_rooms.id AND cp.user_id = auth.uid()
  )
);
