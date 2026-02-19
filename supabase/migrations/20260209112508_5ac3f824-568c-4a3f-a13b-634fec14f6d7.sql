
-- Add is_roundable column to insurance_products (default true for backward compat)
ALTER TABLE public.insurance_products
ADD COLUMN is_roundable boolean NOT NULL DEFAULT true;

-- Add is_roundable column to services_catalog (default true for backward compat)
ALTER TABLE public.services_catalog
ADD COLUMN is_roundable boolean NOT NULL DEFAULT true;
