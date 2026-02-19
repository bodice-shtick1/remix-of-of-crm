
-- 1. Create has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  manager_id uuid,
  content text NOT NULL,
  direction text NOT NULL DEFAULT 'out',
  channel text NOT NULL DEFAULT 'whatsapp',
  is_internal boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  template_id uuid REFERENCES public.notification_templates(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_messages_client_id ON public.messages(client_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_messages_manager_id ON public.messages(manager_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(user_id, is_read) WHERE is_read = false AND direction = 'in';

-- 4. Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Managers can view own and unassigned messages"
ON public.messages FOR SELECT
USING (manager_id = auth.uid() OR manager_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Authenticated can insert messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can update messages"
ON public.messages FOR UPDATE
USING (user_id = auth.uid() OR manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 7. Updated_at trigger
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
