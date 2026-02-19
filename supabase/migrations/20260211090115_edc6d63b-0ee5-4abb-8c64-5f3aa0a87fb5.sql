
-- Add watermark toggle to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS enable_watermarks boolean NOT NULL DEFAULT false;
