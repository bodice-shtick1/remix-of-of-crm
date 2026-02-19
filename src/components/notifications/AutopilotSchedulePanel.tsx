import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Save, CalendarClock, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutopilotSettings } from '@/hooks/useAutopilotSettings';

const WEEKDAYS: { id: number; short: string; full: string }[] = [
  { id: 1, short: 'Пн', full: 'Понедельник' },
  { id: 2, short: 'Вт', full: 'Вторник' },
  { id: 3, short: 'Ср', full: 'Среда' },
  { id: 4, short: 'Чт', full: 'Четверг' },
  { id: 5, short: 'Пт', full: 'Пятница' },
  { id: 6, short: 'Сб', full: 'Суббота' },
  { id: 7, short: 'Вс', full: 'Воскресенье' },
];

/** Get ISO weekday (1=Mon..7=Sun) from JS Date */
function getISOWeekday(date: Date): number {
  const jsDay = date.getDay(); // 0=Sun
  return jsDay === 0 ? 7 : jsDay;
}

/** Find next allowed date from a start date given allowed weekday set */
function findNextAllowedDate(
  from: Date,
  allowedDays: number[],
  time: string,
  skipToday: boolean
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const candidate = new Date(from);
  candidate.setHours(hours, minutes, 0, 0);

  if (skipToday || candidate <= from) {
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(hours, minutes, 0, 0);
  }

  // Search up to 7 days forward
  for (let i = 0; i < 7; i++) {
    const wd = getISOWeekday(candidate);
    if (allowedDays.includes(wd)) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }

  // fallback — shouldn't happen if at least one day is selected
  return candidate;
}

export function AutopilotSchedulePanel() {
  const {
    autoProcessTime,
    autoProcessDays,
    lastAutoRunDate,
    isLoading,
    saveSettings,
    isSaving,
  } = useAutopilotSettings();

  const [localTime, setLocalTime] = useState(autoProcessTime);
  const [localDays, setLocalDays] = useState<number[]>(autoProcessDays);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalTime(autoProcessTime);
    setLocalDays(autoProcessDays);
    setIsDirty(false);
  }, [autoProcessTime, autoProcessDays]);

  const checkDirty = (time: string, days: number[]) => {
    const timeChanged = time !== autoProcessTime;
    const daysChanged =
      days.length !== autoProcessDays.length ||
      days.some((d) => !autoProcessDays.includes(d));
    setIsDirty(timeChanged || daysChanged);
  };

  const handleTimeChange = (value: string) => {
    setLocalTime(value);
    checkDirty(value, localDays);
  };

  const toggleDay = (dayId: number) => {
    const newDays = localDays.includes(dayId)
      ? localDays.filter((d) => d !== dayId)
      : [...localDays, dayId].sort();
    // Don't allow empty selection
    if (newDays.length === 0) return;
    setLocalDays(newDays);
    checkDirty(localTime, newDays);
  };

  const handleSave = () => {
    saveSettings({ time: localTime, days: localDays });
    setIsDirty(false);
  };

  const { statusText, statusVariant, activeDaysText } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayWeekday = getISOWeekday(now);
    const alreadyRanToday = lastAutoRunDate === todayStr;
    const isTodayAllowed = localDays.includes(todayWeekday);

    // Build active days label
    const sortedDays = [...localDays].sort();
    const dayLabels = sortedDays.map(
      (d) => WEEKDAYS.find((w) => w.id === d)?.short || ''
    );
    const activeDaysText = dayLabels.join(', ');

    let statusText: string;
    let statusVariant: 'success' | 'muted' | 'warning';

    if (!isTodayAllowed) {
      const nextDate = findNextAllowedDate(now, localDays, localTime, true);
      const nextDateStr = nextDate.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      statusText = `Сегодня рассылки отключены. Ближайший запуск: ${nextDateStr} в ${localTime}`;
      statusVariant = 'warning';
    } else if (alreadyRanToday) {
      const nextDate = findNextAllowedDate(now, localDays, localTime, true);
      const nextDateStr = nextDate.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      statusText = `Сегодня уже выполнено. Следующий: ${nextDateStr} в ${localTime}`;
      statusVariant = 'success';
    } else {
      const nextDate = findNextAllowedDate(now, localDays, localTime, false);
      const nextDateStr = nextDate.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      statusText = `Следующий запуск: ${nextDateStr} в ${localTime}`;
      statusVariant = 'muted';
    }

    return { statusText, statusVariant, activeDaysText };
  }, [localTime, localDays, lastAutoRunDate]);

  if (isLoading) return null;

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      {/* Row 1: Time + Days */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Time picker */}
          <div className="shrink-0">
            <Label
              htmlFor="auto-process-time"
              className="flex items-center gap-1.5 mb-2 text-sm font-medium text-foreground"
            >
              <Clock className="h-4 w-4 text-primary" />
              Время проверки
            </Label>
            <Input
              id="auto-process-time"
              type="time"
              value={localTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-36"
            />
          </div>

          {/* Day of week toggles */}
          <div className="flex-1">
            <Label className="flex items-center gap-1.5 mb-2 text-sm font-medium text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              Дни недели
            </Label>
            <div className="flex gap-1">
              {WEEKDAYS.map((day) => {
                const isActive = localDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    title={day.full}
                    onClick={() => toggleDay(day.id)}
                    className={cn(
                      'h-8 w-9 rounded-md text-xs font-medium transition-colors border',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    )}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <Button
            size="sm"
            variant={isDirty ? 'default' : 'outline'}
            className="gap-1.5 shrink-0 self-end"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Сохранить
          </Button>
        </div>
      </div>

      {/* Row 2: Status banner */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
          statusVariant === 'success' &&
            'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400',
          statusVariant === 'warning' &&
            'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400',
          statusVariant === 'muted' &&
            'border-border bg-muted/50 text-muted-foreground'
        )}
      >
        <CalendarClock className="h-4 w-4 shrink-0" />
        <span>
          <strong>Автопилот:</strong> {activeDaysText} в {localTime} · {statusText}
        </span>
      </div>
    </div>
  );
}
