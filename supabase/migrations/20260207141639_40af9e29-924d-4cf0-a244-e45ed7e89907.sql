-- Add temp_password column to profiles for admin-set passwords
-- Note: This stores the temporary password that admin sets, which user must change on first login
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS temp_password text,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON public.profiles(last_login_at);

-- Update RLS: Only admins can see temp_password
-- The temp_password should only be readable by admins
-- We'll handle this at the application level since column-level RLS isn't available