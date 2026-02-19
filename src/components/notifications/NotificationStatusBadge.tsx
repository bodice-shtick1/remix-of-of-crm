import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationStatusBadgeProps {
  status: string;
  readAt?: string | null;
  className?: string;
}

export function NotificationStatusBadge({ status, readAt, className }: NotificationStatusBadgeProps) {
  if (status === 'failed') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-destructive', className)}>
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Ошибка</span>
      </span>
    );
  }

  if (readAt || status === 'read') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-blue-600', className)}>
        <CheckCheck className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Прочитано</span>
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
        <Check className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Доставлено</span>
      </span>
    );
  }

  if (status === 'sent') {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
        <Clock className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">Отправлено</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-yellow-600', className)}>
      <Clock className="h-3.5 w-3.5" />
      <span className="text-[10px] font-medium">{status}</span>
    </span>
  );
}
