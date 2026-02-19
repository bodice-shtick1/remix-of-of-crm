import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

export interface DebtRecord {
  id: string;
  saleId: string;
  saleUid: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  totalAmount: number;
  amountPaid: number;
  remainingDebt: number;
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
}

export function useDebts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          uid,
          client_id,
          total_amount,
          amount_paid,
          installment_due_date,
          created_at,
          clients!inner(
            id,
            first_name,
            last_name,
            middle_name,
            company_name,
            is_company,
            phone
          )
        `)
        .eq('status', 'completed')
        .eq('is_installment', true)
        .order('installment_due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const debtRecords: DebtRecord[] = (data || [])
        .filter(sale => {
          const totalAmount = Number(sale.total_amount) || 0;
          const amountPaid = Number(sale.amount_paid) || 0;
          return amountPaid < totalAmount;
        })
        .map(sale => {
          const client = sale.clients;
          const totalAmount = Number(sale.total_amount) || 0;
          const amountPaid = Number(sale.amount_paid) || 0;
          const dueDate = sale.installment_due_date;
          
          let isOverdue = false;
          if (dueDate) {
            const dueDateObj = new Date(dueDate);
            dueDateObj.setHours(0, 0, 0, 0);
            isOverdue = dueDateObj <= today;
          }

          const clientName = client.is_company
            ? client.company_name || 'Компания'
            : `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.trim();

          return {
            id: sale.id,
            saleId: sale.id,
            saleUid: sale.uid,
            clientId: client.id,
            clientName,
            clientPhone: client.phone,
            totalAmount,
            amountPaid,
            remainingDebt: totalAmount - amountPaid,
            dueDate,
            isOverdue,
            createdAt: sale.created_at,
          };
        })
        // Sort: overdue first, then by due date
        .sort((a, b) => {
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          return 0;
        });

      return debtRecords;
    },
  });

  const payDebtMutation = useMutation({
    mutationFn: async ({ saleId, amount }: { saleId: string; amount: number }) => {
      // Get current sale data
      const { data: sale, error: fetchError } = await supabase
        .from('sales')
        .select('amount_paid, total_amount')
        .eq('id', saleId)
        .single();

      if (fetchError) throw fetchError;

      const newAmountPaid = (Number(sale.amount_paid) || 0) + amount;
      const totalAmount = Number(sale.total_amount) || 0;
      
      const newDebtStatus = newAmountPaid >= totalAmount ? 'paid' : 'pending';

      const { error } = await supabase
        .from('sales')
        .update({ 
          amount_paid: newAmountPaid,
          debt_status: newDebtStatus,
        })
        .eq('id', saleId);

      if (error) throw error;
      
      return { newAmountPaid, totalAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['client-debts'] });
      logEventDirect({ action: 'update', category: 'finance', entityType: 'debt', fieldAccessed: 'Платёж по долгу' });
      if (data.newAmountPaid >= data.totalAmount) {
        toast({ title: 'Долг погашен полностью' });
      } else {
        toast({ title: 'Платёж добавлен' });
      }
    },
    onError: () => {
      toast({ title: 'Ошибка при добавлении платежа', variant: 'destructive' });
    },
  });

  return {
    debts,
    isLoading,
    totalDebt: debts.reduce((sum, d) => sum + d.remainingDebt, 0),
    overdueCount: debts.filter(d => d.isOverdue).length,
    payDebt: payDebtMutation.mutate,
    isPaying: payDebtMutation.isPending,
  };
}

export function useClientDebts(clientId: string) {
  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['client-debts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, uid, total_amount, amount_paid, installment_due_date')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .eq('is_installment', true);

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (data || [])
        .filter(sale => {
          const totalAmount = Number(sale.total_amount) || 0;
          const amountPaid = Number(sale.amount_paid) || 0;
          return amountPaid < totalAmount;
        })
        .map(sale => {
          const totalAmount = Number(sale.total_amount) || 0;
          const amountPaid = Number(sale.amount_paid) || 0;
          const dueDate = sale.installment_due_date;
          
          let isOverdue = false;
          if (dueDate) {
            const dueDateObj = new Date(dueDate);
            dueDateObj.setHours(0, 0, 0, 0);
            isOverdue = dueDateObj <= today;
          }

          return {
            saleId: sale.id,
            saleUid: sale.uid,
            totalAmount,
            amountPaid,
            remainingDebt: totalAmount - amountPaid,
            dueDate,
            isOverdue,
          };
        });
    },
    enabled: !!clientId,
  });

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingDebt, 0);
  const nearestDueDate = debts
    .filter(d => d.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0]?.dueDate;
  const hasOverdue = debts.some(d => d.isOverdue);

  return {
    debts,
    isLoading,
    totalDebt,
    nearestDueDate,
    hasOverdue,
    hasDebts: debts.length > 0,
  };
}
