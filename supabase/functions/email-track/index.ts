import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Transparent 1x1 PNG pixel
const PIXEL_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

const pixelHeaders = {
  "Content-Type": "image/png",
  "Content-Length": PIXEL_BYTES.byteLength.toString(),
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");

  console.log(`[email-track] pixel requested, id=${emailId}, ua=${req.headers.get("user-agent")}`);

  // Return the pixel IMMEDIATELY, then update DB in background
  const response = new Response(PIXEL_BYTES, { status: 200, headers: pixelHeaders });

  if (emailId) {
    // Fire-and-forget: don't await — the response is already sent
    (async () => {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase.rpc("track_email_open", { p_email_id: emailId });
        console.log(`[email-track] tracked open for ${emailId}`);
      } catch (err) {
        console.error("[email-track] DB update error:", err);
      }
    })();
  }

  return response;
});
