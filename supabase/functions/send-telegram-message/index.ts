import { Api, TelegramClient } from "npm:telegram@2.24.11";
import { StringSession } from "npm:telegram@2.24.11/sessions/index.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const VERSION = '5.0.0';

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

/** Strip ALL non-digit chars; replace leading 8 with 7 for RU numbers */
function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.slice(1);
  }
  return cleaned;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ── Types ────────────────────────────────────────────────────────────

interface SendRequest {
  api_id: string;
  api_hash: string;
  session_string: string;
  phone: string;
  message: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  batch?: Array<{ phone: string; message: string }>;
  delay_ms?: number;
  refresh_session?: boolean;
  user_id?: string;
  client_id?: string;          // DB client id — used to look up cached telegram_id
}

interface SendResult {
  success: boolean;
  error?: string;
  error_code?: string;
  session_expired?: boolean;
  user_id?: string;
  message_id?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  flood_wait_seconds?: number;
}

// ── Error classifier ─────────────────────────────────────────────────

function classifyError(errMsg: string): { error: string; error_code: string; session_expired: boolean; flood_wait_seconds?: number } {
  if (errMsg.includes('AUTH_KEY_UNREGISTERED') || errMsg.includes('SESSION_EXPIRED') || errMsg.includes('SESSION_REVOKED') || errMsg.includes('USER_DEACTIVATED')) {
    return { error: 'Сессия Telegram истекла. Необходимо переавторизоваться.', error_code: 'SESSION_EXPIRED', session_expired: true };
  }
  if (errMsg.includes('AUTH_KEY_DUPLICATED')) {
    return { error: 'Сессия Telegram конфликтует. Переавторизуйтесь.', error_code: 'SESSION_EXPIRED', session_expired: true };
  }
  if (errMsg.includes('PEER_ID_INVALID') || errMsg.includes('USER_PRIVACY_RESTRICTED')) {
    return { error: 'Клиент скрыл профиль. Попробуйте написать ему в WhatsApp или СМС.', error_code: 'PEER_INVALID', session_expired: false };
  }
  if (errMsg.includes('FLOOD_WAIT') || errMsg.includes('FloodWaitError') || errMsg.includes('A wait of')) {
    const match = errMsg.match(/FLOOD_WAIT_(\d+)/i) || errMsg.match(/(\d+)\s*seconds?/i) || errMsg.match(/(\d+)/);
    const seconds = match ? parseInt(match[1]) : 60;
    return { error: `Telegram просит подождать ${seconds} сек. Сообщение будет отправлено автоматически.`, error_code: 'FLOOD_WAIT', session_expired: false, flood_wait_seconds: seconds };
  }
  if (errMsg.includes('не найден') || errMsg.includes('USER_NOT_FOUND') || errMsg.includes('No user has')) {
    return { error: 'Клиент скрыл профиль. Попробуйте написать ему в WhatsApp или СМС.', error_code: 'USER_NOT_FOUND', session_expired: false };
  }
  return { error: errMsg, error_code: 'UNKNOWN', session_expired: false };
}

// ── Level 1: Lookup cached telegram_id from DB ───────────────────────

async function lookupTelegramId(clientId?: string, phone?: string): Promise<string | null> {
  if (!clientId && !phone) return null;
  const sb = getSupabaseAdmin();

  if (clientId) {
    const { data } = await sb.from('clients').select('telegram_id').eq('id', clientId).maybeSingle();
    if (data?.telegram_id) {
      console.log(`[v${VERSION}] Found cached telegram_id=${data.telegram_id} for client ${clientId}`);
      return data.telegram_id;
    }
  }

  // Also try by phone
  if (phone) {
    const { data } = await sb.from('clients').select('telegram_id, id').eq('phone', phone).maybeSingle();
    if (data?.telegram_id) {
      console.log(`[v${VERSION}] Found cached telegram_id=${data.telegram_id} for phone ${phone}`);
      return data.telegram_id;
    }
  }

  return null;
}

// ── Level 2: getEntity (no importContacts) ───────────────────────────

async function tryGetEntity(client: InstanceType<typeof TelegramClient>, phone: string) {
  try {
    const entity = await client.getEntity(phone);
    if (entity && (entity as any).className !== 'UserEmpty') {
      console.log(`[v${VERSION}] Resolved ${phone} via getEntity`);
      return { entity, resolvedUser: entity as any };
    }
  } catch {
    console.log(`[v${VERSION}] getEntity failed for ${phone}`);
  }
  return null;
}

