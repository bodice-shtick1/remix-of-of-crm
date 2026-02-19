import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { DashboardStats } from '@/types/crm';

export type ProlongationStatus = 'pending' | 'prolonged' | 'lost' | 'irrelevant';

export interface ExpiringPolicy {
  id: string;
  policy_type: string;
  policy_number: string;
  end_date: string;
  premium_amount: number;
  vehicle_number: string | null;
  client_id: string;
  client_name: string;
  is_company: boolean;
  prolongation_status: ProlongationStatus;
}

export interface DashboardClient {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  company_name: string | null;
  is_company: boolean;
  birth_date: string | null;
  phone: string;
}

interface DashboardData {
  stats: DashboardStats;
  expiringPolicies: ExpiringPolicy[];
  clients: DashboardClient[];
  upcomingBirthdays: DashboardClient[];
}

async function fetchDashboardData(): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
  const startOfMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // Parallel fetch all data
  const [
    clientsCountRes,
    clientsDataRes,
    activePoliciesRes,
    expiringRes,
    monthlySalesRes,
    pendingCountRes,
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('id, first_name, last_name, middle_name, company_name, is_company, birth_date, phone'),
    supabase.from('policies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('policies')
      .select('id, policy_type, policy_number, end_date, premium_amount, vehicle_number, client_id, prolongation_status', { count: 'exact' })
      .eq('status', 'active')
      .eq('prolongation_status', 'pending')
      .gte('end_date', todayStr)
      .lte('end_date', thirtyDaysLaterStr)
      .order('end_date', { ascending: true }),
    supabase.from('sales').select('total_amount').eq('status', 'completed').gte('completed_at', startOfMonthStr),
    supabase.from('policies').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
  ]);

  const clientsData = clientsDataRes.data || [];

  // Upcoming birthdays (next 3 days)
  const upcomingBirthdays = clientsData.filter(client => {
    if (!client.birth_date || client.is_company) return false;
    const birthDate = new Date(client.birth_date);
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    const diffDays = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 3;
  });

  console.log('[Dashboard] Expiring policies query range:', todayStr, '→', thirtyDaysLaterStr, '| found:', expiringRes.data?.length ?? 0, '| error:', expiringRes.error);

  // Enrich expiring policies with client names
  const expiringPolicies: ExpiringPolicy[] = (expiringRes.data || []).map(policy => {
    const client = clientsData.find(c => c.id === policy.client_id);
    return {
      ...policy,
      prolongation_status: (policy.prolongation_status || 'pending') as ProlongationStatus,
      client_name: client?.is_company
        ? client.company_name || ''
        : `${client?.last_name || ''} ${client?.first_name || ''}`,
      is_company: client?.is_company || false,
    };
  });

  const monthlyRevenue = (monthlySalesRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return {
    stats: {
      totalClients: clientsCountRes.count || 0,
      activePolicies: activePoliciesRes.count || 0,
      expiringThisMonth: expiringRes.count || 0,
      monthlyRevenue,
      pendingPayments: pendingCountRes.count || 0,
    },
    expiringPolicies,
    clients: clientsData,
    upcomingBirthdays,
  };
}

export function useDashboardData() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });

  return {
    stats: data?.stats ?? {
      totalClients: 0,
      activePolicies: 0,
      expiringThisMonth: 0,
      monthlyRevenue: 0,
      pendingPayments: 0,
    },
    expiringPolicies: data?.expiringPolicies ?? [],
    clients: data?.clients ?? [],
    upcomingBirthdays: data?.upcomingBirthdays ?? [],
    loading: isLoading,
  };
}
