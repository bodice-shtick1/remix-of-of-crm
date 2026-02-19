import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Loader2, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const ACTION_LABELS: Record<string, string> = {
  user_blocked: '🔒 Блокировка',
  user_unblocked: '🔓 Разблокировка',
  password_reset: '🔑 Сброс пароля',
  role_change: '👤 Смена роли',
  login: 'Вход',
  logout: 'Выход',
  emergency_lock: '🚨 Экстр. блокировка',
  create_user: '➕ Создание пользователя',
};

export default function AccessLogs() {
  const { userRole, isLoading: authLoading } = useAuth();
  const isAdmin = userRole === 'admin';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-audit'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['security-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const getName = (userId: string | null) => {
    if (!userId) return '—';
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || userId.slice(0, 8);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (dateFrom && new Date(log.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(log.created_at) >= to) return false;
      }
      if (actionFilter) {
        const label = (ACTION_LABELS[log.action] || log.action).toLowerCase();
        const email = (log.target_email || '').toLowerCase();
        const q = actionFilter.toLowerCase();
        if (!label.includes(q) && !email.includes(q) && !getName(log.user_id).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, dateFrom, dateTo, actionFilter, profiles]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Журнал безопасности</h1>
        <p className="text-sm text-muted-foreground mt-1">Аудит действий: блокировки, сброс паролей, смена ролей</p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Фильтры:
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Поиск</Label>
              <Input
                className="h-8 w-56"
                placeholder="Действие, email, оператор..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дата от</Label>
              <Input
                type="date"
                className="h-8 w-40"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дата до</Label>
              <Input
                type="date"
                className="h-8 w-40"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-300px)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[160px]">Время</TableHead>
                    <TableHead className="w-[140px]">Кто</TableHead>
                    <TableHead className="w-[140px]">Действие</TableHead>
                    <TableHead className="w-[180px]">Цель</TableHead>
                    <TableHead className="w-[120px]">IP</TableHead>
                    <TableHead>Детали</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, idx) => (
                    <TableRow key={log.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {new Date(log.created_at).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-sm font-medium truncate max-w-[140px]">
                        {getName(log.user_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          {log.target_email && (
                            <span className="text-foreground truncate max-w-[180px] block">{log.target_email}</span>
                          )}
                          {log.target_user_id && !log.target_email && (
                            <span className="text-muted-foreground text-xs">{getName(log.target_user_id)}</span>
                          )}
                          {!log.target_email && !log.target_user_id && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.ip_address || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {log.details ? (
                          <pre className="whitespace-pre-wrap text-[10px]">
                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Нет записей
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}