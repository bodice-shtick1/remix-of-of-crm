-- Create staff invitations table
CREATE TABLE public.staff_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'agent',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  claimed_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can view invitations"
ON public.staff_invitations FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invitations"
ON public.staff_invitations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations"
ON public.staff_invitations FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations"
ON public.staff_invitations FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Function to claim invitation on signup
CREATE OR REPLACE FUNCTION public.claim_staff_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record staff_invitations%ROWTYPE;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT * INTO invitation_record
  FROM public.staff_invitations
  WHERE LOWER(email) = LOWER(NEW.email)
    AND claimed_at IS NULL
    AND is_active = true;

  IF FOUND THEN
    -- Mark invitation as claimed
    UPDATE public.staff_invitations
    SET claimed_at = now(),
        claimed_by = NEW.id
    WHERE id = invitation_record.id;

    -- Create profile with invited name
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, invitation_record.full_name)
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Assign role from invitation
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invitation_record.role)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created_claim_invitation
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.claim_staff_invitation();