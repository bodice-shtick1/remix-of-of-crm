
-- Drop both INSERT policies and recreate a single PERMISSIVE one
DROP POLICY IF EXISTS "Allow users to create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated can insert chat rooms" ON public.chat_rooms;

CREATE POLICY "Authenticated can insert chat rooms"
ON public.chat_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);
