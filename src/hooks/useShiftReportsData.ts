import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getClientDisplayName } from '@/lib/mappers';
import { useAuth } from './useAuth';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DebtPaymentDetail } from '@/components/shifts/DebtPaymentsDetailTable';

// ---------- types ----------

export interface ShiftReport {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  actual_opening_balance: number;
  actual_closing_balance: number;
  income_cash: number;
  income_non_cash: number;
  income_debt: number;
  total_revenue: number;
  actual_withdrawal: number;
  sales_summary: any[];
  services_summary: any[];
}

export interface SaleItemWithDetails {
  id: string;
  item_type: string;
  service_name: string | null;
  insurance_company: string | null;
  amount: number;
  sale: {
    id: string;
    uid: string;
    completed_at: string | null;
    payment_method: string;
    client: {
      id: string;
      first_name: string;
      last_name: string;
      middle_name: string | null;
      company_name: string | null;
      is_company: boolean;
    } | null;
  };
  insurance_product: {
    id: string;
    name: string;
  } | null;
}

export interface ShiftReportDetails {
  items: SaleItemWithDetails[];
  debtDetails: DebtPaymentDetail[];
  debtTotals: { cash: number; card: number; total: number };
}

// ---------- fetchers ----------

async function fetchShiftReports(): Promise<ShiftReport[]> {
  const { data, error } = await supabase
    .from('shift_reports')
    .select('*')
    .order('opened_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[ShiftReports] Ошибка загрузки списка смен:', error.message, error.code);
    throw new Error(`Ошибка доступа к данным отчетов: ${error.message}`);
  }
  return (data || []) as ShiftReport[];
}

async function fetchShiftDetails(shift: ShiftReport): Promise<ShiftReportDetails> {
  const shiftEnd = shift.closed_at || new Date().toISOString();

  const [saleItemsResult, debtPaymentsResult] = await Promise.all([
    supabase
      .from('sale_items')
      .select(`
        id, item_type, service_name, insurance_company, amount,
        insurance_product:insurance_product_id ( id, name ),
        sale:sale_id (
          id, uid, completed_at, payment_method,
          client:client_id ( id, first_name, last_name, middle_name, company_name, is_company )
        )
      `)
      .order('created_at', { ascending: true }),
    supabase
      .from('debt_payments')
      .select(`
        id, amount, payment_method, paid_at,
        client:client_id ( id, first_name, last_name, middle_name, company_name, is_company ),
        sale:sale_id ( id, uid, created_at, items )
      `)
      .gte('paid_at', shift.opened_at)
      .lte('paid_at', shiftEnd),
  ]);

  if (saleItemsResult.error) throw saleItemsResult.error;

  // Filter sale items within shift period
  const filteredItems = (saleItemsResult.data || []).filter((item: any) => {
    if (!item.sale?.completed_at) return false;
    const completedAt = new Date(item.sale.completed_at);
    const shiftStart = new Date(shift.opened_at);
    const end = shift.closed_at ? new Date(shift.closed_at) : new Date();
    return completedAt >= shiftStart && completedAt <= end;
  }) as SaleItemWithDetails[];

  // Process debt payments — collect sale IDs needing fallback
  const debtPaymentsData = debtPaymentsResult.data || [];
  const fallbackSaleIds: string[] = [];
  debtPaymentsData.forEach((payment: any) => {
    const sale = payment.sale;
    const items = sale?.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      if (sale?.id) fallbackSaleIds.push(sale.id);
    }
  });

  // Fetch sale_items for sales with empty items JSON
  const fallbackMap = new Map<string, any[]>();
  if (fallbackSaleIds.length > 0) {
    const { data: fbItems } = await supabase
      .from('sale_items')
      .select(`
        sale_id, item_type, service_name, insurance_company,
        insurance_product:insurance_product_id ( id, name )
      `)
      .in('sale_id', fallbackSaleIds);

    (fbItems || []).forEach((item: any) => {
      const existing = fallbackMap.get(item.sale_id) || [];
      existing.push(item);
      fallbackMap.set(item.sale_id, existing);
    });
  }

  let dCash = 0;
  let dCard = 0;
  const details: DebtPaymentDetail[] = [];

  debtPaymentsData.forEach((payment: any) => {
    const amt = Number(payment.amount) || 0;
    if (payment.payment_method === 'cash') dCash += amt;
    else dCard += amt;

    const client = payment.client;
    let clientName = getClientDisplayName(client);

    const sale = payment.sale;
    let saleDesc = '—';
    const jsonItems =
      sale?.items && Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : null;
    const itemsSource = jsonItems || (sale?.id ? fallbackMap.get(sale.id) : null);

    if (itemsSource && itemsSource.length > 0) {
      const descs = (itemsSource as any[]).map((it: any) => {
        if (it.item_type === 'insurance') {
          const productName =
            it.product_name || it.insurance_product?.name || it.insurance_company || 'Полис';
          const parts = [productName];
          if (it.vehicle_number) parts.push(it.vehicle_number);
          return parts.join(' · ');
        }
        return it.service_name || 'Услуга';
      });
      saleDesc = descs.join(', ');
    }

    details.push({
      id: payment.id,
      amount: amt,
      payment_method: payment.payment_method,
      paid_at: payment.paid_at,
      client_name: clientName,
      sale_description: saleDesc,
      debt_date: sale?.created_at || payment.paid_at,
    });
  });

  return {
    items: filteredItems,
    debtDetails: details,
    debtTotals: { cash: dCash, card: dCard, total: dCash + dCard },
  };
}

// ---------- hooks ----------

export function useShiftReportsList() {
  const { user } = useAuth();

  return useQuery<ShiftReport[]>({
    queryKey: ['shift-reports', 'list'],
    queryFn: fetchShiftReports,
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useShiftReportDetails(shiftId: string | undefined, shift: ShiftReport | undefined) {
  return useQuery<ShiftReportDetails>({
    queryKey: ['shift-reports', 'details', shiftId],
    queryFn: () => fetchShiftDetails(shift!),
    enabled: !!shiftId && !!shift,
    staleTime: 5 * 60 * 1000,
  });
}
