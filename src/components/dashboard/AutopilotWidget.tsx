import { useTodayNotificationStats } from '@/hooks/useNotificationStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Send, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutopilotWidget() {
  const { data: stats, isLoading } = useTodayNotificationStats();

  if (isLoading) {
    return (
      <div className="card-elevated p-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!stats || stats.total_prepared === 0) {
    return null; // Don't render if no activity today
  }

  const realSent = stats.sent + stats.delivered + stats.read;

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Автопилот сегодня</h3>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5 text-green-600" />
          <span className="text-muted-foreground">Отправлено:</span>
          <span className="font-semibold text-foreground">{realSent}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-muted-foreground">Прочитано:</span>
          <span className="font-semibold text-foreground">{stats.read}</span>
        </div>
        {stats.error > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-muted-foreground">Ошибки:</span>
            <span className="font-semibold text-destructive">{stats.error}</span>
          </div>
        )}
        {stats.test_prepared > 0 && (
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs',
            'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
          )}>
            🧪 Тест: {stats.test_prepared}
          </div>
        )}
      </div>
    </div>
  );
}
