import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";
import { Api, TelegramClient } from "npm:telegram@2.24.11";
import { StringSession } from "npm:telegram@2.24.11/sessions/index.js";
import bigInt from "npm:big-integer@1.6.52";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all users with active telegram settings
    const { data: settings } = await supabase
      .from("messenger_settings")
      .select("user_id, config")
      .eq("channel", "telegram")
      .eq("is_active", true);

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active Telegram configs", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpdated = 0;

    for (const setting of settings) {
      const cfg = setting.config as Record<string, unknown>;
      if (cfg.connection_type !== "user_api" || !cfg.session_string || !cfg.api_id || !cfg.api_hash) {
        continue;
      }

      // Get unread sent messages for this user
      const { data: pendingLogs } = await supabase
        .from("notification_logs")
        .select("id, external_message_id, external_peer_id")
        .eq("user_id", setting.user_id)
        .eq("channel", "telegram")
        .eq("status", "sent")
        .not("external_message_id", "is", null)
        .not("external_peer_id", "is", null)
        .is("read_at", null);

      if (!pendingLogs || pendingLogs.length === 0) continue;

      // Connect to Telegram
      const apiId = parseInt(cfg.api_id as string);
      const session = new StringSession(cfg.session_string as string);
      const client = new TelegramClient(session, apiId, cfg.api_hash as string, {
        connectionRetries: 3,
      });

      try {
        await client.connect();

        // Group by peer to minimize API calls
        const peerGroups = new Map<string, typeof pendingLogs>();
        for (const log of pendingLogs) {
          const peerId = log.external_peer_id!;
          if (!peerGroups.has(peerId)) peerGroups.set(peerId, []);
          peerGroups.get(peerId)!.push(log);
        }

        for (const [peerId, logs] of peerGroups) {
          try {
            // Get dialog with this peer to check read_outbox_max_id
            const inputPeer = new Api.InputPeerUser({
              userId: bigInt(peerId),
              accessHash: bigInt(0), // Will be resolved
            });

            // Use getEntity to resolve properly
            const entity = await client.getEntity(bigInt(peerId));

            // Get full dialog info
            const dialogs = await client.invoke(
              new Api.messages.GetPeerDialogs({
                peers: [new Api.InputDialogPeer({ peer: await client.getInputEntity(entity) })],
              })
            );

            if (dialogs.dialogs && dialogs.dialogs.length > 0) {
              const dialog = dialogs.dialogs[0] as any;
              const readOutboxMaxId = dialog.readOutboxMaxId || 0;

              // Check each message
              for (const log of logs) {
                const msgId = parseInt(log.external_message_id!);
                if (msgId <= readOutboxMaxId) {
                  // Message was read
                  await supabase
                    .from("notification_logs")
                    .update({ status: "read", read_at: new Date().toISOString() })
                    .eq("id", log.id);
                  totalUpdated++;
                }
              }
            }
          } catch (peerErr) {
            console.error(`Error checking peer ${peerId}:`, (peerErr as Error).message);
          }
        }

        await client.disconnect();
      } catch (clientErr) {
        console.error(`Telegram client error for user ${setting.user_id}:`, (clientErr as Error).message);
      }
    }

    return new Response(
      JSON.stringify({ message: "Read status checked", updated: totalUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
