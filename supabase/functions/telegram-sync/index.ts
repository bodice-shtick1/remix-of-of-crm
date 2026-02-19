import { Api, TelegramClient } from "npm:telegram@2.24.11";
import { StringSession } from "npm:telegram@2.24.11/sessions/index.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }
  return cleaned;
}

interface SyncRequest {
  action: 'backfill' | 'poll' | 'check_read';
  api_id: string;
  api_hash: string;
  session_string: string;
  user_id: string;
  client_phone?: string;
  client_id?: string;
  limit?: number;
  since_date?: string;
}

function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.voice) return 'voice';
  if (message.audio) return 'audio';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.sticker) return 'sticker';
  return 'text';
}

function getMessageText(message: any): string {
  if (message.message) return message.message;
  if (message.photo) return '📷 Фото';
  if (message.voice) return '🎤 Голосовое сообщение';
  if (message.audio) return '🎵 Аудио';
  if (message.video) return '🎬 Видео';
  if (message.document) {
    const attrs = message.document?.attributes || [];
    for (const attr of attrs) {
      if (attr.fileName) return `📄 ${attr.fileName}`;
    }
    return '📄 Документ';
  }
  if (message.sticker) return '🖼️ Стикер';
  return '';
}

async function downloadAndUploadMedia(
  client: InstanceType<typeof TelegramClient>,
  message: any,
  supabase: any,
): Promise<{ media_url: string; media_type: string } | null> {
  try {
    if (!message.media) return null;

    let mediaType = 'document';
    let extension = 'bin';
    let mimeType = 'application/octet-stream';

    if (message.photo) {
      mediaType = 'photo'; extension = 'jpg'; mimeType = 'image/jpeg';
    } else if (message.voice || message.audio) {
      mediaType = 'voice'; extension = 'ogg'; mimeType = 'audio/ogg';
      if (message.audio) { extension = 'mp3'; mimeType = 'audio/mpeg'; }
    } else if (message.document) {
      mediaType = 'document';
      const docAttrs = message.document?.attributes || [];
      for (const attr of docAttrs) {
        if (attr.fileName) { extension = attr.fileName.split('.').pop() || 'bin'; break; }
      }
      if (message.document.mimeType) mimeType = message.document.mimeType;
    } else if (message.video) {
      mediaType = 'video'; extension = 'mp4'; mimeType = 'video/mp4';
    } else if (message.sticker) {
      mediaType = 'sticker'; extension = 'webp'; mimeType = 'image/webp';
    }

    const buffer = await client.downloadMedia(message, {});
    if (!buffer || (buffer instanceof Uint8Array && buffer.length === 0)) return null;

    const fileName = `tg_${message.id}_${Date.now()}.${extension}`;
    const filePath = `telegram/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('Media upload error:', uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
    return { media_url: urlData.publicUrl, media_type: mediaType };
  } catch (err) {
    console.error('Media download/upload error:', (err as Error).message);
    return null;
  }
}

// Create TG client with update loop DISABLED to prevent TIMEOUT
async function createTgClient(apiId: number, apiHash: string, sessionString: string): Promise<TelegramClient> {
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 2,
    timeout: 15,
    useWSS: false,
  });
  // Connect without starting the update loop
  await client.connect();
  return client;
}

// Resolve entity using cached telegram_id or phone
async function resolveEntity(
  client: InstanceType<typeof TelegramClient>,
  supabase: any,
  clientId: string,
  phone: string,
): Promise<any | null> {
  // 1. Try cached telegram_id
  const { data: clientData } = await supabase
    .from('clients')
    .select('telegram_id')
    .eq('id', clientId)
    .maybeSingle();

  if (clientData?.telegram_id) {
    try {
      const entity = await client.getEntity(BigInt(clientData.telegram_id));
      return entity;
    } catch {
      console.log(`Cached telegram_id ${clientData.telegram_id} failed, trying phone`);
    }
  }

  // 2. Try by phone directly
  try {
    const entity = await client.getEntity('+' + phone);
    // Cache the telegram_id
    if (entity && (entity as any).id) {
      await supabase
        .from('clients')
        .update({ telegram_id: String((entity as any).id) })
        .eq('id', clientId);
    }
    return entity;
  } catch {
    // 3. Import contact as last resort
    try {
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

      if (importResult.users && importResult.users.length > 0) {
        const tgUser = importResult.users[0] as any;
        if (tgUser.className !== 'UserEmpty') {
          // Cache telegram_id
          await supabase
            .from('clients')
            .update({ telegram_id: String(tgUser.id) })
            .eq('id', clientId);

          const entity = await client.getEntity(tgUser.id);
          // Cleanup temp contact
          try {
            const inputUser = new Api.InputUser({ userId: tgUser.id, accessHash: tgUser.accessHash || BigInt(0) });
            await client.invoke(new Api.contacts.DeleteContacts({ id: [inputUser] }));
          } catch { /* non-critical */ }
          return entity;
        }
      }
    } catch (err) {
      console.error('Import contact failed:', (err as Error).message);
    }
  }

  return null;
}

async function backfillChat(
  client: InstanceType<typeof TelegramClient>,
  supabase: any,
  phone: string,
  clientId: string,
  userId: string,
  limit: number,
): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;

  try {
    const entity = await resolveEntity(client, supabase, clientId, phone);
    if (!entity) {
      console.log(`No Telegram user found for ${phone}`);
      return { synced: 0, skipped: 0 };
    }

    const tgMessages = await client.getMessages(entity, { limit });

    for (const msg of tgMessages) {
      if (!msg.id) continue;

      const externalId = `tg_${msg.id}`;
      const direction: 'in' | 'out' = msg.out ? 'out' : 'in';
      const messageType = getMessageType(msg);
      const content = getMessageText(msg);

      if (!content && messageType === 'text') continue;

      let mediaInfo: { media_url: string; media_type: string } | null = null;
      if (messageType !== 'text') {
        mediaInfo = await downloadAndUploadMedia(client, msg, supabase);
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          client_id: clientId,
          user_id: userId,
          external_message_id: externalId,
          content: content || `[${messageType}]`,
          direction,
          channel: 'telegram',
          is_internal: false,
          is_read: direction === 'out',
          message_type: messageType,
          media_url: mediaInfo?.media_url || null,
          media_type: mediaInfo?.media_type || null,
          created_at: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') skipped++;
        else console.error('Insert error:', error.message);
      } else {
        synced++;
      }
    }
  } catch (err) {
    console.error('Backfill error:', (err as Error).message);
  }

  return { synced, skipped };
}

// Extract user online status from entity
function getUserOnlineStatus(entity: any): { is_online: boolean; last_seen: string | null } {
  try {
    const status = entity?.status;
    if (!status) return { is_online: false, last_seen: null };

    const className = status.className || '';
    if (className === 'UserStatusOnline') {
      return { is_online: true, last_seen: null };
    }
    if (className === 'UserStatusOffline' && status.wasOnline) {
      return { is_online: false, last_seen: new Date(status.wasOnline * 1000).toISOString() };
    }
    if (className === 'UserStatusRecently') {
      return { is_online: false, last_seen: 'recently' };
    }
    return { is_online: false, last_seen: null };
  } catch {
    return { is_online: false, last_seen: null };
  }
}

// Efficient polling: use getDialogs to find recent incoming messages
async function pollNewMessages(
  client: InstanceType<typeof TelegramClient>,
  supabase: any,
  userId: string,
): Promise<{ synced: number; clients_checked: number; read_updated: number; online_statuses: Record<string, { is_online: boolean; last_seen: string | null }> }> {
  let totalSynced = 0;
  let clientsChecked = 0;
  const onlineStatuses: Record<string, { is_online: boolean; last_seen: string | null }> = {};

  try {
    // Get recent TG dialogs (up to 20) — much faster than iterating all clients
    const dialogs = await client.getDialogs({ limit: 20 });

    // Build a map of phone→clientId from our DB
    const { data: knownClients } = await supabase
      .from('clients')
      .select('id, phone, telegram_id')
      .not('phone', 'is', null);

    const phoneToClient = new Map<string, { id: string; telegram_id: string | null }>();
    const tgIdToClient = new Map<string, { id: string; phone: string }>();
    for (const c of (knownClients || [])) {
      const cleanPhone = sanitizePhone(c.phone);
      phoneToClient.set(cleanPhone, { id: c.id, telegram_id: c.telegram_id });
      if (c.telegram_id) {
        tgIdToClient.set(c.telegram_id, { id: c.id, phone: c.phone });
      }
    }

    for (const dialog of dialogs) {
      const entity = dialog.entity as any;
      if (!entity || !entity.id) continue;

      // Match dialog to our client
      const tgId = String(entity.id);
      let clientMatch = tgIdToClient.get(tgId);

      if (!clientMatch && entity.phone) {
        const cleanPhone = sanitizePhone(entity.phone);
        const found = phoneToClient.get(cleanPhone);
        if (found) {
          clientMatch = { id: found.id, phone: entity.phone };
          // Cache telegram_id
          if (!found.telegram_id) {
            await supabase.from('clients').update({ telegram_id: tgId }).eq('id', found.id);
          }
        }
      }

      if (!clientMatch) continue;

      clientsChecked++;

      // Extract online status for this client
      onlineStatuses[clientMatch.id] = getUserOnlineStatus(entity);

      // Only fetch last 5 messages per dialog for speed
      try {
        const messages = await client.getMessages(entity, { limit: 5 });
        for (const msg of messages) {
          if (!msg.id) continue;
          const externalId = `tg_${msg.id}`;
          const direction: 'in' | 'out' = msg.out ? 'out' : 'in';
          const messageType = getMessageType(msg);
          const content = getMessageText(msg);
          if (!content && messageType === 'text') continue;

          let mediaInfo: { media_url: string; media_type: string } | null = null;
          if (messageType !== 'text' && direction === 'in') {
            mediaInfo = await downloadAndUploadMedia(client, msg, supabase);
          }

          const { error } = await supabase
            .from('messages')
            .insert({
              client_id: clientMatch.id,
              user_id: userId,
              external_message_id: externalId,
              content: content || `[${messageType}]`,
              direction,
              channel: 'telegram',
              is_internal: false,
              is_read: direction === 'out',
              message_type: messageType,
              media_url: mediaInfo?.media_url || null,
              media_type: mediaInfo?.media_type || null,
              created_at: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            if (error.code !== '23505') console.error('Poll insert error:', error.message);
          } else {
            totalSynced++;
          }
        }
      } catch (err) {
        console.error(`Poll messages for ${tgId}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.error('Poll error:', (err as Error).message);
  }

  // Check read statuses
  const readUpdated = await checkReadStatuses(client, supabase, userId);

  return { synced: totalSynced, clients_checked: clientsChecked, read_updated: readUpdated, online_statuses: onlineStatuses };
}

