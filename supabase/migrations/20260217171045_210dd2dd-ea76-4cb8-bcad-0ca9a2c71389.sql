
-- Email accounts table (org-level and personal)
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email_address text NOT NULL,
  display_name text,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  imap_host text NOT NULL,
  imap_port integer NOT NULL DEFAULT 993,
  username text NOT NULL,
  password_encrypted text NOT NULL,
  is_org_account boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  use_ssl boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_accounts' AND policyname='View org or own email accounts') THEN
    CREATE POLICY "View org or own email accounts"
    ON public.email_accounts FOR SELECT TO authenticated
    USING (is_org_account = true OR auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_accounts' AND policyname='Admins manage all email accounts') THEN
    CREATE POLICY "Admins manage all email accounts"
    ON public.email_accounts FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_accounts' AND policyname='Users manage own personal accounts') THEN
    CREATE POLICY "Users manage own personal accounts"
    ON public.email_accounts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND is_org_account = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_accounts' AND policyname='Users update own personal accounts') THEN
    CREATE POLICY "Users update own personal accounts"
    ON public.email_accounts FOR UPDATE TO authenticated
    USING (auth.uid() = user_id AND is_org_account = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_accounts' AND policyname='Users delete own personal accounts') THEN
    CREATE POLICY "Users delete own personal accounts"
    ON public.email_accounts FOR DELETE TO authenticated
    USING (auth.uid() = user_id AND is_org_account = false);
  END IF;
END $$;

-- Update emails table with new columns
ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES public.email_accounts(id),
  ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS cc text,
  ADD COLUMN IF NOT EXISTS bcc text,
  ADD COLUMN IF NOT EXISTS external_uid text,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.emails(id);

-- RLS for emails table
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emails' AND policyname='View emails from own or org accounts') THEN
    CREATE POLICY "View emails from own or org accounts"
    ON public.emails FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.email_accounts ea
        WHERE ea.id = email_account_id AND (ea.is_org_account = true OR ea.user_id = auth.uid())
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emails' AND policyname='Admins view all emails') THEN
    CREATE POLICY "Admins view all emails"
    ON public.emails FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emails' AND policyname='Insert own emails') THEN
    CREATE POLICY "Insert own emails"
    ON public.emails FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='emails' AND policyname='Update own emails') THEN
    CREATE POLICY "Update own emails"
    ON public.emails FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emails_client_id ON public.emails(client_id);
CREATE INDEX IF NOT EXISTS idx_emails_company_id ON public.emails(company_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON public.emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON public.emails(email_account_id);

-- Trigger for updated_at on email_accounts
DROP TRIGGER IF EXISTS update_email_accounts_updated_at ON public.email_accounts;
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add email permission keys (with conflict handling)
INSERT INTO public.role_permissions (role, permission_key, is_enabled) VALUES
  ('admin', 'email_config_manage', true),
  ('admin', 'email_view_all', true),
  ('admin', 'email_view_own', true),
  ('agent', 'email_view_own', true),
  ('agent', 'email_config_manage', false),
  ('agent', 'email_view_all', false),
  ('viewer', 'email_view_own', false),
  ('viewer', 'email_config_manage', false),
  ('viewer', 'email_view_all', false)
ON CONFLICT (role, permission_key) DO NOTHING;
