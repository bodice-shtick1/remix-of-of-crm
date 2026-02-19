import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClientData, ClientVisit, ExpiringPolicy } from '@/components/sales/ClientSearchField';
import { InsuranceProductCatalog, ServiceCatalog, ProductServiceLink, InsuranceCompanyData, InsuranceContractData } from '@/components/sales/SaleItemsTableInline';
import { Bank } from '@/components/sales/FinanceModuleEnhanced';
import { differenceInDays, parseISO } from 'date-fns';

export interface AgentSettings {
  lastOsagoSeries: string;
  preferredRoundingServiceId: string | null;
  roundingStep: number;
}

export interface SaleDataResult {
  isLoading: boolean;
  clients: ClientData[];
  setClients: React.Dispatch<React.SetStateAction<ClientData[]>>;
  insuranceProducts: InsuranceProductCatalog[];
  services: ServiceCatalog[];
  banks: Bank[];
  productServiceLinks: ProductServiceLink[];
  insuranceCompanies: InsuranceCompanyData[];
  insuranceContracts: InsuranceContractData[];
  agentSettings: AgentSettings;
  setLastOsagoSeries: (series: string) => void;
  // Client history
  clientVisits: ClientVisit[];
  expiringPolicies: ExpiringPolicy[];
  isLoadingHistory: boolean;
  loadClientHistory: (clientId: string) => Promise<void>;
  clearClientHistory: () => void;
}

export function useSaleData(): SaleDataResult {
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);

  // Catalogs
  const [clients, setClients] = useState<ClientData[]>([]);
  const [insuranceProducts, setInsuranceProducts] = useState<InsuranceProductCatalog[]>([]);
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [productServiceLinks, setProductServiceLinks] = useState<ProductServiceLink[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompanyData[]>([]);
  const [insuranceContracts, setInsuranceContracts] = useState<InsuranceContractData[]>([]);

  // Agent settings
  const [lastOsagoSeries, setLastOsagoSeries] = useState('');
  const [preferredRoundingServiceId, setPreferredRoundingServiceId] = useState<string | null>(null);
  const [roundingStep, setRoundingStep] = useState(100);

  // Client history
  const [clientVisits, setClientVisits] = useState<ClientVisit[]>([]);
  const [expiringPolicies, setExpiringPolicies] = useState<ExpiringPolicy[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load all catalogs on mount
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          { data: clientsData },
          { data: productsData },
          { data: servicesData },
          { data: linksData },
          { data: banksData },
          { data: companiesData },
          { data: contractsData },
          { data: settingsData },
        ] = await Promise.all([
          supabase.from('clients').select('*').order('last_name'),
          supabase.from('insurance_products').select('*').eq('is_active', true),
          supabase.from('services_catalog').select('*').eq('is_active', true),
          supabase.from('product_service_links').select('*'),
          supabase.from('banks').select('*').eq('is_active', true),
          supabase.from('insurance_companies').select('*').eq('is_active', true).order('name'),
          supabase.from('insurance_contracts').select('*').order('contract_number'),
          supabase.from('agent_settings')
            .select('last_osago_series, preferred_rounding_service_id, rounding_step')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (clientsData) setClients(clientsData);
        if (productsData) setInsuranceProducts(productsData);
        if (servicesData) setServices(servicesData);
        if (linksData) setProductServiceLinks(linksData as ProductServiceLink[]);
        if (banksData) setBanks(banksData);
        if (companiesData) setInsuranceCompanies(companiesData);
        if (contractsData) setInsuranceContracts(contractsData);

        if (settingsData) {
          if (settingsData.last_osago_series) setLastOsagoSeries(settingsData.last_osago_series);
          if (settingsData.preferred_rounding_service_id) setPreferredRoundingServiceId(settingsData.preferred_rounding_service_id);
          if (settingsData.rounding_step) setRoundingStep(settingsData.rounding_step);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: 'Ошибка загрузки данных',
          description: 'Не удалось загрузить данные из базы',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  const loadClientHistory = useCallback(async (clientId: string) => {
    setIsLoadingHistory(true);
    try {
      const [{ data: salesData }, { data: policiesData }] = await Promise.all([
        supabase
          .from('sales')
          .select(`
            id,
            completed_at,
            total_amount,
            sale_items (
              item_type,
              service_name,
              amount,
              insurance_product_id,
              insurance_products:insurance_product_id (name)
            )
          `)
          .eq('client_id', clientId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(10),
        supabase
          .from('policies')
          .select('id, policy_type, end_date, prolongation_status')
          .eq('client_id', clientId)
          .eq('status', 'active')
          .eq('prolongation_status', 'pending'),
      ]);

      if (salesData) {
        const visits: ClientVisit[] = salesData
          .map(sale => ({
            id: sale.id,
            date: sale.completed_at || '',
            totalAmount: Number(sale.total_amount) || 0,
            items: (sale.sale_items || []).map((item: any) => ({
              name: item.item_type === 'insurance'
                ? item.insurance_products?.name || 'Страховка'
                : item.service_name || 'Услуга',
              amount: Number(item.amount) || 0,
            })),
          }))
          .filter(v => v.date);
        setClientVisits(visits);
      }

      if (policiesData) {
        const today = new Date();
        const expiring: ExpiringPolicy[] = policiesData
          .map(policy => {
            const endDate = parseISO(policy.end_date);
            const daysLeft = differenceInDays(endDate, today);
            return {
              id: policy.id,
              type: policy.policy_type,
              endDate: policy.end_date,
              daysLeft,
              isExpired: daysLeft < 0,
            };
          })
          .filter(p => p.daysLeft <= 30)
          .sort((a, b) => a.daysLeft - b.daysLeft);
        setExpiringPolicies(expiring);
      }
    } catch (error) {
      console.error('Error loading client history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const clearClientHistory = useCallback(() => {
    setClientVisits([]);
    setExpiringPolicies([]);
  }, []);

  return {
    isLoading,
    clients,
    setClients,
    insuranceProducts,
    services,
    banks,
    productServiceLinks,
    insuranceCompanies,
    insuranceContracts,
    agentSettings: {
      lastOsagoSeries,
      preferredRoundingServiceId,
      roundingStep,
    },
    setLastOsagoSeries,
    clientVisits,
    expiringPolicies,
    isLoadingHistory,
    loadClientHistory,
    clearClientHistory,
  };
}