// Lightweight read status check using getDialogs
async function checkReadStatuses(
  client: InstanceType<typeof TelegramClient>,
  supabase: any,
  userId: string,
): Promise<number> {
  let totalUpdated = 0;
  try {
    // Get outgoing messages with status 'sent' (not yet read)
    const { data: pendingMessages } = await supabase
      .from('messages')
      .select('id, external_message_id, client_id')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .eq('direction', 'out')
      .eq('delivery_status', 'sent')
      .not('external_message_id', 'is', null)
      .limit(100);

    if (!pendingMessages || pendingMessages.length === 0) return 0;

    // Get telegram_ids for these clients
    const clientIds = [...new Set(pendingMessages.map((m: any) => m.client_id))];
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, telegram_id')
      .in('id', clientIds);

    const clientTgId = new Map<string, string>();
    for (const c of (clientsData || [])) {
      if (c.telegram_id) clientTgId.set(c.id, c.telegram_id);
    }

    // Group by client
    const msgByClient = new Map<string, any[]>();
    for (const m of pendingMessages) {
      const tgId = clientTgId.get(m.client_id);
      if (!tgId) continue;
      if (!msgByClient.has(tgId)) msgByClient.set(tgId, []);
      msgByClient.get(tgId)!.push(m);
    }

    for (const [tgId, msgs] of msgByClient) {
      try {
        const entity = await client.getEntity(BigInt(tgId));
        const dialogs = await client.invoke(
          new Api.messages.GetPeerDialogs({
            peers: [new Api.InputDialogPeer({ peer: await client.getInputEntity(entity) })],
          })
        );

        if (dialogs.dialogs && dialogs.dialogs.length > 0) {
          const dialog = dialogs.dialogs[0] as any;
          const readOutboxMaxId = dialog.readOutboxMaxId || 0;

          for (const m of msgs) {
            const numericId = parseInt(m.external_message_id.replace('tg_', ''));
            if (!isNaN(numericId) && numericId <= readOutboxMaxId) {
              await supabase
                .from('messages')
                .update({ delivery_status: 'read' })
                .eq('id', m.id);
              totalUpdated++;
            }
          }
        }
      } catch (peerErr) {
        console.error(`Read check for ${tgId}:`, (peerErr as Error).message);
      }
    }

    // Also check notification_logs
    const { data: pendingLogs } = await supabase
      .from('notification_logs')
      .select('id, external_message_id, external_peer_id')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .eq('status', 'sent')
      .not('external_message_id', 'is', null)
      .not('external_peer_id', 'is', null)
      .is('read_at', null)
      .limit(50);

    if (pendingLogs && pendingLogs.length > 0) {
      const peerGroups = new Map<string, typeof pendingLogs>();
      for (const log of pendingLogs) {
        const peerId = log.external_peer_id!;
        if (!peerGroups.has(peerId)) peerGroups.set(peerId, []);
        peerGroups.get(peerId)!.push(log);
      }

      for (const [peerId, logs] of peerGroups) {
        try {
          const entity = await client.getEntity(BigInt(peerId));
          const dialogs = await client.invoke(
            new Api.messages.GetPeerDialogs({
              peers: [new Api.InputDialogPeer({ peer: await client.getInputEntity(entity) })],
            })
          );

          if (dialogs.dialogs && dialogs.dialogs.length > 0) {
            const dialog = dialogs.dialogs[0] as any;
            const readOutboxMaxId = dialog.readOutboxMaxId || 0;
            for (const log of logs) {
              const msgId = parseInt(log.external_message_id!);
              if (msgId <= readOutboxMaxId) {
                await supabase
                  .from('notification_logs')
                  .update({ status: 'read', read_at: new Date().toISOString() })
                  .eq('id', log.id);
                totalUpdated++;
              }
            }
          }
        } catch (peerErr) {
          console.error(`Read-status peer ${peerId}:`, (peerErr as Error).message);
        }
      }
    }
  } catch (err) {
    console.error('checkReadStatuses error:', (err as Error).message);
  }
  return totalUpdated;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SyncRequest = await req.json();
    const { action, api_id, api_hash, session_string, user_id } = body;

    if (!api_id || !api_hash || !session_string || !user_id) {
      return new Response(
        JSON.stringify({ error: 'api_id, api_hash, session_string, user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const apiId = parseInt(api_id);
    const client = await createTgClient(apiId, api_hash, session_string);

    let result: any;

    if (action === 'backfill') {
      if (!body.client_phone || !body.client_id) {
        await client.disconnect();
        return new Response(
          JSON.stringify({ error: 'client_phone and client_id required for backfill' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const phone = sanitizePhone(body.client_phone);
      const limit = body.limit || 50;
      result = await backfillChat(client, supabase, phone, body.client_id, user_id, limit);
      result.action = 'backfill';

    } else if (action === 'poll') {
      result = await pollNewMessages(client, supabase, user_id);
      result.action = 'poll';

    } else if (action === 'check_read') {
      const readUpdated = await checkReadStatuses(client, supabase, user_id);
      result = { action: 'check_read', read_updated: readUpdated };

    } else {
      await client.disconnect();
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: backfill, poll, check_read' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await client.disconnect();

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('telegram-sync error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
