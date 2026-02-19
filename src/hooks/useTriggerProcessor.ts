import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';
import { toast } from 'sonner';
import { buildTemplateVars, renderTemplate, formatDateRu, formatPlate } from '@/lib/templateEngine';

const THROTTLE_MS = 60_000; // 1 minute

interface TriggerTemplate {
  id: string;
  title: string;
  message_template: string;
  channel: string;
}

interface MatchedClient {
  id: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  phone?: string;
  policy_number?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  end_date?: string;
  debt?: string;
  due_date?: string;
  _policy_id?: string | null;
}

async function processTriggersLocally(userId: string, isTestMode: boolean, source: string, messengerSettings: any[]): Promise<number> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayMonthDay = todayStr.slice(5);

  const { data: triggers, error: trigErr } = await supabase
    .from('notification_triggers')
    .select('*')
    .eq('is_active', true);

  if (trigErr) throw trigErr;
  if (!triggers || triggers.length === 0) return 0;

  const templateIds = [...new Set(triggers.map(t => t.template_id).filter(Boolean))] as string[];
  const { data: templatesData } = await supabase
    .from('notification_templates')
    .select('id, title, message_template, channel')
    .in('id', templateIds);

  const templateMap = new Map<string, TriggerTemplate>();
  (templatesData || []).forEach(t => templateMap.set(t.id, t));

  let totalProcessed = 0;

  for (const trigger of triggers) {
    if (!trigger.template_id) continue;
    const template = templateMap.get(trigger.template_id);
    if (!template) continue;

    let matchingClients: MatchedClient[] = [];

    if (trigger.event_type === 'birthday') {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, middle_name, phone, birth_date')
        .not('birth_date', 'is', null);

      matchingClients = (clients || [])
        .filter(c => c.birth_date && c.birth_date.slice(5) === todayMonthDay)
        .map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          middle_name: c.middle_name || undefined,
          phone: c.phone,
          _policy_id: null,
        }));
    } else if (trigger.event_type === 'policy_expiry') {
      // Dynamic range: end_date between today and today + days_before
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + trigger.days_before);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      const { data: policies } = await supabase
        .from('policies')
        .select('id, client_id, policy_number, vehicle_model, vehicle_number, end_date, client:clients(id, first_name, last_name, middle_name, phone)')
        .gte('end_date', todayStr)
        .lte('end_date', maxDateStr)
        .in('status', ['active', 'expiring_soon']);

      matchingClients = (policies || []).map((p: any) => ({
        id: p.client?.id || p.client_id,
        first_name: p.client?.first_name,
        last_name: p.client?.last_name,
        middle_name: p.client?.middle_name,
        phone: p.client?.phone,
        policy_number: p.policy_number,
        vehicle_model: p.vehicle_model,
        vehicle_number: p.vehicle_number,
        end_date: p.end_date,
        _policy_id: p.id,
      }));
    } else if (trigger.event_type === 'debt_reminder') {
      // Dynamic range: due_date between today and today + days_before
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + trigger.days_before);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      const { data: sales } = await supabase
        .from('sales')
        .select('id, client_id, total_amount, amount_paid, installment_due_date, client:clients(id, first_name, last_name, middle_name, phone)')
        .eq('debt_status', 'unpaid')
        .gte('installment_due_date', todayStr)
        .lte('installment_due_date', maxDateStr);

      matchingClients = (sales || []).map((s: any) => ({
        id: s.client?.id || s.client_id,
        first_name: s.client?.first_name,
        last_name: s.client?.last_name,
        middle_name: s.client?.middle_name,
        phone: s.client?.phone,
        debt: (s.total_amount - s.amount_paid).toFixed(0),
        due_date: s.installment_due_date,
        _policy_id: null,
      }));
    }

    for (const client of matchingClients) {
      if (!client.id) continue;

      // Anti-spam: check if this trigger+client+policy combo was already notified
      let existing: any[] | null = null;
      if (client._policy_id) {
        // Policy-specific: check if already notified for this exact policy+template (ever)
        const { data } = await (supabase
          .from('notification_logs')
          .select('id')
          .eq('client_id', client.id)
          .eq('template_id', template.id) as any)
          .eq('policy_id', client._policy_id)
          .limit(1);
        existing = data;
      } else {
        // Birthday/debt: dedup by today's date
        const { data } = await supabase
          .from('notification_logs')
          .select('id')
          .eq('client_id', client.id)
          .eq('template_id', template.id)
          .gte('sent_at', todayStr + 'T00:00:00Z')
          .limit(1);
        existing = data;
      }
      if (existing && existing.length > 0) continue;

      const vars = buildTemplateVars(
        { first_name: client.first_name, last_name: client.last_name, middle_name: client.middle_name },
        {
          policy_type: undefined,
          policy_series: undefined,
          policy_number: client.policy_number,
          vehicle_model: client.vehicle_model,
          vehicle_number: client.vehicle_number,
          end_date: client.end_date,
        },
      );
      if (client.debt) vars.debt = client.debt;
      if (client.due_date) vars.due_date = formatDateRu(client.due_date);

      const message = renderTemplate(template.message_template, vars);

      const channelName = template.channel?.split(',')[0] || 'whatsapp';

      // ── Channel validation for triggers ──
      const channelSetting = messengerSettings.find((s: any) => s.channel === channelName);
      let sendStatus: string;
      let errorMessage: string | null = null;

      if (!channelSetting || !channelSetting.is_active) {
        sendStatus = 'error';
        errorMessage = `Канал ${channelName} не настроен или отключён`;
      } else if (channelName === 'telegram') {
        const config = channelSetting.config as any;
        if (!config?.bot_token) {
          sendStatus = 'error';
          errorMessage = 'Missing Telegram Token';
        } else {
          sendStatus = isTestMode ? '[ТЕСТ] Подготовлено' : 'pending';
        }
      } else if (channelName === 'whatsapp') {
        const config = channelSetting.config as any;
        if (config?.mode === 'business_api' && !config?.api_key) {
          sendStatus = 'error';
          errorMessage = 'Missing WhatsApp Business API key';
        } else {
          sendStatus = isTestMode ? '[ТЕСТ] Подготовлено' : 'pending';
        }
      } else if (channelName === 'max') {
        const config = channelSetting.config as any;
        if (!config?.api_key) {
          sendStatus = 'error';
          errorMessage = 'Missing Max API key';
        } else {
          sendStatus = isTestMode ? '[ТЕСТ] Подготовлено' : 'pending';
        }
      } else {
        sendStatus = isTestMode ? '[ТЕСТ] Подготовлено' : 'pending';
      }

      const { error: logErr } = await supabase
        .from('notification_logs')
        .insert([{
          user_id: userId,
          client_id: client.id,
          template_id: template.id,
          trigger_id: trigger.id,
          policy_id: client._policy_id || null,
          channel: channelName,
          message,
          template_title: template.title,
          status: sendStatus,
          error_message: errorMessage,
          source,
        } as any]);

      if (!logErr) {
        totalProcessed++;
      }
    }
  }

  return totalProcessed;
}

