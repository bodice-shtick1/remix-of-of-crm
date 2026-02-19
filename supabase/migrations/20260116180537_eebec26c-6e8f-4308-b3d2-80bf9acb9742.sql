-- Add preferred rounding service to agent settings
ALTER TABLE public.agent_settings 
ADD COLUMN preferred_rounding_service_id uuid REFERENCES public.services_catalog(id) ON DELETE SET NULL;