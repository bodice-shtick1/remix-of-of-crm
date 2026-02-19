
-- Add PND consent tracking columns to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_pnd_signed boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pnd_signed_date date;
