-- Create client_interactions table for notes and reminders
CREATE TABLE public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reminder_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view interactions"
ON public.client_interactions FOR SELECT
USING (true);

CREATE POLICY "Authenticated can create interactions"
ON public.client_interactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated can update interactions"
ON public.client_interactions FOR UPDATE
USING (true);

CREATE POLICY "Authenticated can delete interactions"
ON public.client_interactions FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_client_interactions_updated_at
BEFORE UPDATE ON public.client_interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_client_interactions_client_id ON public.client_interactions(client_id);
CREATE INDEX idx_client_interactions_reminder_date ON public.client_interactions(reminder_date) WHERE reminder_date IS NOT NULL AND is_completed = false;