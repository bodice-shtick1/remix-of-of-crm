import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, Lock, Wallet, Banknote, CreditCard, Clock, ArrowDown, Landmark, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShiftFinancials, ShiftReport } from '@/hooks/useShiftManagement';
import { DebtPaymentsDetailTable } from '@/components/shifts/DebtPaymentsDetailTable';
import { NotificationStatsSection } from '@/components/shifts/NotificationStatsSection';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    actualClosingBalance: number,
    amountToKeep: number,
    actualWithdrawal: number,
    closingDiscrepancyReason?: string,
    notes?: string
  ) => Promise<boolean>;
  currentShift: ShiftReport | null;
  financials: ShiftFinancials | null;
  isLoadingFinancials: boolean;
}

export function CloseShiftModal({
  isOpen,
  onClose,
  onConfirm,
  currentShift,
  financials,
  isLoadingFinancials,
}: CloseShiftModalProps) {
  const [actualClosingBalance, setActualClosingBalance] = useState('');
  const [amountToKeep, setAmountToKeep] = useState('');
  const [actualWithdrawal, setActualWithdrawal] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);

  const actualClosingNum = parseFloat(actualClosingBalance) || 0;
  const expectedClosing = financials?.expected_closing_balance || 0;
  const hasDiscrepancy = actualClosingBalance !== '' && actualClosingNum !== expectedClosing;
  const discrepancyAmount = actualClosingNum - expectedClosing;

  const amountToKeepNum = parseFloat(amountToKeep) || 0;
  const actualWithdrawalNum = parseFloat(actualWithdrawal) || 0;
  const suggestedWithdrawal = Math.max(0, actualClosingNum - amountToKeepNum);
  
  // Validation: after withdrawal, balance should equal amount to keep
  const balanceAfterWithdrawal = actualClosingNum - actualWithdrawalNum;
  const withdrawalMismatch = amountToKeep !== '' && actualWithdrawal !== '' && 
    Math.abs(balanceAfterWithdrawal - amountToKeepNum) > 0.01;

  useEffect(() => {
    if (isOpen && financials) {
      setActualClosingBalance(financials.expected_closing_balance.toString());
      // Set default amount to keep from previous shift if available
      setAmountToKeep(currentShift?.amount_to_keep?.toString() || '1000');
      setActualWithdrawal('');
      setDiscrepancyReason('');
      setNotes('');
    }
  }, [isOpen, financials, currentShift]);

  // Auto-calculate withdrawal when amount to keep changes
  useEffect(() => {
    if (amountToKeep !== '' && actualClosingBalance !== '') {
      const suggested = Math.max(0, actualClosingNum - amountToKeepNum);
      setActualWithdrawal(suggested.toString());
    }
  }, [amountToKeep, actualClosingBalance, actualClosingNum, amountToKeepNum]);

  const handleSubmit = async () => {
    // Validation
    if (!actualClosingBalance) {
      return;
    }
    
    if (hasDiscrepancy && !discrepancyReason.trim()) {
      return;
    }

    // Withdrawal step is mandatory - must have amount to keep specified
    if (amountToKeep === '') {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onConfirm(
        actualClosingNum,
        amountToKeepNum,
        actualWithdrawalNum,
        hasDiscrepancy ? discrepancyReason : undefined,
        notes || undefined
      );
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    if (!actualClosingBalance || actualClosingBalance === '') return false;
    if (hasDiscrepancy && !discrepancyReason.trim()) return false;
    if (amountToKeep === '') return false; // Amount to keep is required
    if (withdrawalMismatch) return false;
    return true;
  };

  if (!currentShift) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Закрытие смены
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Открыта: {new Date(currentShift.opened_at).toLocaleString('ru-RU')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoadingFinancials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Расчёт итогов...</span>
            </div>
          ) : financials ? (
            <div className="grid gap-6 py-4">
              {/* ===== STEP 1: Revenue Summary ===== */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                  Итоги продаж за смену
                </h4>
                
                {/* Payment breakdown by type */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-1">
                      <Banknote className="h-4 w-4" />
                      <span className="text-xs font-medium">Наличные</span>
                    </div>
                    <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                      {financials.income_cash.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-1">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-xs font-medium">Карта/СБП</span>
                    </div>
                    <p className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                      {financials.income_non_cash.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-1">
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-xs font-medium">Рассрочка</span>
                    </div>
                    <p className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                      {financials.income_debt.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <Wallet className="h-4 w-4" />
                      <span className="text-xs font-medium">Всего</span>
                    </div>
                    <p className="text-lg font-semibold text-primary">
                      {financials.total_revenue.toLocaleString('ru-RU')} ₽
                    </p>
                  </div>
                </div>

                {/* Debt repayment detailed table */}
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  <DebtPaymentsDetailTable
                    payments={financials.debt_payment_details}
                    totalCash={financials.debt_repayment_cash}
                    totalCard={financials.debt_repayment_card}
                    totalAmount={financials.debt_repayment_total}
                    compact
                  />
                </div>
              </div>

              {/* Detailed Report Toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                <Label htmlFor="detailed-toggle" className="text-sm cursor-pointer">
                  Показать детальный отчёт по продуктам
                </Label>
                <Switch
                  id="detailed-toggle"
                  checked={showDetailedView}
                  onCheckedChange={setShowDetailedView}
                />
              </div>

              {/* Detailed Sales Summary */}
              {showDetailedView && (financials.sales_summary.length > 0 || financials.services_summary.length > 0) && (
                <div className="space-y-4">
                  {financials.sales_summary.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Страховые продукты</h5>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Компания / Продукт</TableHead>
                              <TableHead className="text-center">Кол-во</TableHead>
                              <TableHead className="text-right">Нал</TableHead>
                              <TableHead className="text-right">Безнал</TableHead>
                              <TableHead className="text-right">Сумма</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {financials.sales_summary.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <div className="font-medium">{item.insurance_company}</div>
                                  <div className="text-sm text-muted-foreground">{item.product_name}</div>
                                </TableCell>
                                <TableCell className="text-center">{item.count}</TableCell>
                                <TableCell className="text-right text-green-600">
                                  {item.total_cash.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell className="text-right text-blue-600">
                                  {item.total_non_cash.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {item.total_amount.toLocaleString('ru-RU')} ₽
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {financials.services_summary.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Услуги</h5>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Услуга</TableHead>
                              <TableHead className="text-center">Кол-во</TableHead>
                              <TableHead className="text-right">Нал</TableHead>
                              <TableHead className="text-right">Безнал</TableHead>
                              <TableHead className="text-right">Сумма</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {financials.services_summary.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.service_name}</TableCell>
                                <TableCell className="text-center">{item.count}</TableCell>
                                <TableCell className="text-right text-green-600">
                                  {item.total_cash.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell className="text-right text-blue-600">
                                  {item.total_non_cash.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {item.total_amount.toLocaleString('ru-RU')} ₽
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* ===== STEP 2: Cash Balance Verification ===== */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                  Проверка кассы
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Расчётный остаток кассы</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xl font-semibold">
                        {financials.expected_closing_balance.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        = {currentShift.actual_opening_balance.toLocaleString('ru-RU')} ₽ (начальный) + {financials.income_cash.toLocaleString('ru-RU')} ₽ (продажи нал.){financials.debt_repayment_cash > 0 ? ` + ${financials.debt_repayment_cash.toLocaleString('ru-RU')} ₽ (долги нал.)` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="actual-closing">Фактический остаток *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="actual-closing"
                        type="number"
                        value={actualClosingBalance}
                        onChange={(e) => setActualClosingBalance(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className="text-lg"
                      />
                      <span className="text-muted-foreground">₽</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Пересчитайте наличные в кассе
                    </p>
                  </div>
                </div>

                {hasDiscrepancy && (
                  <Alert variant={discrepancyAmount > 0 ? 'default' : 'destructive'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-2">
                      <span>
                        {discrepancyAmount > 0 ? 'Излишек' : 'Недостача'}: {' '}
                        <span className="font-semibold">
                          {Math.abs(discrepancyAmount).toLocaleString('ru-RU')} ₽
                        </span>
                      </span>
                      <Textarea
                        value={discrepancyReason}
                        onChange={(e) => setDiscrepancyReason(e.target.value)}
                        placeholder="Укажите причину расхождения (обязательно)..."
                        rows={2}
                        className="mt-2"
                      />
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* ===== STEP 3: Mandatory Withdrawal Section ===== */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                  Инкассация (выемка средств)
                </h4>
                
                <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount-to-keep" className="flex items-center gap-1">
                        Оставить на размен *
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="amount-to-keep"
                          type="number"
                          value={amountToKeep}
                          onChange={(e) => setAmountToKeep(e.target.value)}
                          placeholder="1000"
                          min="0"
                          step="100"
                        />
                        <span className="text-muted-foreground">₽</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <ArrowDown className="h-3 w-3" />
                        Рекомендуемая выемка
                      </Label>
                      <div className="p-2 bg-muted rounded border">
                        <p className="font-medium text-lg">
                          {suggestedWithdrawal.toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="actual-withdrawal" className="flex items-center gap-1">
                        <Landmark className="h-3 w-3" />
                        Сумма выемки
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="actual-withdrawal"
                          type="number"
                          value={actualWithdrawal}
                          onChange={(e) => setActualWithdrawal(e.target.value)}
                          placeholder="0"
                          min="0"
                          step="100"
                        />
                        <span className="text-muted-foreground">₽</span>
                      </div>
                    </div>
                  </div>

                  {/* Balance after withdrawal info */}
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <span className="text-sm text-muted-foreground">Остаток после выемки:</span>
                    <span className={cn(
                      "font-semibold",
                      balanceAfterWithdrawal < 0 ? "text-destructive" : "text-primary"
                    )}>
                      {balanceAfterWithdrawal.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  {withdrawalMismatch && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Остаток после выемки ({balanceAfterWithdrawal.toLocaleString('ru-RU')} ₽) 
                        не равен сумме "на размен" ({amountToKeepNum.toLocaleString('ru-RU')} ₽)
                      </AlertDescription>
                    </Alert>
                  )}

                  {actualClosingNum > 0 && amountToKeep === '' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Укажите сумму для размена. Выемка обязательна при положительном балансе кассы.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Notification Stats */}
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  Отчёт по автоматическим уведомлениям
                </h4>
                <NotificationStatsSection shiftOpenedAt={currentShift.opened_at} compact />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Заметки к смене</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительные заметки..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Нет данных для отображения
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isLoadingFinancials || !isFormValid()}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Lock className="h-4 w-4" />
            Закрыть смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
