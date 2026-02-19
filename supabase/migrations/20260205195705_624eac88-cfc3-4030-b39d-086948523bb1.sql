-- Add function to normalize phone numbers (remove all non-digit characters except leading +)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Remove all non-digit characters, keep only digits
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$;

-- Create unique index on normalized phone number
CREATE UNIQUE INDEX idx_clients_phone_normalized 
ON public.clients (normalize_phone(phone))
WHERE phone IS NOT NULL AND phone != '';