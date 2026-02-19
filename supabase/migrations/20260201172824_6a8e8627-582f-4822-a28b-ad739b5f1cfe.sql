-- Add missing columns to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.banks(id),
ADD COLUMN IF NOT EXISTS installment_due_date date,
ADD COLUMN IF NOT EXISTS installment_payments_count integer;

-- Add missing columns to sale_items table
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_price numeric;

-- Add missing columns to policies table
ALTER TABLE public.policies
ADD COLUMN IF NOT EXISTS insurance_product_id uuid REFERENCES public.insurance_products(id),
ADD COLUMN IF NOT EXISTS policy_series text,
ADD COLUMN IF NOT EXISTS agent_id uuid;