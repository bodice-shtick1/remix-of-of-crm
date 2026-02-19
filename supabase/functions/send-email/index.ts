import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { account_id, to, subject, html, cc, bcc, attachments } = await req.json();

    // Fetch account credentials
    const { data: account, error: accError } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accError || !account) {
      return new Response(JSON.stringify({ success: false, error: "Account not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtpHost = account.smtp_host;
    const smtpPort = account.smtp_port;
    const username = account.username;
    const password = account.password_encrypted;
    const fromEmail = account.email_address;
    const displayName = account.display_name || fromEmail;

    // BCC trick: add sender's own email to BCC so it appears in Yandex Sent
    const allBcc = [bcc, fromEmail].filter(Boolean).join(", ");

    let conn: Deno.Conn;
    if (smtpPort === 465) {
      conn = await Deno.connectTls({ hostname: smtpHost, port: smtpPort });
    } else {
      conn = await Deno.connect({ hostname: smtpHost, port: smtpPort });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    }

    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await readResponse();
    }

    // SMTP conversation
    await readResponse(); // greeting

    await sendCommand(`EHLO localhost`);

    // STARTTLS for port 587
    const useTls = account.use_ssl || smtpPort === 465;
    if (smtpPort === 587 && useTls) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: smtpHost });
      await sendCommand("EHLO localhost");
    }

    // AUTH LOGIN
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(username));
    const authResp = await sendCommand(btoa(password));
    if (!authResp.startsWith("235")) {
      conn.close();
      return new Response(JSON.stringify({ success: false, error: "SMTP auth failed: " + authResp.trim() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendCommand(`MAIL FROM:<${fromEmail}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    if (cc) {
      for (const addr of cc.split(",").map((s: string) => s.trim()).filter(Boolean)) {
        await sendCommand(`RCPT TO:<${addr}>`);
      }
    }
    // Add BCC recipients
    if (allBcc) {
      for (const addr of allBcc.split(",").map((s: string) => s.trim()).filter(Boolean)) {
        await sendCommand(`RCPT TO:<${addr}>`);
      }
    }

    await sendCommand("DATA");

    // Smart link: find matching client by email
    let clientId: string | null = null;
    const { data: matchClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", to)
      .limit(1)
      .maybeSingle();
    if (matchClient) clientId = matchClient.id;

    // Pre-save to DB to get the email ID for tracking pixel
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: savedEmail } = await serviceClient.from("emails").insert({
      from_email: fromEmail,
      to_email: to,
      subject,
      body_html: html,
      direction: "outbound",
      folder: "sent",
      is_read: true,
      user_id: userId,
      email_account_id: account_id,
      client_id: clientId,
      company_id: null,
      cc: cc || null,
      bcc: bcc || null,
      attachments: attachments || [],
    }).select("id").single();

    // Build HTML with tracking pixel
    let finalHtml = html;
    if (savedEmail?.id) {
      const trackingUrl = `${supabaseUrl}/functions/v1/email-track?id=${savedEmail.id}`;
      const pixelTag = `<img src="${trackingUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
      finalHtml = html + pixelTag;
      // Update saved email with pixel-injected body
      await serviceClient.from("emails").update({ body_html: finalHtml } as any).eq("id", savedEmail.id);
    }

    // Build message headers (BCC not included in headers, only in envelope)
    const headers = [
      `From: "${displayName}" <${fromEmail}>`,
      `To: ${to}`,
      cc ? `Cc: ${cc}` : null,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      `Date: ${new Date().toUTCString()}`,
    ].filter(Boolean).join("\r\n");

    const bodyB64 = btoa(unescape(encodeURIComponent(finalHtml)));
    const message = headers + "\r\n\r\n" + bodyB64 + "\r\n.\r\n";
    await sendCommand(message);

    await sendCommand("QUIT");
    conn.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
