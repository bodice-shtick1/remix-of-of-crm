import { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users, Play, Pause, Square, CheckCircle2, XCircle, Loader2,
  MessageCircle, Send, Cake, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMassBroadcasts } from '@/hooks/useMassBroadcasts';
import { useChannelValidation } from '@/hooks/useChannelValidation';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';
import type { NotificationTemplate } from '@/hooks/useNotifications';
import { toast } from 'sonner';

interface MassBroadcastTabProps {
  templates: NotificationTemplate[];
  onLogCreated: (params: {
    client_id: string;
    template_id?: string;
    channel: string;
    message: string;
    template_title?: string;
    status?: string;
    broadcast_id?: string;
    source?: string;
  }) => Promise<void>;
}

interface BroadcastClient {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

type SendState = 'idle' | 'sending' | 'paused';

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Все клиенты',
  with_debts: 'Клиенты с долгами',
  by_company: 'По страховой компании',
  birthday_month: 'Именинники месяца',
};

const DEFAULT_CHANNEL_DELAY_MS: Record<string, number> = {
  whatsapp: 7000,  // 7 sec for WhatsApp (human-like)
  telegram: 20000, // 20 sec for Telegram personal account
  max: 3000,
  sms: 2000,
};

export function MassBroadcastTab({ templates, onLogCreated }: MassBroadcastTabProps) {
  const { user } = useAuth();
  const { validateChannel } = useChannelValidation();
  const { broadcasts, createBroadcast, updateBroadcast } = useMassBroadcasts();
  const { getChannelSetting } = useMessengerSettings();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [companyId, setCompanyId] = useState('');
  const [channel, setChannel] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  // Default channel
  const preferredChannel = 'whatsapp';

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Use template channel if available, fallback to manual selection or preferred
  const effectiveChannel = channel || selectedTemplate?.channel || preferredChannel;

  const activeTemplates = useMemo(() => templates.filter(t => t.is_active), [templates]);

  // Load insurance companies for filter
  const { data: companies = [] } = useQuery({
    queryKey: ['insurance-companies-broadcast'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Load audience count & clients based on filter
  const { data: audienceData } = useQuery({
    queryKey: ['broadcast-audience', audienceFilter, companyId],
    queryFn: async (): Promise<{ clients: BroadcastClient[]; count: number }> => {
      let query = supabase
        .from('clients')
        .select('id, first_name, last_name, middle_name, phone', { count: 'exact' });

      if (audienceFilter === 'with_debts') {
        // Clients with unpaid sales (total_amount > amount_paid)
        const { data: debtSales } = await supabase
          .from('sales')
          .select('client_id')
          .neq('debt_status', 'paid')
          .eq('status', 'completed');
        const clientIds = [...new Set((debtSales || []).map(s => s.client_id))];
        if (clientIds.length === 0) return { clients: [], count: 0 };
        query = query.in('id', clientIds);
      } else if (audienceFilter === 'by_company' && companyId) {
        const { data: policiesData } = await supabase
          .from('policies')
          .select('client_id')
          .eq('insurance_company', companyId)
          .eq('status', 'active');
        const clientIds = [...new Set((policiesData || []).map(p => p.client_id))];
        if (clientIds.length === 0) return { clients: [], count: 0 };
        query = query.in('id', clientIds);
      } else if (audienceFilter === 'birthday_month') {
        // Birthday in current month
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const monthStr = currentMonth.toString().padStart(2, '0');
        // Filter clients whose birth_date month matches
        const { data: allClients, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name, middle_name, phone, birth_date')
          .not('birth_date', 'is', null);
        if (error) throw error;
        const filtered = (allClients ?? []).filter(c => {
          if (!c.birth_date) return false;
          const month = c.birth_date.split('-')[1];
          return month === monthStr;
        });
        return {
          clients: filtered.map(c => ({
            id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            middle_name: c.middle_name,
            phone: c.phone,
          })),
          count: filtered.length,
        };
      }

      const { data, count, error } = await query.limit(500);
      if (error) throw error;
      return { clients: (data ?? []) as BroadcastClient[], count: count ?? (data?.length ?? 0) };
    },
    staleTime: 30 * 1000,
  });

  const audienceCount = audienceData?.count ?? 0;

  // Auto-set channel from template when template changes
  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl?.channel) {
      setChannel(tmpl.channel);
    }
  }, [templates]);

  // Wait helper that respects pause and cancel
  const waitWithPauseSupport = useCallback(async (ms: number) => {
    const interval = 200;
    let waited = 0;
    while (waited < ms) {
      if (cancelRef.current) return;
      // Pause loop
      while (pauseRef.current && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (cancelRef.current) return;
      await new Promise(r => setTimeout(r, Math.min(interval, ms - waited)));
      waited += interval;
    }
  }, []);

  const handleStartBroadcast = useCallback(async () => {
    if (!selectedTemplate || !audienceData?.clients.length || !user) return;

    // ── Channel validation ──
    const validation = validateChannel(effectiveChannel);
    if (!validation.isConfigured) {
      toast.error(validation.errorReason || 'Канал не настроен. Перейдите в настройки мессенджеров.');
      return;
    }

    const isWhatsAppWeb = validation.isWhatsAppWeb;

    setSendState('sending');
    cancelRef.current = false;
    pauseRef.current = false;
    const clients = audienceData.clients;
    setProgress({ sent: 0, failed: 0, total: clients.length });

    // Use saved broadcast_interval from telegram settings, or channel default
    const tgSetting = getChannelSetting('telegram');
    const savedInterval = (tgSetting?.config as Record<string, unknown>)?.broadcast_interval as number | undefined;
    const delay = effectiveChannel === 'telegram' && savedInterval
      ? savedInterval * 1000
      : DEFAULT_CHANNEL_DELAY_MS[effectiveChannel] ?? 3000;

    try {
      const broadcast = await createBroadcast({
        template_id: selectedTemplate.id,
        audience_filter: audienceFilter,
        audience_params: audienceFilter === 'by_company' ? { company_id: companyId } : {},
        channel: effectiveChannel,
        total_recipients: clients.length,
      });

      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < clients.length; i++) {
        if (cancelRef.current) break;

        // Wait while paused
        while (pauseRef.current && !cancelRef.current) {
          await new Promise(r => setTimeout(r, 300));
        }
        if (cancelRef.current) break;

        const client = clients[i];
        const vars: Record<string, string> = {
          name: `${client.first_name || ''} ${client.middle_name || ''}`.trim() || 'Клиент',
          customer_name: [client.last_name, client.first_name].filter(Boolean).join(' ') || 'Клиент',
        };
        const message = resolveTemplate(selectedTemplate.message_template, vars);

        try {
          if (isWhatsAppWeb) {
            // WhatsApp Web: open wa.me, status = pending until user confirms
            const phone = client.phone.replace(/\D/g, '');
            if (phone) {
              window.open(
                `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                '_blank'
              );
            }
            // Log as pending — user must confirm manually
            await onLogCreated({
              client_id: client.id,
              template_id: selectedTemplate.id,
              channel: effectiveChannel,
              message,
              template_title: selectedTemplate.title,
              status: phone ? 'pending' : 'error',
              broadcast_id: broadcast.id,
              source: 'broadcast',
            });
            sentCount++;
          } else {
            // API mode: log as pending (real delivery would update later)
            await onLogCreated({
              client_id: client.id,
              template_id: selectedTemplate.id,
              channel: effectiveChannel,
              message,
              template_title: selectedTemplate.title,
              status: 'pending',
              broadcast_id: broadcast.id,
              source: 'broadcast',
            });
            sentCount++;
          }
        } catch {
          // Log error with reason
          try {
            await onLogCreated({
              client_id: client.id,
              template_id: selectedTemplate.id,
              channel: effectiveChannel,
              message,
              template_title: selectedTemplate.title,
              status: 'error',
              broadcast_id: broadcast.id,
              source: 'broadcast',
            });
          } catch { /* ignore logging errors */ }
          failedCount++;
        }

        setProgress({ sent: sentCount, failed: failedCount, total: clients.length });

        // Delay between messages (human-like pacing)
        if (i < clients.length - 1 && !cancelRef.current) {
          await waitWithPauseSupport(delay);
        }
      }

      await updateBroadcast({
        id: broadcast.id,
        sent_count: sentCount,
        failed_count: failedCount,
        status: cancelRef.current ? 'cancelled' : 'completed',
        completed_at: new Date().toISOString(),
      });

      toast.success(
        cancelRef.current
          ? `Рассылка остановлена. Отправлено: ${sentCount}`
          : `Рассылка завершена! Подготовлено: ${sentCount}, ошибок: ${failedCount}`
      );
    } catch (err: any) {
      toast.error('Ошибка рассылки: ' + err.message);
    } finally {
      setSendState('idle');
      pauseRef.current = false;
      cancelRef.current = false;
    }
  }, [selectedTemplate, audienceData, user, audienceFilter, companyId, effectiveChannel, validateChannel, createBroadcast, updateBroadcast, onLogCreated, waitWithPauseSupport, getChannelSetting]);

  const handlePauseResume = useCallback(() => {
    if (sendState === 'sending') {
      pauseRef.current = true;
      setSendState('paused');
    } else if (sendState === 'paused') {
      pauseRef.current = false;
      setSendState('sending');
    }
  }, [sendState]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    pauseRef.current = false;
  }, []);

  const progressPercent = progress.total > 0
    ? Math.round(((progress.sent + progress.failed) / progress.total) * 100)
    : 0;

  const isBusy = sendState !== 'idle';

  return (
    <div className="space-y-6">
      {/* New Broadcast */}
      <div className="card-elevated p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Новая массовая рассылка</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Audience filter */}
          <div className="space-y-1.5">
            <Label className="text-sm">Аудитория</Label>
            <Select value={audienceFilter} onValueChange={setAudienceFilter} disabled={isBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все клиенты</SelectItem>
                <SelectItem value="with_debts">Клиенты с долгами</SelectItem>
                <SelectItem value="by_company">По страховой компании</SelectItem>
                <SelectItem value="birthday_month">
                  <span className="flex items-center gap-1.5">
                    <Cake className="h-3.5 w-3.5" />
                    Именинники месяца
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Company filter */}
          {audienceFilter === 'by_company' && (
            <div className="space-y-1.5">
              <Label className="text-sm">Страховая компания</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isBusy}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите СК" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template */}
          <div className="space-y-1.5">
            <Label className="text-sm">Шаблон сообщения</Label>
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange} disabled={isBusy}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите шаблон" />
              </SelectTrigger>
              <SelectContent>
                {activeTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({t.channel})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label className="text-sm">Канал отправки</Label>
            <Select value={effectiveChannel} onValueChange={setChannel} disabled={isBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="max">Макс</SelectItem>
                <SelectItem value="sms">СМС</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* WhatsApp Web notice */}
        {effectiveChannel === 'whatsapp' && !isBusy && audienceCount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
            <MessageCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Для WhatsApp будут открываться ссылки wa.me для каждого контакта с задержкой ~{DEFAULT_CHANNEL_DELAY_MS.whatsapp / 1000} сек.
              Подтвердите отправку в каждом окне.
            </span>
          </div>
        )}

        {/* Audience count + actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            Выбрано получателей:{' '}
            <span className="font-semibold text-foreground">{audienceCount}</span>
          </div>
          <div className="flex gap-2">
            {isBusy && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePauseResume}
                >
                  {sendState === 'paused' ? (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Продолжить
                    </>
                  ) : (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Пауза
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCancel}
                >
                  <Square className="h-3.5 w-3.5" />
                  Остановить
                </Button>
              </>
            )}
            <Button
              onClick={handleStartBroadcast}
              disabled={!selectedTemplateId || audienceCount === 0 || isBusy}
              className="gap-2"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isBusy ? (sendState === 'paused' ? 'На паузе...' : 'Отправка...') : 'Запустить рассылку'}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {isBusy && (
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Отправлено: {progress.sent} из {progress.total}
                {sendState === 'paused' && (
                  <span className="ml-2 text-amber-600 font-medium">⏸ Пауза</span>
                )}
              </span>
              {progress.failed > 0 && (
                <span className="text-destructive">Ошибок: {progress.failed}</span>
              )}
              <span>{progressPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Broadcast History */}
      <div className="card-elevated">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">История рассылок</h3>
        </div>
        {broadcasts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Нет массовых рассылок
          </div>
        ) : (
          <div className="divide-y divide-border">
            {broadcasts.map(b => {
              const totalDone = b.sent_count + b.failed_count;
              const pct = b.total_recipients > 0 ? Math.round((totalDone / b.total_recipients) * 100) : 0;
              const filterLabel = AUDIENCE_LABELS[b.audience_filter] || b.audience_filter;
              return (
                <div key={b.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {b.channel === 'whatsapp' ? (
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      ) : b.channel === 'telegram' ? (
                        <Send className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {filterLabel}
                      </span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        b.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' :
                        b.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' :
                        b.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                        b.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {b.status === 'completed' ? 'Завершена' :
                         b.status === 'in_progress' ? 'В процессе' :
                         b.status === 'cancelled' ? 'Отменена' :
                         b.status === 'failed' ? 'Ошибка' : b.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {b.sent_count}
                    </span>
                    {b.failed_count > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {b.failed_count}
                      </span>
                    )}
                    <span>из {b.total_recipients}</span>
                  </div>
                  {b.status === 'in_progress' && (
                    <Progress value={pct} className="h-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
