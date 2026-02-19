
-- Add passport detail columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS passport_series text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS passport_issue_date date,
  ADD COLUMN IF NOT EXISTS passport_issued_by text,
  ADD COLUMN IF NOT EXISTS passport_unit_code text;
