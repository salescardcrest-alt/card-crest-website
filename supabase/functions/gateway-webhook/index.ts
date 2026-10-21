// Card Crest: payment gateway webhook (Razorpay-style). NOT needed in test mode.
//
// What it does: verifies the gateway's HMAC signature, then calls the database function
// mk_apply_payment(), which is idempotent on the event id, so retries and replays are safe.
//
// Deploy:   supabase functions deploy gateway-webhook --no-verify-jwt
// Secrets:  supabase secrets set GATEWAY_WEBHOOK_SECRET=...   (SUPABASE_URL and
//           SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically)
// Gateway:  point the gateway's webhook at  https://<project>.supabase.co/functions/v1/gateway-webhook
//           and subscribe to payment.captured and payment.failed.
//
// The service-role key stays inside this function. It must never be placed in the website.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const secret = Deno.env.get("GATEWAY_WEBHOOK_SECRET") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secret) return new Response("Webhook secret is not configured", { status: 500 });

  const body = await req.text();                         // verify the RAW body, before any parsing
  const given = req.headers.get("x-razorpay-signature") ?? "";
  if (!safeEqual(await hmacHex(secret, body), given)) return new Response("Invalid signature", { status: 401 });

  const ev = JSON.parse(body);
  const pay = ev?.payload?.payment?.entity;
  if (!pay) return new Response("ok", { status: 200 });   // an event type we do not use

  const { error } = await sb.rpc("mk_apply_payment", {
    ev_id: req.headers.get("x-razorpay-event-id") ?? ev.id ?? crypto.randomUUID(),
    ev_type: ev.event,                                    // payment.captured | payment.failed
    order_id: pay.order_id,
    amount: Number(pay.amount) / 100,                     // gateway amounts are in paise
    payment_id: pay.id,
  });
  // Business-rule failures (wrong amount, already paid) are logged by the gateway as non-2xx so you can look at them.
  if (error) return new Response(error.message, { status: 422 });
  return new Response("ok", { status: 200 });
});
