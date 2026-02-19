import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationLog } from '@/hooks/useNotifications';
import { NotificationStatusBadge } from '@/components/notifications/NotificationStatusBadge';
import { ChannelIcon } from '@/components/icons/MessengerIcons';

interface QueueTabProps {
  logs: NotificationLog[];
  isLoading: boolean;
  onSelect: (log: NotificationLog) => void;
  onCheckRead?: () => void;
  isCheckingRead?: boolean;
}

export function QueueTab({ logs, isLoading, onSelect, onCheckRead, isCheckingRead }: QueueTabProps) {
  const pendingLogs = logs.filter(l => l.status === 'pending' || l.status === 'sending');

  return (
    <div className="card-elevated">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Очередь на отправку</h2>
        </div>
        {onCheckRead && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckRead}
            disabled={isCheckingRead}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isCheckingRead && "animate-spin")} />
            Проверить статусы
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : pendingLogs.length === 0 ? (
        <div className="p-8 text-center">
          <Loader2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Очередь пуста — все сообщения обработаны
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {pendingLogs.map((log) => {
            const clientName = log.client
              ? `${log.client.last_name} ${log.client.first_name?.charAt(0)}.`
              : 'Клиент';
            return (
              <div
                key={log.id}
                className="p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => onSelect(log)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(log)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{clientName}</span>
                      <NotificationStatusBadge status={log.status} readAt={log.read_at} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {log.template_title || log.message}
                    </p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0',
                    log.channel === 'whatsapp'
                      ? 'bg-green-100 text-green-700'
                      : log.channel === 'telegram'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    <ChannelIcon channel={log.channel} size={10} />
                    {log.channel === 'whatsapp' ? 'WA' : log.channel === 'telegram' ? 'TG' : log.channel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
