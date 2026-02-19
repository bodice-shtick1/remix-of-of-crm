
-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create insurance_products table for catalog
CREATE TABLE public.insurance_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  default_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 15,
  round_to INTEGER NOT NULL DEFAULT 100,
  default_series TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create services_catalog table (different from service_catalog)
CREATE TABLE public.services_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create product_service_links table
CREATE TABLE public.product_service_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.insurance_products(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services_catalog(id) ON DELETE CASCADE,
  inclusion_type TEXT NOT NULL DEFAULT 'manual',
  is_deletion_prohibited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, service_id)
);

-- Create sale_items table for detailed sale entries
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'insurance' or 'service'
  insurance_product_id UUID REFERENCES public.insurance_products(id),
  service_name TEXT,
  insurance_company TEXT,
  policy_series TEXT,
  policy_number TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  premium_amount DECIMAL(12,2),
  commission_percent DECIMAL(5,2),
  commission_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_service_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS policies for insurance_products (read for all, write for admin)
CREATE POLICY "Authenticated can view products" ON public.insurance_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage products" ON public.insurance_products FOR ALL TO authenticated USING (true);

-- RLS policies for services_catalog
CREATE POLICY "Authenticated can view services" ON public.services_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage services" ON public.services_catalog FOR ALL TO authenticated USING (true);

-- RLS policies for product_service_links
CREATE POLICY "Authenticated can view links" ON public.product_service_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage links" ON public.product_service_links FOR ALL TO authenticated USING (true);

-- RLS policies for sale_items
CREATE POLICY "Authenticated can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sale items" ON public.sale_items FOR UPDATE TO authenticated USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_product_service_links_product_id ON public.product_service_links(product_id);
