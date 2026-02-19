
-- Create enum types for the CRM
CREATE TYPE public.insurance_type AS ENUM ('ОСАГО', 'КАСКО', 'Имущество', 'Жизнь', 'ДМС', 'НС', 'ДОМ', 'Другое');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'transferred', 'commission_received');
CREATE TYPE public.policy_status AS ENUM ('active', 'expiring_soon', 'expired', 'renewed');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer', 'sbp');
CREATE TYPE public.sale_status AS ENUM ('draft', 'completed', 'cancelled');
CREATE TYPE public.task_type AS ENUM ('renewal', 'birthday', 'call', 'payment', 'custom');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.service_category AS ENUM ('inspection', 'documents', 'other');

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create policies table
CREATE TABLE public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  insurance_company TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  premium_amount DECIMAL(12,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  vehicle_number TEXT,
  vehicle_model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  transferred_to_insurer TIMESTAMPTZ,
  commission_received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.policies(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium',
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create service_catalog table
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  rounding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  audit_log JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for clients
CREATE POLICY "Authenticated users can view all clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete clients"
  ON public.clients FOR DELETE TO authenticated USING (true);

-- Create RLS policies for policies
CREATE POLICY "Authenticated users can view all policies"
  ON public.policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create policies"
  ON public.policies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update policies"
  ON public.policies FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete policies"
  ON public.policies FOR DELETE TO authenticated USING (true);

-- Create RLS policies for payments
CREATE POLICY "Authenticated users can view all payments"
  ON public.payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON public.payments FOR UPDATE TO authenticated USING (true);

-- Create RLS policies for tasks
CREATE POLICY "Authenticated users can view all tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tasks"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE TO authenticated USING (true);

-- Create RLS policies for service_catalog (read-only for regular users)
CREATE POLICY "Anyone can view service catalog"
  ON public.service_catalog FOR SELECT TO authenticated USING (true);

-- Create RLS policies for sales
CREATE POLICY "Authenticated users can view all sales"
  ON public.sales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create sales"
  ON public.sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON public.sales FOR UPDATE TO authenticated USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_clients_agent_id ON public.clients(agent_id);
CREATE INDEX idx_clients_phone ON public.clients(phone);
CREATE INDEX idx_policies_client_id ON public.policies(client_id);
CREATE INDEX idx_policies_end_date ON public.policies(end_date);
CREATE INDEX idx_policies_status ON public.policies(status);
CREATE INDEX idx_payments_policy_id ON public.payments(policy_id);
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_agent_id ON public.tasks(agent_id);
CREATE INDEX idx_sales_client_id ON public.sales(client_id);
CREATE INDEX idx_sales_status ON public.sales(status);
