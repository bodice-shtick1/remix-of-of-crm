import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useShiftManagement } from '@/hooks/useShiftManagement';
import { logEventDirect } from '@/hooks/useEventLog';

export interface DebtPayment {
  id: string;
  sale_id: string;
  client_id: string;
  amount: number;
  payment_method: 'cash' | 'card';
  shift_id: string | null;
  paid_at: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateDebtPaymentInput {
  saleId: string;
  clientId: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  notes?: string;
}

export function useDebtPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentShift, isShiftOpen } = useShiftManagement();
  const queryClient = useQueryClient();

  // Create a debt payment and update sale
  // IMPORTANT: Debt payments can be made WITHOUT an open shift
  // They will have shift_id = null and won't affect shift cash balance
  const createPaymentMutation = useMutation({
    mutationFn: async (input: CreateDebtPaymentInput) => {
      // Get current sale data
      const { data: sale, error: fetchError } = await supabase
        .from('sales')
        .select('amount_paid, total_amount, uid')
        .eq('id', input.saleId)
        .single();

      if (fetchError) throw fetchError;

      // CRITICAL: Force Number() conversion to avoid string concatenation
      const currentAmountPaid = Number(sale.amount_paid) || 0;
      const paymentAmount = Number(input.amount) || 0;
      const totalAmount = Number(sale.total_amount) || 0;
      
      const newAmountPaid = currentAmountPaid + paymentAmount;
      const newDebtStatus = newAmountPaid >= totalAmount ? 'paid' : 'pending';

      // Query current open shift directly from DB (more reliable than hook state)
      const { data: openShift } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const resolvedShiftId = openShift?.id || null;

      // Insert debt payment record
      const { data: payment, error: paymentError } = await supabase
        .from('debt_payments')
        .insert({
          sale_id: input.saleId,
          client_id: input.clientId,
          amount: paymentAmount,
          payment_method: input.paymentMethod,
          shift_id: resolvedShiftId,
          created_by: user?.id || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Calculate remaining debt
      const remainingDebt = Math.max(0, totalAmount - newAmountPaid);
      const originalDebt = totalAmount - currentAmountPaid;

      // Create receipt document record for archival
      const receiptMetadata = {
        amount: paymentAmount,
        paymentMethod: input.paymentMethod,
        originalDebt: originalDebt,
        remainingDebt: remainingDebt,
        saleUid: sale.uid,
        paidAt: new Date().toISOString(),
        shiftId: resolvedShiftId,
      };

      await supabase
        .from('client_documents')
        .insert({
          client_id: input.clientId,
          sale_id: input.saleId,
          debt_payment_id: payment.id,
          file_name: `Квитанция #${sale.uid} - ${paymentAmount.toLocaleString('ru-RU')} ₽`,
          file_path: '', // No actual file, just metadata
          document_type: 'debt_receipt',
          metadata: receiptMetadata,
          uploaded_by: user?.id || null,
        });

      // Update sale amount_paid and debt_status
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          amount_paid: newAmountPaid,
          debt_status: newDebtStatus,
        })
        .eq('id', input.saleId);

      if (updateError) throw updateError;

      return { 
        payment, 
        newAmountPaid, 
        totalAmount, 
        isPaidOff: newAmountPaid >= totalAmount,
        wasInShift: !!resolvedShiftId,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['client-debts'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      queryClient.invalidateQueries({ queryKey: ['shift-debt-payments'] });
      queryClient.invalidateQueries({ queryKey: ['today-debt-payments'] });
      queryClient.invalidateQueries({ queryKey: ['shift-management'] });
      queryClient.invalidateQueries({ queryKey: ['client-documents'] });
      queryClient.invalidateQueries({ queryKey: ['client-installments'] });
      
      logEventDirect({ action: 'create', category: 'finance', entityType: 'debt_payment', entityId: data.payment.id, fieldAccessed: 'Погашение долга', newValue: `${data.payment.amount.toLocaleString('ru-RU')} ₽` });
      if (data.isPaidOff) {
        toast({ title: 'Долг погашен полностью' });
      } else {
        const note = data.wasInShift ? '' : ' (вне смены)';
        toast({ title: `Платёж добавлен${note}` });
      }
    },
    onError: (error: any) => {
      console.error('Error creating debt payment:', error);
      toast({ 
        title: 'Ошибка при добавлении платежа', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return {
    createPayment: createPaymentMutation.mutate,
    createPaymentAsync: createPaymentMutation.mutateAsync,
    isCreating: createPaymentMutation.isPending,
    isShiftOpen,
    currentShiftId: currentShift?.id,
  };
}

// Hook to get debt payments for current shift
export function useShiftDebtPayments(shiftId?: string) {
  return useQuery({
    queryKey: ['shift-debt-payments', shiftId],
    queryFn: async () => {
      if (!shiftId) return { payments: [], totalCash: 0, totalCard: 0, total: 0 };

      const { data, error } = await supabase
        .from('debt_payments')
        .select(`
          *,
          client:clients(id, first_name, last_name, company_name, is_company),
          sale:sales(uid)
        `)
        .eq('shift_id', shiftId)
        .order('paid_at', { ascending: false });

      if (error) throw error;

      const payments = data || [];
      const totalCash = payments
        .filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalCard = payments
        .filter(p => p.payment_method === 'card')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        payments,
        totalCash,
        totalCard,
        total: totalCash + totalCard,
      };
    },
    enabled: !!shiftId,
  });
}

// Hook to get today's debt payments total
export function useTodayDebtPayments() {
  return useQuery({
    queryKey: ['today-debt-payments'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('debt_payments')
        .select('amount, payment_method')
        .gte('paid_at', today.toISOString());

      if (error) throw error;

      const payments = data || [];
      const totalCash = payments
        .filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalCard = payments
        .filter(p => p.payment_method === 'card')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        totalCash,
        totalCard,
        total: totalCash + totalCard,
        count: payments.length,
      };
    },
  });
}

// Hook to get debt payments for a specific sale
export function useSaleDebtPayments(saleId: string) {
  return useQuery({
    queryKey: ['sale-debt-payments', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('sale_id', saleId)
        .order('paid_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: !!saleId,
  });
}