// ── Level 3: importContacts fallback ─────────────────────────────────

async function tryImportContacts(client: InstanceType<typeof TelegramClient>, phone: string) {
  try {
    const importResult = await client.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(0),
            phone,
            firstName: 'Contact',
            lastName: '',
          }),
        ],
      }),
    );

    if (!importResult.users || importResult.users.length === 0) return null;
    const resolvedUser = importResult.users[0] as any;
    if (resolvedUser.className === 'UserEmpty') return null;

    const entity = await client.getEntity(resolvedUser.id);
    console.log(`[v${VERSION}] Resolved ${phone} via importContacts`);
    return { entity, resolvedUser };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('FLOOD_WAIT') || errMsg.includes('FloodWaitError')) throw err; // propagate
    console.error(`[v${VERSION}] importContacts failed for ${phone}:`, errMsg);
    return null;
  }
}

// ── Combined multi-level resolution ──────────────────────────────────

async function resolveEntity(
  client: InstanceType<typeof TelegramClient>,
  phone: string,
  clientId?: string,
) {
  // Level 1 — cached telegram_id
  const cachedId = await lookupTelegramId(clientId, phone);
  if (cachedId) {
    try {
      const entity = await client.getEntity(BigInt(cachedId));
      if (entity && (entity as any).className !== 'UserEmpty') {
        console.log(`[v${VERSION}] Resolved via cached telegram_id=${cachedId}`);
        return { entity, resolvedUser: entity as any };
      }
    } catch {
      console.log(`[v${VERSION}] Cached telegram_id=${cachedId} failed, continuing fallback`);
    }
  }

  // Level 2 — getEntity by phone (no API import call)
  const byEntity = await tryGetEntity(client, phone);
  if (byEntity) return byEntity;

  // Level 3 — importContacts (only for unknown contacts)
  const byImport = await tryImportContacts(client, phone);
  if (byImport) return byImport;

  // Level 4 — direct peer by phone (last resort)
  try {
    const entity = await client.getEntity(`+${phone}`);
    if (entity && (entity as any).className !== 'UserEmpty') {
      console.log(`[v${VERSION}] Resolved ${phone} via +phone fallback`);
      return { entity, resolvedUser: entity as any };
    }
  } catch {
    console.log(`[v${VERSION}] +phone fallback also failed for ${phone}`);
  }

  return null;
}

// ── Save telegram_id after successful send ───────────────────────────

async function saveTelegramId(clientId: string | undefined, phone: string, resolvedUser: any) {
  const telegramId = resolvedUser?.id?.toString();
  if (!telegramId) return;

  const sb = getSupabaseAdmin();

  if (clientId) {
    await sb.from('clients').update({ telegram_id: telegramId }).eq('id', clientId);
    console.log(`[v${VERSION}] Saved telegram_id=${telegramId} for client ${clientId}`);
  } else {
    // Try by phone
    const cleaned = sanitizePhone(phone);
    const { data } = await sb.from('clients').select('id').or(`phone.eq.${cleaned},phone.eq.+${cleaned}`).maybeSingle();
    if (data?.id) {
      await sb.from('clients').update({ telegram_id: telegramId }).eq('id', data.id);
      console.log(`[v${VERSION}] Saved telegram_id=${telegramId} for phone match ${cleaned}`);
    }
  }
}

// ── Media helpers ────────────────────────────────────────────────────