export function useTriggerProcessor() {
  const { user } = useAuth();
  const { settings: messengerSettingsList } = useMessengerSettings();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const lastRunRef = useRef<number>(0);

  const invalidateLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
  }, [queryClient]);

  const runTriggers = useCallback(async (isTestMode: boolean) => {
    if (!user) {
      toast.error('Необходимо авторизоваться');
      return;
    }

    const now = Date.now();
    const elapsed = now - lastRunRef.current;
    if (elapsed < THROTTLE_MS) {
      const remaining = Math.ceil((THROTTLE_MS - elapsed) / 1000);
      toast.warning(`Подождите ${remaining} сек. перед повторным запуском`);
      return;
    }

    setIsRunning(true);
    lastRunRef.current = Date.now();

    try {
      // Try Edge Function first — manual source
      const { data, error } = await supabase.functions.invoke('process-triggers', {
        body: { source: 'manual' },
      });

      if (error) throw error;

      const processed = data?.processed ?? 0;
      if (processed > 0) {
        toast.success(`Проверка завершена. Подготовлено ${processed} уведомлений`);
      } else {
        toast.info('Проверка завершена. Новых уведомлений не найдено');
      }

      invalidateLogs();
    } catch {
      console.warn('Edge Function недоступна, запускаю локальную проверку...');

      try {
        const processed = await processTriggersLocally(user.id, isTestMode, 'manual', messengerSettingsList);

        if (processed > 0) {
          toast.success(`Локальная проверка завершена. Найдено совпадений: ${processed}`);
        } else {
          toast.info('Локальная проверка завершена. Совпадений не найдено');
        }

        invalidateLogs();
      } catch (localErr: any) {
        toast.error('Ошибка локальной проверки: ' + (localErr?.message || 'Неизвестная ошибка'));
      }
    } finally {
      setIsRunning(false);
    }
  }, [user, invalidateLogs, messengerSettingsList]);

  return { runTriggers, isRunning };
}