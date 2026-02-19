import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Eye, AlertTriangle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NotificationTemplate } from '@/hooks/useNotifications';

const AVAILABLE_TAGS = [
  { label: 'Имя клиента', tag: '{{customer_name}}', preview: 'Иван Иванович' },
  { label: 'Марка авто', tag: '{{car}}', preview: 'Toyota Camry' },
  { label: 'Госномер', tag: '{{plate}}', preview: 'А001АА77' },
  { label: 'Номер полиса', tag: '{{policy}}', preview: 'ХХХ-1234567890' },
  { label: 'Дата окончания', tag: '{{end_date}}', preview: '15.03.2026' },
  { label: 'Сумма долга', tag: '{{debt}}', preview: '5 200' },
  { label: 'Дата возврата', tag: '{{due_date}}', preview: '20.02.2026' },
] as const;

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'max', label: 'Макс' },
  { value: 'sms', label: 'СМС' },
] as const;

function resolvePreview(template: string): string {
  let result = template;
  for (const t of AVAILABLE_TAGS) {
    result = result.split(t.tag).join(t.preview);
  }
  result = result.split('{{name}}').join('Иван Иванович');
  return result;
}

function getSmsInfo(text: string) {
  const isCyrillic = /[а-яА-ЯёЁ]/.test(text);
  const maxPerMessage = isCyrillic ? 70 : 160;
  const length = text.length;
  const parts = Math.max(1, Math.ceil(length / maxPerMessage));
  return { length, maxPerMessage, parts, isCyrillic, isOver: length > maxPerMessage };
}

interface TemplateFormDialogProps {
  /** Pass existing template for edit mode, null for create mode */
  template: NotificationTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (params: {
    id?: string;
    title: string;
    slug: string;
    message_template: string;
    channel: string;
    description: string;
    is_active: boolean;
  }) => void;
  isSaving: boolean;
}

export function TemplateFormDialog({
  template,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: TemplateFormDialogProps) {
  const isEditMode = !!template;

  const [title, setTitle] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp']);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewText = useMemo(() => resolvePreview(messageTemplate), [messageTemplate]);
  const smsInfo = useMemo(() => getSmsInfo(messageTemplate), [messageTemplate]);
  const isSmsSelected = selectedChannels.includes('sms');

  // Sync form when opening
  useEffect(() => {
    if (open) {
      if (template) {
        setTitle(template.title);
        // Support comma-separated channels from DB
        setSelectedChannels(template.channel ? template.channel.split(',').map(c => c.trim()) : ['whatsapp']);
        setMessageTemplate(template.message_template);
        setIsActive(template.is_active);
      } else {
        setTitle('');
        setSelectedChannels(['whatsapp']);
        setMessageTemplate('');
        setIsActive(true);
      }
    }
  }, [open, template]);

  const toggleChannel = (ch: string) => {
    setSelectedChannels(prev =>
      prev.includes(ch)
        ? prev.length > 1 ? prev.filter(c => c !== ch) : prev
        : [...prev, ch]
    );
  };

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageTemplate(prev => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = messageTemplate.slice(0, start);
    const after = messageTemplate.slice(end);
    setMessageTemplate(before + tag + after);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleSave = () => {
    if (!title.trim() || !messageTemplate.trim()) return;
    const channelStr = selectedChannels.join(',');

    onSave({
      id: template?.id,
      title: title.trim(),
      slug: template?.slug ?? `custom_${Date.now()}`,
      message_template: messageTemplate,
      channel: channelStr,
      description: `Шаблон: ${title.trim()}`,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Редактирование шаблона' : 'Новый шаблон'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label>Название шаблона</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Напоминание о продлении"
            />
          </div>

          {/* Multi-select channels */}
          <div className="space-y-2">
            <Label>Каналы отправки</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(ch => (
                <Badge
                  key={ch.value}
                  variant={selectedChannels.includes(ch.value) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer select-none px-3 py-1.5 transition-colors',
                    selectedChannels.includes(ch.value)
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => toggleChannel(ch.value)}
                >
                  {ch.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tag Toolbar */}
          <div className="space-y-2">
            <Label>Вставить данные</Label>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map(t => (
                <Badge
                  key={t.tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors select-none px-2.5 py-1"
                  onClick={() => insertTag(t.tag)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Template text */}
          <div className="space-y-2">
            <Label>Текст шаблона</Label>
            <Textarea
              ref={textareaRef}
              rows={5}
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              placeholder="Здравствуйте, {{customer_name}}! Напоминаем, что ваш полис {{policy}} на автомобиль {{car}} ({{plate}}) истекает {{end_date}}."
              className="font-mono text-sm"
            />

            {/* SMS counter */}
            {isSmsSelected && messageTemplate.length > 0 && (
              <div className={cn(
                'flex items-center gap-2 text-xs px-2 py-1.5 rounded',
                smsInfo.isOver
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
              )}>
                {smsInfo.isOver && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span>
                  Символов: {smsInfo.length} | Сегментов: {smsInfo.parts} (по {smsInfo.maxPerMessage} симв.)
                  {smsInfo.isCyrillic ? ' · кириллица' : ' · латиница'}
                </span>
              </div>
            )}
          </div>

          {/* Live preview */}
          {messageTemplate.trim() && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label className="text-muted-foreground">Предварительный просмотр</Label>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {previewText}
                </p>
              </div>
            </div>
          )}

          {/* Active toggle (edit only) */}
          {isEditMode && (
            <div className="flex items-center justify-between">
              <Label>Активен</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !messageTemplate.trim() || isSaving}
            className="w-full gap-2"
          >
            {isEditMode ? (
              <>
                <Save className="h-4 w-4" />
                Сохранить шаблон
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Создать шаблон
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
