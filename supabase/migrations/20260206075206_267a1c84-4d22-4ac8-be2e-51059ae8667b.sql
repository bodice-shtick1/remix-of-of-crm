-- Add document_type and metadata columns for receipt tracking
ALTER TABLE public.client_documents 
ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'file',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_documents_document_type ON public.client_documents(document_type);

-- Add debt_payment_id column to link receipts to payments
ALTER TABLE public.client_documents 
ADD COLUMN IF NOT EXISTS debt_payment_id uuid REFERENCES public.debt_payments(id);

-- Comment on columns
COMMENT ON COLUMN public.client_documents.document_type IS 'Type: file, debt_receipt, sale_receipt';
COMMENT ON COLUMN public.client_documents.metadata IS 'Additional data like payment amount, method, etc.';
COMMENT ON COLUMN public.client_documents.debt_payment_id IS 'Link to debt payment for receipts';