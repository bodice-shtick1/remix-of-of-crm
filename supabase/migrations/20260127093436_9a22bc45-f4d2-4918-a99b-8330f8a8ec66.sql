-- Create shift status enum
CREATE TYPE public.shift_status AS ENUM ('open', 'closed');

-- Create shift_reports table for tracking cash shifts
CREATE TABLE public.shift_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Shift timing
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  status shift_status NOT NULL DEFAULT 'open',
  
  -- Opening balances
  expected_opening_balance numeric NOT NULL DEFAULT 0,
  actual_opening_balance numeric NOT NULL DEFAULT 0,
  opening_discrepancy_reason text,
  
  -- Income breakdown
  income_cash numeric NOT NULL DEFAULT 0,
  income_non_cash numeric NOT NULL DEFAULT 0,
  income_debt numeric NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  
  -- Closing calculations
  expected_closing_balance numeric NOT NULL DEFAULT 0,
  actual_closing_balance numeric NOT NULL DEFAULT 0,
  closing_discrepancy_reason text,
  
  -- Cash withdrawal
  amount_to_keep numeric NOT NULL DEFAULT 0,
  suggested_withdrawal numeric NOT NULL DEFAULT 0,
  actual_withdrawal numeric NOT NULL DEFAULT 0,
  
  -- Sales summary (JSON for flexibility)
  sales_summary jsonb DEFAULT '[]'::jsonb,
  services_summary jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for shift_reports
CREATE POLICY "Authenticated users can view all shifts"
ON public.shift_reports
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create shifts"
ON public.shift_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own shifts"
ON public.shift_reports
FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_shift_reports_updated_at
BEFORE UPDATE ON public.shift_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookup of open shifts and user shifts
CREATE INDEX idx_shift_reports_status ON public.shift_reports(status);
CREATE INDEX idx_shift_reports_user_id ON public.shift_reports(user_id);
CREATE INDEX idx_shift_reports_opened_at ON public.shift_reports(opened_at DESC);