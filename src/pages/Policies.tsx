import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Car, Building2, Calendar, Download, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Tables } from '@/integrations/supabase/types';
import { useEntityTab } from '@/hooks/useEntityTab';
import { ProlongationStatusBadge } from '@/components/common/ProlongationStatusBadge';
import { ProlongationStatus } from '@/hooks/useProlongationStatus';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';
import { ServerPagination } from '@/components/common/ServerPagination';

const insuranceTypes = ['ОСАГО', 'КАСКО', 'Имущество', 'Жизнь', 'ДМС', 'НС', 'ДОМ', 'Другое'];

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: 'Активен', class: 'status-success' },
  expiring_soon: { label: 'Истекает', class: 'status-warning' },
  expired: { label: 'Истек', class: 'status-danger' },
  renewed: { label: 'Продлен', class: 'status-info' },
};

const paymentLabels: Record<string, { label: string; class: string }> = {
  pending: { label: 'Ожидает оплаты', class: 'status-warning' },
  paid: { label: 'Оплачено', class: 'status-success' },
  transferred: { label: 'Перечислено в СК', class: 'status-info' },
  commission_received: { label: 'Комиссия получена', class: 'status-success' },
};

export default function Policies() {
  const { openPolicyTab, openClientTab } = useEntityTab();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const tableRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [search, typeFilter]);

  // Fetch clients (needed for display)
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-raw'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      return data;
    },
  });

  // Server-side paginated policies
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['policies-paginated', page, pageSize, typeFilter, search],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('policies')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') query = query.eq('policy_type', typeFilter);
      
      if (search) {
        query = query.or(`policy_number.ilike.%${search}%,insurance_company.ilike.%${search}%,vehicle_number.ilike.%${search}%`);
      }

      query = query.range(from, to);

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: rows ?? [], totalCount: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const policies = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  return (
    <div className="p-4 lg:p-6" ref={tableRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Полисы</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление страховыми полисами</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Экспорт</Button>
          <Button className="btn-gradient gap-2"><Plus className="h-4 w-4" />Новый полис</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <SearchInput 
          value={search} onChange={setSearch} 
          placeholder="Поиск по номеру полиса, СК, гос.номеру..."
          className="flex-1 max-w-md"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            Все
          </button>
          {insuranceTypes.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Policies Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto relative">
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Тип / Номер</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Клиент</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">СК</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Срок действия</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Премия</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Статус</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Пролонг.</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Оплата</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy, index) => {
                  const client = getClient(policy.client_id);
                  const clientName = getClientDisplayName(client);
                  const status = statusLabels[policy.status] || { label: policy.status, class: '' };
                  const paymentStatus = paymentLabels[policy.payment_status] || { label: policy.payment_status, class: '' };

                  return (
                    <tr 
                      key={policy.id} 
                      className="table-row-hover border-b border-border/50 cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-foreground">{policy.policy_type}</span>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{policy.policy_number}</p>
                          {policy.vehicle_number && (
                            <div className="flex items-center gap-1 mt-1">
                              <Car className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground font-mono">{policy.vehicle_number}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div 
                          className="flex items-center gap-2 group/client cursor-pointer hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (client) {
                              openClientTab({
                                id: client.id,
                                firstName: client.first_name,
                                lastName: client.last_name,
                                middleName: client.middle_name || undefined,
                                companyName: client.company_name || undefined,
                                isCompany: client.is_company,
                              });
                            }
                          }}
                          title="Открыть клиента в новой вкладке"
                        >
                          {client?.is_company ? (
                            <Building2 className="h-4 w-4 text-accent shrink-0" />
                          ) : (
                            <div className="avatar-initials h-7 w-7 text-xs shrink-0">
                              {getClientInitials(client)}
                            </div>
                          )}
                          <span className="text-sm text-foreground group-hover/client:text-primary">{clientName}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/client:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="text-sm text-foreground">{policy.insurance_company}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(policy.start_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {' - '}
                            {new Date(policy.end_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-foreground">{Number(policy.premium_amount).toLocaleString('ru-RU')} ₽</span>
                          <p className="text-xs text-success mt-0.5">+{Number(policy.commission_amount).toLocaleString('ru-RU')} ₽ ({policy.commission_percent}%)</p>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className={cn('status-badge', status.class)}>{status.label}</span></td>
                      <td className="px-3 py-2">
                        <ProlongationStatusBadge status={(policy.prolongation_status || 'pending') as ProlongationStatus} showPending={true} />
                      </td>
                      <td className="px-3 py-2"><span className={cn('status-badge', paymentStatus.class)}>{paymentStatus.label}</span></td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPolicyTab({ id: policy.id, policyNumber: policy.policy_number, policyType: policy.policy_type, insuranceCompany: policy.insurance_company });
                          }}
                          title="Открыть полис в новой вкладке"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {policies.length === 0 && !isLoading && (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              {totalCount === 0 && !search && typeFilter === 'all' ? 'Нет полисов' : 'Полисы не найдены'}
            </h3>
            <p className="text-muted-foreground">
              {totalCount === 0 && !search && typeFilter === 'all'
                ? 'Добавьте первый полис для начала работы'
                : 'Попробуйте изменить параметры поиска'
              }
            </p>
          </div>
        )}

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
            label="полисов"
          />
        </div>
      </div>
    </div>
  );
}