async function downloadMediaBuffer(mediaUrl: string): Promise<Uint8Array> {
  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error(`Failed to download media: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function getMimeFromType(mediaType: string, fileName?: string): string {
  switch (mediaType) {
    case 'photo': return 'image/jpeg';
    case 'voice': return 'audio/ogg';
    case 'audio': return 'audio/mpeg';
    case 'video': return 'video/mp4';
    default: {
      if (fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf', doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', mp3: 'audio/mpeg', ogg: 'audio/ogg',
          mp4: 'video/mp4', txt: 'text/plain', zip: 'application/zip',
        };
        return mimeMap[ext || ''] || 'application/octet-stream';
      }
      return 'application/octet-stream';
    }
  }
}

class CustomFile {
  name: string; size: number; path: string; buffer: Uint8Array;
  constructor(name: string, size: number, path: string, buffer: Uint8Array) {
    this.name = name; this.size = size; this.path = path; this.buffer = buffer;
  }
  [Symbol.asyncIterator]() {
    const buffer = this.buffer; let done = false;
    return { async next() { if (done) return { value: undefined, done: true }; done = true; return { value: buffer, done: false }; } };
  }
}

async function sendMediaMessage(
  client: InstanceType<typeof TelegramClient>,
  entity: any, message: string, mediaUrl: string, mediaType: string, fileName?: string,
): Promise<any> {
  const buffer = await downloadMediaBuffer(mediaUrl);
  const mimeType = getMimeFromType(mediaType, fileName);
  const defaultName = mediaType === 'photo' ? 'photo.jpg'
    : mediaType === 'voice' ? 'voice.ogg'
    : mediaType === 'audio' ? 'audio.mp3'
    : mediaType === 'video' ? 'video.mp4'
    : fileName || 'file.bin';

  if (mediaType === 'photo') {
    return await client.sendFile(entity, {
      file: new Api.InputFile({ id: BigInt(Date.now()), parts: 1, name: defaultName, md5Checksum: '' }),
      caption: message || undefined, forceDocument: false,
    });
  }

  const attributes: any[] = [];
  if (mediaType === 'voice') attributes.push(new Api.DocumentAttributeAudio({ voice: true, duration: 0 }));
  else if (mediaType === 'audio') attributes.push(new Api.DocumentAttributeAudio({ voice: false, duration: 0, title: fileName || 'audio' }));
  else if (mediaType === 'video') attributes.push(new Api.DocumentAttributeVideo({ duration: 0, w: 640, h: 480, supportsStreaming: true }));
  if (fileName) attributes.push(new Api.DocumentAttributeFilename({ fileName: defaultName }));

  const uploaded = await client.uploadFile({ file: new CustomFile(defaultName, buffer.length, '', buffer), workers: 1 });
  const media = new Api.InputMediaUploadedDocument({ file: uploaded, mimeType, attributes, forceFile: mediaType === 'document' });

  return await client.invoke(
    new Api.messages.SendMedia({
      peer: await client.getInputEntity(entity), media, message: message || '',
      randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    }),
  );
}

// ── Send single message with multi-level resolution ──────────────────

async function sendSingleMessage(
  client: InstanceType<typeof TelegramClient>,
  phone: string, message: string,
  mediaUrl?: string, mediaType?: string, fileName?: string,
  clientId?: string,
): Promise<SendResult> {
  try {
    console.log(`[v${VERSION}] Resolving peer for phone: ${phone}, clientId: ${clientId || 'none'}`);

    const resolved = await resolveEntity(client, phone, clientId);
    if (!resolved) {
      return {
        success: false,
        error: 'Клиент скрыл профиль. Попробуйте написать ему в WhatsApp или СМС.',
        error_code: 'USER_NOT_FOUND',
      };
    }

    const { entity, resolvedUser } = resolved;

    try {
      let sentMessage: any;
      if (mediaUrl && mediaType) {
        sentMessage = await sendMediaMessage(client, entity, message, mediaUrl, mediaType, fileName);
      } else {
        sentMessage = await client.sendMessage(entity, { message });
      }

      const msgId = sentMessage?.id || sentMessage?.updates?.[0]?.id;
      console.log(`[v${VERSION}] Message sent to ${phone} (user_id: ${resolvedUser.id}, msg_id: ${msgId})`);

      // Save telegram_id asynchronously (fire-and-forget)
      saveTelegramId(clientId, phone, resolvedUser).catch(e => console.error(`[v${VERSION}] saveTelegramId error:`, e));

      return {
        success: true,
        user_id: resolvedUser.id?.toString(),
        message_id: msgId?.toString(),
        username: resolvedUser.username || undefined,
        first_name: resolvedUser.firstName || '',
        last_name: resolvedUser.lastName || '',
      };
    } catch (sendErr: any) {
      const errMsg = sendErr?.message || String(sendErr);
      console.error(`[v${VERSION}] Send inner error for ${phone}:`, errMsg);
      return { success: false, ...classifyError(errMsg) };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[v${VERSION}] Send error for ${phone}:`, errMsg);
    return { success: false, ...classifyError(errMsg) };
  }
}

