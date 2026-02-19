
ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT '₽',
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Moscow';
