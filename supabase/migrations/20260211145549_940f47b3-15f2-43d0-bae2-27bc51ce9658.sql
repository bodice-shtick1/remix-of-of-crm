
-- Create document_archives table
CREATE TABLE public.document_archives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('dkp', 'pnd')),
  document_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.document_archives ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can view document archives"
ON public.document_archives FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert document archives"
ON public.document_archives FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete document archives"
ON public.document_archives FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for fast client lookups
CREATE INDEX idx_document_archives_client_id ON public.document_archives(client_id);
