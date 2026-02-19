-- Create roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');

-- Create user roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    middle_name TEXT,
    company_name TEXT,
    is_company BOOLEAN NOT NULL DEFAULT false,
    phone TEXT NOT NULL,
    email TEXT,
    birth_date DATE,
    passport_data TEXT,
    inn TEXT,
    address TEXT,
    notes TEXT,
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own clients, admins see all"
ON public.clients
FOR SELECT
TO authenticated
USING (
    agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Agents can create clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create insurance products catalog
CREATE TABLE public.insurance_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    default_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 15,
    round_to INTEGER NOT NULL DEFAULT 100,
    default_series TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
ON public.insurance_products
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage products"
ON public.insurance_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create services catalog
CREATE TABLE public.services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'other',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services"
ON public.services_catalog
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage services"
ON public.services_catalog
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create banks table for transfers
CREATE TABLE public.banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view banks"
ON public.banks
FOR SELECT
TO authenticated
USING (true);

-- Create sales table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT NOT NULL UNIQUE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    bank_id UUID REFERENCES public.banks(id),
    is_installment BOOLEAN NOT NULL DEFAULT false,
    installment_due_date DATE,
    installment_payments_count INTEGER,
    rounding_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can create sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own draft sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() AND status = 'draft');

-- Create sale items table
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    item_type TEXT NOT NULL, -- 'insurance' or 'service'
    -- Insurance fields
    insurance_product_id UUID REFERENCES public.insurance_products(id),
    policy_series TEXT,
    policy_number TEXT,
    insurance_company TEXT,
    start_date DATE,
    end_date DATE,
    premium_amount NUMERIC(12,2),
    commission_percent NUMERIC(5,2),
    -- Service fields
    service_id UUID REFERENCES public.services_catalog(id),
    service_name TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2),
    -- Common
    amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sale items of own sales"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales 
        WHERE sales.id = sale_items.sale_id 
        AND (sales.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

CREATE POLICY "Users can insert items to own sales"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.sales 
        WHERE sales.id = sale_items.sale_id 
        AND sales.agent_id = auth.uid()
    )
);

CREATE POLICY "Users can update items of own draft sales"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales 
        WHERE sales.id = sale_items.sale_id 
        AND sales.agent_id = auth.uid() 
        AND sales.status = 'draft'
    )
);

CREATE POLICY "Users can delete items of own draft sales"
ON public.sale_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales 
        WHERE sales.id = sale_items.sale_id 
        AND sales.agent_id = auth.uid() 
        AND sales.status = 'draft'
    )
);

-- Create audit log table
CREATE TABLE public.sale_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit log of own sales"
ON public.sale_audit_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sales 
        WHERE sales.id = sale_audit_log.sale_id 
        AND (sales.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
);

CREATE POLICY "Users can insert audit log"
ON public.sale_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create policies table
CREATE TABLE public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    insurance_product_id UUID REFERENCES public.insurance_products(id),
    policy_type TEXT NOT NULL,
    policy_series TEXT,
    policy_number TEXT NOT NULL,
    insurance_company TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    premium_amount NUMERIC(12,2) NOT NULL,
    commission_percent NUMERIC(5,2) NOT NULL,
    commission_amount NUMERIC(12,2) NOT NULL,
    vehicle_number TEXT,
    vehicle_model TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own policies"
ON public.policies
FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can create policies"
ON public.policies
FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own policies"
ON public.policies
FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Store last used series for OSAGO per agent
CREATE TABLE public.agent_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    last_osago_series TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
ON public.agent_settings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own settings"
ON public.agent_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
ON public.agent_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamps
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_settings_updated_at
BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default insurance products
INSERT INTO public.insurance_products (name, code, default_commission_percent, round_to, default_series) VALUES
('ОСАГО', 'OSAGO', 15, 100, 'ХХХ'),
('КАСКО', 'KASKO', 20, 1000, NULL),
('ДОМ', 'DOM', 18, 100, NULL),
('НС', 'NS', 20, 100, NULL),
('Имущество', 'PROPERTY', 18, 500, NULL),
('Жизнь', 'LIFE', 25, 500, NULL),
('ДМС', 'DMS', 15, 1000, NULL),
('Другое', 'OTHER', 15, 100, NULL);

-- Insert default services
INSERT INTO public.services_catalog (name, default_price, category) VALUES
('Осмотр ТС', 300, 'inspection'),
('Ксерокопия документов', 50, 'documents'),
('Оформление документов', 200, 'documents'),
('Сопровождение сделки', 500, 'other'),
('Консультация', 0, 'other'),
('Фотофиксация', 150, 'inspection'),
('Доставка полиса', 300, 'other');

-- Insert default banks
INSERT INTO public.banks (name) VALUES
('Сбербанк'),
('ВТБ'),
('Альфа-Банк'),
('Тинькофф'),
('Газпромбанк'),
('Райффайзен'),
('Росбанк');

-- Create function to generate sale UID
CREATE OR REPLACE FUNCTION public.generate_sale_uid()
RETURNS TEXT AS $$
DECLARE
    year_prefix TEXT;
    next_num INTEGER;
BEGIN
    year_prefix := EXTRACT(YEAR FROM now())::TEXT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(uid FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.sales
    WHERE uid LIKE year_prefix || '-INV-%';
    
    RETURN year_prefix || '-INV-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;