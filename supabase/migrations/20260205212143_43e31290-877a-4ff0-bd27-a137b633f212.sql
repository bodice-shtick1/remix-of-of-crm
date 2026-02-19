-- Add amount_paid column to track partial payments
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- Update existing completed sales to have full payment
UPDATE public.sales 
SET amount_paid = total_amount 
WHERE status = 'completed' AND is_installment = false;

-- For installment sales, set initial payment (can be adjusted manually)
UPDATE public.sales 
SET amount_paid = 0 
WHERE status = 'completed' AND is_installment = true AND amount_paid = 0;

-- Add debt_status column for easier querying
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS debt_status text NOT NULL DEFAULT 'paid';

-- Update debt_status based on payment
UPDATE public.sales 
SET debt_status = CASE 
  WHEN amount_paid >= total_amount THEN 'paid'
  WHEN installment_due_date IS NOT NULL AND installment_due_date < CURRENT_DATE AND amount_paid < total_amount THEN 'overdue'
  WHEN amount_paid < total_amount THEN 'pending'
  ELSE 'paid'
END
WHERE status = 'completed';

-- Create index for faster debt queries
CREATE INDEX IF NOT EXISTS idx_sales_debt_status ON public.sales(debt_status) WHERE debt_status != 'paid';