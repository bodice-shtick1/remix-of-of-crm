
-- Car brands and models directory
CREATE TABLE public.car_brands_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on brand+model
CREATE UNIQUE INDEX idx_car_brands_models_unique ON public.car_brands_models (LOWER(brand), COALESCE(LOWER(model), ''));

ALTER TABLE public.car_brands_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view car brands" ON public.car_brands_models FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage car brands" ON public.car_brands_models FOR ALL USING (true);

-- Vehicle registry
CREATE TABLE public.vehicle_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vin_code TEXT,
  plate_number TEXT,
  brand_id UUID REFERENCES public.car_brands_models(id) ON DELETE SET NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  model_name TEXT,
  last_customer_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for plate number search
CREATE INDEX idx_vehicle_registry_plate ON public.vehicle_registry (LOWER(REPLACE(plate_number, ' ', '')));
-- Index for VIN search
CREATE INDEX idx_vehicle_registry_vin ON public.vehicle_registry (UPPER(vin_code)) WHERE vin_code IS NOT NULL;
-- Unique plate number
CREATE UNIQUE INDEX idx_vehicle_registry_plate_unique ON public.vehicle_registry (LOWER(REPLACE(plate_number, ' ', ''))) WHERE plate_number IS NOT NULL AND plate_number != '';

ALTER TABLE public.vehicle_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vehicles" ON public.vehicle_registry FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage vehicles" ON public.vehicle_registry FOR ALL USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_vehicle_registry_updated_at
  BEFORE UPDATE ON public.vehicle_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
