
-- Create a security definer function for chat room creation
CREATE OR REPLACE FUNCTION public.create_chat_room(
  p_name text DEFAULT NULL,
  p_is_group boolean DEFAULT false,
  p_member_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_user_id uuid := auth.uid();
  v_member_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the room
  INSERT INTO public.chat_rooms (name, is_group, created_by)
  VALUES (p_name, p_is_group, v_user_id)
  RETURNING id INTO v_room_id;

  -- Add the creator as participant
  INSERT INTO public.chat_participants (room_id, user_id)
  VALUES (v_room_id, v_user_id);

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != v_user_id THEN
      INSERT INTO public.chat_participants (room_id, user_id)
      VALUES (v_room_id, v_member_id);
    END IF;
  END LOOP;

  RETURN v_room_id;
END;
$$;
