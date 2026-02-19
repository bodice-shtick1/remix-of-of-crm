import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClientDisplayName } from '@/lib/mappers';
import type { NotificationLog } from '@/hooks/useNotifications';
import { NotificationStatusBadge } from '@/components/notifications/NotificationStatusBadge';
import { ChannelIcon } from '@/components/icons/MessengerIcons';

interface HistoryTabProps {
  logs: NotificationLog[];
  isLoading: boolean;
  onSelect: (log: NotificationLog) => void;
  onCheckRead?: () => void;
  isCheckingRead?: boolean;
}

export function HistoryTab({ logs, isLoading, onSelect, onCheckRead, isCheckingRead }: HistoryTabProps) {
  return (
    <div className="card-elevated">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">История отправок</h2>
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
            Проверить прочтения
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center">
          <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Нет отправленных уведомлений</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {logs.map((log) => {
            const clientName = log.client
              ? getClientDisplayName(log.client)
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{clientName}</span>
                      <NotificationStatusBadge status={log.status} readAt={log.read_at} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {log.template_title || log.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.sent_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        log.channel === 'whatsapp'
                          ? 'bg-green-100 text-green-700'
                          : log.channel === 'telegram'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        <ChannelIcon channel={log.channel} size={10} />
                        {log.channel === 'whatsapp' ? 'WhatsApp' : log.channel === 'telegram' ? 'Telegram' : log.channel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
