import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, BellRing, Check, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUpcomingReminders, ClientInteractionWithClient } from '@/hooks/useClientInteractions';
import { cn } from '@/lib/utils';
import { getClientDisplayName } from '@/lib/mappers';
import { useNavigate } from 'react-router-dom';

export function UpcomingTasksWidget() {
  const navigate = useNavigate();
  const { reminders, isLoading, markAsCompleted } = useUpcomingReminders();
  const [completing, setCompleting] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    setCompleting(id);
    await markAsCompleted(id);
    setCompleting(null);
  };

  const getClientName = (r: ClientInteractionWithClient) => getClientDisplayName(r.client);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <BellRing className="h-4 w-4 text-warning" /> Задачи и звонки
        </div>
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Bell className="h-4 w-4 text-muted-foreground" /> Задачи и звонки
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">Нет активных напоминаний</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-warning" /> Задачи и звонки
        </div>
        <span className="text-[11px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">
          {reminders.length}
        </span>
      </div>
      <ScrollArea className="max-h-[220px]">
        <div className="divide-y divide-border/40">
          {reminders.slice(0, 8).map((r) => (
            <div key={r.id} className="px-3 py-2 hover:bg-muted/30 transition-colors flex items-center gap-2.5">
              {/* Checkbox */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 shrink-0 rounded-full border',
                  completing === r.id
                    ? 'border-muted-foreground'
                    : 'border-success/50 text-success hover:bg-success/10'
                )}
                onClick={() => handleComplete(r.id)}
                disabled={completing === r.id}
              >
                {completing === r.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Check className="h-3 w-3" />
                }
              </Button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => r.client && navigate(`/clients?id=${r.client.id}`)}
                >
                  {getClientName(r)}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.content}</p>
              </div>

              {/* Time */}
              <span className="text-[10px] text-warning shrink-0">
                {r.reminder_date && format(parseISO(r.reminder_date), 'd MMM, HH:mm', { locale: ru })}
              </span>
            </div>
          ))}
          {reminders.length > 8 && (
            <div className="px-3 py-1.5 text-center">
              <span className="text-[11px] text-muted-foreground">+{reminders.length - 8} ещё</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
