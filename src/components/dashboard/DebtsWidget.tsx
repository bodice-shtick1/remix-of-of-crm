import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  CreditCard, Phone, AlertTriangle, Loader2, Wallet,
  CheckCircle2, Banknote, Printer, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebts, DebtRecord } from '@/hooks/useDebts';
import { useDebtPayments } from '@/hooks/useDebtPayments';
import { useAuth } from '@/hooks/useAuth';
import { printDebtReceipt, DebtReceiptData } from '@/lib/printDebtReceipt';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';

export function DebtsWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { debts, isLoading, totalDebt, overdueCount } = useDebts();
  const { createPaymentAsync, isCreating, isShiftOpen } = useDebtPayments();

  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const getManagerName = () => userProfile?.full_name || user?.user_metadata?.full_name || 'Менеджер';

  const handlePayDebt = async (shouldPrint = false) => {
    if (!payingDebt || !paymentAmount || isCreating) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await createPaymentAsync({ saleId: payingDebt.saleId, clientId: payingDebt.clientId, amount, paymentMethod });
      if (shouldPrint) {
        const receiptData: DebtReceiptData = {
          clientName: payingDebt.clientName, clientPhone: payingDebt.clientPhone,
          saleUid: payingDebt.saleUid, productName: 'Погашение задолженности',
          amount, paymentMethod, paidAt: new Date(), managerName: getManagerName(),
          remainingDebt: Math.max(0, payingDebt.remainingDebt - amount),
          originalDebt: payingDebt.remainingDebt,
        };
        printDebtReceipt(receiptData);
      }
      setPayingDebt(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
    } catch (error) {
      console.error('Error paying debt:', error);
    }
  };

  const openPayDialog = (debt: DebtRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setPayingDebt(debt);
    setPaymentAmount(debt.remainingDebt.toString());
    setPaymentMethod('cash');
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <CreditCard className="h-4 w-4 text-primary" /> Долги и рассрочки
        </div>
        <div className="flex items-center justify-center h-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <CreditCard className="h-4 w-4 text-primary" /> Долги и рассрочки
        </div>
        <div className="text-center py-4">
          <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-1" />
          <p className="text-xs text-muted-foreground">Нет активных долгов</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-primary" /> Долги и рассрочки
          </div>
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 gap-0.5 px-1.5">
                <AlertTriangle className="h-2.5 w-2.5" /> {overdueCount}
              </Badge>
            )}
            <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
              {totalDebt.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
        <ScrollArea className="max-h-[220px]">
          <div className="divide-y divide-border/40">
            {debts.map((debt) => (
              <div
                key={debt.id}
                onClick={() => navigate(`/clients?id=${debt.clientId}`)}
                className={cn(
                  'px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30 flex items-center gap-3',
                  debt.isOverdue && 'bg-destructive/5 hover:bg-destructive/10'
                )}
              >
                {/* Overdue indicator */}
                <div className={cn(
                  'shrink-0 w-1 h-8 rounded-full',
                  debt.isOverdue ? 'bg-destructive' : 'bg-primary/30'
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{debt.clientName}</span>
                    {debt.isOverdue && (
                      <span className="text-[9px] bg-destructive/10 text-destructive px-1 py-0.5 rounded font-medium">Просрочен</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>#{debt.saleUid}</span>
                    {debt.dueDate && (
                      <span className={cn(debt.isOverdue && 'text-destructive')}>
                        до {format(parseISO(debt.dueDate), 'd MMM', { locale: ru })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-semibold', debt.isOverdue ? 'text-destructive' : 'text-foreground')}>
                    {debt.remainingDebt.toLocaleString('ru-RU')} ₽
                  </p>
                  <p className="text-[10px] text-muted-foreground">из {debt.totalAmount.toLocaleString('ru-RU')} ₽</p>
                </div>

                {can('debt_payment_create') && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => openPayDialog(debt, e)}>
                  <Wallet className="h-3.5 w-3.5 text-success" />
                </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!payingDebt} onOpenChange={(open) => !open && setPayingDebt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Погашение долга</DialogTitle></DialogHeader>
          {payingDebt && (
            <div className="space-y-4 pt-2">
              {!isShiftOpen && (
                <Alert className="border-warning/50 bg-warning/10">
                  <Info className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-warning text-sm">Смена не открыта. Платёж будет учтён вне кассовой смены.</AlertDescription>
                </Alert>
              )}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium text-sm">{payingDebt.clientName}</p>
                <p className="text-xs text-muted-foreground">Чек #{payingDebt.saleUid}</p>
                <div className="flex justify-between mt-2 text-xs">
                  <span>Остаток:</span>
                  <span className="font-semibold">{payingDebt.remainingDebt.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Сумма</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" max={payingDebt.remainingDebt} className="mt-1 h-9" />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Способ оплаты</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card')} className="flex gap-4">
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center gap-1 cursor-pointer text-xs"><Banknote className="h-3.5 w-3.5 text-success" />Наличные</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-1 cursor-pointer text-xs"><CreditCard className="h-3.5 w-3.5 text-primary" />Карта</Label>
                  </div>
                </RadioGroup>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setPaymentAmount(payingDebt.remainingDebt.toString())}>Всю сумму</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handlePayDebt(true)} disabled={isCreating || !paymentAmount}>
                  <Printer className="h-3.5 w-3.5" /> Квитанция
                </Button>
                <Button size="sm" className="flex-1" onClick={() => handlePayDebt(false)} disabled={isCreating || !paymentAmount}>
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Погасить'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
