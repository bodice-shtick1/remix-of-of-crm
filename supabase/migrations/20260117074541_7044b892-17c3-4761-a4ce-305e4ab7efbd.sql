-- Table for linking services to insurance products
CREATE TABLE public.product_service_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.insurance_products(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services_catalog(id) ON DELETE CASCADE,
    inclusion_type TEXT NOT NULL DEFAULT 'manual' CHECK (inclusion_type IN ('auto', 'manual')),
    is_deletion_prohibited BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, service_id)
);

-- Enable RLS
ALTER TABLE public.product_service_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies - admins can manage, everyone can view
CREATE POLICY "Admins can manage product service links" 
ON public.product_service_links 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view product service links" 
ON public.product_service_links 
FOR SELECT 
USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.product_service_links IS 'Links services to insurance products with auto/manual inclusion';
COMMENT ON COLUMN public.product_service_links.inclusion_type IS 'auto = automatically added when product selected, manual = available for selection';
COMMENT ON COLUMN public.product_service_links.is_deletion_prohibited IS 'If true, service cannot be removed from sale';