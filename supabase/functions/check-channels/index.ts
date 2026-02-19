import { Api, TelegramClient } from "npm:telegram@2.24.11";
import { StringSession } from "npm:telegram@2.24.11/sessions/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Strip ALL non-digit characters. Result: pure digits like 79991234567 */
function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Ensure phone starts with country code. For Russian numbers starting with 8, replace with 7. */
function toInternational(digits: string): string {
  if (digits.startsWith('8') && digits.length === 11) return '7' + digits.slice(1);
  if (digits.length === 10) return '7' + digits;
  return digits;
}

interface ChannelResult {
  available: boolean;
  privacy_restricted?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  user_id?: string;
}

interface CheckResult {
  whatsapp: ChannelResult;
  telegram: ChannelResult;
  max: ChannelResult;
}

async function checkTelegram(
  phone: string,
  userConfig?: { api_id?: string; api_hash?: string; session_string?: string }
): Promise<ChannelResult> {
  if (!userConfig?.session_string || !userConfig?.api_id || !userConfig?.api_hash) {
    console.warn('No Telegram session configured for contact search');
    return { available: false };
  }

  let client: InstanceType<typeof TelegramClient> | null = null;

  try {
    console.log(`Checking Telegram for phone: ${phone}`);

    const apiId = parseInt(userConfig.api_id);
    const session = new StringSession(userConfig.session_string);
    client = new TelegramClient(session, apiId, userConfig.api_hash, {
      connectionRetries: 2,
    });

    await client.connect();

    // Step 1: Import contact with CRM_ prefix to resolve user
    const importResult = await client.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(0),
            phone: '+' + phone,
            firstName: `CRM_${phone}`,
            lastName: '',
          }),
        ],
      })
    );

    if (!importResult.users || importResult.users.length === 0) {
      // No user found — could be privacy restricted or not on Telegram
      console.log(`Telegram: no users returned for ${phone}`);
      await client.disconnect();
      return { available: false, privacy_restricted: false };
    }

    const foundUser = importResult.users[0] as any;

    if (foundUser.className === 'UserEmpty') {
      console.log(`Telegram: UserEmpty for ${phone} — privacy restricted`);
      await client.disconnect();
      return { available: false, privacy_restricted: true };
    }

    const result: ChannelResult = {
      available: true,
      privacy_restricted: false,
      user_id: foundUser.id?.toString(),
      first_name: foundUser.firstName || '',
      last_name: foundUser.lastName || '',
      username: foundUser.username || undefined,
    };

    // Step 2: Clean up — delete the temporary imported contact
    try {
      const inputUser = new Api.InputUser({
        userId: foundUser.id,
        accessHash: foundUser.accessHash || BigInt(0),
      });
      await client.invoke(
        new Api.contacts.DeleteContacts({
          id: [inputUser],
        })
      );
      console.log('Temporary contact cleaned up');
    } catch (cleanupErr) {
      console.warn('Contact cleanup failed (non-critical):', (cleanupErr as Error).message);
    }

    await client.disconnect();
    return result;
  } catch (error) {
    const errMsg = (error as Error).message || '';
    console.error('Telegram session check error:', errMsg);

    if (client) {
      try { await client.disconnect(); } catch { /* ignore */ }
    }

    // Detect privacy-related errors
    if (errMsg.includes('PRIVACY') || errMsg.includes('PEER_ID_INVALID')) {
      return { available: false, privacy_restricted: true };
    }

    return { available: false };
  }
}

async function checkWhatsApp(phone: string): Promise<ChannelResult> {
  const greenApiInstance = Deno.env.get('GREEN_API_INSTANCE');
  const greenApiToken = Deno.env.get('GREEN_API_TOKEN');

  if (!greenApiInstance || !greenApiToken) {
    return { available: false };
  }

  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${greenApiInstance}/checkWhatsapp/${greenApiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { available: data.existsWhatsapp === true };
    }
  } catch (error) {
    console.error('WhatsApp check error:', (error as Error).message);
  }

  return { available: false };
}

async function checkMax(phone: string, maxConfig?: { bot_token?: string }): Promise<ChannelResult> {
  const botToken = maxConfig?.bot_token;

  if (!botToken) {
    return { available: false };
  }

  try {
    // Verify bot token with /me
    const meResponse = await fetch('https://platform-api.max.ru/me', {
      method: 'GET',
      headers: { 'Authorization': botToken },
    });

    if (!meResponse.ok) {
      console.error('Max bot token invalid, status:', meResponse.status);
      return { available: false };
    }

    // MAX Bot API doesn't support phone-based lookup directly
    // The bot can only interact with users who have previously messaged it
    // We return available: false with a specific note
    return { available: false };
  } catch (error) {
    console.error('Max check error:', (error as Error).message);
    return { available: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, telegram_config, max_config } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Normalize phone — strip ALL non-digit chars, then ensure international format
    const cleanDigits = sanitizePhone(phone);
    const normalizedPhone = toInternational(cleanDigits);

    if (normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking channels for normalized phone: ${normalizedPhone}`);

    const [whatsapp, telegram, max] = await Promise.all([
      checkWhatsApp(normalizedPhone),
      checkTelegram(normalizedPhone, telegram_config),
      checkMax(normalizedPhone, max_config),
    ]);

    const result: CheckResult = { whatsapp, telegram, max };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Check channels error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
