// Card Crest: send-alert-email
// Sends the "new request" email to people who switched on "Email me new requests".
//
// How it is triggered: a Supabase Database Webhook on INSERT into public.mk_outbox calls this function.
// The database only queues an email row for people who opted in (see mk_set_email_alerts in 05_marketplace.sql).
//
// It sends through any normal SMTP mailbox, for example a Hostinger mailbox such as admin@cardcrest.in.
// Secrets to set (Supabase dashboard > Edge Functions > Secrets):
//   SMTP_HOST      smtp.hostinger.com            (Hostinger Titan mail uses smtp.titan.email)
//   SMTP_PORT      465                            (465 = secure SSL; use 587 only if your host says so)
//   SMTP_USER      admin@cardcrest.in             (the full mailbox address)
//   SMTP_PASSWORD  the mailbox password           (set in Hostinger hPanel > Emails; never share it)
//   WEBHOOK_SECRET any long random text; the same text goes in the webhook's "x-webhook-secret" header
//   SITE_URL       https://salescardcrest-alt.github.io/card-crest-website/
// Older setups that used GMAIL_USER / GMAIL_APP_PASSWORD still work (host defaults to smtp.gmail.com).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically.
// The service-role key stays on the server: it is never put in the website or the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("Unauthorized", { status: 401 });

  const payload = await req.json().catch(() => null);
  const row = payload?.record;
  if (!row || row.channel !== "email" || row.status !== "QUEUED") return new Response("ignored", { status: 200 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const mark = (status: "SENT" | "FAILED") => admin.from("mk_outbox").update({ status }).eq("id", row.id);

  try {
    // double-check the opt-in so nobody is emailed by mistake
    const { data: member } = await admin.from("mk_member").select("email_alerts").eq("user_id", row.user_id).maybeSingle();
    if (!member?.email_alerts) { await mark("FAILED"); return new Response("not opted in", { status: 200 }); }

    const { data: user, error } = await admin.auth.admin.getUserById(row.user_id);
    const to = user?.user?.email;
    if (error || !to) { await mark("FAILED"); return new Response("no address", { status: 200 }); }

    const site = (Deno.env.get("SITE_URL") || "").replace(/\/?$/, "/");
    const link = site + "#/market/earn";
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0b1f17">
      <h2 style="margin:0 0 12px">${esc(row.title)}</h2>
      <p style="font-size:15px;line-height:1.5">${esc(row.body)}</p>
      <p><a href="${link}" style="display:inline-block;background:#0e5c3c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:30px;font-weight:bold">See the request</a></p>
      <p style="font-size:12px;color:#6c7b73">You get this because you switched on "Email me new requests" on Card Crest. You can switch it off on the Earn page.
      Card Crest never asks for your card number, CVV or OTP.</p></div>`;

    const user_ = Deno.env.get("SMTP_USER") || Deno.env.get("GMAIL_USER")!;
    const pass_ = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("GMAIL_APP_PASSWORD")!;
    const host_ = Deno.env.get("SMTP_HOST") || (Deno.env.get("GMAIL_USER") ? "smtp.gmail.com" : "smtp.hostinger.com");
    const port_ = Number(Deno.env.get("SMTP_PORT") || 465);
    const smtp = new SMTPClient({
      connection: { hostname: host_, port: port_, tls: port_ === 465, auth: { username: user_, password: pass_ } },
    });
    await smtp.send({ from: `Card Crest <${user_}>`, to, subject: row.title, content: row.body, html });
    await smtp.close();
    await mark("SENT");
    return new Response("sent", { status: 200 });
  } catch (e) {
    console.error("send-alert-email failed", e);
    await mark("FAILED");
    return new Response("failed", { status: 500 });
  }
});
