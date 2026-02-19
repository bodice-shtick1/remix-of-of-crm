import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertTriangle, Shield, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface ActivityLogEntry {
  id: string;
  event_type: string;
  status: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  auth: 'Авторизация',
  message_out: 'Отправка сообщения',
  message_in: 'Входящее сообщение',
  session_error: 'Ошибка сессии',
  logout: 'Выход',
  suspicious_login: 'Подозрительный вход',
  terminate_all: 'Завершение сеансов',
};

interface BridgeActivityLogProps {
  channel?: string;
}

export function BridgeActivityLog({ channel = 'max_web' }: BridgeActivityLogProps) {
  const { user } = useAuth();
  const [isTerminating, setIsTerminating] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['bridge-activity-logs', channel],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('messenger_activity_logs' as any)
        .select('id, event_type, status, description, ip_address, created_at')
        .eq('channel', channel)
        .order('created_at', { ascending: false })
        .limit(5) as any);
      if (error) throw error;
      return (data ?? []) as ActivityLogEntry[];
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  const hasSuspicious = logs?.some(l => l.event_type === 'suspicious_login' && l.status === 'success');

  const handleTerminateAll = async () => {
    setIsTerminating(true);
    try {
      const { data, error } = await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'terminate_all' },
      });
      if (error && !data) throw error;
      if (data?.success) {
        toast.success('Все сеансы завершены, кроме текущего моста');
      } else {
        toast.error(data?.error || 'Ошибка');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка завершения сеансов');
    } finally {
      setIsTerminating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        <div className="h-20 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Журнал действий
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTerminateAll}
          disabled={isTerminating}
          className="gap-1.5 text-xs"
        >
          {isTerminating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
          Завершить все сеансы
        </Button>
      </div>

      {hasSuspicious && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Внимание! Зафиксирован вход в аккаунт извне. Проверьте настройки безопасности.
          </AlertDescription>
        </Alert>
      )}

      {(!logs || logs.length === 0) ? (
        <p className="text-xs text-muted-foreground py-2">Нет записей</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Событие</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Дата/время</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground hidden sm:table-cell">IP</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Статус</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-2.5 py-1.5 font-medium">
                    {EVENT_LABELS[log.event_type] || log.event_type}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: ru })}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground hidden sm:table-cell font-mono">
                    {log.ip_address || '—'}
                  </td>
                  <td className="px-2.5 py-1.5">
                    {log.status === 'success' ? (
                      <span className="text-green-600">Успешно</span>
                    ) : (
                      <span className="text-destructive" title={log.description || ''}>
                        Ошибка
                      </span>
                    )}
                    {log.description && log.status === 'error' && (
                      <span className="block text-muted-foreground truncate max-w-[120px]">{log.description}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