// ── Fresh session from DB ────────────────────────────────────────────

async function getFreshSession(userId: string): Promise<{ api_id: string; api_hash: string; session_string: string } | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('messenger_settings').select('config')
    .eq('user_id', userId).eq('channel', 'telegram').maybeSingle();
  if (error || !data?.config) return null;
  const cfg = data.config as Record<string, unknown>;
  if (cfg.connection_type === 'user_api' && cfg.session_string) {
    return { api_id: cfg.api_id as string, api_hash: cfg.api_hash as string, session_string: cfg.session_string as string };
  }
  return null;
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log(`[send-telegram-message v${VERSION}] Request received`);

  try {
    const body: SendRequest = await req.json();
    let { api_id, api_hash, session_string, phone, message, batch, delay_ms, media_url, media_type, file_name, refresh_session, user_id: reqUserId, client_id } = body;

    if (refresh_session && reqUserId) {
      console.log(`[v${VERSION}] Refreshing session from DB for user ${reqUserId}`);
      const fresh = await getFreshSession(reqUserId);
      if (!fresh || !fresh.session_string) {
        return ok({ success: false, error: 'Требуется переавторизация Telegram.', error_code: 'SESSION_EXPIRED', session_expired: true });
      }
      api_id = fresh.api_id; api_hash = fresh.api_hash; session_string = fresh.session_string;
    }

    if (!api_id || !api_hash) return ok({ success: false, error: 'api_id и api_hash обязательны' });
    if (!session_string || session_string.trim().length === 0) {
      return ok({ success: false, error: 'Требуется переавторизация Telegram.', error_code: 'SESSION_EXPIRED', session_expired: true });
    }

    const apiId = parseInt(api_id);
    const session = new StringSession(session_string);
    const client = new TelegramClient(session, apiId, api_hash, { connectionRetries: 3, timeout: 20 });

    try { await client.connect(); } catch (connErr: any) {
      const errMsg = connErr?.message || String(connErr);
      console.error(`[v${VERSION}] Connection error:`, errMsg);
      return ok({ success: false, ...classifyError(errMsg) });
    }

    // Single message mode
    if (!batch) {
      if (!phone || (!message && !media_url)) {
        await client.disconnect();
        return ok({ success: false, error: 'phone и (message или media_url) обязательны' });
      }
      const result = await sendSingleMessage(client, sanitizePhone(phone), message || '', media_url, media_type, file_name, client_id);
      await client.disconnect();

      // Auto-unarchive client on successful send
      if (result.success && client_id) {
        const sb = getSupabaseAdmin();
        sb.from('clients').update({ is_archived: false, archive_reason: null }).eq('id', client_id).eq('is_archived', true).then(() => {});
      }

      return ok(result as Record<string, unknown>);
    }

    // Batch mode — enforce minimum 20s delay
    const delayBetween = Math.max(delay_ms || 20000, 20000);
    const results: Array<{ phone: string; result: SendResult }> = [];

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const result = await sendSingleMessage(client, sanitizePhone(item.phone), item.message);
      results.push({ phone: item.phone, result });

      if (result.flood_wait_seconds && result.flood_wait_seconds > 0 && result.flood_wait_seconds <= 120) {
        console.log(`[v${VERSION}] FLOOD_WAIT: waiting ${result.flood_wait_seconds}s`);
        await new Promise(resolve => setTimeout(resolve, result.flood_wait_seconds! * 1000));
        const retry = await sendSingleMessage(client, sanitizePhone(item.phone), item.message);
        results[results.length - 1] = { phone: item.phone, result: retry };
      }

      if (i < batch.length - 1) {
        console.log(`[v${VERSION}] Waiting ${delayBetween}ms (${i + 1}/${batch.length})`);
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    }

    await client.disconnect();
    const sent = results.filter(r => r.result.success).length;
    const failed = results.filter(r => !r.result.success).length;
    return ok({ total: batch.length, sent, failed, results });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error(`[send-telegram-message v${VERSION}] Top-level error:`, errorMessage);
    return ok({ success: false, ...classifyError(errorMessage) });
  }
});
