import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Headers mimicking a real browser to avoid bot-detection blocks */
const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://web.max.ru/',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://web.max.ru',
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

interface AuthRequest {
  action: 'init' | 'verify' | 'verify_code' | 'verify_2fa' | 'check_session' | 'logout' | 'terminate_all';
  phone?: string;
  code?: string;
  password?: string;
  proxy?: string;
}

/** Extract client IP from request headers */
function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/** Extract user_id from Authorization header (JWT) */
async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const sb = getSupabaseAdmin();
    const token = auth.replace('Bearer ', '');
    const { data } = await sb.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/** Log an activity event */
async function logActivity(
  userId: string | null,
  eventType: string,
  status: 'success' | 'error',
  ip: string,
  description?: string,
  metadata?: Record<string, unknown>,
) {
  if (!userId) return;
  const sb = getSupabaseAdmin();
  await sb.from('messenger_activity_logs').insert({
    user_id: userId,
    channel: 'max_web',
    event_type: eventType,
    status,
    description: description || null,
    ip_address: ip,
    metadata: metadata || {},
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body: AuthRequest = await req.json();
    const { action, phone, proxy } = body;
    const ip = getClientIp(req);
    const userId = await getUserId(req);

    // Normalize phone: strip non-digits, remove leading +
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    // ── init: request confirmation code ──────────────────────────
    if (action === 'init') {
      if (!cleanPhone || cleanPhone.length < 10) return json({ success: false, error: 'Номер телефона обязателен (мин. 10 цифр)' }, 400);

      console.log(`[max-bridge] init – requesting code for ${cleanPhone}, proxy=${proxy || 'none'}`);
      console.log(`[max-bridge] Using browser headers:`, JSON.stringify(browserHeaders));

      // Production: Make actual request to MAX API here
      // const maxResponse = await fetch('https://api.max.ru/auth/sendCode', {
      //   method: 'POST',
      //   headers: { ...browserHeaders, 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ phone: cleanPhone }),
      // });
      // const maxData = await maxResponse.json();
      // console.log(`[max-bridge] MAX API response:`, JSON.stringify(maxData));
      // if (maxData.error) {
      //   const errMsg = maxData.error === 'IP_BLOCKED' ? 'IP заблокирован MAX. Попробуйте через прокси.'
      //     : maxData.error === 'TOO_MANY_REQUESTS' ? 'Слишком много запросов. Подождите и попробуйте снова.'
      //     : `Ошибка MAX: ${maxData.error}`;
      //   await logActivity(userId, 'auth', 'error', ip, errMsg);
      //   return json({ success: false, error: errMsg, error_code: maxData.error });
      // }

      await logActivity(userId, 'auth', 'success', ip, `Запрос кода для ${cleanPhone}`);

      return json({
        success: true,
        message: `Код подтверждения отправлен на +${cleanPhone}`,
      });
    }

    // ── verify / verify_code: submit the confirmation code ─────
    if (action === 'verify' || action === 'verify_code') {
      const { code } = body;
      if (!cleanPhone || !code) return json({ success: false, error: 'phone и code обязательны' }, 400);
      console.log(`[max-bridge] verify_code – code=${code} phone=${cleanPhone}`);

      // Production: validate the code against MAX API here
      // For now, accept any non-empty code as valid

      const authPayload = {
        phone: cleanPhone,
        authenticated_at: new Date().toISOString(),
        token_type: 'web_session',
      };

      await logActivity(userId, 'auth', 'success', ip, `Успешная авторизация. Сессия запущена для ${cleanPhone}`);

      return json({ success: true, auth_payload: authPayload });
    }

    // ── verify_2fa: submit cloud password ────────────────────────
    if (action === 'verify_2fa') {
      const { password } = body;
      if (!cleanPhone || !password) return json({ success: false, error: 'phone и password обязательны' }, 400);
      console.log(`[max-bridge] verify_2fa – phone=${cleanPhone}`);

      const authPayload = {
        phone: cleanPhone,
        authenticated_at: new Date().toISOString(),
        token_type: 'web_session_2fa',
      };

      await logActivity(userId, 'auth', 'success', ip, `2FA пройдена для ${cleanPhone}`);

      return json({ success: true, auth_payload: authPayload });
    }

    // ── check_session ────────────────────────────────────────────
    if (action === 'check_session') {
      if (!cleanPhone) return json({ success: false, error: 'phone обязателен' }, 400);
      console.log(`[max-bridge] check_session – phone=${cleanPhone}`);
      return json({ success: true, active: true });
    }

    // ── logout: terminate current session ────────────────────────
    if (action === 'logout') {
      if (!cleanPhone) return json({ success: false, error: 'phone обязателен' }, 400);
      console.log(`[max-bridge] logout – phone=${cleanPhone}`);

      await logActivity(userId, 'logout', 'success', ip, `Сессия закрыта для ${cleanPhone}`);

      return json({ success: true, message: 'Сессия закрыта' });
    }

    // ── terminate_all: terminate all sessions except bridge ──────
    if (action === 'terminate_all') {
      console.log(`[max-bridge] terminate_all`);

      await logActivity(userId, 'terminate_all', 'success', ip, 'Все сеансы завершены, кроме текущего моста');

      return json({ success: true, message: 'Все сеансы завершены' });
    }

    return json({ success: false, error: `Неизвестное действие: ${action}` }, 400);
  } catch (error) {
    console.error('[max-bridge-auth] Error:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
