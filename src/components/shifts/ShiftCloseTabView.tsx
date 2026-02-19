import { useState, useEffect, useCallback } from 'react';
import { useTabManager } from '@/hooks/useTabManager';
import { useShiftManagement, ShiftFinancials, ShiftReport, ShiftReportData } from '@/hooks/useShiftManagement';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { generatePrintableHTML, ExportShiftData } from '@/lib/shiftReportExport';
import { DebtPaymentsDetailTable } from '@/components/shifts/DebtPaymentsDetailTable';
import { NotificationStatsSection } from '@/components/shifts/NotificationStatsSection';
import { fetchNotificationStats } from '@/hooks/useNotificationStats';
import { 
  Loader2, 
  AlertTriangle, 
  Lock, 
  Wallet, 
  Banknote, 
  CreditCard, 
  Clock, 
  ArrowDown, 
  Landmark, 
  CalendarClock,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ShiftClosePersistedData {
  shiftId?: string;
  shift?: ShiftReport;
  financials?: ShiftFinancials | null;
  actualClosingBalance?: string;
  amountToKeep?: string;
  actualWithdrawal?: string;
  discrepancyReason?: string;
  notes?: string;
}

interface ShiftCloseTabViewProps {
  tabId: string;
}

export function ShiftCloseTabView({ tabId }: ShiftCloseTabViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { tabs, closeTab, updateTab, setTabDirty } = useTabManager();
  const { currentShift, closeShift, calculateShiftFinancials, isShiftOpen, isLoading: isLoadingShift } = useShiftManagement();

  // Get manager name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-shift', user?.id],
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

  const getManagerName = () => {
    if (userProfile?.full_name) return userProfile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    return 'Менеджер';
  };
  
  // Get persisted data from tab
  const activeTab = tabs.find(t => t.id === tabId);
  const persistedData = activeTab?.data as ShiftClosePersistedData | undefined;
  
  // Use shift from tab data FIRST (most reliable), then fall back to currentShift
  // This ensures that even if hook hasn't loaded yet, we have the shift data from tab
  const shiftToClose = persistedData?.shift || currentShift;

  const [financials, setFinancials] = useState<ShiftFinancials | null>(persistedData?.financials || null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(!persistedData?.financials);
  
  const [actualClosingBalance, setActualClosingBalance] = useState(persistedData?.actualClosingBalance || '');
  const [amountToKeep, setAmountToKeep] = useState(persistedData?.amountToKeep || '');
  const [actualWithdrawal, setActualWithdrawal] = useState(persistedData?.actualWithdrawal || '');
  const [discrepancyReason, setDiscrepancyReason] = useState(persistedData?.discrepancyReason || '');
  const [notes, setNotes] = useState(persistedData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetailedView, setShowDetailedView] = useState(false);

  const actualClosingNum = parseFloat(actualClosingBalance) || 0;
  const expectedClosing = financials?.expected_closing_balance || 0;
  const hasDiscrepancy = actualClosingBalance !== '' && actualClosingNum !== expectedClosing;
  const discrepancyAmount = actualClosingNum - expectedClosing;

  const amountToKeepNum = parseFloat(amountToKeep) || 0;
  const actualWithdrawalNum = parseFloat(actualWithdrawal) || 0;
  const suggestedWithdrawal = Math.max(0, actualClosingNum - amountToKeepNum);
  
  const balanceAfterWithdrawal = actualClosingNum - actualWithdrawalNum;
  const withdrawalMismatch = amountToKeep !== '' && actualWithdrawal !== '' && 
    Math.abs(balanceAfterWithdrawal - amountToKeepNum) > 0.01;

  // Load financials on mount - only if we have a valid shift
  useEffect(() => {
    // Wait for shift loading to complete if we don't have persisted data
    if (isLoadingShift && !persistedData?.shift) {
      return;
    }
    
    if (!shiftToClose) {
      setIsLoadingFinancials(false);
      return;
    }
    
    if (!persistedData?.financials) {
      setIsLoadingFinancials(true);
      calculateShiftFinancials().then((data) => {
        setFinancials(data);
        if (data) {
          setActualClosingBalance(data.expected_closing_balance.toString());
          setAmountToKeep(shiftToClose?.amount_to_keep?.toString() || '1000');
          // Save financials to tab data
          updateTab(tabId, { 
            data: { 
              ...persistedData, 
              financials: data,
              shiftId: shiftToClose.id,
              shift: shiftToClose,
            } 
          });
        }
      }).finally(() => {
        setIsLoadingFinancials(false);
      });
    }
  }, [shiftToClose?.id, isLoadingShift]);

  // Persist data to tab when inputs change
  const persistData = useCallback(() => {
    const data = {
      financials,
      actualClosingBalance,
      amountToKeep,
      actualWithdrawal,
      discrepancyReason,
      notes,
    } as unknown as Record<string, unknown>;
    updateTab(tabId, { data });
  }, [tabId, financials, actualClosingBalance, amountToKeep, actualWithdrawal, discrepancyReason, notes, updateTab]);

  useEffect(() => {
    persistData();
    // Mark tab as dirty if any field has been modified
    const isDirty = actualClosingBalance !== '' || amountToKeep !== '' || notes !== '';
    setTabDirty(tabId, isDirty);
  }, [actualClosingBalance, amountToKeep, actualWithdrawal, discrepancyReason, notes, persistData, setTabDirty, tabId]);

  // Auto-calculate withdrawal when amount to keep changes
  useEffect(() => {
    if (amountToKeep !== '' && actualClosingBalance !== '') {
      const suggested = Math.max(0, actualClosingNum - amountToKeepNum);
      setActualWithdrawal(suggested.toString());
    }
  }, [amountToKeep, actualClosingBalance, actualClosingNum, amountToKeepNum]);

  // Function to open the shift report in a new tab
  const openShiftReport = async (reportData: ShiftReportData) => {
    // Fetch notification stats for the shift period
    let notificationStats;
    try {
      notificationStats = await fetchNotificationStats(reportData.openedAt, reportData.closedAt || undefined);
    } catch (e) {
      console.error('Failed to fetch notification stats for report:', e);
    }

    const exportData: ExportShiftData = {
      shiftId: reportData.shiftId,
      openedAt: reportData.openedAt,
      closedAt: reportData.closedAt,
      openingBalance: reportData.openingBalance,
      closingBalance: reportData.closingBalance,
      incomeCash: reportData.incomeCash,
      incomeNonCash: reportData.incomeNonCash,
      incomeDebt: reportData.incomeDebt,
      debtRepaymentCash: reportData.debtRepaymentCash,
      debtRepaymentCard: reportData.debtRepaymentCard,
      debtRepaymentTotal: reportData.debtRepaymentTotal,
      debtPaymentDetails: reportData.debtPaymentDetails,
      totalRevenue: reportData.totalRevenue,
      withdrawal: reportData.withdrawal,
      amountToKeep: reportData.amountToKeep,
      managerName: getManagerName(),
      notificationStats: notificationStats || undefined,
      salesSummary: reportData.salesSummary.map(s => ({
        insurance_company: s.insurance_company,
        product_name: s.product_name,
        count: s.count,
        total_cash: s.total_cash,
        total_non_cash: s.total_non_cash,
        total_amount: s.total_amount,
      })),
      servicesSummary: reportData.servicesSummary.map(s => ({
        service_name: s.service_name,
        count: s.count,
        total_cash: s.total_cash,
        total_non_cash: s.total_non_cash,
        total_amount: s.total_amount,
      })),
    };

    const reportHtml = generatePrintableHTML(exportData, true);
    const newWindow = window.open('', '_blank');
    
    if (newWindow) {
      newWindow.document.write(reportHtml);
      newWindow.document.close();
      newWindow.focus();
    } else {
      // Browser blocked popup
      toast({
        title: 'Браузер заблокировал открытие отчёта',
        description: 'Пожалуйста, разрешите всплывающие окна для этого сайта',
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    if (!can('dash_shift_manage')) {
      toast({ title: 'Нет доступа', description: 'У вас нет права на управление сменой', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await closeShift(
        actualClosingNum,
        amountToKeepNum,
        actualWithdrawalNum,
        hasDiscrepancy ? discrepancyReason : undefined,
        notes || undefined
      );
      
      if (result.success && result.reportData) {
        // Open the report in a new tab BEFORE closing this tab
        await openShiftReport(result.reportData);
        
        // Close the tab and navigate away
        closeTab(tabId);
        navigate('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    closeTab(tabId);
  };

  const isFormValid = () => {
    if (!actualClosingBalance || actualClosingBalance === '') return false;
    if (hasDiscrepancy && !discrepancyReason.trim()) return false;
    if (amountToKeep === '') return false;
    if (withdrawalMismatch) return false;
    return true;
  };

  // Show loading state while shift data is being fetched
  if (isLoadingShift && !persistedData?.shift) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Загрузка данных смены...</h2>
      </div>
    );
  }

  if (!shiftToClose) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Смена не открыта</h2>
        <p className="text-muted-foreground mb-4">Нет активной смены для закрытия</p>
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Вернуться
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Закрытие смены</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Открыта: {new Date(shiftToClose.opened_at).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Отмена
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto">
          {isLoadingFinancials ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <span className="text-muted-foreground">Расчёт итогов смены...</span>
            </div>
          ) : financials ? (
            <div className="space-y-6">
              {/* ===== STEP 1: Revenue Summary ===== */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium">1</span>
                    Итоги продаж за смену
                  </CardTitle>
                  <CardDescription>Выручка по типам оплаты</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                        <Banknote className="h-5 w-5" />
                        <span className="text-sm font-medium">Наличные</span>
                      </div>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {financials.income_cash.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                        <CreditCard className="h-5 w-5" />
                        <span className="text-sm font-medium">Карта/СБП</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                        {financials.income_non_cash.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
                        <CalendarClock className="h-5 w-5" />
                        <span className="text-sm font-medium">Рассрочка</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                        {financials.income_debt.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <Wallet className="h-5 w-5" />
                        <span className="text-sm font-medium">Всего</span>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        {financials.total_revenue.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </div>

                  {/* Debt repayment detailed table */}
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 mt-4">
                    <DebtPaymentsDetailTable
                      payments={financials.debt_payment_details}
                      totalCash={financials.debt_repayment_cash}
                      totalCard={financials.debt_repayment_card}
                      totalAmount={financials.debt_repayment_total}
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 mt-4 bg-muted/30 rounded-lg">
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
                    <div className="space-y-4 mt-4">
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
                </CardContent>
              </Card>

              {/* ===== STEP 2: Cash Balance Verification ===== */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium">2</span>
                    Проверка кассы
                  </CardTitle>
                  <CardDescription>Сверка расчётного и фактического остатка</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Расчётный остаток кассы</Label>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">
                          {financials.expected_closing_balance.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          = {Number(shiftToClose.actual_opening_balance).toLocaleString('ru-RU')} ₽ (начальный) + {financials.income_cash.toLocaleString('ru-RU')} ₽ (продажи нал.) + {financials.debt_repayment_cash.toLocaleString('ru-RU')} ₽ (долги нал.)
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
                          className="text-lg h-12"
                        />
                        <span className="text-muted-foreground text-lg">₽</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Пересчитайте наличные в кассе
                      </p>
                    </div>
                  </div>

                  {/* Real-time hint for available cash */}
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">Доступно к распределению (с учетом долгов):</span>
                      <span className="font-semibold text-primary text-lg">
                        {(Number(shiftToClose.actual_opening_balance) + financials.income_cash + financials.debt_repayment_cash).toLocaleString('ru-RU')} ₽
                      </span>
                    </p>
                  </div>

                  {hasDiscrepancy && (
                    <Alert variant={discrepancyAmount > 0 ? 'default' : 'destructive'} className="mt-4">
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
                </CardContent>
              </Card>

              {/* ===== STEP 3: Mandatory Withdrawal Section ===== */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium">3</span>
                    Инкассация (выемка средств)
                  </CardTitle>
                  <CardDescription>Укажите сумму для размена и выемку</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
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
                          className="h-12 text-lg"
                        />
                        <span className="text-muted-foreground text-lg">₽</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <ArrowDown className="h-3.5 w-3.5" />
                        Рекомендуемая выемка
                      </Label>
                      <div className="p-3 bg-muted rounded-lg border h-12 flex items-center">
                        <p className="font-semibold text-lg">
                          {suggestedWithdrawal.toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="actual-withdrawal" className="flex items-center gap-1">
                        <Landmark className="h-3.5 w-3.5" />
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
                          className="h-12 text-lg"
                        />
                        <span className="text-muted-foreground text-lg">₽</span>
                      </div>
                    </div>
                  </div>

                  {/* Balance after withdrawal info */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border mt-4">
                    <span className="text-muted-foreground">Остаток после выемки:</span>
                    <span className={cn(
                      "text-xl font-bold",
                      balanceAfterWithdrawal < 0 ? "text-destructive" : "text-primary"
                    )}>
                      {balanceAfterWithdrawal.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  {withdrawalMismatch && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Остаток после выемки ({balanceAfterWithdrawal.toLocaleString('ru-RU')} ₽) 
                        не равен сумме "на размен" ({amountToKeepNum.toLocaleString('ru-RU')} ₽)
                      </AlertDescription>
                    </Alert>
                  )}

                  {actualClosingNum > 0 && amountToKeep === '' && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Укажите сумму для размена. Выемка обязательна при положительном балансе кассы.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Notification Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Отчёт по автоматическим уведомлениям
                  </CardTitle>
                  <CardDescription>Статистика автопилота за текущую смену</CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationStatsSection shiftOpenedAt={shiftToClose.opened_at} />
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Заметки к смене</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Дополнительные заметки..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              Нет данных для отображения
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer with submit button */}
      {financials && (
        <div className="border-t bg-muted/30 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isFormValid() ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Все поля заполнены корректно
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Заполните все обязательные поля
                </span>
              )}
            </div>
            <Button 
              size="lg"
              onClick={handleSubmit} 
              disabled={isSubmitting || isLoadingFinancials || !isFormValid()}
              className="gap-2 px-8"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Lock className="h-4 w-4" />
              Закрыть смену
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
