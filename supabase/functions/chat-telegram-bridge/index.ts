import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('CHAT_TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { room_id, sender_id, message, sender_name } = await req.json();

    if (!room_id || !sender_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all participants in the room except the sender
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('room_id', room_id)
      .neq('user_id', sender_id);

    if (!participants?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientIds = participants.map(p => p.user_id);

    // Get profiles with telegram_chat_id for offline users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, telegram_chat_id, last_seen_at, full_name')
      .in('user_id', recipientIds);

    let sentCount = 0;
    const now = new Date();

    for (const profile of profiles || []) {
      // Only send to offline users with linked Telegram
      if (!profile.telegram_chat_id) continue;

      const lastSeen = profile.last_seen_at ? new Date(profile.last_seen_at) : null;
      const isOffline = !lastSeen || (now.getTime() - lastSeen.getTime()) > 3 * 60 * 1000;

      if (!isOffline) continue;

      // Send Telegram message
      const text = `💬 *${sender_name || 'Коллега'}:*\n${message}`;
      const tgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const res = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: profile.telegram_chat_id,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (res.ok) {
        sentCount++;
      } else {
        const errBody = await res.text();
        console.error(`Failed to send to ${profile.user_id}:`, errBody);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('chat-telegram-bridge error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
