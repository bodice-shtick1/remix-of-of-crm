import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfMonth, endOfMonth, subDays, format, startOfWeek, startOfQuarter, eachDayOfInterval } from 'date-fns';

export type PeriodType = 'week' | 'month' | 'quarter';

export function useAnalyticsData(period: PeriodType = 'month') {
  const { user } = useAuth();
  const now = new Date();

  const dateRange = (() => {
    if (period === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    if (period === 'quarter') return { start: startOfQuarter(now), end: now };
    return { start: startOfMonth(now), end: endOfMonth(now) };
  })();

  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr = format(dateRange.end, 'yyyy-MM-dd');

  // Revenue + sales
  const salesQuery = useQuery({
    queryKey: ['analytics-sales', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, total_amount, amount_paid, created_at, status, company_id, debt_status')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)
        .eq('status', 'completed');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Policies for the period
  const policiesQuery = useQuery({
    queryKey: ['analytics-policies', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('id, created_at, insurance_company, premium_amount')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Upcoming payments (installments due within 7 days)
  const upcomingPaymentsQuery = useQuery({
    queryKey: ['analytics-upcoming-payments'],
    queryFn: async () => {
      const today = format(now, 'yyyy-MM-dd');
      const sevenDays = format(subDays(now, -7), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('sales')
        .select('id, uid, client_id, total_amount, amount_paid, installment_due_date, debt_status, clients(first_name, last_name, phone)')
        .eq('is_installment', true)
        .eq('status', 'completed')
        .neq('debt_status', 'paid')
        .lte('installment_due_date', sevenDays)
        .order('installment_due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Messages for channel distribution
  const messagesQuery = useQuery({
    queryKey: ['analytics-messages', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('channel')
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Insurance companies for top SK
  const companiesQuery = useQuery({
    queryKey: ['analytics-companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_companies').select('id, name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Computed values
  const sales = salesQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const companies = companiesQuery.data ?? [];

  const totalRevenue = sales.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const expectedIncome = sales.reduce((s, r) => s + Math.max(0, Number(r.total_amount || 0) - Number(r.amount_paid || 0)), 0);

  // Top insurance company
  const companyCount: Record<string, number> = {};
  sales.forEach(s => { if (s.company_id) companyCount[s.company_id] = (companyCount[s.company_id] || 0) + 1; });
  const topCompanyId = Object.entries(companyCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCompany = companies.find(c => c.id === topCompanyId)?.name || '—';

  // Daily chart data
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end > now ? now : dateRange.end });
  const dailyData = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const daySales = sales.filter(s => s.created_at.startsWith(dayStr));
    const dayPolicies = policies.filter(p => p.created_at.startsWith(dayStr));
    return {
      date: format(day, 'dd.MM'),
      revenue: daySales.reduce((s, r) => s + Number(r.amount_paid || 0), 0),
      policies: dayPolicies.length,
    };
  });

  // Channel distribution
  const channelMap: Record<string, number> = {};
  messages.forEach(m => { channelMap[m.channel] = (channelMap[m.channel] || 0) + 1; });
  const channelData = Object.entries(channelMap).map(([name, value]) => ({
    name: name === 'whatsapp' ? 'WhatsApp' : name === 'telegram' ? 'Telegram' : name === 'max' ? 'MAX' : name === 'whatsapp_web' ? 'WA Web' : name,
    value,
  }));

  const isLoading = salesQuery.isLoading || policiesQuery.isLoading || messagesQuery.isLoading;

  return {
    totalRevenue,
    expectedIncome,
    topCompany,
    salesCount: sales.length,
    policiesCount: policies.length,
    dailyData,
    channelData,
    upcomingPayments: upcomingPaymentsQuery.data ?? [],
    isLoading,
    dateRange,
  };
}
