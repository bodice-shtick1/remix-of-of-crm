import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

export interface InsuranceCompany {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsuranceContract {
  id: string;
  company_id: string;
  contract_number: string;
  commission_rate: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company?: InsuranceCompany;
}

export function useInsuranceCompanies() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [contracts, setContracts] = useState<InsuranceContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [companiesRes, contractsRes] = await Promise.all([
        supabase
          .from('insurance_companies')
          .select('*')
          .order('name'),
        supabase
          .from('insurance_contracts')
          .select('*')
          .order('contract_number'),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (contractsRes.data) setContracts(contractsRes.data);
    } catch (error) {
      console.error('Error loading insurance companies:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить данные страховых компаний',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCompanies = companies.filter(c => c.is_active);

  const getActiveContractsForCompany = useCallback((companyId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return contracts.filter(c => 
      c.company_id === companyId && 
      c.is_active && 
      c.start_date <= today && 
      c.end_date >= today
    );
  }, [contracts]);

  const createCompany = async (data: Omit<InsuranceCompany, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: newCompany, error } = await supabase
        .from('insurance_companies')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      setCompanies(prev => [...prev, newCompany]);
      toast({ title: 'Компания добавлена' });
      logEventDirect({ action: 'create', category: 'service', entityType: 'insurance_company', entityId: newCompany.id, fieldAccessed: `Новая СК: ${data.name}` });
      return newCompany;
    } catch (error) {
      console.error('Error creating company:', error);
      toast({ title: 'Ошибка создания компании', variant: 'destructive' });
      return null;
    }
  };

  const updateCompany = async (id: string, data: Partial<InsuranceCompany>) => {
    try {
      const { error } = await supabase
        .from('insurance_companies')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      toast({ title: 'Компания обновлена' });
      logEventDirect({ action: 'update', category: 'service', entityType: 'insurance_company', entityId: id, fieldAccessed: 'Редактирование СК' });
      return true;
    } catch (error) {
      console.error('Error updating company:', error);
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
      return false;
    }
  };

  const deleteCompany = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insurance_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCompanies(prev => prev.filter(c => c.id !== id));
      setContracts(prev => prev.filter(c => c.company_id !== id));
      toast({ title: 'Компания удалена' });
      logEventDirect({ action: 'delete', category: 'service', entityType: 'insurance_company', entityId: id, fieldAccessed: 'Удаление СК' });
      return true;
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
      return false;
    }
  };

  const createContract = async (data: Omit<InsuranceContract, 'id' | 'created_at' | 'updated_at' | 'company'>) => {
    try {
      const { data: newContract, error } = await supabase
        .from('insurance_contracts')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      setContracts(prev => [...prev, newContract]);
      toast({ title: 'Договор добавлен' });
      logEventDirect({ action: 'create', category: 'service', entityType: 'insurance_contract', entityId: newContract.id, fieldAccessed: `Новый договор: ${data.contract_number}` });
      return newContract;
    } catch (error) {
      console.error('Error creating contract:', error);
      toast({ title: 'Ошибка создания договора', variant: 'destructive' });
      return null;
    }
  };

  const updateContract = async (id: string, data: Partial<InsuranceContract>) => {
    try {
      const { error } = await supabase
        .from('insurance_contracts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setContracts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      toast({ title: 'Договор обновлен' });
      logEventDirect({ action: 'update', category: 'service', entityType: 'insurance_contract', entityId: id, fieldAccessed: 'Редактирование договора' });
      return true;
    } catch (error) {
      console.error('Error updating contract:', error);
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
      return false;
    }
  };

  const deleteContract = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insurance_contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setContracts(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Договор удален' });
      logEventDirect({ action: 'delete', category: 'service', entityType: 'insurance_contract', entityId: id, fieldAccessed: 'Удаление договора' });
      return true;
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
      return false;
    }
  };

  return {
    companies,
    contracts,
    activeCompanies,
    isLoading,
    loadData,
    getActiveContractsForCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    createContract,
    updateContract,
    deleteContract,
  };
}
