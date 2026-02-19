
-- Create a function to atomically track email opens
CREATE OR REPLACE FUNCTION public.track_email_open(p_email_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.emails
  SET
    open_count = open_count + 1,
    opened_at = COALESCE(opened_at, now())
  WHERE id = p_email_id;
END;
$$;
