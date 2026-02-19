import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, Loader2, Printer, FileSpreadsheet,
  Banknote, CreditCard, Wallet, TrendingUp, ChevronRight, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { printShiftReport, exportToExcel, type ExportShiftData } from '@/lib/shiftReportExport';
import { DebtPaymentsDetailTable } from '@/components/shifts/DebtPaymentsDetailTable';
import { useShiftReportsList, useShiftReportDetails, type SaleItemWithDetails } from '@/hooks/useShiftReportsData';
import { ServerPagination } from '@/components/common/ServerPagination';
import { usePermissions } from '@/hooks/usePermissions';

const paymentMethodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  debt: 'Долг',
};

export default function ShiftReports() {
  const { toast } = useToast();
  const { can } = usePermissions();
  
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [isFullForm, setIsFullForm] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const tableRef = useRef<HTMLDivElement>(null);

  // react-query: shifts list
  const { data: shifts = [], isLoading } = useShiftReportsList();

  // Auto-select first closed shift when list loads
  const effectiveShiftId = useMemo(() => {
    if (selectedShiftId) return selectedShiftId;
    const closedShift = shifts.find(s => s.status === 'closed');
    return closedShift?.id || '';
  }, [selectedShiftId, shifts]);

  // Reset page on shift or form change
  useEffect(() => { setPage(0); }, [effectiveShiftId, isFullForm]);

  const selectedShift = useMemo(
    () => shifts.find(s => s.id === effectiveShiftId) || null,
    [shifts, effectiveShiftId],
  );

  // react-query: shift details (items + debt)
  const { data: details, isLoading: isLoadingDetails } = useShiftReportDetails(
    effectiveShiftId || undefined,
    selectedShift || undefined,
  );

  const shiftItems = details?.items ?? [];
  const totalCountItems = shiftItems.length;
  const totalPagesItems = Math.ceil(totalCountItems / pageSize);
  const paginatedShiftItems = useMemo(() => {
    const from = page * pageSize;
    return shiftItems.slice(from, from + pageSize);
  }, [shiftItems, page, pageSize]);

  const handlePageChange = (p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handlePageSizeChange = (size: number) => { setPageSize(size); setPage(0); };
  const debtDetails = details?.debtDetails ?? [];
  const debtTotals = details?.debtTotals ?? { cash: 0, card: 0, total: 0 };

  const getClientName = (client: SaleItemWithDetails['sale']['client']) => {
    if (!client) return '—';
    if (client.is_company) return client.company_name || '—';
    return `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.trim();
  };

  const buildExportData = (): ExportShiftData => {
    return {
      shiftId: selectedShift!.id,
      openedAt: selectedShift!.opened_at,
      closedAt: selectedShift!.closed_at,
      openingBalance: selectedShift!.actual_opening_balance,
      closingBalance: selectedShift!.actual_closing_balance,
      incomeCash: selectedShift!.income_cash,
      incomeNonCash: selectedShift!.income_non_cash,
      incomeDebt: selectedShift!.income_debt,
      debtRepaymentCash: debtTotals.cash,
      debtRepaymentCard: debtTotals.card,
      debtRepaymentTotal: debtTotals.total,
      debtPaymentDetails: debtDetails,
      totalRevenue: selectedShift!.total_revenue,
      withdrawal: selectedShift!.actual_withdrawal,
      salesSummary: selectedShift!.sales_summary || [],
      servicesSummary: selectedShift!.services_summary || [],
      transactions: isFullForm ? shiftItems.map(item => ({
        date: format(new Date(item.sale.completed_at!), 'dd.MM.yyyy HH:mm', { locale: ru }),
        uid: item.sale.uid,
        clientName: getClientName(item.sale.client),
        itemType: item.item_type === 'insurance' ? 'Страховка' : 'Услуга',
        itemName: item.item_type === 'insurance' 
          ? item.insurance_product?.name || '—'
          : item.service_name || '—',
        paymentMethod: paymentMethodLabels[item.sale.payment_method] || item.sale.payment_method,
        amount: Number(item.amount) || 0,
      })) : undefined,
    };
  };

  const handlePrint = () => {
    if (!selectedShift) return;
    printShiftReport(buildExportData(), isFullForm);
  };

  const handleExportExcel = () => {
    if (!selectedShift) return;
    exportToExcel(buildExportData(), isFullForm);
    toast({ title: 'Экспорт завершён', description: 'Файл Excel сохранён' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 pb-24 overflow-auto max-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Отчёты по сменам</h1>
          <p className="text-sm text-muted-foreground mt-1">Анализ кассовых смен и выручки</p>
        </div>
        {can('reports_shifts_view') && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!selectedShift}>
            <Printer className="h-4 w-4 mr-2" />
            Печать
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!selectedShift}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
        )}
      </div>

      {/* Shift Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground mb-2 block">Выберите смену</Label>
              <Select value={effectiveShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите смену для просмотра" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {shifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(shift.opened_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </span>
                        {shift.status === 'closed' && (
                          <span className="text-muted-foreground">
                            — {format(new Date(shift.closed_at!), 'HH:mm', { locale: ru })}
                          </span>
                        )}
                        <Badge variant={shift.status === 'open' ? 'default' : 'secondary'} className="ml-2">
                          {shift.status === 'open' ? 'Открыта' : 'Закрыта'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Form toggle */}
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <Label htmlFor="form-toggle" className="text-sm cursor-pointer">
                {isFullForm ? 'Полная форма' : 'Краткая форма'}
              </Label>
              <Switch id="form-toggle" checked={isFullForm} onCheckedChange={setIsFullForm} />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedShift ? (
        <>
          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-1">
                  <Banknote className="h-4 w-4" />
                  <span className="text-sm font-medium">Приход Наличными</span>
                </div>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {(selectedShift.income_cash || 0).toLocaleString('ru-RU')} ₽
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Приход Безнал/Долги</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {((selectedShift.income_non_cash || 0) + (selectedShift.income_debt || 0)).toLocaleString('ru-RU')} ₽
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20 md:col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Общая выручка за смену</span>
                </div>
                <p className="text-3xl font-bold text-primary">
                  {(selectedShift.total_revenue || 0).toLocaleString('ru-RU')} ₽
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Summary Tables */}
          {!isFullForm && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {selectedShift.sales_summary && selectedShift.sales_summary.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Страховые продукты
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Компания / Продукт</TableHead>
                          <TableHead className="text-center">Кол-во</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedShift.sales_summary.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">{item.insurance_company || '—'}</div>
                              <div className="text-sm text-muted-foreground">{item.product_name || '—'}</div>
                            </TableCell>
                            <TableCell className="text-center">{item.count}</TableCell>
                            <TableCell className="text-right font-medium">
                              {(item.total_amount || 0).toLocaleString('ru-RU')} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {selectedShift.services_summary && selectedShift.services_summary.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Услуги
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Услуга</TableHead>
                          <TableHead className="text-center">Кол-во</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedShift.services_summary.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.service_name}</TableCell>
                            <TableCell className="text-center">{item.count}</TableCell>
                            <TableCell className="text-right font-medium">
                              {(item.total_amount || 0).toLocaleString('ru-RU')} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Debt Payments Detail */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Погашение долгов / рассрочек
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DebtPaymentsDetailTable
                  payments={debtDetails}
                  totalCash={debtTotals.cash}
                  totalCard={debtTotals.card}
                  totalAmount={debtTotals.total}
                />
              )}
            </CardContent>
          </Card>

          {isFullForm && (
            <>
            <div ref={tableRef} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Детализация операций
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>№ Документа</TableHead>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Наименование</TableHead>
                          <TableHead>Оплата</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedShiftItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              Нет операций за эту смену
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {paginatedShiftItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="text-sm">
                                    {format(new Date(item.sale.completed_at!), 'dd.MM.yyyy', { locale: ru })}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(item.sale.completed_at!), 'HH:mm')}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{item.sale.uid}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{getClientName(item.sale.client)}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      item.item_type === 'insurance'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    )}
                                  >
                                    {item.item_type === 'insurance' ? 'Страховка' : 'Услуга'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {item.item_type === 'insurance'
                                      ? item.insurance_product?.name || '—'
                                      : item.service_name || '—'}
                                  </div>
                                  {item.item_type === 'insurance' && item.insurance_company && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                      <ChevronRight className="h-3 w-3" />
                                      {item.insurance_company}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {paymentMethodLabels[item.sale.payment_method] || item.sale.payment_method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {(Number(item.amount) || 0).toLocaleString('ru-RU')} ₽
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={6}>Итого</TableCell>
                              <TableCell className="text-right">
                                {shiftItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString('ru-RU')} ₽
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            {shiftItems.length > 0 && (
              <ServerPagination
                page={page}
                totalPages={totalPagesItems}
                totalCount={totalCountItems}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                label="операций"
              />
            )}
            </>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {shifts.length === 0
              ? 'Нет данных о сменах. Откройте и закройте первую смену для начала работы.'
              : 'Выберите смену для просмотра отчёта'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
