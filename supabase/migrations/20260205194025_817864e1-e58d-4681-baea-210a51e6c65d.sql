-- Create insurance_companies table
CREATE TABLE public.insurance_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insurance_contracts table
CREATE TABLE public.insurance_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.insurance_companies(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add company_id and contract_id to sales table
ALTER TABLE public.sales 
ADD COLUMN company_id UUID REFERENCES public.insurance_companies(id),
ADD COLUMN contract_id UUID REFERENCES public.insurance_contracts(id);

-- Enable RLS
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies for insurance_companies
CREATE POLICY "Authenticated can view companies" 
ON public.insurance_companies 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can manage companies" 
ON public.insurance_companies 
FOR ALL 
USING (true);

-- RLS policies for insurance_contracts
CREATE POLICY "Authenticated can view contracts" 
ON public.insurance_contracts 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can manage contracts" 
ON public.insurance_contracts 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_insurance_contracts_company_id ON public.insurance_contracts(company_id);
CREATE INDEX idx_sales_company_id ON public.sales(company_id);
CREATE INDEX idx_sales_contract_id ON public.sales(contract_id);

-- Add triggers for updated_at
CREATE TRIGGER update_insurance_companies_updated_at
BEFORE UPDATE ON public.insurance_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insurance_contracts_updated_at
BEFORE UPDATE ON public.insurance_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();