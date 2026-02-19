import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { computeShiftFinancials } from './useShiftFinancials';
import { logEventDirect } from '@/hooks/useEventLog';

export interface ShiftReport {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  expected_opening_balance: number;
  actual_opening_balance: number;
  opening_discrepancy_reason: string | null;
  income_cash: number;
  income_non_cash: number;
  income_debt: number;
  total_revenue: number;
  expected_closing_balance: number;
  actual_closing_balance: number;
  closing_discrepancy_reason: string | null;
  amount_to_keep: number;
  suggested_withdrawal: number;
  actual_withdrawal: number;
  sales_summary: any[];
  services_summary: any[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftSalesSummary {
  insurance_company: string | null;
  product_name: string | null;
  count: number;
  total_cash: number;
  total_non_cash: number;
  total_amount: number;
}

export interface ShiftServicesSummary {
  service_name: string;
  count: number;
  total_cash: number;
  total_non_cash: number;
  total_amount: number;
}

export interface DebtPaymentDetail {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  client_name: string;
  sale_description: string;
  debt_date: string;
}

export interface ShiftFinancials {
  income_cash: number;
  income_non_cash: number;
  income_debt: number;
  debt_repayment_cash: number;
  debt_repayment_card: number;
  debt_repayment_total: number;
  debt_payment_details: DebtPaymentDetail[];
  total_revenue: number;
  expected_closing_balance: number;
  sales_summary: ShiftSalesSummary[];
  services_summary: ShiftServicesSummary[];
}

export interface ShiftReportData {
  shiftId: string;
  openedAt: string;
  closedAt: string;
  openingBalance: number;
  closingBalance: number;
  incomeCash: number;
  incomeNonCash: number;
  incomeDebt: number;
  debtRepaymentCash: number;
  debtRepaymentCard: number;
  debtRepaymentTotal: number;
  debtPaymentDetails: DebtPaymentDetail[];
  totalRevenue: number;
  withdrawal: number;
  amountToKeep: number;
  salesSummary: ShiftSalesSummary[];
  servicesSummary: ShiftServicesSummary[];
}

// ── Query functions ────────────────────────────────────────────

async function fetchCurrentShift(): Promise<ShiftReport | null> {
  const { data, error } = await supabase
    .from('shift_reports')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ShiftReport) ?? null;
}

async function fetchLastClosedShift(): Promise<ShiftReport | null> {
  const { data, error } = await supabase
    .from('shift_reports')
    .select('*')
    .eq('status', 'closed')
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ShiftReport) ?? null;
}

// ── Hook ───────────────────────────────────────────────────────

