import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/**
 * MAX Bot API Webhook handler.
 * MAX sends updates to this endpoint when users send messages to the bot.
 * 
 * Expected update format (from MAX Bot API):
 * {
 *   "update_type": "message_created",
 *   "timestamp": 1234567890,
 *   "message": {
 *     "sender": { "user_id": 123, "name": "John" },
 *     "recipient": { "chat_id": 456 },
 *     "body": { "mid": "msg_id", "text": "Hello", "attachments": [...] },
 *     "timestamp": 1234567890
 *   }
 * }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request = webhook verification
  if (req.method === 'GET') {
    return new Response('OK', { status: 200, headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log('MAX webhook received:', JSON.stringify(update).slice(0, 500));

    const updateType = update.update_type;
    
    if (updateType !== 'message_created' && updateType !== 'message_callback') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = update.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderId = message.sender?.user_id?.toString();
    const senderName = message.sender?.name || '';
    const chatId = message.recipient?.chat_id?.toString() || message.chat_id?.toString();
    const text = message.body?.text || '';
    const mid = message.body?.mid || '';
    const attachments = message.body?.attachments || [];
    const timestamp = message.timestamp ? new Date(message.timestamp * 1000).toISOString() : new Date().toISOString();

    if (!senderId || !chatId) {
      console.warn('MAX webhook: missing sender or chat id');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = getSupabaseAdmin();

    // Find the messenger_settings for MAX to get the user_id (agent)
    const { data: maxSettings } = await sb
      .from('messenger_settings')
      .select('user_id')
      .eq('channel', 'max')
      .eq('is_active', true)
      .limit(1);

    if (!maxSettings || maxSettings.length === 0) {
      console.warn('MAX webhook: no active MAX settings found');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agentUserId = maxSettings[0].user_id;

    // Find or create client by MAX user_id
    // First check if we have a client with this MAX chat in messages
    const { data: existingMsg } = await sb
      .from('messages')
      .select('client_id')
      .eq('channel', 'max')
      .or(`external_message_id.eq.max_user_${senderId}`)
      .limit(1);

    let clientId: string | null = existingMsg?.[0]?.client_id || null;

    if (!clientId) {
      // Try to find by looking at previous messages from this sender
      const { data: prevMsgs } = await sb
        .from('messages')
        .select('client_id')
        .eq('channel', 'max')
        .eq('direction', 'in')
        .ilike('external_message_id', `max_${senderId}_%`)
        .limit(1);

      clientId = prevMsgs?.[0]?.client_id || null;
    }

    if (!clientId) {
      // Create a new client from MAX user
      const nameParts = senderName.split(' ');
      const firstName = nameParts[0] || 'MAX User';
      const lastName = nameParts.slice(1).join(' ') || senderId;

      const { data: newClient, error: clientErr } = await sb
        .from('clients')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          phone: `max_${senderId}`,
          agent_id: agentUserId,
        }])
        .select('id')
        .single();

      if (clientErr) {
        console.error('MAX webhook: failed to create client:', clientErr.message);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      clientId = newClient.id;
    }

    // Determine message type and media
    let messageType = 'text';
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (attachments.length > 0) {
      const att = attachments[0];
      if (att.type === 'image') {
        messageType = 'photo';
        mediaUrl = att.payload?.url || att.url || null;
        mediaType = 'image/jpeg';
      } else if (att.type === 'video') {
        messageType = 'video';
        mediaUrl = att.payload?.url || att.url || null;
        mediaType = 'video/mp4';
      } else if (att.type === 'file') {
        messageType = 'document';
        mediaUrl = att.payload?.url || att.url || null;
        mediaType = att.payload?.mime_type || 'application/octet-stream';
      } else if (att.type === 'audio') {
        messageType = 'audio';
        mediaUrl = att.payload?.url || att.url || null;
        mediaType = 'audio/mpeg';
      }
    }

    // Check for duplicate
    const { data: duplicate } = await sb
      .from('messages')
      .select('id')
      .eq('external_message_id', `max_${mid}`)
      .limit(1);

    if (duplicate && duplicate.length > 0) {
      console.log('MAX webhook: duplicate message, skipping');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert message
    const { error: msgErr } = await sb.from('messages').insert([{
      client_id: clientId,
      user_id: agentUserId,
      content: text || (messageType !== 'text' ? `[${messageType}]` : ''),
      direction: 'in',
      channel: 'max',
      is_internal: false,
      is_read: false,
      is_automated: false,
      message_type: messageType,
      media_url: mediaUrl,
      media_type: mediaType,
      external_message_id: `max_${mid}`,
      delivery_status: 'sent',
      created_at: timestamp,
    }]);

    if (msgErr) {
      console.error('MAX webhook: message insert error:', msgErr.message);
    }

    // Auto-unarchive
    await sb.from('clients')
      .update({ is_archived: false, archive_reason: null })
      .eq('id', clientId)
      .eq('is_archived', true);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('MAX webhook error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
