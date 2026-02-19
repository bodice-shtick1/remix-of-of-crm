import { useShiftNotificationStats } from '@/hooks/useNotificationStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Send, CheckCheck, Eye, AlertCircle, FlaskConical } from 'lucide-react';
import type { NotificationStats } from '@/hooks/useNotificationStats';

interface NotificationStatsSectionProps {
  shiftOpenedAt: string;
  /** If stats are pre-fetched (e.g. for export), pass them directly */
  preloadedStats?: NotificationStats | null;
  compact?: boolean;
}

export function NotificationStatsSection({
  shiftOpenedAt,
  preloadedStats,
  compact = false,
}: NotificationStatsSectionProps) {
  const { data: fetchedStats, isLoading } = useShiftNotificationStats(
    preloadedStats ? undefined : shiftOpenedAt
  );

  const stats = preloadedStats || fetchedStats;

  if (isLoading && !preloadedStats) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!stats || stats.total_prepared === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        За смену уведомления не отправлялись.
      </div>
    );
  }

  const items = [
    {
      icon: Bot,
      label: 'Подготовлено автопилотом',
      value: stats.total_prepared - stats.test_prepared,
      color: 'text-foreground',
    },
    {
      icon: Send,
      label: 'Успешно отправлено',
      value: stats.sent + stats.delivered + stats.read,
      color: 'text-green-600',
    },
    {
      icon: CheckCheck,
      label: 'Доставлено',
      value: stats.delivered + stats.read,
      color: 'text-blue-600',
    },
    {
      icon: Eye,
      label: 'Прочитано',
      value: stats.read,
      color: 'text-primary',
    },
    {
      icon: AlertCircle,
      label: 'Ошибки отправки',
      value: stats.error,
      color: stats.error > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
  ];

  if (stats.test_prepared > 0) {
    items.push({
      icon: FlaskConical,
      label: 'Тестовый режим',
      value: stats.test_prepared,
      color: 'text-amber-600',
    });
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {items.filter(i => i.value > 0 || i.label === 'Подготовлено автопилотом').map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <Icon className={`h-3.5 w-3.5 ${item.color}`} />
              <span className="text-muted-foreground">{item.label}:</span>
              <span className={`font-semibold ${item.color}`}>{item.value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <tr key={item.label} className="border-b last:border-b-0">
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-foreground">{item.label}</span>
                </td>
                <td className={`px-4 py-2.5 text-right font-semibold ${item.color}`}>
                  {item.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
