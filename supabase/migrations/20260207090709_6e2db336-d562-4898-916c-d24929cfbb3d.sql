
-- Add archive fields to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_clients_is_archived ON public.clients (is_archived);

-- Trigger function: auto-unarchive client when incoming message arrives
CREATE OR REPLACE FUNCTION public.auto_unarchive_on_incoming()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    UPDATE public.clients
    SET is_archived = false, archive_reason = NULL
    WHERE id = NEW.client_id AND is_archived = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_unarchive_on_incoming
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_unarchive_on_incoming();
