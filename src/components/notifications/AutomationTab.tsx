import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCcw, Gift, AlertCircle, Zap, Plus, Trash2, Pencil, FlaskConical, Play, Loader2,
  Clock, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { useTestMode } from '@/hooks/useTestMode';
import { useTriggerProcessor } from '@/hooks/useTriggerProcessor';
import { useTriggerStats } from '@/hooks/useTriggerStats';
import { TriggerFormDialog } from '@/components/notifications/TriggerFormDialog';
import { AutopilotSchedulePanel } from '@/components/notifications/AutopilotSchedulePanel';
import type { NotificationTemplate } from '@/hooks/useNotifications';
import type { NotificationTrigger } from '@/hooks/useNotificationTriggers';

interface AutomationTabProps {
  templates: NotificationTemplate[];
}

const EVENT_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  daysLabel: string;
}> = {
  policy_expiry: {
    icon: RefreshCcw,
    label: 'Истечение полиса',
    daysLabel: 'дн. до окончания',
  },
  birthday: {
    icon: Gift,
    label: 'День рождения',
    daysLabel: 'в день события',
  },
  debt_reminder: {
    icon: AlertCircle,
    label: 'Просрочка долга',
    daysLabel: 'дн. до возврата',
  },
};

export function AutomationTab({ templates }: AutomationTabProps) {
  const {
    triggers,
    isLoading,
    saveTrigger,
    isSaving,
    toggleTrigger,
    deleteTrigger,
    isDeleting,
  } = useNotificationTriggers();

  const { testMode, toggleTestMode, isToggling } = useTestMode();
  const { runTriggers, isRunning } = useTriggerProcessor();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);

  const templateMap = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach(t => map.set(t.id, t.title));
    return map;
  }, [templates]);

  const triggerTemplateIds = useMemo(
    () => triggers.map(t => t.template_id).filter(Boolean) as string[],
    [triggers]
  );
  const { data: statsMap } = useTriggerStats(triggerTemplateIds);

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин. назад`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} ч. назад`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return d.toLocaleDateString('ru-RU');
  };

  const openCreate = () => {
    setEditingTrigger(null);
    setFormOpen(true);
  };

  const openEdit = (trigger: NotificationTrigger) => {
    setEditingTrigger(trigger);
    setFormOpen(true);
  };

  const handleRunNow = () => runTriggers(testMode);

  const handleSave = (params: {
    id?: string;
    event_type: string;
    template_id: string;
    days_before: number;
    is_active: boolean;
  }) => {
    saveTrigger(params);
    setFormOpen(false);
    setEditingTrigger(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with test mode toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Триггерные рассылки</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Test mode toggle */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
            testMode
              ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700'
              : 'border-border bg-card'
          )}>
            <FlaskConical className={cn(
              'h-4 w-4',
              testMode ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )} />
            <span className="text-xs font-medium whitespace-nowrap">
              Тестовый режим
            </span>
            <Switch
              checked={testMode}
              onCheckedChange={toggleTestMode}
              disabled={isToggling}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleRunNow}
            disabled={isRunning || triggers.length === 0}
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isRunning ? 'Проверка...' : 'Запустить проверку'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Добавить авто-рассылку
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Настройте автоматическую отправку уведомлений при наступлении событий.
        {testMode && (
          <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
            Тестовый режим — сообщения не отправляются реально
          </Badge>
        )}
      </p>

      {/* Autopilot schedule settings */}
      <AutopilotSchedulePanel />

      {triggers.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Нет настроенных авто-рассылок.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Нажмите «Добавить авто-рассылку», чтобы создать первую.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => {
            const meta = EVENT_META[trigger.event_type] || {
              icon: Zap,
              label: trigger.event_type,
              daysLabel: 'дн.',
            };
            const Icon = meta.icon;
            const templateTitle = trigger.template_id
              ? templateMap.get(trigger.template_id) || 'Шаблон удалён'
              : 'Шаблон не выбран';

            return (
              <div
                key={trigger.id}
                className={cn(
                  'border rounded-lg p-4 transition-colors',
                  trigger.is_active
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-card'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'p-2.5 rounded-lg shrink-0',
                    trigger.is_active ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      trigger.is_active ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>

                    <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">
                          Шаблон «{templateTitle}» → за{' '}
                          {trigger.event_type === 'birthday'
                            ? '0 дн. (в день события)'
                            : `${trigger.days_before} ${meta.daysLabel}`}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {meta.label}
                        </p>
                        {/* Stats row */}
                        {trigger.template_id && statsMap && (() => {
                          const stat = statsMap.get(trigger.template_id!);
                          return (
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Hash className="h-3 w-3" />
                                {stat ? stat.totalSent : 0} отправлено
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {stat?.lastSentAt
                                  ? formatRelativeTime(stat.lastSentAt)
                                  : 'ещё не запускался'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={trigger.is_active}
                          onCheckedChange={(checked) =>
                            toggleTrigger({ id: trigger.id, is_active: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(trigger)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 w-7 p-0"
                          disabled={isDeleting}
                          onClick={() => deleteTrigger(trigger.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TriggerFormDialog
        trigger={editingTrigger}
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingTrigger(null);
        }}
        templates={templates}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </div>
  );
}
