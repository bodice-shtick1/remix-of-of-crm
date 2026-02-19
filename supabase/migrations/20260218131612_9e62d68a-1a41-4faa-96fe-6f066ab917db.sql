
-- Allow room creator to delete their own rooms (needed for orphan cleanup)
CREATE POLICY "Room creator can delete own rooms"
ON public.chat_rooms FOR DELETE TO authenticated
USING (auth.uid() = created_by);
