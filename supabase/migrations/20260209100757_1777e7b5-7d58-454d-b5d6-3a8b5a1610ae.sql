-- Add mask fields to insurance_products for series and number format control
ALTER TABLE public.insurance_products 
ADD COLUMN IF NOT EXISTS series_mask text DEFAULT 'AAA',
ADD COLUMN IF NOT EXISTS number_mask text DEFAULT '0000000000';

-- Add comments for documentation
COMMENT ON COLUMN public.insurance_products.series_mask IS 'Input mask for policy series (A=letter, 0=digit, *=any)';
COMMENT ON COLUMN public.insurance_products.number_mask IS 'Input mask for policy number (A=letter, 0=digit, *=any)';