-- Create vehicle catalog table for storing vehicle brands/models with auto-fill capability
CREATE TABLE public.vehicle_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plate_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on normalized plate number
CREATE UNIQUE INDEX idx_vehicle_catalog_plate_number 
ON public.vehicle_catalog (LOWER(REPLACE(plate_number, ' ', '')));

-- Enable RLS
ALTER TABLE public.vehicle_catalog ENABLE ROW LEVEL SECURITY;

-- Policies for vehicle catalog (shared across organization)
CREATE POLICY "Authenticated can view vehicle catalog" 
ON public.vehicle_catalog 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can insert vehicle catalog" 
ON public.vehicle_catalog 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated can update vehicle catalog" 
ON public.vehicle_catalog 
FOR UPDATE 
USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_vehicle_catalog_updated_at
BEFORE UPDATE ON public.vehicle_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.vehicle_catalog IS 'Stores vehicle information for auto-fill by plate number';