import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Search, Filter, Eye, Receipt, ChevronDown, ChevronRight, FileText, Shield, Wrench, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getClientDisplayName } from '@/lib/mappers';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ServerPagination } from '@/components/common/ServerPagination';
import { usePermissions } from '@/hooks/usePermissions';

interface SaleItem {
  id: string;
  item_type: string;
  insurance_product_id: string | null;
  policy_series: string | null;
  policy_number: string | null;
  insurance_company: string | null;
  start_date: string | null;
  end_date: string | null;
  premium_amount: number | null;
  commission_percent: number | null;
  service_name: string | null;
  quantity: number | null;
  amount: number;
}

interface SaleWithClient {
  id: string;
  uid: string;
  created_at: string;
  completed_at: string | null;
  total_amount: number;
  rounding_amount: number;
  payment_method: string;
  status: string;
  is_installment: boolean;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    company_name: string | null;
    is_company: boolean;
    phone: string;
  } | null;
  sale_items: SaleItem[];
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  debt: 'Рассрочка',
};

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  completed: 'Завершен',
  cancelled: 'Отменен',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function SalesHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { can } = usePermissions();
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [searchQuery, dateFrom, dateTo, statusFilter, paymentFilter]);

  const toggleExpand = (saleId: string) => {
    setExpandedSales(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const getSaleItemsSummary = (sale: SaleWithClient) => {
    const insuranceItems = sale.sale_items?.filter(i => i.item_type === 'insurance') || [];
    const serviceItems = sale.sale_items?.filter(i => i.item_type === 'service') || [];
    return { insuranceItems, serviceItems };
  };

  // Server-side paginated query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sales-history', page, pageSize, dateFrom, dateTo, statusFilter, paymentFilter, searchQuery],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('sales')
        .select(`
          id,
          uid,
          created_at,
          completed_at,
          total_amount,
          rounding_amount,
          payment_method,
          status,
          is_installment,
          client:clients (
            id,
            first_name,
            last_name,
            middle_name,
            company_name,
            is_company,
            phone
          ),
          sale_items (
            id,
            item_type,
            insurance_product_id,
            policy_series,
            policy_number,
            insurance_company,
            start_date,
            end_date,
            premium_amount,
            commission_percent,
            service_name,
            quantity,
            amount
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Server-side filters
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (paymentFilter !== 'all') query = query.eq('payment_method', paymentFilter);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
      if (searchQuery) query = query.ilike('uid', `%${searchQuery}%`);

      query = query.range(from, to);

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: rows as SaleWithClient[], totalCount: count ?? 0 };
    },
    placeholderData: keepPreviousData,
    enabled: !!user,
  });

  const sales = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const getClientName = (client: SaleWithClient['client']) => getClientDisplayName(client);

  const resetFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setPaymentFilter('all');
  };

  const hasFilters = searchQuery || dateFrom || dateTo || statusFilter !== 'all' || paymentFilter !== 'all';

  return (
    <div className="p-4 lg:p-6" ref={tableRef}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">История продаж</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Просмотр и фильтрация оформленных документов
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по номеру документа..."
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="pl-10" placeholder="От" />
              </div>
            </div>
            <div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="pl-10" placeholder="До" />
              </div>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="completed">Завершен</SelectItem>
                  <SelectItem value="draft">Черновик</SelectItem>
                  <SelectItem value="cancelled">Отменен</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger><SelectValue placeholder="Оплата" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все способы</SelectItem>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="card">Карта</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                  <SelectItem value="debt">Рассрочка</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Найдено: <span className="font-medium text-foreground">{totalCount}</span> записей
            </div>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(100vh-380px)] relative">
            {/* Loading overlay */}
            {isFetching && !isLoading && (
              <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>№ Документа</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Позиции</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Оплата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        Продажи не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => {
                      const { insuranceItems, serviceItems } = getSaleItemsSummary(sale);
                      const isExpanded = expandedSales.has(sale.id);
                      const hasItems = insuranceItems.length > 0 || serviceItems.length > 0;

                      return (
                        <>
                          <TableRow key={sale.id} className="group">
                            <TableCell>
                              {hasItems && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(sale.id)}>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{sale.uid}</TableCell>
                            <TableCell>
                              <div className="text-sm">{format(new Date(sale.created_at), 'dd.MM.yyyy', { locale: ru })}</div>
                              <div className="text-xs text-muted-foreground">{format(new Date(sale.created_at), 'HH:mm')}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{getClientName(sale.client)}</div>
                              {sale.client?.phone && (
                                <div className="text-xs text-muted-foreground">{sale.client.phone}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {insuranceItems.length > 0 && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Shield className="h-3 w-3" />
                                    {insuranceItems.length}
                                  </Badge>
                                )}
                                {serviceItems.length > 0 && (
                                  <Badge variant="outline" className="gap-1">
                                    <Wrench className="h-3 w-3" />
                                    {serviceItems.reduce((sum, s) => sum + (s.quantity || 1), 0)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {sale.total_amount.toLocaleString('ru-RU')} ₽
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{paymentMethodLabels[sale.payment_method] || sale.payment_method}</span>
                                {sale.is_installment && <Badge variant="outline" className="text-xs">рассрочка</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[sale.status]}>
                                {statusLabels[sale.status] || sale.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Просмотр"><Eye className="h-4 w-4" /></Button>
                                {can('docs_archive_print') && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Чек"><Receipt className="h-4 w-4" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {isExpanded && hasItems && (
                            <TableRow key={`${sale.id}-details`} className="bg-muted/30">
                              <TableCell colSpan={9} className="p-4">
                                <div className="space-y-4">
                                  {insuranceItems.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        Страховые продукты ({insuranceItems.length})
                                      </h4>
                                      <div className="grid gap-2">
                                        {insuranceItems.map((item) => (
                                          <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium">{item.policy_series} {item.policy_number}</span>
                                                {item.insurance_company && (
                                                  <span className="text-muted-foreground text-sm">• {item.insurance_company}</span>
                                                )}
                                              </div>
                                              {(item.start_date || item.end_date) && (
                                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                  <Calendar className="h-3 w-3" />
                                                  {item.start_date && format(new Date(item.start_date), 'dd.MM.yyyy', { locale: ru })}
                                                  {item.start_date && item.end_date && ' — '}
                                                  {item.end_date && format(new Date(item.end_date), 'dd.MM.yyyy', { locale: ru })}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              <div className="font-medium">{(item.premium_amount || item.amount).toLocaleString('ru-RU')} ₽</div>
                                              {item.commission_percent && <div className="text-xs text-green-600">комиссия {item.commission_percent}%</div>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {serviceItems.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Wrench className="h-4 w-4 text-accent" />
                                        Услуги ({serviceItems.length})
                                      </h4>
                                      <div className="grid gap-2">
                                        {serviceItems.map((item) => (
                                          <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                            <div className="flex-1">
                                              <span className="font-medium">{item.service_name}</span>
                                              {item.quantity && item.quantity > 1 && (
                                                <span className="text-muted-foreground ml-2">× {item.quantity}</span>
                                              )}
                                            </div>
                                            <div className="font-medium">{item.amount.toLocaleString('ru-RU')} ₽</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {sale.rounding_amount !== 0 && (
                                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-dashed">
                                      <span className="text-sm text-muted-foreground italic">Округление (без сдачи)</span>
                                      <span className="font-medium text-primary">
                                        {sale.rounding_amount > 0 ? '+' : ''}{sale.rounding_amount.toLocaleString('ru-RU')} ₽
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <div className="border-t p-3">
            <ServerPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              isLoading={isFetching}
              label="записей"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
