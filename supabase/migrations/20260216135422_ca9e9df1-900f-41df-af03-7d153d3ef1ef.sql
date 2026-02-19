
-- Update RLS on clients
DROP POLICY IF EXISTS "Authenticated users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;

CREATE POLICY "All authenticated can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update clients" ON public.clients FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Only admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS on sales
DROP POLICY IF EXISTS "Authenticated users can create sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON public.sales;

CREATE POLICY "All authenticated can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update sales" ON public.sales FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));

-- Update RLS on tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

CREATE POLICY "All authenticated can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Only admins can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS on policies
DROP POLICY IF EXISTS "Authenticated users can create policies" ON public.policies;
DROP POLICY IF EXISTS "Authenticated users can delete policies" ON public.policies;
DROP POLICY IF EXISTS "Authenticated users can update policies" ON public.policies;
DROP POLICY IF EXISTS "Authenticated users can view all policies" ON public.policies;

CREATE POLICY "All authenticated can view policies" ON public.policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert policies" ON public.policies FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update policies" ON public.policies FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Only admins can delete policies" ON public.policies FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS on payments
DROP POLICY IF EXISTS "Authenticated users can create payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view all payments" ON public.payments;

CREATE POLICY "All authenticated can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update payments" ON public.payments FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));

-- Update RLS on sale_items
DROP POLICY IF EXISTS "Authenticated can create sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated can update sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated can view sale items" ON public.sale_items;

CREATE POLICY "All authenticated can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update sale items" ON public.sale_items FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));

-- Update RLS on debt_payments
DROP POLICY IF EXISTS "Authenticated can create debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Authenticated can update debt payments" ON public.debt_payments;
DROP POLICY IF EXISTS "Authenticated can view debt payments" ON public.debt_payments;

CREATE POLICY "All authenticated can view debt payments" ON public.debt_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert debt payments" ON public.debt_payments FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update debt payments" ON public.debt_payments FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));

-- Update RLS on client_interactions
DROP POLICY IF EXISTS "Authenticated can create interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "Authenticated can delete interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "Authenticated can update interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "Authenticated can view interactions" ON public.client_interactions;

CREATE POLICY "All authenticated can view interactions" ON public.client_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert interactions" ON public.client_interactions FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Admins and agents can update interactions" ON public.client_interactions FOR UPDATE TO authenticated USING (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Only admins can delete interactions" ON public.client_interactions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS on client_documents
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.client_documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.client_documents;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.client_documents;

CREATE POLICY "All authenticated can view documents" ON public.client_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and agents can insert documents" ON public.client_documents FOR INSERT TO authenticated WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
CREATE POLICY "Only admins can delete documents" ON public.client_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
