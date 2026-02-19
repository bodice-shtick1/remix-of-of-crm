import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BODY_BYTES = 5 * 1024 * 1024;

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

    const { account_id, full_sync, silent } = await req.json();

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

    const imapHost = account.imap_host;
    const imapPort = account.imap_port;
    const username = account.username;
    const password = account.password_encrypted;

    console.log(`Connecting to IMAP: ${imapHost}:${imapPort} as ${username}`);

    const conn = await connectWithTimeout(imapHost, imapPort, 20000);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let tagCounter = 1;
    let responseBuffer = "";

    async function readMore(timeoutMs = 10000): Promise<string> {
      const buf = new Uint8Array(65536);
      const timeoutId = setTimeout(() => {
        try { conn.close(); } catch { /* ignore */ }
      }, timeoutMs);
      try {
        const n = await conn.read(buf);
        clearTimeout(timeoutId);
        if (!n) return "";
        return decoder.decode(buf.subarray(0, n));
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    }

    async function readUntilTag(tag: string, timeoutMs = 10000): Promise<string> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (responseBuffer.includes(`${tag} OK`) ||
            responseBuffer.includes(`${tag} NO`) ||
            responseBuffer.includes(`${tag} BAD`)) {
          const result = responseBuffer;
          responseBuffer = "";
          return result;
        }
        const chunk = await readMore(deadline - Date.now());
        if (!chunk) break;
        responseBuffer += chunk;
      }
      const result = responseBuffer;
      responseBuffer = "";
      return result;
    }

    async function sendCommand(cmd: string, timeoutMs = 10000): Promise<string> {
      const tag = `A${tagCounter++}`;
      const fullCmd = `${tag} ${cmd}\r\n`;
      await conn.write(encoder.encode(fullCmd));
      const resp = await readUntilTag(tag, timeoutMs);
      return resp;
    }

    // Read server greeting
    const greeting = await readMore(10000);
    console.log("IMAP greeting received:", greeting.substring(0, 100));

    if (!greeting.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ success: false, error: "IMAP server did not send OK greeting" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const capResp = await sendCommand("CAPABILITY", 10000);
    console.log("Server capabilities:", capResp.substring(0, 300));

    // Try AUTHENTICATE PLAIN first, fallback to LOGIN
    let loginSuccess = false;
    let loginResp = "";
    let loginTag = "";

    const plainAuth = btoa(`\0${username}\0${password}`);
    loginTag = `A${tagCounter}`;
    const authCmd = `${loginTag} AUTHENTICATE PLAIN ${plainAuth}\r\n`;
    await conn.write(encoder.encode(authCmd));
    tagCounter++;
    loginResp = await readUntilTag(loginTag, 15000);
    console.log("AUTHENTICATE PLAIN response:", loginResp.substring(0, 200));

    if (loginResp.includes(`${loginTag} OK`)) {
      loginSuccess = true;
    } else {
      console.log("AUTHENTICATE PLAIN failed, trying LOGIN...");
      loginResp = await sendCommand(`LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`, 10000);
      loginTag = `A${tagCounter - 1}`;
      console.log("LOGIN response:", loginResp.substring(0, 200));
      if (loginResp.includes(`${loginTag} OK`)) {
        loginSuccess = true;
      }
    }

    if (!loginSuccess) {
      const errorMsg = extractImapError(loginResp);
      conn.close();
      return new Response(JSON.stringify({
        success: false,
        error: `IMAP auth failed: ${errorMsg}`,
        debug: {
          raw_response: loginResp.substring(0, 500),
          username_used: username,
          host: imapHost,
          capabilities: capResp.substring(0, 300),
        }
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Login successful");

    // List all folders for debugging
    const listResp = await sendCommand('LIST "" "*"', 10000);
    console.log("Available folders:", listResp.substring(0, 1000));

    // Determine folders to sync
    const foldersToSync = detectFolders(listResp);
    console.log("Folders to sync:", JSON.stringify(foldersToSync));

    // Prepare service client and client email map
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existingUids } = await supabase
      .from("emails")
      .select("external_uid")
      .eq("email_account_id", account_id)
      .not("external_uid", "is", null);
    const existingSet = new Set((existingUids || []).map((e: any) => e.external_uid));

    const { data: allClients } = await serviceClient
      .from("clients")
      .select("id, email")
      .not("email", "is", null);
    const clientByEmail = new Map<string, string>();
    (allClients || []).forEach((c: any) => {
      if (c.email) clientByEmail.set(c.email.toLowerCase(), c.id);
    });

    let totalFetched = 0;
    const totalCounts: Record<string, number> = {};

    for (const folderInfo of foldersToSync) {
      const { imapName, direction, dbFolder } = folderInfo;

      const selectResp = await sendCommand(`SELECT "${escapeImapString(imapName)}"`, 10000);
      console.log(`SELECT ${imapName} response:`, selectResp.substring(0, 200));

      if (selectResp.includes("NO") || selectResp.includes("BAD")) {
        console.log(`Skipping folder ${imapName}: cannot open`);
        continue;
      }

      const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
      const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;
      totalCounts[imapName] = totalMessages;
      console.log(`Total messages in ${imapName}: ${totalMessages}`);

      if (totalMessages === 0) continue;

      // Determine how far back to fetch
      // If full_sync or no existing emails for this account+folder, go 90 days; otherwise 30 days
      const { count: existingCount } = await serviceClient
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("email_account_id", account_id)
        .eq("folder", dbFolder);

      const daysBack = (full_sync || (existingCount ?? 0) === 0) ? 90 : 30;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      const sinceStr = formatImapDate(since);

      const searchResp = await sendCommand(`SEARCH SINCE ${sinceStr}`, 15000);
      console.log(`SEARCH SINCE ${sinceStr} in ${imapName}:`, searchResp.substring(0, 300));

      const searchMatch = searchResp.match(/\* SEARCH([\d\s]*)/);
      const msgNums = searchMatch?.[1]?.trim().split(/\s+/).filter(Boolean).map(Number) || [];
      console.log(`Found ${msgNums.length} messages since ${sinceStr} in ${imapName}`);

      if (msgNums.length === 0) continue;

      // Fetch in batches of 50
      const batchSize = 50;
      for (let i = 0; i < msgNums.length; i += batchSize) {
        const batch = msgNums.slice(i, i + batchSize);
        const rangeStr = batch.join(",");

        const fetchResp = await sendCommand(
          `FETCH ${rangeStr} (UID RFC822.SIZE RFC822.HEADER)`,
          30000
        );

        const messages = parseImapMessages(fetchResp, account.email_address);
        console.log(`Parsed ${messages.length} message headers from ${imapName} batch ${i}`);

        const newEmails = messages
          .filter(m => m.uid && !existingSet.has(`${imapName}:${m.uid}`))
          .filter(m => !m.size || m.size <= MAX_BODY_BYTES)
          .map(m => {
            const fromLower = m.from.toLowerCase();
            const toLower = m.to.toLowerCase();
            const clientId = clientByEmail.get(fromLower) || clientByEmail.get(toLower) || null;

            return {
              from_email: m.from,
              to_email: m.to,
              subject: m.subject,
              body_html: null,
              direction,
              folder: dbFolder,
              is_read: direction === "outbound",
              user_id: userId,
              email_account_id: account_id,
              external_uid: `${imapName}:${m.uid}`,
              client_id: clientId,
              company_id: null,
              created_at: m.date || new Date().toISOString(),
            };
          });

        if (newEmails.length > 0) {
          const { error: insertError } = await serviceClient.from("emails").insert(newEmails);
          if (insertError) {
            console.error(`Insert error (${imapName}):`, insertError.message);
          } else {
            totalFetched += newEmails.length;
            newEmails.forEach(e => existingSet.add(e.external_uid));
            console.log(`Inserted ${newEmails.length} new emails from ${imapName}`);
          }
        }
      }
    }

    // Update last_sync_at
    await serviceClient
      .from("email_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", account_id);

    // Logout gracefully
    await sendCommand("LOGOUT", 5000).catch(() => {});
    try { conn.close(); } catch { /* ignore */ }

    return new Response(JSON.stringify({
      success: true,
      fetched: totalFetched,
      folders: totalCounts,
      synced_folders: foldersToSync.map(f => f.imapName),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-sync error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Helper functions ---

interface FolderInfo {
  imapName: string;
  direction: "inbound" | "outbound";
  dbFolder: string;
}

function detectFolders(listResponse: string): FolderInfo[] {
  const folders: FolderInfo[] = [];
  const lines = listResponse.split("\r\n").filter(l => l.startsWith("* LIST"));

  const folderNames: string[] = [];
  for (const line of lines) {
    // Parse: * LIST (\flags) "delimiter" "name" or * LIST (\flags) "delimiter" name
    const match = line.match(/\* LIST \([^)]*\) "[^"]*" "?([^"\r\n]+)"?/);
    if (match) folderNames.push(match[1]);
  }

  console.log("Detected folder names:", folderNames.join(", "));

  // Always add INBOX
  folders.push({ imapName: "INBOX", direction: "inbound", dbFolder: "inbox" });

  // Detect sent folder (Yandex uses "Sent" or "Отправленные")
  const sentCandidates = ["Sent", "SENT", "Sent Items", "Sent Messages", "Отправленные", "&BB4EQgQ,BEAEMAQyBDsENQQ9BD0ESwQ1-"];
  for (const candidate of sentCandidates) {
    if (folderNames.some(f => f === candidate || f.toLowerCase() === candidate.toLowerCase())) {
      const actualName = folderNames.find(f => f === candidate || f.toLowerCase() === candidate.toLowerCase())!;
      folders.push({ imapName: actualName, direction: "outbound", dbFolder: "sent" });
      break;
    }
  }

  return folders;
}

function formatImapDate(date: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

async function connectWithTimeout(hostname: string, port: number, timeoutMs: number): Promise<Deno.TlsConn> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const conn = await Deno.connectTls({ hostname, port, alpnProtocols: [] });
    clearTimeout(timeoutId);
    return conn;
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error(`Connection to ${hostname}:${port} failed: ${e.message}`);
  }
}

function escapeImapString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function extractImapError(response: string): string {
  const match = response.match(/A\d+ (?:NO|BAD)\s+(.+?)(?:\r?\n|$)/);
  return match?.[1]?.trim() || "Unknown error";
}

interface ParsedMessage {
  uid: string | null;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  size: number | null;
}

function parseImapMessages(response: string, accountEmail: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const parts = response.split(/\* \d+ FETCH/);

  for (const part of parts) {
    if (!part.trim()) continue;

    const uidMatch = part.match(/UID (\d+)/);
    const sizeMatch = part.match(/RFC822\.SIZE (\d+)/);

    // Extract the RFC822.HEADER block
    const headerBlock = extractHeaderBlock(part);
    if (!headerBlock) continue;

    // Parse individual headers by unfolding continuation lines first
    const unfolded = headerBlock.replace(/\r?\n([ \t]+)/g, " ");
    const headers = new Map<string, string>();
    for (const line of unfolded.split(/\r?\n/)) {
      const hMatch = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)/);
      if (hMatch) {
        headers.set(hMatch[1].toLowerCase(), hMatch[2]);
      }
    }

    const fromRaw = headers.get("from") || "";
    const toRaw = headers.get("to") || "";
    const subjectRaw = headers.get("subject") || "";
    const dateRaw = headers.get("date") || "";

    const fromEmail = extractEmailAddress(decodeMimeWords(fromRaw)) || accountEmail;
    const toEmail = extractEmailAddress(decodeMimeWords(toRaw)) || accountEmail;
    const subject = decodeMimeWords(subjectRaw);

    if (fromEmail || toEmail) {
      messages.push({
        uid: uidMatch?.[1] || null,
        from: fromEmail,
        to: toEmail,
        subject,
        date: dateRaw ? safeParseDate(dateRaw.trim()) : null,
        size: sizeMatch ? parseInt(sizeMatch[1]) : null,
      });
    }
  }

  return messages;
}

/** Extract RFC822.HEADER content from a FETCH response part */
function extractHeaderBlock(part: string): string | null {
  const idx = part.indexOf("RFC822.HEADER");
  if (idx === -1) return null;
  const braceStart = part.indexOf("{", idx);
  if (braceStart === -1) return null;
  const newlineAfterBrace = part.indexOf("\n", braceStart);
  if (newlineAfterBrace === -1) return null;
  return part.substring(newlineAfterBrace + 1);
}

/** Extract bare email address from a header value */
function extractEmailAddress(value: string): string {
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim();
  const bareMatch = value.match(/([^\s,;]+@[^\s,;]+)/);
  if (bareMatch) return bareMatch[1].trim();
  return value.trim();
}

// ========== MIME / Charset Decoding ==========

// Windows-1251 single-byte to Unicode mapping (128..255)
const WIN1251_MAP: Record<number, number> = {
  0x80:0x0410,0x81:0x0411,0x82:0x0412,0x83:0x0413,0x84:0x0414,0x85:0x0415,0x86:0x0416,0x87:0x0417,
  0x88:0x0418,0x89:0x0419,0x8A:0x041A,0x8B:0x041B,0x8C:0x041C,0x8D:0x041D,0x8E:0x041E,0x8F:0x041F,
  0x90:0x0420,0x91:0x0421,0x92:0x0422,0x93:0x0423,0x94:0x0424,0x95:0x0425,0x96:0x0426,0x97:0x0427,
  0x98:0x0428,0x99:0x0429,0x9A:0x042A,0x9B:0x042B,0x9C:0x042C,0x9D:0x042D,0x9E:0x042E,0x9F:0x042F,
  0xA0:0x0430,0xA1:0x0431,0xA2:0x0432,0xA3:0x0433,0xA4:0x0434,0xA5:0x0435,0xA6:0x0436,0xA7:0x0437,
  0xA8:0x0438,0xA9:0x0439,0xAA:0x043A,0xAB:0x043B,0xAC:0x043C,0xAD:0x043D,0xAE:0x043E,0xAF:0x043F,
  0xB0:0x0440,0xB1:0x0441,0xB2:0x0442,0xB3:0x0443,0xB4:0x0444,0xB5:0x0445,0xB6:0x0446,0xB7:0x0447,
  0xB8:0x0448,0xB9:0x0449,0xBA:0x044A,0xBB:0x044B,0xBC:0x044C,0xBD:0x044D,0xBE:0x044E,0xBF:0x044F,
  0xC0:0x0410,0xC1:0x0411,0xC2:0x0412,0xC3:0x0413,0xC4:0x0414,0xC5:0x0415,0xC6:0x0416,0xC7:0x0417,
  0xC8:0x0418,0xC9:0x0419,0xCA:0x041A,0xCB:0x041B,0xCC:0x041C,0xCD:0x041D,0xCE:0x041E,0xCF:0x041F,
  0xD0:0x0420,0xD1:0x0421,0xD2:0x0422,0xD3:0x0423,0xD4:0x0424,0xD5:0x0425,0xD6:0x0426,0xD7:0x0427,
  0xD8:0x0428,0xD9:0x0429,0xDA:0x042A,0xDB:0x042B,0xDC:0x042C,0xDD:0x042D,0xDE:0x042E,0xDF:0x042F,
  0xE0:0x0430,0xE1:0x0431,0xE2:0x0432,0xE3:0x0433,0xE4:0x0434,0xE5:0x0435,0xE6:0x0436,0xE7:0x0437,
  0xE8:0x0438,0xE9:0x0439,0xEA:0x043A,0xEB:0x043B,0xEC:0x043C,0xED:0x043D,0xEE:0x043E,0xEF:0x043F,
  0xF0:0x0440,0xF1:0x0441,0xF2:0x0442,0xF3:0x0443,0xF4:0x0444,0xF5:0x0445,0xF6:0x0446,0xF7:0x0447,
  0xF8:0x0448,0xF9:0x0449,0xFA:0x044A,0xFB:0x044B,0xFC:0x044C,0xFD:0x044D,0xFE:0x044E,0xFF:0x044F,
};

// Proper Windows-1251 byte-to-codepoint mapping (the standard one)
function buildWin1251Table(): number[] {
  const table: number[] = [];
  // 0x00-0x7F: same as ASCII
  for (let i = 0; i < 128; i++) table[i] = i;
  // 0x80-0xFF: standard Windows-1251 mapping
  const hi = [
    0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,
    0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
    0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
    0x0098,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
    0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,
    0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
    0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,
    0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
    0x0410,0x0411,0x0412,0x0413,0x0414,0x0415,0x0416,0x0417,
    0x0418,0x0419,0x041A,0x041B,0x041C,0x041D,0x041E,0x041F,
    0x0420,0x0421,0x0422,0x0423,0x0424,0x0425,0x0426,0x0427,
    0x0428,0x0429,0x042A,0x042B,0x042C,0x042D,0x042E,0x042F,
    0x0430,0x0431,0x0432,0x0433,0x0434,0x0435,0x0436,0x0437,
    0x0438,0x0439,0x043A,0x043B,0x043C,0x043D,0x043E,0x043F,
    0x0440,0x0441,0x0442,0x0443,0x0444,0x0445,0x0446,0x0447,
    0x0448,0x0449,0x044A,0x044B,0x044C,0x044D,0x044E,0x044F,
  ];
  for (let i = 0; i < 128; i++) table[128 + i] = hi[i];
  return table;
}
const WIN1251_TABLE = buildWin1251Table();

/** Decode a byte array from windows-1251 to a JS string */
function decodeWindows1251(bytes: Uint8Array): string {
  let result = "";
  for (const b of bytes) {
    result += String.fromCodePoint(WIN1251_TABLE[b] ?? b);
  }
  return result;
}

/** Decode a byte array from KOI8-R to a JS string */
const KOI8R_HI = [
  0x2500,0x2502,0x250C,0x2510,0x2514,0x2518,0x251C,0x2524,
  0x252C,0x2534,0x253C,0x2580,0x2584,0x2588,0x258C,0x2590,
  0x2591,0x2592,0x2593,0x2320,0x25A0,0x2219,0x221A,0x2248,
  0x2264,0x2265,0x00A0,0x2321,0x00B0,0x00B2,0x00B7,0x00F7,
  0x2550,0x2551,0x2552,0x0451,0x2553,0x2554,0x2555,0x2556,
  0x2557,0x2558,0x2559,0x255A,0x255B,0x255C,0x255D,0x255E,
  0x255F,0x2560,0x2561,0x0401,0x2562,0x2563,0x2564,0x2565,
  0x2566,0x2567,0x2568,0x2569,0x256A,0x256B,0x256C,0x00A9,
  0x044E,0x0430,0x0431,0x0446,0x0434,0x0435,0x0444,0x0433,
  0x0445,0x0438,0x0439,0x043A,0x043B,0x043C,0x043D,0x043E,
  0x043F,0x044F,0x0440,0x0441,0x0442,0x0443,0x0436,0x0432,
  0x044C,0x044B,0x0437,0x0448,0x044D,0x0449,0x0447,0x044A,
  0x042E,0x0410,0x0411,0x0426,0x0414,0x0415,0x0424,0x0413,
  0x0425,0x0418,0x0419,0x041A,0x041B,0x041C,0x041D,0x041E,
  0x041F,0x042F,0x0420,0x0421,0x0422,0x0423,0x0416,0x0412,
  0x042C,0x042B,0x0417,0x0428,0x042D,0x0429,0x0427,0x042A,
];

function decodeKoi8r(bytes: Uint8Array): string {
  let result = "";
  for (const b of bytes) {
    result += String.fromCodePoint(b < 0x80 ? b : KOI8R_HI[b - 0x80]);
  }
  return result;
}

/** Convert raw bytes to string based on charset name */
function decodeCharset(bytes: Uint8Array, charset: string): string {
  const cs = charset.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cs === "utf8" || cs === "utf-8" || cs === "") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (cs === "windows1251" || cs === "cp1251" || cs === "win1251") {
    return decodeWindows1251(bytes);
  }
  if (cs === "koi8r" || cs === "koi8") {
    return decodeKoi8r(bytes);
  }
  if (cs === "iso88591" || cs === "latin1") {
    // ISO-8859-1: byte value = code point
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
  // Fallback: try TextDecoder (supports many encodings in Deno)
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

/** Base64 string → Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Quoted-Printable hex string → Uint8Array */
function qpToBytes(qp: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < qp.length; i++) {
    if (qp[i] === "=" && i + 2 < qp.length) {
      const hex = qp.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    if (qp[i] === "_") {
      bytes.push(0x20); // underscore = space in Q encoding
    } else {
      bytes.push(qp.charCodeAt(i));
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Decode RFC 2047 encoded-words in a header value.
 * Handles =?charset?B?...?= and =?charset?Q?...?=
 * Also handles adjacent encoded words separated by whitespace.
 */
function decodeMimeWords(input: string): string {
  // First, join adjacent encoded words (RFC 2047 §6.2: whitespace between them is ignored)
  const joined = input.replace(/\?=\s+=\?/g, "?==?");

  return joined.replace(/=\?([^?]+)\?(B|Q)\?([^?]*)\?=/gi, (_, charset: string, encoding: string, encoded: string) => {
    try {
      const enc = encoding.toUpperCase();
      if (enc === "B") {
        const bytes = base64ToBytes(encoded);
        return decodeCharset(bytes, charset);
      } else if (enc === "Q") {
        const bytes = qpToBytes(encoded);
        return decodeCharset(bytes, charset);
      }
      return encoded;
    } catch {
      return encoded;
    }
  });
}

function safeParseDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}
