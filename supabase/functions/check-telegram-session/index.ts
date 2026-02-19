import { TelegramClient } from "npm:telegram@2.24.11";
import { StringSession } from "npm:telegram@2.24.11/sessions/index.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const VERSION = '1.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ...body, version: VERSION }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[check-telegram-session v${VERSION}] Request received`);

  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return ok({ valid: false, error: 'user_id обязателен' });
    }

    // Read config from DB
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await sb
      .from('messenger_settings')
      .select('id, config, status')
      .eq('user_id', user_id)
      .eq('channel', 'telegram')
      .maybeSingle();

    if (error || !data?.config) {
      return ok({ valid: false, error: 'Telegram не настроен', not_configured: true });
    }

    const cfg = data.config as Record<string, unknown>;

    if (cfg.connection_type !== 'user_api') {
      // Bot mode — check bot_token presence only
      const hasToken = !!(cfg.bot_token as string)?.length;
      return ok({ valid: hasToken, mode: 'bot' });
    }

    const sessionString = cfg.session_string as string;
    if (!sessionString) {
      // No session at all
      await sb.from('messenger_settings').update({ status: 'not_configured' }).eq('id', data.id);
      return ok({ valid: false, session_expired: true, error: 'Сессия не найдена' });
    }

    const apiId = parseInt(cfg.api_id as string);
    const apiHash = cfg.api_hash as string;

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 2,
      timeout: 15,
    });

    try {
      await client.connect();
      const me = await client.getMe();
      await client.disconnect();

      if (!me) {
        await sb.from('messenger_settings').update({ status: 'error' }).eq('id', data.id);
        return ok({ valid: false, session_expired: true, error: 'getMe вернул пустой результат' });
      }

      // Session is valid — ensure status is correct
      if (data.status !== 'connected') {
        await sb.from('messenger_settings').update({ status: 'connected' }).eq('id', data.id);
      }

      return ok({
        valid: true,
        user: {
          id: (me as any).id?.toString(),
          first_name: (me as any).firstName || '',
          username: (me as any).username || null,
        },
      });
    } catch (tgErr: any) {
      const errMsg = tgErr?.message || String(tgErr);
      console.error(`[check-telegram-session] TG error: ${errMsg}`);

      const isSessionError = errMsg.includes('AUTH_KEY_UNREGISTERED') ||
        errMsg.includes('SESSION_EXPIRED') ||
        errMsg.includes('SESSION_REVOKED') ||
        errMsg.includes('USER_DEACTIVATED') ||
        errMsg.includes('AUTH_KEY_DUPLICATED');

      if (isSessionError) {
        await sb.from('messenger_settings').update({ status: 'error' }).eq('id', data.id);
        return ok({ valid: false, session_expired: true, error: 'Сессия Telegram истекла' });
      }

      try { await client.disconnect(); } catch (_) {}
      return ok({ valid: false, error: errMsg });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error(`[check-telegram-session v${VERSION}] Error:`, errorMessage);
    return ok({ valid: false, error: errorMessage });
  }
});
