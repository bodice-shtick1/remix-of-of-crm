-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload client documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-documents');

-- Create policy to allow authenticated users to view files
CREATE POLICY "Authenticated users can view client documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client-documents');

-- Create policy to allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete client documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client-documents');

-- Create policy to allow authenticated users to update files
CREATE POLICY "Authenticated users can update client documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'client-documents');

-- Create table for document metadata
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_documents
CREATE POLICY "Authenticated users can view documents"
ON public.client_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert documents"
ON public.client_documents
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
ON public.client_documents
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_client_documents_client_id ON public.client_documents(client_id);
CREATE INDEX idx_client_documents_sale_id ON public.client_documents(sale_id);