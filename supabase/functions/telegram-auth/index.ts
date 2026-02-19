import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = '2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sanitizePhone(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

function mapTelegramError(errorMessage: string): string {
  if (errorMessage.includes('AUTH_RESTART')) {
    return 'Требуется повторная авторизация. Попробуйте ещё раз.';
  }
  if (errorMessage.includes('PHONE_NUMBER_INVALID')) {
    return 'Неверный формат номера телефона. Используйте формат +7...';
  }
  if (errorMessage.includes('PHONE_CODE_INVALID')) {
    return 'Неверный код подтверждения.';
  }
  if (errorMessage.includes('PHONE_CODE_EXPIRED')) {
    return 'Код подтверждения истёк. Запросите новый.';
  }
  if (errorMessage.includes('FLOOD_WAIT')) {
    const match = errorMessage.match(/FLOOD_WAIT_(\d+)/);
    const seconds = match ? match[1] : '?';
    return `Слишком много попыток. Подождите ${seconds} секунд.`;
  }
  if (errorMessage.includes('SESSION_PASSWORD_NEEDED')) {
    return '2fa_needed';
  }
  if (errorMessage.includes('PASSWORD_HASH_INVALID')) {
    return 'Неверный облачный пароль (2FA).';
  }
  return errorMessage;
}

// Dynamic import helper to work around Deno npm: subpath issues
async function loadGramJS() {
  const telegram = await import("npm:telegram@2.24.11");
  return telegram;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[telegram-auth v${VERSION}] Request received`);

  try {
    const body = await req.json();
    const { action, api_id, api_hash, phone: rawPhone, phone_code_hash, code, session_string, password } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required', version: VERSION }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phone = rawPhone ? sanitizePhone(rawPhone) : '';
    const apiId = parseInt(api_id);
    const apiHash = api_hash as string;

    // Load gramjs dynamically
    const { TelegramClient, Api } = await loadGramJS();
    const { StringSession } = await import("npm:telegram@2.24.11/sessions/index.js");

    let result: Record<string, unknown>;

    switch (action) {
      case 'send_code': {
        if (!api_id || !api_hash || !phone) {
          return new Response(
            JSON.stringify({ error: 'api_id, api_hash и phone обязательны', version: VERSION }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[v${VERSION}] send_code for phone: ${phone}, apiId: ${apiId}`);

        const session = new StringSession('');
        const client = new TelegramClient(session, apiId, apiHash, {
          connectionRetries: 3,
        });

        await client.connect();

        const sendResult = await client.sendCode(
          { apiId, apiHash },
          phone
        );

        const tempSession = client.session.save() as unknown as string;
        await client.disconnect();

        result = {
          status: 'code_requested',
          phone_code_hash: sendResult.phoneCodeHash,
          session_string: tempSession,
          version: VERSION,
        };
        break;
      }

      case 'sign_in': {
        if (!api_id || !api_hash || !phone || !phone_code_hash || !code || !session_string) {
          return new Response(
            JSON.stringify({ error: 'Все поля авторизации обязательны', version: VERSION }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[v${VERSION}] sign_in for phone: ${phone}`);

        const session = new StringSession(session_string);
        const client = new TelegramClient(session, apiId, apiHash, {
          connectionRetries: 3,
        });

        await client.connect();

        try {
          const signInResult = await client.invoke(
            new Api.auth.SignIn({
              phoneNumber: phone,
              phoneCodeHash: phone_code_hash,
              phoneCode: code,
            })
          );

          const finalSession = client.session.save() as unknown as string;
          const user = (signInResult as any)?.user;
          await client.disconnect();

          result = {
            status: 'authorized',
            session_string: finalSession,
            user: user ? {
              id: user.id?.toString(),
              first_name: user.firstName || '',
              last_name: user.lastName || '',
              username: user.username || null,
            } : null,
            version: VERSION,
          };
        } catch (signInError: any) {
          const errMsg = signInError?.message || String(signInError);

          if (errMsg.includes('SESSION_PASSWORD_NEEDED')) {
            const twoFaSession = client.session.save() as unknown as string;
            await client.disconnect();

            result = {
              status: '2fa_needed',
              session_string: twoFaSession,
              version: VERSION,
            };
          } else {
            await client.disconnect();
            throw signInError;
          }
        }
        break;
      }

      case 'sign_in_2fa': {
        if (!api_id || !api_hash || !session_string || !password) {
          return new Response(
            JSON.stringify({ error: 'session_string и password обязательны для 2FA', version: VERSION }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[v${VERSION}] sign_in_2fa`);

        const session = new StringSession(session_string);
        const client = new TelegramClient(session, apiId, apiHash, {
          connectionRetries: 3,
        });

        await client.connect();

        const passwordResult = await client.invoke(
          new Api.auth.CheckPassword({
            password: await (client as any)._computePasswordSRP(password),
          })
        );

        const finalSession = client.session.save() as unknown as string;
        const user = (passwordResult as any)?.user;
        await client.disconnect();

        result = {
          status: 'authorized',
          session_string: finalSession,
          user: user ? {
            id: user.id?.toString(),
            first_name: user.firstName || '',
            last_name: user.lastName || '',
            username: user.username || null,
          } : null,
          version: VERSION,
        };
        break;
      }

      case 'resolve_phone': {
        if (!api_id || !api_hash || !session_string || !phone) {
          return new Response(
            JSON.stringify({ error: 'session и phone обязательны', version: VERSION }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[v${VERSION}] resolve_phone: ${phone}`);

        const session = new StringSession(session_string);
        const client = new TelegramClient(session, apiId, apiHash, {
          connectionRetries: 3,
        });

        await client.connect();

        try {
          const importResult = await client.invoke(
            new Api.contacts.ImportContacts({
              contacts: [
                new Api.InputPhoneContact({
                  clientId: BigInt(0),
                  phone: phone,
                  firstName: 'Search',
                  lastName: '',
                }),
              ],
            })
          );

          if (importResult.users && importResult.users.length > 0) {
            const foundUser = importResult.users[0] as any;
            await client.disconnect();
            result = {
              found: true,
              user: {
                id: foundUser.id?.toString(),
                first_name: foundUser.firstName || '',
                last_name: foundUser.lastName || '',
                username: foundUser.username || null,
              },
              version: VERSION,
            };
          } else {
            await client.disconnect();
            result = { found: false, user: null, version: VERSION };
          }
        } catch (resolveErr) {
          await client.disconnect();
          console.error('Resolve error:', resolveErr);
          result = { found: false, user: null, error: String(resolveErr), version: VERSION };
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Неизвестное действие: ${action}`, version: VERSION }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[telegram-auth v${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const userMessage = mapTelegramError(errorMessage);

    return new Response(
      JSON.stringify({ error: userMessage, raw_error: errorMessage, version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
