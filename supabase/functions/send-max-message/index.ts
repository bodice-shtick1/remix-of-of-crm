import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_API_BASE = 'https://platform-api.max.ru';

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

interface SendRequest {
  bot_token: string;
  chat_id?: string;
  user_id?: string;
  phone?: string;
  message: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  client_id?: string;
}

async function maxApiFetch(token: string, path: string, options?: RequestInit) {
  const url = `${MAX_API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Authorization': token,
    ...(options?.headers as Record<string, string> || {}),
  };
  
  const response = await fetch(url, { ...options, headers });
  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SendRequest = await req.json();
    const { bot_token, message, media_url, media_type, file_name, client_id } = body;
    let chatId = body.chat_id || body.user_id;

    if (!bot_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'bot_token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!chatId && !body.phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'chat_id, user_id or phone is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message && !media_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'message or media_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have phone but no chat_id, try to look up from DB
    if (!chatId && body.phone && client_id) {
      const sb = getSupabaseAdmin();
      // Check if we have a MAX user_id stored for this client from previous conversations
      const { data: msgs } = await sb
        .from('messages')
        .select('external_message_id')
        .eq('client_id', client_id)
        .eq('channel', 'max')
        .eq('direction', 'in')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // We can't send to a phone number in MAX Bot API - only to known chat_ids
      if (!msgs || msgs.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Клиент ещё не писал боту MAX. Отправка невозможна без предварительного диалога.', error_code: 'NO_CHAT' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send text message
    let sentMessage: any = null;

    if (media_url && media_type) {
      // Upload media first, then send
      // For MAX Bot API, we send with attachment
      const mediaResponse = await fetch(media_url);
      if (!mediaResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to download media file' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const mediaBuffer = await mediaResponse.arrayBuffer();
      const boundary = 'boundary' + Date.now();
      
      // Upload the file first
      const uploadForm = new FormData();
      const blob = new Blob([mediaBuffer], { type: 'application/octet-stream' });
      uploadForm.append('data', blob, file_name || 'file');
      uploadForm.append('type', media_type === 'photo' ? 'photo' : 'file');

      const uploadResp = await fetch(`${MAX_API_BASE}/uploads`, {
        method: 'POST',
        headers: { 'Authorization': bot_token },
        body: uploadForm,
      });

      if (uploadResp.ok) {
        const uploadData = await uploadResp.json();
        // Send message with attachment
        const msgBody: any = {
          text: message || '',
          attachments: [uploadData],
        };

        const sendResp = await maxApiFetch(bot_token, `/messages?chat_id=${chatId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgBody),
        });

        if (sendResp.ok) {
          sentMessage = await sendResp.json();
        } else {
          const errText = await sendResp.text();
          return new Response(
            JSON.stringify({ success: false, error: `MAX API error: ${sendResp.status} ${errText}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Fallback: send text only
        const sendResp = await maxApiFetch(bot_token, `/messages?chat_id=${chatId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message || `[${media_type}] ${file_name || ''}` }),
        });
        if (sendResp.ok) sentMessage = await sendResp.json();
      }
    } else {
      // Text-only message
      const sendResp = await maxApiFetch(bot_token, `/messages?chat_id=${chatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (!sendResp.ok) {
        const errText = await sendResp.text();
        console.error('MAX send error:', sendResp.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `MAX API error: ${sendResp.status}`, error_code: 'API_ERROR' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sentMessage = await sendResp.json();
    }

    // Auto-unarchive client
    if (client_id) {
      const sb = getSupabaseAdmin();
      sb.from('clients').update({ is_archived: false, archive_reason: null }).eq('id', client_id).eq('is_archived', true).then(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: sentMessage?.message?.body?.mid || sentMessage?.message?.mid || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-max-message error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
