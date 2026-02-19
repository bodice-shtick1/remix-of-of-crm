-- Create debt_payments table for tracking debt repayments
CREATE TABLE public.debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash', -- 'cash' or 'card'
  shift_id uuid REFERENCES public.shift_reports(id) ON DELETE SET NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view debt payments"
  ON public.debt_payments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create debt payments"
  ON public.debt_payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated can update debt payments"
  ON public.debt_payments FOR UPDATE
  USING (true);

-- Add index for performance
CREATE INDEX idx_debt_payments_sale_id ON public.debt_payments(sale_id);
CREATE INDEX idx_debt_payments_shift_id ON public.debt_payments(shift_id);
CREATE INDEX idx_debt_payments_paid_at ON public.debt_payments(paid_at);

-- Add comment
COMMENT ON TABLE public.debt_payments IS 'Tracks individual debt/installment payments linked to sales and shifts';