
-- Add open tracking columns to emails table
ALTER TABLE public.emails
ADD COLUMN opened_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0;
