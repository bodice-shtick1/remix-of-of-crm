-- Add new fields to insurance_products for dynamic form control
ALTER TABLE public.insurance_products 
ADD COLUMN IF NOT EXISTS number_length integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS requires_vehicle boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.insurance_products.number_length IS 'Maximum length for policy number input';
COMMENT ON COLUMN public.insurance_products.requires_vehicle IS 'Whether vehicle fields (brand/model/plate) should be shown';