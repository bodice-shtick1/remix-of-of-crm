import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, Phone, ExternalLink, MessageCircle, Send,
  RefreshCcw, Clock, Check, CheckCheck, AlertCircle, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MaskedPhone } from '@/components/common/MaskedPhone';

export interface NotificationLogDetail {
  id: string;
  status: string;
  read_at?: string | null;
  sent_at: string;
  channel: string;
  message: string;
  template_title: string | null;
  error_message: string | null;
  broadcast_id: string | null;
  source?: string | null;
  client_id: string;
  client?: {
    first_name: string;
    last_name: string;
    middle_name: string | null;
    phone?: string;
  } | null;
}

interface NotificationDetailSheetProps {
  log: NotificationLogDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (log: NotificationLogDetail) => void;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}> = {
  sent: { label: 'Отправлено', variant: 'secondary', icon: Clock },
  pending: { label: 'Ожидание', variant: 'outline', icon: Clock, className: 'border-amber-300 text-amber-700 dark:text-amber-400' },
  delivered: { label: 'Доставлено', variant: 'secondary', icon: Check },
  read: { label: 'Прочитано', variant: 'default', icon: CheckCheck, className: 'bg-blue-600 text-white' },
  failed: { label: 'Ошибка', variant: 'destructive', icon: XCircle },
  error: { label: 'Ошибка', variant: 'destructive', icon: XCircle },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  max: 'Макс',
  sms: 'СМС',
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function NotificationDetailSheet({
  log,
  open,
  onOpenChange,
  onRetry,
}: NotificationDetailSheetProps) {
  const navigate = useNavigate();

  const statusInfo = useMemo(() => {
    if (!log) return null;
    // Check if read
    if (log.read_at) {
      return STATUS_CONFIG['read'];
    }
    return STATUS_CONFIG[log.status] ?? STATUS_CONFIG['sent'];
  }, [log]);

  if (!log) return null;

  const clientName = log.client
    ? `${log.client.last_name} ${log.client.first_name}${log.client.middle_name ? ' ' + log.client.middle_name : ''}`
    : 'Неизвестный клиент';

  const clientPhone = log.client?.phone || '';
  const isFailed = log.status === 'failed' || log.status === 'error';
  const channelLabel = CHANNEL_LABELS[log.channel] || log.channel;

  const handleOpenChat = () => {
    if (!clientPhone) return;
    const phone = clientPhone.replace(/\D/g, '');
    if (log.channel === 'whatsapp') {
      window.open(`https://wa.me/${phone}`, '_blank');
    } else if (log.channel === 'telegram') {
      window.open(`https://t.me/+${phone}`, '_blank');
    }
  };

  const handleGoToClient = () => {
    if (log.client_id) {
      navigate(`/clients?id=${log.client_id}`);
      onOpenChange(false);
    }
  };

  // Timeline events
  const timelineEvents: Array<{
    label: string;
    time: string | null;
    icon: React.ComponentType<{ className?: string }>;
    done: boolean;
  }> = [
    {
      label: 'Отправлено',
      time: log.sent_at,
      icon: Send,
      done: true,
    },
    {
      label: 'Доставлено',
      time: log.status === 'delivered' || log.read_at ? log.sent_at : null, // approximate if no delivery timestamp
      icon: Check,
      done: log.status === 'delivered' || !!log.read_at,
    },
    {
      label: 'Прочитано',
      time: log.read_at || null,
      icon: CheckCheck,
      done: !!log.read_at,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            {statusInfo && (
              <Badge
                variant={statusInfo.variant}
                className={cn('text-sm px-3 py-1', statusInfo.className)}
              >
                <statusInfo.icon className="h-4 w-4 mr-1.5" />
                {statusInfo.label}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg mt-2">
            {log.template_title || 'Уведомление'}
          </SheetTitle>
          <SheetDescription>
            {log.broadcast_id ? 'Массовая рассылка' : log.source === 'autopilot' ? 'Автопилот' : 'Ручная отправка'}
            {' · '}
            {channelLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-6">
          {/* Recipient */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Получатель
            </h4>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {clientName}
                  </p>
                  {clientPhone && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      <MaskedPhone
                        phone={clientPhone}
                        clientId={log.client_id}
                        clientName={clientName}
                        context="Уведомления"
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={handleGoToClient}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть карточку клиента
              </Button>
            </div>
          </section>

          {/* Message content */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Текст сообщения
            </h4>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {log.message}
              </p>
            </div>
          </section>

          {/* Technical info */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Техническая информация
            </h4>
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Канал</span>
                <span className={cn(
                  'inline-flex items-center gap-1.5 font-medium',
                  log.channel === 'whatsapp' ? 'text-green-600' :
                  log.channel === 'telegram' ? 'text-blue-600' :
                  'text-foreground'
                )}>
                  {log.channel === 'whatsapp' && <MessageCircle className="h-3.5 w-3.5" />}
                  {log.channel === 'telegram' && <Send className="h-3.5 w-3.5" />}
                  {channelLabel}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ID транзакции</span>
                <span className="font-mono text-xs text-foreground">
                  {log.id.slice(0, 8)}...
                </span>
              </div>
              {log.broadcast_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID рассылки</span>
                  <span className="font-mono text-xs text-foreground">
                    {log.broadcast_id.slice(0, 8)}...
                  </span>
                </div>
              )}
              {log.source && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Источник</span>
                  <span className="text-foreground">
                    {log.source === 'broadcast' ? 'Массовая рассылка' :
                     log.source === 'autopilot' ? 'Автопилот' :
                     log.source === 'manual' ? 'Вручную' : log.source}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Timeline */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Трекинг
            </h4>
            <div className="rounded-lg border border-border p-4">
              {isFailed ? (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-destructive">Ошибка отправки</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.error_message || 'Причина неизвестна'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {timelineEvents.map((event, idx) => (
                    <div key={event.label} className="flex items-start gap-3 relative">
                      {/* Vertical line */}
                      {idx < timelineEvents.length - 1 && (
                        <div className={cn(
                          'absolute left-4 top-8 w-px h-6',
                          event.done && timelineEvents[idx + 1]?.done
                            ? 'bg-primary/40'
                            : 'bg-border'
                        )} />
                      )}
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10',
                        event.done
                          ? 'bg-primary/10'
                          : 'bg-muted'
                      )}>
                        <event.icon className={cn(
                          'h-4 w-4',
                          event.done ? 'text-primary' : 'text-muted-foreground/40'
                        )} />
                      </div>
                      <div className="pb-6">
                        <p className={cn(
                          'text-sm font-medium',
                          event.done ? 'text-foreground' : 'text-muted-foreground/50'
                        )}>
                          {event.label}
                        </p>
                        {event.done && event.time && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(event.time)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Actions */}
          <section className="flex flex-col gap-2 pt-2 pb-4">
            {(log.channel === 'whatsapp' || log.channel === 'telegram') && clientPhone && (
              <Button
                variant="outline"
                className="gap-2 w-full"
                onClick={handleOpenChat}
              >
                <MessageCircle className="h-4 w-4" />
                Перейти в чат
              </Button>
            )}
            {isFailed && onRetry && (
              <Button
                variant="default"
                className="gap-2 w-full"
                onClick={() => onRetry(log)}
              >
                <RefreshCcw className="h-4 w-4" />
                Повторить отправку
              </Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
