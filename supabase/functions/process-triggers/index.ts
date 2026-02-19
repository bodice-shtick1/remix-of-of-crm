import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========================= HELPERS =========================
// quick template engine
function buildMessage(template: string, vars: Record<string, string>): string {
  let msg = template;
  msg = msg.replace(/\{\{customer_name\}\}/g, vars.customer_name || "");
  msg = msg.replace(/\{\{name\}\}/g, vars.customer_name || "");
  msg = msg.replace(/\{\{car\}\}/g, vars.car || "");
  msg = msg.replace(/\{\{plate\}\}/g, vars.plate || "");
  msg = msg.replace(/\{\{policy\}\}/g, vars.policy || "");
  msg = msg.replace(/\{\{policy_number\}\}/g, vars.policy || "");
  msg = msg.replace(/\{\{car_brand\}\}/g, vars.car || "");
  msg = msg.replace(/\{\{end_date\}\}/g, vars.end_date || "");
  msg = msg.replace(/\{\{debt\}\}/g, vars.debt || "0");
  msg = msg.replace(/\{\{due_date\}\}/g, vars.due_date || "");
  return msg;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU");
}

function getISOWeekday(date: Date): number {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function isWithinScheduleWindow(
  scheduledTime: string,
  nowHour: number,
  nowMinute: number
): boolean {
  const [sHour, sMinute] = scheduledTime.split(":").map(Number);
  const scheduledMinutes = sHour * 60 + sMinute;
  const currentMinutes = nowHour * 60 + nowMinute;
  const diff = currentMinutes - scheduledMinutes;
  return diff >= 0 && diff < 30;
}

async function sendViaTelegramUserBot(
  supabaseUrl: string,
  supabaseKey: string,
  telegramConfig: { api_id: string; api_hash: string; session_string: string },
  phone: string,
  message: string
): Promise<{ sent: boolean; error?: string; user_id?: string; message_id?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_id: telegramConfig.api_id,
        api_hash: telegramConfig.api_hash,
        session_string: telegramConfig.session_string,
        phone,
        message,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { sent: true, user_id: data.user_id, message_id: data.message_id };
    }
    return { sent: false, error: data.error || 'Unknown error' };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

async function sendViaMaxBot(
  supabaseUrl: string,
  supabaseKey: string,
  botToken: string,
  clientId: string,
  message: string
): Promise<{ sent: boolean; error?: string; message_id?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-max-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_token: botToken,
        chat_id: clientId,
        message,
        client_id: clientId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { sent: true, message_id: data.message_id };
    }
    return { sent: false, error: data.error || 'Unknown error' };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

async function processUserTriggers(
  supabase: any,
  userId: string,
  isTestMode: boolean,
  source: string,
  today: Date,
  todayStr: string,
  todayMonthDay: string,
  telegramConfig: { api_id: string; api_hash: string; session_string: string } | null,
  maxBotToken: string | null,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ processed: number; errors: string[] }> {
  let totalProcessed = 0;
  const errors: string[] = [];

  const { data: triggers, error: trigErr } = await supabase
    .from("notification_triggers")
    .select("*, template:notification_templates(*)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (trigErr) throw trigErr;
  if (!triggers || triggers.length === 0) return { processed: 0, errors: [] };

  for (const trigger of triggers) {
    try {
      const template = trigger.template as any;
      if (!template) continue;

      let matchingRecords: any[] = [];

      if (trigger.event_type === "birthday") {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, first_name, last_name, middle_name, phone, birth_date")
          .not("birth_date", "is", null);

        matchingRecords = (clients || [])
          .filter((c: any) => c.birth_date && c.birth_date.slice(5) === todayMonthDay)
          .map((c: any) => ({ ...c, _policy_id: null }));
      } else if (trigger.event_type === "policy_expiry") {
        // Dynamic range: find policies expiring within days_before days (inclusive)
        // end_date - today <= days_before  →  end_date <= today + days_before
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + trigger.days_before);
        const maxDateStr = maxDate.toISOString().split("T")[0];

        const { data: policies } = await supabase
          .from("policies")
          .select(
            "id, client_id, policy_number, vehicle_model, vehicle_number, end_date, client:clients(id, first_name, last_name, middle_name, phone)"
          )
          .gte("end_date", todayStr)        // not yet expired
          .lte("end_date", maxDateStr)       // within range
          .in("status", ["active", "expiring_soon"]);

        matchingRecords = (policies || []).map((p: any) => ({
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
      } else if (trigger.event_type === "debt_reminder") {
        // Dynamic range: due_date <= today + days_before (catch-up)
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + trigger.days_before);
        const maxDateStr = maxDate.toISOString().split("T")[0];

        const { data: sales } = await supabase
          .from("sales")
          .select(
            "id, client_id, total_amount, amount_paid, installment_due_date, client:clients(id, first_name, last_name, middle_name, phone)"
          )
          .eq("debt_status", "unpaid")
          .gte("installment_due_date", todayStr)
          .lte("installment_due_date", maxDateStr);

        matchingRecords = (sales || []).map((s: any) => ({
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

      // Determine the channel for this template
      const templateChannel = template.channel?.split(",")[0] || "whatsapp";
      const useTelegramUserBot = templateChannel === "telegram" && telegramConfig !== null;
      const useMaxBot = templateChannel === "max" && maxBotToken !== null;

      for (const client of matchingRecords) {
        if (!client.id || !client.phone) continue;

        // Anti-spam: check if notification already sent for this trigger + client + policy (ever, not just today)
        const dedupQuery = supabase
          .from("notification_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("client_id", client.id)
          .eq("trigger_id", trigger.id);

        if (client._policy_id) {
          dedupQuery.eq("policy_id", client._policy_id);
        }

        const { data: existing } = await dedupQuery.limit(1);
        if (existing && existing.length > 0) continue;

        const customerName = [
          client.last_name,
          client.first_name,
          client.middle_name,
        ]
          .filter(Boolean)
          .join(" ");

        const message = buildMessage(template.message_template || "", {
          customer_name: customerName,
          car: client.vehicle_model || "",
          plate: client.vehicle_number || "",
          policy: client.policy_number || "",
          end_date: client.end_date ? formatDate(client.end_date) : "",
          debt: client.debt || "0",
          due_date: client.due_date ? formatDate(client.due_date) : "",
        });

        let status = isTestMode ? "[ТЕСТ] Подготовлено" : "pending";
        let errorMessage: string | null = null;
        let externalMessageId: string | null = null;
        let externalPeerId: string | null = null;

        // Actually send via Telegram UserBot if not in test mode
        if (!isTestMode && useTelegramUserBot) {
          const sendResult = await sendViaTelegramUserBot(
            supabaseUrl, supabaseKey, telegramConfig!, client.phone, message
          );

          if (sendResult.sent) {
            status = "sent";
            externalMessageId = sendResult.message_id || null;
            externalPeerId = sendResult.user_id || null;
          } else {
            status = "error";
            errorMessage = sendResult.error || "Ошибка отправки";
          }
          await new Promise(resolve => setTimeout(resolve, 18000));
        }

        // Send via MAX Bot if not in test mode
        if (!isTestMode && useMaxBot) {
          const sendResult = await sendViaMaxBot(
            supabaseUrl, supabaseKey, maxBotToken!, client.id, message
          );

          if (sendResult.sent) {
            status = "sent";
            externalMessageId = sendResult.message_id || null;
          } else {
            status = "error";
            errorMessage = sendResult.error || "Ошибка отправки MAX";
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const { error: logErr } = await supabase
          .from("notification_logs")
          .insert([{
            user_id: userId, client_id: client.id, template_id: template.id,
            trigger_id: trigger.id,
            policy_id: client._policy_id || null,
            channel: templateChannel, message, template_title: template.title,
            status, source, error_message: errorMessage,
            external_message_id: externalMessageId, external_peer_id: externalPeerId,
          }]);

        // If sent successfully, also save as a message with is_automated=true and auto-unarchive
        if (status === "sent") {
          await supabase.from("messages").insert([{
            client_id: client.id, user_id: userId,
            content: `Автопилот: ${template.title}\n\n${message}`,
            direction: "out", channel: templateChannel,
            is_internal: false, is_read: true, is_automated: true,
            delivery_status: "sent", external_message_id: externalMessageId,
          }]);
          await supabase.from("clients").update({ is_archived: false, archive_reason: null }).eq("id", client.id).eq("is_archived", true);
        }

        if (logErr) {
          errors.push(`Log error for client ${client.id}: ${logErr.message}`);
        } else {
          totalProcessed++;
        }
      }
    } catch (triggerError) {
      errors.push(
        `Trigger ${trigger.id}: ${(triggerError as Error).message}`
      );
    }
  }

  return { processed: totalProcessed, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayMonthDay = todayStr.slice(5);
    const todayWeekday = getISOWeekday(today);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // no body = manual call
    }
    const source: string = body?.source || "manual";
    const isScheduledRun = source === "cron";

    // Get all user settings
    const { data: allSettings } = await supabase
      .from("agent_settings")
      .select(
        "user_id, notification_test_mode, auto_process_time, auto_process_days, last_auto_run_date"
      );

    const settingsMap = new Map<string, any>();
    for (const s of allSettings || []) {
      settingsMap.set(s.user_id, s);
    }

    // Get all distinct user_ids from active triggers
    const { data: activeTriggers } = await supabase
      .from("notification_triggers")
      .select("user_id")
      .eq("is_active", true);

    const userIds = [
      ...new Set((activeTriggers || []).map((t: any) => t.user_id)),
    ];

    let totalProcessed = 0;
    const allErrors: string[] = [];

    for (const userId of userIds) {
      const settings = settingsMap.get(userId);
      const isTestMode = settings?.notification_test_mode ?? true;

      if (isScheduledRun) {
        const scheduledTime = settings?.auto_process_time || "09:00";
        const allowedDays: number[] = settings?.auto_process_days || [1, 2, 3, 4, 5];
        const lastRunDate = settings?.last_auto_run_date;

        if (lastRunDate === todayStr) continue;
        if (!allowedDays.includes(todayWeekday)) continue;

        const nowHour = today.getUTCHours();
        const nowMinute = today.getUTCMinutes();
        if (!isWithinScheduleWindow(scheduledTime, nowHour, nowMinute))
          continue;
      }

      // Load Telegram UserBot config for this user (if available)
      let telegramConfig: { api_id: string; api_hash: string; session_string: string } | null = null;
      let maxBotToken: string | null = null;

      const { data: allMessengerSettings } = await supabase
        .from("messenger_settings")
        .select("channel, config")
        .eq("user_id", userId)
        .eq("is_active", true);

      for (const ms of allMessengerSettings || []) {
        const cfg = ms.config as Record<string, unknown>;
        if (ms.channel === 'telegram' && cfg.connection_type === 'user_api' && cfg.session_string && cfg.api_id && cfg.api_hash) {
          telegramConfig = { api_id: cfg.api_id as string, api_hash: cfg.api_hash as string, session_string: cfg.session_string as string };
        }
        if (ms.channel === 'max' && cfg.bot_token) {
          maxBotToken = cfg.bot_token as string;
        }
      }

      const result = await processUserTriggers(
        supabase, userId, isTestMode,
        source === "cron" ? "scheduled" : "manual",
        today, todayStr, todayMonthDay,
        telegramConfig, maxBotToken, supabaseUrl, serviceRoleKey
      );

      totalProcessed += result.processed;
      allErrors.push(...result.errors);

      if (isScheduledRun || result.processed > 0) {
        await supabase
          .from("agent_settings")
          .update({ last_auto_run_date: todayStr })
          .eq("user_id", userId);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Triggers processed",
        processed: totalProcessed,
        source,
        errors: allErrors.length > 0 ? allErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
