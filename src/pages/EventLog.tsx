import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Loader2, AlertTriangle, Info, X } from 'lucide-react';
import { EventLogFilters } from '@/components/event-log/EventLogFilters';
import { EventLogTable } from '@/components/event-log/EventLogTable';
import { EventLogPagination } from '@/components/event-log/EventLogPagination';
import { useAuditLogConfig } from '@/hooks/useAuditLogConfig';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_PAGE_SIZE = 50;

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// Map frontend action filter keys to DB action values
const ACTION_FILTER_MAP: Record<string, string[]> = {
  create: ['create'],
  update: ['update', 'settings_change'],
  delete: ['delete', 'cleanup'],
  view_contact_phone: ['view_contact_phone'],
  view_contact_email: ['view_contact_email'],
  open_card: ['open_card'],
  access_denied: ['access_denied'],
  view: ['view', 'view_contact', 'print', 'login', 'login_failed', 'logout'],
};

export default function EventLog() {
  const { userRole, isLoading: authLoading } = useAuth();
  const isAdmin = userRole === 'admin';
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);

  const [dateFrom, setDateFrom] = useState(getTodayStr);
  const [dateTo, setDateTo] = useState(getTodayStr);
  const [operatorFilter, setOperatorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { hasDisabledRules } = useAuditLogConfig();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: isAdmin,
  });

  // Resolve operator filter to user_id
  const operatorUserId = useMemo(() => {
    if (!operatorFilter || operatorFilter === '__all__') return null;
    const p = profiles.find(pr => pr.full_name === operatorFilter);
    return p?.user_id || null;
  }, [operatorFilter, profiles]);

  // Compute mapped actions for filter
  const mappedActions = useMemo(() => {
    if (!actionFilter || actionFilter === '__all__') return null;
    return ACTION_FILTER_MAP[actionFilter] || [actionFilter];
  }, [actionFilter]);

  const hasActiveFilters = useMemo(() => {
    const today = getTodayStr();
    return (
      (operatorFilter && operatorFilter !== '__all__') ||
      (categoryFilter && categoryFilter !== '__all__') ||
      (actionFilter && actionFilter !== '__all__') ||
      searchQuery ||
      dateFrom !== today ||
      dateTo !== today
    );
  }, [operatorFilter, categoryFilter, actionFilter, searchQuery, dateFrom, dateTo]);

  // Server-side paginated query
  const { data: queryResult, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['event-logs', dateFrom, dateTo, operatorUserId, categoryFilter, mappedActions, searchQuery, page, pageSize],
    queryFn: async () => {
      let q = supabase
        .from('access_logs')
        .select(`
          id, user_id, client_id, action, field_accessed, created_at,
          category, entity_type, entity_id, old_value, new_value, details,
          clients!access_logs_client_id_fkey ( first_name, last_name )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Date filters
      if (dateFrom) {
        q = q.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        q = q.lt('created_at', to.toISOString().split('T')[0] + 'T00:00:00');
      }

      // Operator filter
      if (operatorUserId) {
        q = q.eq('user_id', operatorUserId);
      }

      // Category filter
      if (categoryFilter && categoryFilter !== '__all__') {
        q = q.eq('category', categoryFilter);
      }

      // Action filter
      if (mappedActions && mappedActions.length > 0) {
        q = q.in('action', mappedActions);
      }

      // Text search (field_accessed or action)
      if (searchQuery) {
        q = q.or(`field_accessed.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%,old_value.ilike.%${searchQuery}%,new_value.ilike.%${searchQuery}%`);
      }

      // Pagination via range
      const from = page * pageSize;
      const to2 = from + pageSize - 1;
      q = q.range(from, to2);

      const { data, error, count } = await q;
      if (error) throw error;
      return { logs: data || [], totalCount: count ?? 0 };
    },
    enabled: isAdmin,
    placeholderData: (prev) => prev,
  });

  const logs = queryResult?.logs ?? [];
  const totalCount = queryResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, operatorUserId, categoryFilter, mappedActions, searchQuery, pageSize]);

  // Scroll to top on page change
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Realtime subscription
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('event-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['event-logs'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, queryClient]);

  const getOperatorName = useCallback((userId: string) => {
    if (userId === '00000000-0000-0000-0000-000000000000') return 'Аноним (неавторизован)';
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || userId.slice(0, 8);
  }, [profiles]);

  // Handle clicking on operator name in table
  const handleOperatorClick = useCallback((userId: string) => {
    const name = getOperatorName(userId);
    setOperatorFilter(name);
  }, [getOperatorName]);

  const handleResetFilters = useCallback(() => {
    const today = getTodayStr();
    setDateFrom(today);
    setDateTo(today);
    setOperatorFilter('');
    setCategoryFilter('');
    setActionFilter('');
    setSearchQuery('');
    setPage(0);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  // Suspicious activity (uses current page data as hint — not critical)
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const suspiciousCounts = new Map<string, number>();
  logs.forEach((log: any) => {
    if (new Date(log.created_at).getTime() > tenMinAgo) {
      suspiciousCounts.set(log.user_id, (suspiciousCounts.get(log.user_id) || 0) + 1);
    }
  });
  const alerts = Array.from(suspiciousCounts.entries()).filter(([_, c]) => c >= 15);

  if (authLoading) {
    return (
      <div className="p-6 flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="card-elevated p-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium">Доступ ограничен</h3>
          <p className="text-muted-foreground">Только для администраторов</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-foreground">Журнал событий</h1>
        <p className="text-sm text-muted-foreground mt-1">Все действия пользователей в системе</p>
      </div>

      {hasDisabledRules && (
        <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700">
            Внимание: логирование некоторых действий отключено в настройках
          </span>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium text-destructive">Подозрительная активность!</p>
            {alerts.map(([uid, count]) => (
              <span key={uid} className="block text-destructive/80">
                {getOperatorName(uid)} — {count} действий за 10 мин
              </span>
            ))}
          </div>
        </div>
      )}

      <EventLogFilters
        operatorFilter={operatorFilter}
        setOperatorFilter={setOperatorFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        profiles={profiles}
        onRefresh={() => refetch()}
      />

      {/* Reset filters button */}
      {hasActiveFilters && (
        <div className="mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleResetFilters}
          >
            <X className="h-3 w-3" />
            Сбросить фильтры
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Fetching overlay for page transitions */}
          {isFetching && !isLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          <EventLogTable
            logs={logs}
            getOperatorName={getOperatorName}
            onOperatorClick={handleOperatorClick}
            tableRef={tableRef}
          />

          <EventLogPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            isLoading={isFetching}
          />
        </div>
      )}
    </div>
  );
}
