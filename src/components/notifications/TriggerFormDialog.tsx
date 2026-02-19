import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Plus } from 'lucide-react';
import type { NotificationTemplate } from '@/hooks/useNotifications';
import type { NotificationTrigger } from '@/hooks/useNotificationTriggers';

const EVENT_TYPES = [
  { value: 'birthday', label: 'Дни рождения' },
  { value: 'policy_expiry', label: 'Истечение полиса' },
  { value: 'debt_reminder', label: 'Просрочка долга' },
] as const;

interface TriggerFormDialogProps {
  trigger: NotificationTrigger | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: NotificationTemplate[];
  onSave: (params: {
    id?: string;
    event_type: string;
    template_id: string;
    days_before: number;
    is_active: boolean;
  }) => void;
  isSaving: boolean;
}

export function TriggerFormDialog({
  trigger,
  open,
  onOpenChange,
  templates,
  onSave,
  isSaving,
}: TriggerFormDialogProps) {
  const isEditMode = !!trigger;

  const [eventType, setEventType] = useState('policy_expiry');
  const [templateId, setTemplateId] = useState('');
  const [daysBefore, setDaysBefore] = useState(7);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      if (trigger) {
        setEventType(trigger.event_type);
        setTemplateId(trigger.template_id || '');
        setDaysBefore(trigger.days_before);
        setIsActive(trigger.is_active);
      } else {
        setEventType('policy_expiry');
        setTemplateId('');
        setDaysBefore(7);
        setIsActive(true);
      }
    }
  }, [open, trigger]);

  const handleSave = () => {
    if (!templateId) return;
    onSave({
      id: trigger?.id,
      event_type: eventType,
      template_id: templateId,
      days_before: eventType === 'birthday' ? 0 : daysBefore,
      is_active: isActive,
    });
    onOpenChange(false);
  };

  const activeTemplates = templates.filter(t => t.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Редактирование триггера' : 'Новая авто-рассылка'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <Label>Шаблон сообщения</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите шаблон" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.length > 0 ? (
                  activeTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Нет активных шаблонов
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Event type */}
          <div className="space-y-2">
            <Label>Тип события</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(et => (
                  <SelectItem key={et.value} value={et.value}>
                    {et.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days before */}
          {eventType !== 'birthday' ? (
            <div className="space-y-2">
              <Label>За сколько дней до события отправить</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={daysBefore}
                onChange={e => setDaysBefore(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                {eventType === 'policy_expiry'
                  ? 'Уведомление отправится за указанное число дней до окончания полиса'
                  : 'Уведомление отправится за указанное число дней до даты возврата долга'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              Поздравление будет отправлено в день рождения клиента (days_before = 0).
            </p>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <Label>Включить автопилот</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={!templateId || isSaving}
            className="w-full gap-2"
          >
            {isEditMode ? (
              <>
                <Save className="h-4 w-4" />
                Сохранить триггер
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Создать триггер
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
