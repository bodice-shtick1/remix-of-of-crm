
-- Table for pinned conversations
CREATE TABLE public.pinned_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.pinned_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pins"
  ON public.pinned_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_pinned_conversations_user ON public.pinned_conversations(user_id);
