import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, FileText, Loader2, Download, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { getClientDisplayName } from '@/lib/mappers';
import { ServerPagination } from '@/components/common/ServerPagination';
import { Skeleton } from '@/components/ui/skeleton';

interface SaleItemWithDetails {
  id: string;
  item_type: string;
  service_name: string | null;
  insurance_company: string | null;
  amount: number;
  premium_amount: number | null;
  sale: {
    id: string;
    uid: string;
    created_at: string;
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

interface SummaryRow {
  category: string;
  insuranceCompany: string | null;
  productName: string | null;
  totalAmount: number;
  count: number;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  debt: 'Рассрочка',
};

export default function CashReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { can } = usePermissions();
  
  const [items, setItems] = useState<SaleItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullForm, setIsFullForm] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Period filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return format(date, 'yyyy-MM-dd');
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('sale_items')
          .select(`
            id,
            item_type,
            service_name,
            insurance_company,
            amount,
            premium_amount,
            insurance_product:insurance_product_id (
              id,
              name
            ),
            sale:sale_id (
              id,
              uid,
              created_at,
              completed_at,
              payment_method,
              client:client_id (
                id,
                first_name,
                last_name,
                middle_name,
                company_name,
                is_company
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Filter by completed sales only and flatten the data
        const filteredData = (data || []).filter((item: any) => 
          item.sale?.completed_at
        ) as SaleItemWithDetails[];
        
        setItems(filteredData);
      } catch (error) {
        console.error('Error loading report data:', error);
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить данные отчёта',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  // Filter by date range
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const saleDate = new Date(item.sale.completed_at || item.sale.created_at);
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (saleDate < fromDate) return false;
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (saleDate > toDate) return false;
      }
      
      return true;
    });
  }, [items, dateFrom, dateTo]);

  // Summary data grouped by category > insurance company > product
  const summaryData = useMemo(() => {
    const groups = new Map<string, SummaryRow>();
    
    filteredItems.forEach(item => {
      const category = item.item_type === 'insurance' ? 'Страховой продукт' : 'Услуга';
      const insuranceCompany = item.item_type === 'insurance' ? (item.insurance_company || '—') : null;
      const productName = item.item_type === 'insurance' 
        ? (item.insurance_product?.name || '—')
        : (item.service_name || '—');
      
      const key = `${category}|${insuranceCompany || ''}|${productName}`;
      
      const existing = groups.get(key);
      if (existing) {
        existing.totalAmount += Number(item.amount) || 0;
        existing.count += 1;
      } else {
        groups.set(key, {
          category,
          insuranceCompany,
          productName,
          totalAmount: Number(item.amount) || 0,
          count: 1,
        });
      }
    });
    
    // Sort by category, then company, then product
    return Array.from(groups.values()).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.insuranceCompany !== b.insuranceCompany) {
        return (a.insuranceCompany || '').localeCompare(b.insuranceCompany || '');
      }
      return (a.productName || '').localeCompare(b.productName || '');
    });
  }, [filteredItems]);

  const totalAmount = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredItems]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [dateFrom, dateTo, isFullForm]);

  const totalCountItems = filteredItems.length;
  const totalPagesItems = Math.ceil(totalCountItems / pageSize);
  const paginatedItems = useMemo(() => {
    const from = page * pageSize;
    return filteredItems.slice(from, from + pageSize);
  }, [filteredItems, page, pageSize]);

  const handlePageChange = (p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(0);
  };

  const getClientName = (client: SaleItemWithDetails['sale']['client']) => getClientDisplayName(client);

  const setQuickPeriod = (period: 'today' | 'week' | 'month' | 'quarter') => {
    const now = new Date();
    const to = format(now, 'yyyy-MM-dd');
    let from: Date;
    
    switch (period) {
      case 'today':
        from = now;
        break;
      case 'week':
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        from = new Date(now.getFullYear(), quarterMonth, 1);
        break;
    }
    
    setDateFrom(format(from, 'yyyy-MM-dd'));
    setDateTo(to);
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
            <h1 className="text-2xl font-bold text-foreground">Отчёты по кассе</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Аналитика операций за выбранный период
            </p>
          </div>
          {can('reports_cash_view') && (
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Экспорт
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Period selection */}
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground mb-2 block">Период</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <span className="text-muted-foreground">—</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              {/* Quick period buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuickPeriod('today')}>
                  Сегодня
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickPeriod('week')}>
                  Неделя
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickPeriod('month')}>
                  Месяц
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickPeriod('quarter')}>
                  Квартал
                </Button>
              </div>
              
              {/* Form toggle */}
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <Label htmlFor="form-toggle" className="text-sm cursor-pointer">
                  {isFullForm ? 'Полная форма' : 'Краткая форма'}
                </Label>
                <Switch
                  id="form-toggle"
                  checked={isFullForm}
                  onCheckedChange={setIsFullForm}
                />
              </div>
            </div>
            
            {/* Summary stats */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
              <div className="text-sm">
                <span className="text-muted-foreground">Операций: </span>
                <span className="font-medium text-foreground">{filteredItems.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Итого: </span>
                <span className="font-semibold text-foreground">{totalAmount.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brief form - Summary table */}
        {!isFullForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Сводный отчёт
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Категория</TableHead>
                      <TableHead>Страховая компания</TableHead>
                      <TableHead>Продукт / Услуга</TableHead>
                      <TableHead className="text-center">Кол-во</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          Нет данных за выбранный период
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {summaryData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                row.category === 'Страховой продукт' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              )}>
                                {row.category}
                              </span>
                            </TableCell>
                            <TableCell>
                              {row.insuranceCompany || '—'}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.productName}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {row.totalAmount.toLocaleString('ru-RU')} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={3}>Итого</TableCell>
                          <TableCell className="text-center">
                            {filteredItems.length}
                          </TableCell>
                          <TableCell className="text-right">
                            {totalAmount.toLocaleString('ru-RU')} ₽
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full form - Detailed list */}
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
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          Нет данных за выбранный период
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {paginatedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(item.sale.completed_at || item.sale.created_at), 'dd.MM.yyyy', { locale: ru })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(item.sale.completed_at || item.sale.created_at), 'HH:mm')}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.sale.uid}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{getClientName(item.sale.client)}</div>
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                item.item_type === 'insurance'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              )}>
                                {item.item_type === 'insurance' ? 'Страховка' : 'Услуга'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {item.item_type === 'insurance' 
                                  ? item.insurance_product?.name || '—'
                                  : item.service_name || '—'
                                }
                              </div>
                              {item.item_type === 'insurance' && item.insurance_company && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ChevronRight className="h-3 w-3" />
                                  {item.insurance_company}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {paymentMethodLabels[item.sale.payment_method] || item.sale.payment_method}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(Number(item.amount) || 0).toLocaleString('ru-RU')} ₽
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total row */}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={6}>Итого</TableCell>
                          <TableCell className="text-right">
                            {totalAmount.toLocaleString('ru-RU')} ₽
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {filteredItems.length > 0 && (
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
    </div>
  );
}
