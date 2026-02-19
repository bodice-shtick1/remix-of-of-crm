import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  CreditCard, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  CheckCircle2, Calendar, Clock, Banknote, Wallet, Printer, Receipt
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { printDebtReceipt, DebtReceiptData } from '@/lib/printDebtReceipt';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientInstallmentsTabProps {
  clientId: string;
}

interface InstallmentRecord {
  id: string;
  saleId: string;
  saleUid: string;
  createdAt: string;
  dueDate: string | null;
  totalAmount: number;
  amountPaid: number;
  remainingDebt: number;
  isOverdue: boolean;
  isPaidOff: boolean;
  productName: string;
  payments: PaymentRecord[];
}

interface PaymentRecord {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  paidAt: string;
  receiptDocId?: string;
}

export function ClientInstallmentsTab({ clientId }: ClientInstallmentsTabProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Get user profile for manager name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-installments', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Get client data
  const { data: clientData } = useQuery({
    queryKey: ['client-for-installments', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('first_name, last_name, middle_name, company_name, is_company, phone')
        .eq('id', clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  const getManagerName = () => {
    if (userProfile?.full_name) return userProfile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    return 'Менеджер';
  };

  const getClientName = () => {
    if (!clientData) return '—';
    return [clientData.last_name, clientData.first_name, clientData.middle_name].filter(Boolean).join(' ') || '—';
  };

  const { data: installments = [], isLoading } = useQuery({
    queryKey: ['client-installments', clientId],
    queryFn: async () => {
      // Get all installment sales (where is_installment = true OR amount_paid < total_amount)
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
          id, uid, total_amount, amount_paid, debt_status, is_installment,
          installment_due_date, created_at, completed_at
        `)
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .or('is_installment.eq.true,debt_status.eq.pending')
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      const now = new Date();
      const results: InstallmentRecord[] = [];

      for (const sale of sales || []) {
        // Get sale items for product name
        const { data: items } = await supabase
          .from('sale_items')
          .select('service_name, insurance_product:insurance_products(name)')
          .eq('sale_id', sale.id)
          .limit(1);

        const item = items?.[0];
        let productName = 'Услуга';
        if (item) {
          if (item.insurance_product?.name) {
            productName = item.insurance_product.name;
          } else if (item.service_name) {
            productName = item.service_name;
          }
        }

        // Get payment history
        const { data: payments } = await supabase
          .from('debt_payments')
          .select('id, amount, payment_method, paid_at')
          .eq('sale_id', sale.id)
          .order('paid_at', { ascending: false });

        const totalAmount = Number(sale.total_amount) || 0;
        const amountPaid = Number(sale.amount_paid) || 0;
        const remainingDebt = totalAmount - amountPaid;
        const isPaidOff = remainingDebt <= 0;
        const dueDate = sale.installment_due_date;
        const isOverdue = !isPaidOff && dueDate ? new Date(dueDate) < now : false;

        results.push({
          id: sale.id,
          saleId: sale.id,
          saleUid: sale.uid,
          createdAt: sale.completed_at || sale.created_at,
          dueDate,
          totalAmount,
          amountPaid,
          remainingDebt,
          isOverdue,
          isPaidOff,
          productName,
          payments: (payments || []).map(p => ({
            id: p.id,
            amount: Number(p.amount),
            paymentMethod: p.payment_method as 'cash' | 'card',
            paidAt: p.paid_at,
          })),
        });
      }

      return results;
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (installments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">Нет рассрочек</h3>
            <p className="text-muted-foreground text-sm">
              У клиента нет активных или завершённых рассрочек
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeInstallments = installments.filter(i => !i.isPaidOff);
  const completedInstallments = installments.filter(i => i.isPaidOff);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сводка по рассрочкам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-foreground">
                {activeInstallments.length}
              </p>
              <p className="text-xs text-muted-foreground">Активных</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-success">
                {completedInstallments.length}
              </p>
              <p className="text-xs text-muted-foreground">Погашено</p>
            </div>
          </div>
          {activeInstallments.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Общий долг:</span>
                <span className="text-lg font-bold text-destructive">
                  {activeInstallments.reduce((sum, i) => sum + i.remainingDebt, 0).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installments List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            История рассрочек ({installments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border">
              {installments.map((installment) => (
                <div key={installment.id} className="p-4">
                  {/* Header */}
                  <div
                    className="cursor-pointer"
                    onClick={() => toggleExpand(installment.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {installment.productName}
                          </span>
                          {installment.isPaidOff ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Погашено
                            </Badge>
                          ) : installment.isOverdue ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Просрочен
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                              <Clock className="h-3 w-3 mr-1" />
                              Активна
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(installment.createdAt), 'd MMM yyyy', { locale: ru })}
                          </span>
                          <span>Чек #{installment.saleUid}</span>
                        </div>

                        {installment.dueDate && !installment.isPaidOff && (
                          <p className={cn(
                            'text-xs mt-1',
                            installment.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                          )}>
                            Срок возврата: {format(parseISO(installment.dueDate), 'd MMMM yyyy', { locale: ru })}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="font-semibold">
                          {installment.totalAmount.toLocaleString('ru-RU')} ₽
                        </p>
                        {!installment.isPaidOff && (
                          <p className="text-sm text-destructive">
                            Долг: {installment.remainingDebt.toLocaleString('ru-RU')} ₽
                          </p>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          {expandedId === installment.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Payment History */}
                  {expandedId === installment.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        История платежей ({installment.payments.length})
                      </h4>
                      
                      {installment.payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Платежей пока нет
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {installment.payments.map((payment, paymentIndex) => {
                            // Calculate what the remaining debt was after this payment
                            const laterPayments = installment.payments.slice(0, paymentIndex);
                            const laterPaymentsSum = laterPayments.reduce((sum, p) => sum + p.amount, 0);
                            const remainingAfterThis = installment.remainingDebt + laterPaymentsSum;
                            const originalDebtAtTime = remainingAfterThis + payment.amount;
                            
                            const handlePrintReceipt = () => {
                              const receiptData: DebtReceiptData = {
                                clientName: getClientName(),
                                clientPhone: clientData?.phone || undefined,
                                saleUid: installment.saleUid,
                                productName: installment.productName,
                                amount: payment.amount,
                                paymentMethod: payment.paymentMethod,
                                paidAt: new Date(payment.paidAt),
                                managerName: getManagerName(),
                                remainingDebt: remainingAfterThis,
                                originalDebt: originalDebtAtTime,
                              };
                              printDebtReceipt(receiptData);
                            };
                            
                            return (
                              <div 
                                key={payment.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  {payment.paymentMethod === 'cash' ? (
                                    <div className="p-2 rounded-full bg-success/10">
                                      <Banknote className="h-4 w-4 text-success" />
                                    </div>
                                  ) : (
                                    <div className="p-2 rounded-full bg-primary/10">
                                      <CreditCard className="h-4 w-4 text-primary" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">
                                      {payment.paymentMethod === 'cash' ? 'Наличные' : 'Карта'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(parseISO(payment.paidAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-success">
                                    +{payment.amount.toLocaleString('ru-RU')} ₽
                                  </span>
                                  {can('docs_archive_print') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handlePrintReceipt}
                                    title="Печать квитанции"
                                  >
                                    <Printer className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Summary */}
                      <div className="mt-4 pt-3 border-t border-dashed border-border space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Оплачено:</span>
                          <span className="font-medium text-success">
                            {installment.amountPaid.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Осталось:</span>
                          <span className={cn(
                            'font-medium',
                            installment.remainingDebt > 0 ? 'text-destructive' : 'text-success'
                          )}>
                            {installment.remainingDebt.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