export function useShiftManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query: current open shift
  const {
    data: currentShift = null,
    isLoading: isLoadingCurrent,
  } = useQuery<ShiftReport | null>({
    queryKey: ['shift-management', 'current'],
    queryFn: fetchCurrentShift,
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Query: last closed shift (for expected opening balance)
  const {
    data: lastClosedShift = null,
    isLoading: isLoadingLast,
  } = useQuery<ShiftReport | null>({
    queryKey: ['shift-management', 'last-closed'],
    queryFn: fetchLastClosedShift,
    enabled: !!user,
    staleTime: 60_000,
  });

  const isLoading = isLoadingCurrent || isLoadingLast;

  // Calculate expected opening balance from last shift
  const getExpectedOpeningBalance = useCallback(() => {
    if (!lastClosedShift) return 0;
    const expectedBalance = (lastClosedShift.actual_closing_balance || 0) - (lastClosedShift.actual_withdrawal || 0);
    return Math.max(0, expectedBalance);
  }, [lastClosedShift]);

  // Invalidate all shift queries
  const invalidateShiftQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shift-management'] });
  }, [queryClient]);

  // Open a new shift
  const openShift = async (
    actualBalance: number,
    expectedBalance: number,
    discrepancyReason?: string
  ): Promise<boolean> => {
    if (!user) {
      toast({ title: 'Ошибка', description: 'Необходимо авторизоваться', variant: 'destructive' });
      return false;
    }

    try {
      const { error } = await supabase
        .from('shift_reports')
        .insert({
          user_id: user.id,
          expected_opening_balance: expectedBalance,
          actual_opening_balance: actualBalance,
          opening_discrepancy_reason: discrepancyReason || null,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      invalidateShiftQueries();
      toast({ title: 'Смена открыта', description: 'Вы можете начать работу' });
      logEventDirect({ action: 'create', category: 'finance', entityType: 'shift', fieldAccessed: 'Открытие смены', newValue: `Баланс: ${actualBalance.toLocaleString('ru-RU')} ₽` });
      return true;
    } catch (error: any) {
      console.error('Error opening shift:', error);
      toast({ title: 'Ошибка', description: error.message || 'Не удалось открыть смену', variant: 'destructive' });
      return false;
    }
  };

  // Calculate shift financials (imperative, on-demand)
  const calculateShiftFinancials = async (): Promise<ShiftFinancials | null> => {
    if (!currentShift) return null;
    try {
      return await computeShiftFinancials(
        currentShift.opened_at,
        currentShift.actual_opening_balance,
      );
    } catch (error) {
      console.error('Error calculating shift financials:', error);
      return null;
    }
  };

  // Close the current shift
  const closeShift = async (
    actualClosingBalance: number,
    amountToKeep: number,
    actualWithdrawal: number,
    closingDiscrepancyReason?: string,
    notes?: string
  ): Promise<{ success: boolean; reportData?: ShiftReportData }> => {
    if (!currentShift || !user) {
      toast({ title: 'Ошибка', description: 'Нет открытой смены', variant: 'destructive' });
      return { success: false };
    }

    try {
      const financials = await calculateShiftFinancials();
      if (!financials) throw new Error('Не удалось рассчитать финансовые показатели');

      const closedAt = new Date().toISOString();
      const suggestedWithdrawal = actualClosingBalance - amountToKeep;

      const { data: updated, error } = await supabase
        .from('shift_reports')
        .update({
          status: 'closed',
          closed_at: closedAt,
          income_cash: financials.income_cash,
          income_non_cash: financials.income_non_cash,
          income_debt: financials.income_debt,
          total_revenue: financials.total_revenue,
          expected_closing_balance: financials.expected_closing_balance,
          actual_closing_balance: actualClosingBalance,
          closing_discrepancy_reason: closingDiscrepancyReason || null,
          amount_to_keep: amountToKeep,
          suggested_withdrawal: suggestedWithdrawal > 0 ? suggestedWithdrawal : 0,
          actual_withdrawal: actualWithdrawal,
          sales_summary: JSON.parse(JSON.stringify(financials.sales_summary)),
          services_summary: JSON.parse(JSON.stringify(financials.services_summary)),
          notes: notes || null,
        })
        .eq('id', currentShift.id)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!updated) throw new Error('Не удалось обновить запись смены. Проверьте права доступа.');

      const reportData: ShiftReportData = {
        shiftId: currentShift.id,
        openedAt: currentShift.opened_at,
        closedAt,
        openingBalance: Number(currentShift.actual_opening_balance) || 0,
        closingBalance: actualClosingBalance,
        incomeCash: financials.income_cash,
        incomeNonCash: financials.income_non_cash,
        incomeDebt: financials.income_debt,
        debtRepaymentCash: financials.debt_repayment_cash,
        debtRepaymentCard: financials.debt_repayment_card,
        debtRepaymentTotal: financials.debt_repayment_total,
        debtPaymentDetails: financials.debt_payment_details,
        totalRevenue: financials.total_revenue,
        withdrawal: actualWithdrawal,
        amountToKeep,
        salesSummary: financials.sales_summary,
        servicesSummary: financials.services_summary,
      };

      invalidateShiftQueries();
      toast({
        title: 'Смена закрыта',
        description: `Выручка за смену: ${financials.total_revenue.toLocaleString('ru-RU')} ₽`,
      });
      logEventDirect({ action: 'update', category: 'finance', entityType: 'shift', entityId: currentShift.id, fieldAccessed: 'Закрытие смены', newValue: `Выручка: ${financials.total_revenue.toLocaleString('ru-RU')} ₽` });

      return { success: true, reportData };
    } catch (error: any) {
      console.error('Error closing shift:', error);
      toast({ title: 'Ошибка закрытия смены в базе данных', description: error.message || 'Не удалось закрыть смену', variant: 'destructive' });
      return { success: false };
    }
  };

  return {
    currentShift,
    isShiftOpen: !!currentShift,
    isLoading,
    lastClosedShift,
    getExpectedOpeningBalance,
    openShift,
    closeShift,
    calculateShiftFinancials,
    refreshShift: invalidateShiftQueries,
  };
}
