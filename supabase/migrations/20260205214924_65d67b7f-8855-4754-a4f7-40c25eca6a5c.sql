-- Add prolongation_status to policies table
-- Values: 'pending' (Ожидает), 'prolonged' (Пролонгирован), 'lost' (Утрачен), 'irrelevant' (Неактуально)
ALTER TABLE public.policies 
ADD COLUMN IF NOT EXISTS prolongation_status text NOT NULL DEFAULT 'pending';

-- Add constraint to ensure valid values
ALTER TABLE public.policies 
ADD CONSTRAINT policies_prolongation_status_check 
CHECK (prolongation_status IN ('pending', 'prolonged', 'lost', 'irrelevant'));

-- Create index for filtering expiring policies by status
CREATE INDEX IF NOT EXISTS idx_policies_prolongation_status ON public.policies(prolongation_status);

-- Create function to normalize vehicle numbers (remove spaces, lowercase)
CREATE OR REPLACE FUNCTION public.normalize_vehicle_number(vehicle_num text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF vehicle_num IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remove all spaces and convert to lowercase
  RETURN LOWER(REPLACE(vehicle_num, ' ', ''));
END;
$function$;

-- Create trigger function to auto-detect prolongations
CREATE OR REPLACE FUNCTION public.auto_detect_prolongation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  old_policy_id uuid;
  normalized_vehicle text;
BEGIN
  -- Only process if this is a new policy with a vehicle number
  IF NEW.vehicle_number IS NULL OR NEW.vehicle_number = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize the vehicle number
  normalized_vehicle := normalize_vehicle_number(NEW.vehicle_number);
  
  -- Find previous active policy of the same type for the same client with matching vehicle
  SELECT id INTO old_policy_id
  FROM public.policies
  WHERE client_id = NEW.client_id
    AND policy_type = NEW.policy_type
    AND id != NEW.id
    AND normalize_vehicle_number(vehicle_number) = normalized_vehicle
    AND prolongation_status = 'pending'
    AND status IN ('active', 'expiring_soon')
  ORDER BY end_date DESC
  LIMIT 1;
  
  -- If found, mark the old policy as prolonged
  IF old_policy_id IS NOT NULL THEN
    UPDATE public.policies
    SET prolongation_status = 'prolonged'
    WHERE id = old_policy_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on policies table
DROP TRIGGER IF EXISTS trigger_auto_detect_prolongation ON public.policies;
CREATE TRIGGER trigger_auto_detect_prolongation
  AFTER INSERT ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_prolongation();