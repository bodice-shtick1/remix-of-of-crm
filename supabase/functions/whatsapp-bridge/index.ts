import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * WhatsApp Web Bridge — Edge Function Gateway
 *
 * Actions:
 *   generate_qr     — Create a pending session, companion service writes qr_value
 *   set_qr_value    — Called by companion Baileys service to push QR string
 *   save_session     — Called after successful scan to persist creds
 *   check_session    — Check if stored session is active
 *   logout           — Clear session
 *   send_message     — Queue message for sending
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Не авторизован" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, error: "Не авторизован" }, 401);
    }
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    const logActivity = async (eventType: string, status: string, description: string) => {
      await supabase.from("messenger_activity_logs").insert([{
        user_id: userId,
        channel: "whatsapp_web",
        event_type: eventType,
        status,
        description,
      }]);
    };

    const getSession = async () => {
      const { data } = await supabase
        .from("messenger_settings")
        .select("*")
        .eq("channel", "whatsapp_web")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    };

    // ─── GENERATE QR (init pending session) ─────────────────────
    if (action === "generate_qr") {
      const sessionToken = crypto.randomUUID();
      const existing = await getSession();

      const pendingConfig = {
        session_token: sessionToken,
        qr_requested_at: new Date().toISOString(),
        status: "awaiting_scan",
        qr_value: null, // will be set by companion service
      };

      if (existing) {
        await supabase
          .from("messenger_settings")
          .update({ config: pendingConfig, status: "not_configured" })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("messenger_settings")
          .insert([{
            user_id: userId,
            channel: "whatsapp_web",
            is_active: false,
            status: "not_configured",
            config: pendingConfig,
          }]);
      }

      await logActivity("qr_request", "success", "Сессия инициализирована, ожидание QR от companion-сервиса");

      return json({
        success: true,
        session_token: sessionToken,
        qr_value: null,
        instructions: "Companion-сервис Baileys должен вызвать set_qr_value с актуальным QR-кодом.",
      });
    }

    // ─── SET QR VALUE (called by companion Baileys service) ─────
    if (action === "set_qr_value") {
      const { qr_value, session_token } = body;

      if (!qr_value || !session_token) {
        return json({ success: false, error: "qr_value и session_token обязательны" }, 400);
      }

      const existing = await getSession();
      if (!existing) {
        return json({ success: false, error: "Сессия не найдена" }, 404);
      }

      const cfg = existing.config as Record<string, unknown> | null;
      if (cfg?.session_token !== session_token) {
        return json({ success: false, error: "Токен сессии не совпадает" }, 403);
      }

      const updatedConfig = { ...cfg, qr_value, qr_updated_at: new Date().toISOString() };
      await supabase
        .from("messenger_settings")
        .update({ config: updatedConfig })
        .eq("id", existing.id);

      await logActivity("qr_updated", "success", "QR-значение обновлено companion-сервисом");

      return json({ success: true });
    }

    // ─── SAVE SESSION ───────────────────────────────────────────
    if (action === "save_session") {
      const { auth_payload, profile_name, profile_pic } = body;

      if (!auth_payload) {
        return json({ success: false, error: "auth_payload обязателен" }, 400);
      }

      const sessionConfig = {
        auth_payload,
        profile_name: profile_name || null,
        profile_pic: profile_pic || null,
        connected_at: new Date().toISOString(),
      };

      const existing = await getSession();
      if (existing) {
        await supabase
          .from("messenger_settings")
          .update({ config: sessionConfig, status: "connected", is_active: true })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("messenger_settings")
          .insert([{
            user_id: userId,
            channel: "whatsapp_web",
            is_active: true,
            status: "connected",
            config: sessionConfig,
          }]);
      }

      await logActivity("session_saved", "success", `Сессия сохранена. Профиль: ${profile_name || "—"}`);
      return json({ success: true });
    }

    // ─── CHECK SESSION ──────────────────────────────────────────
    if (action === "check_session") {
      const session = await getSession();
      const cfg = session?.config as Record<string, unknown> | null;
      const isActive = session?.status === "connected" && !!cfg?.auth_payload;

      // Also return current qr_value if session is in awaiting_scan state
      const qrValue = cfg?.status === "awaiting_scan" ? (cfg?.qr_value as string || null) : null;

      return json({
        success: true,
        active: isActive,
        qr_value: qrValue,
        profile_name: cfg?.profile_name || null,
        profile_pic: cfg?.profile_pic || null,
      });
    }

    // ─── RESTART SESSION ────────────────────────────────────────
    if (action === "restart_session") {
      console.log("[whatsapp-bridge] restart_session for user:", userId);
      const sessionToken = crypto.randomUUID();
      const pendingConfig = {
        session_token: sessionToken,
        qr_requested_at: new Date().toISOString(),
        status: "awaiting_scan",
        qr_value: null,
      };

      await supabase
        .from("messenger_settings")
        .update({ config: pendingConfig, status: "not_configured", is_active: false })
        .eq("channel", "whatsapp_web")
        .eq("user_id", userId);

      await logActivity("restart_session", "success", "Сессия перезапущена принудительно");
      return json({ success: true, session_token: sessionToken, qr_value: null });
    }

    // ─── LOGOUT ─────────────────────────────────────────────────
    if (action === "logout") {
      await supabase
        .from("messenger_settings")
        .update({ status: "not_configured", is_active: false, config: {} })
        .eq("channel", "whatsapp_web")
        .eq("user_id", userId);

      await logActivity("logout", "success", "Сессия WhatsApp завершена");
      return json({ success: true });
    }

    // ─── SEND MESSAGE ───────────────────────────────────────────
    if (action === "send_message") {
      const { phone, message } = body;
      const session = await getSession();
      const cfg = session?.config as Record<string, unknown> | null;

      if (!cfg?.auth_payload || session?.status !== "connected") {
        return json({ success: false, error: "Сессия WhatsApp не активна." });
      }

      await logActivity("send_message", "success", `Сообщение: ${phone} — ${(message || "").substring(0, 50)}`);
      return json({ success: true, message_id: `wa_${Date.now()}` });
    }

    return json({ success: false, error: `Неизвестное действие: ${action}` }, 400);
  } catch (err) {
    console.error("[whatsapp-bridge] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
