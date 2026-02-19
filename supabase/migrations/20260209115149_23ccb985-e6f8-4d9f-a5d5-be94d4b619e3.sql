
-- Add year and color columns to vehicle_registry
ALTER TABLE public.vehicle_registry
ADD COLUMN IF NOT EXISTS year integer,
ADD COLUMN IF NOT EXISTS color text;
