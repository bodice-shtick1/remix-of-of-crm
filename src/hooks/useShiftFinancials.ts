import { supabase } from '@/integrations/supabase/client';
import { getClientDisplayName } from '@/lib/mappers';
import type { DebtPaymentDetail, ShiftSalesSummary, ShiftServicesSummary, ShiftFinancials } from './useShiftManagement';

/**
 * Build a human-readable sale description from items.
 * Tries sale.items JSON first, falls back to sale_items table rows.
 */
function buildDescription(itemsSource: any[]): string {
  if (!itemsSource || itemsSource.length === 0) return '—';
  const descriptions = itemsSource.map((item: any) => {
    if (item.item_type === 'insurance') {
      const productName = item.product_name || item.insurance_product?.name || item.insurance_company || 'Полис';
      const parts = [productName];
      if (item.vehicle_number) parts.push(item.vehicle_number);
      return parts.join(' · ');
    }
    return item.service_name || 'Услуга';
  });
  return descriptions.join(', ');
}

/**
 * Fetch and compute all financials for a shift period.
 */
export async function computeShiftFinancials(
  shiftOpenedAt: string,
  actualOpeningBalance: number,
): Promise<ShiftFinancials> {
  // Fetch sales + sale items + debt payments in parallel
  const [salesRes, debtPaymentsRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, total_amount, payment_method, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', shiftOpenedAt)
      .order('completed_at', { ascending: true }),
    supabase
      .from('debt_payments')
      .select(`
        id, amount, payment_method, paid_at, sale_id,
        client:client_id (id, first_name, last_name, middle_name, company_name, is_company),
        sale:sale_id (id, uid, created_at, items)
      `)
      .gte('paid_at', shiftOpenedAt),
  ]);

  const sales = salesRes.data || [];

  // Fetch sale items for completed sales
  const saleIds = sales.map(s => s.id);
  let saleItems: any[] = [];
  if (saleIds.length > 0) {
    const { data: items } = await supabase
      .from('sale_items')
      .select(`
        id, sale_id, item_type, service_name, insurance_company, amount,
        insurance_product:insurance_product_id (id, name)
      `)
      .in('sale_id', saleIds);
    saleItems = items || [];
  }

  // Process debt payments — with fallback lookup for empty items
  const debtPayments = debtPaymentsRes.data || [];
  const fallbackSaleIds: string[] = [];
  debtPayments.forEach((p: any) => {
    const items = p.sale?.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      if (p.sale?.id) fallbackSaleIds.push(p.sale.id);
    }
  });

  const fallbackItemsMap = new Map<string, any[]>();
  if (fallbackSaleIds.length > 0) {
    const { data: fbItems } = await supabase
      .from('sale_items')
      .select(`
        sale_id, item_type, service_name, insurance_company,
        insurance_product:insurance_product_id (id, name)
      `)
      .in('sale_id', fallbackSaleIds);
    (fbItems || []).forEach((item: any) => {
      const arr = fallbackItemsMap.get(item.sale_id) || [];
      arr.push(item);
      fallbackItemsMap.set(item.sale_id, arr);
    });
  }

  // Build debt payment details
  let debt_repayment_cash = 0;
  let debt_repayment_card = 0;
  const debt_payment_details: DebtPaymentDetail[] = [];

  debtPayments.forEach((payment: any) => {
    const amount = Number(payment.amount) || 0;
    if (payment.payment_method === 'cash') debt_repayment_cash += amount;
    else debt_repayment_card += amount;

    const client = payment.client;
    let clientName = getClientDisplayName(client);

    const sale = payment.sale;
    const jsonItems = sale?.items && Array.isArray(sale.items) && sale.items.length > 0
      ? sale.items : null;
    const itemsSource = jsonItems || (sale?.id ? fallbackItemsMap.get(sale.id) : null);

    debt_payment_details.push({
      id: payment.id,
      amount,
      payment_method: payment.payment_method,
      paid_at: payment.paid_at,
      client_name: clientName,
      sale_description: buildDescription(itemsSource || []),
      debt_date: sale?.created_at || payment.paid_at,
    });
  });

  // Calculate income by payment method
  let income_cash = 0;
  let income_non_cash = 0;
  let income_debt = 0;

  sales.forEach(sale => {
    const amount = Number(sale.total_amount) || 0;
    switch (sale.payment_method) {
      case 'cash': income_cash += amount; break;
      case 'card': case 'transfer': case 'sbp': income_non_cash += amount; break;
      case 'debt': income_debt += amount; break;
    }
  });

  // Group by insurance company + product / services
  const salePaymentMap = new Map<string, string>();
  sales.forEach(sale => salePaymentMap.set(sale.id, sale.payment_method));

  const salesSummaryMap = new Map<string, ShiftSalesSummary>();
  const servicesSummaryMap = new Map<string, ShiftServicesSummary>();

  saleItems.forEach(item => {
    const paymentMethod = salePaymentMap.get(item.sale_id);
    const amount = Number(item.amount) || 0;
    const isCash = paymentMethod === 'cash';

    if (item.item_type === 'insurance') {
      const productName = item.insurance_product?.name || 'Прочее';
      const companyName = item.insurance_company || 'Не указано';
      const key = `${companyName}|${productName}`;
      const existing = salesSummaryMap.get(key) || {
        insurance_company: companyName,
        product_name: productName,
        count: 0, total_cash: 0, total_non_cash: 0, total_amount: 0,
      };
      existing.count += 1;
      existing.total_amount += amount;
      if (isCash) existing.total_cash += amount;
      else existing.total_non_cash += amount;
      salesSummaryMap.set(key, existing);
    } else {
      const key = item.service_name || 'Услуга';
      const existing = servicesSummaryMap.get(key) || {
        service_name: item.service_name || 'Услуга',
        count: 0, total_cash: 0, total_non_cash: 0, total_amount: 0,
      };
      existing.count += 1;
      existing.total_amount += amount;
      if (isCash) existing.total_cash += amount;
      else existing.total_non_cash += amount;
      servicesSummaryMap.set(key, existing);
    }
  });

  const openingBalance = Number(actualOpeningBalance) || 0;

  return {
    income_cash,
    income_non_cash,
    income_debt,
    debt_repayment_cash,
    debt_repayment_card,
    debt_repayment_total: debt_repayment_cash + debt_repayment_card,
    debt_payment_details,
    total_revenue: income_cash + income_non_cash + income_debt,
    expected_closing_balance: openingBalance + income_cash + debt_repayment_cash,
    sales_summary: Array.from(salesSummaryMap.values()),
    services_summary: Array.from(servicesSummaryMap.values()),
  };
}
