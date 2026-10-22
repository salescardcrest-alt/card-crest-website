// Card Crest: send-alert-email (new-request alerts for cardholders, and the buyer's "Payment held safely" confirmation)
// Sends emails to people who switched on "Email me alerts".
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

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const rupees = (n: unknown) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
const when = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)) + " IST";
  } catch { return ""; }
};

type Line = [string, string];

/** A plain-language summary of the request, in sentence case. */
function summarise(r: any): { headline: string; lines: Line[] } {
  const d = r?.details || {}, s = r?.fee_snapshot || {};
  const lines: Line[] = [];
  let headline = "A new request matches one of your cards";
  if (r?.module === "LOUNGE") {
    const kind = d.type === "INTERNATIONAL" ? "International" : "Domestic";
    headline = `${kind} lounge access at ${d.airport || "an airport"}`;
    lines.push(["Service", `${kind} lounge access`]);
    lines.push(["Airport", `${d.airport || ""}${d.terminal ? ", " + d.terminal : ""}`]);
    if (d.dateTime) lines.push(["Visit time", when(d.dateTime)]);
  } else if (r?.module === "MOVIE") {
    headline = `Movie offer: ${d.movie || "a movie"}`;
    lines.push(["Service", d.offer === "BOGO" ? "Buy one, get one" : "₹500 off on 2 seats"]);
    if (d.theatre) lines.push(["Theatre", `${d.theatre}${d.city ? ", " + d.city : ""}`]);
    if (d.showTime) lines.push(["Show time", when(d.showTime)]);
  } else if (r?.module === "ORDER") {
    headline = `Order & Earn on ${d.platform || "a shopping site"}`;
    lines.push(["Service", "Order & Earn"]);
    lines.push(["Shop", d.platform || ""]);
    if (d.offerWanted) lines.push(["Card offer needed", d.offerWanted]);
  } else if (r?.module === "PAY") {
    headline = `Pay & Earn on ${d.platform || "a shopping site"}`;
    lines.push(["Service", "Pay & Earn"]);
    lines.push(["Shop", d.platform || ""]);
    if (d.offerWanted) lines.push(["Card offer needed", d.offerWanted]);
  }
  if (s.holderFee != null) lines.push(["You would earn", rupees(s.holderFee)]);
  if (Number(s.reimbursement) > 0) lines.push(["Reimbursed to you", rupees(s.reimbursement) + " after the order"]);
  if (r?.accept_by) lines.push(["Accept before", when(r.accept_by)]);
  return { headline, lines: lines.filter((l) => l[1]) };
}

/** What the buyer sees after paying: the request, the amount held and what happens next. */
function summariseBuyer(r: any): { headline: string; lines: Line[] } {
  const d = r?.details || {}, s = r?.fee_snapshot || {};
  const lines: Line[] = [];
  let headline = "Your request";
  if (r?.module === "LOUNGE") {
    const kind = d.type === "INTERNATIONAL" ? "International" : "Domestic";
    headline = `${kind} lounge access at ${d.airport || "the airport"}`;
    if (d.dateTime) lines.push(["Visit time", when(d.dateTime)]);
  } else if (r?.module === "MOVIE") {
    headline = `Movie offer: ${d.movie || "your movie"}`;
    if (d.showTime) lines.push(["Show time", when(d.showTime)]);
  } else if (r?.module === "ORDER") {
    headline = `Order & Earn on ${d.platform || "your shopping site"}`;
  } else if (r?.module === "PAY") {
    headline = `Pay & Earn on ${d.platform || "your shopping site"}`;
  }
  if (s.total != null) lines.push(["Amount held", rupees(s.total)]);
  if (Number(s.saved) > 0) lines.push(["Your saving", rupees(s.saved)]);
  lines.push(["Status", "Waiting for a cardholder"]);
  if (r?.accept_by) lines.push(["Open until", when(r.accept_by)]);
  return { headline, lines };
}

type Mail = {
  eyebrow: string; title: string; intro: string; headline: string; lines: Line[];
  steps?: string[]; button: string; link: string; note: string; reason: string; site: string; gif: string;
};

function render(m: Mail) {
  const rows = m.lines.map(([k, v], i) =>
    `<tr><td style="padding:12px 0;${i ? "border-top:1px solid #e6ece8;" : ""}color:#6c7b73;font-size:14px;width:42%">${esc(k)}</td>` +
    `<td style="padding:12px 0;${i ? "border-top:1px solid #e6ece8;" : ""}color:#0b1f17;font-size:14px;font-weight:600;text-align:right">${esc(v)}</td></tr>`).join("");
  const steps = (m.steps || []).map((s, i) =>
    `<tr><td style="padding:6px 12px 6px 0;vertical-align:top"><div style="width:24px;height:24px;border-radius:12px;background:#0e5c3c;color:#fff;font-size:12px;font-weight:700;line-height:24px;text-align:center">${i + 1}</div></td>` +
    `<td style="padding:6px 0;color:#3a4a42;font-size:14px;line-height:1.5">${esc(s)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(m.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6ece8">
    <tr><td style="background:#0e5c3c;padding:20px 28px">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.4px">Card<span style="color:#8fd3b4">Crest</span></span>
    </td></tr>
    <tr><td align="center" style="background:#e8f5ee;padding:0;line-height:0">
      <img src="${esc(m.gif)}" width="480" height="190" alt="A happy smiley celebrating with confetti" style="display:block;width:100%;max-width:480px;height:auto;border:0">
    </td></tr>
    <tr><td style="padding:28px 28px 8px">
      <div style="color:#17a06a;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">${esc(m.eyebrow)}</div>
      <h1 style="margin:8px 0 10px;color:#0b1f17;font-size:24px;line-height:1.25;font-weight:700">${esc(m.title)}</h1>
      <p style="margin:0;color:#3a4a42;font-size:15px;line-height:1.6">${esc(m.intro)}</p>
    </td></tr>
    <tr><td style="padding:18px 28px 6px">
      <div style="background:#f4f7f5;border-radius:12px;padding:6px 20px">
        <div style="padding:14px 0 4px;color:#0b1f17;font-size:16px;font-weight:700">${esc(m.headline)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </div>
    </td></tr>
    ${steps ? `<tr><td style="padding:18px 28px 0"><div style="color:#0b1f17;font-size:15px;font-weight:700;margin-bottom:6px">What happens next</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${steps}</table></td></tr>` : ""}
    <tr><td style="padding:22px 28px 8px" align="left">
      <a href="${esc(m.link)}" style="display:inline-block;background:#0e5c3c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:30px">${esc(m.button)}</a>
      <p style="margin:14px 0 0;color:#6c7b73;font-size:13px;line-height:1.5">${esc(m.note)}</p>
    </td></tr>
    <tr><td style="padding:22px 28px 26px">
      <div style="border-top:1px solid #e6ece8;padding-top:18px;color:#6c7b73;font-size:12px;line-height:1.6">
        <strong style="color:#3a4a42">Stay safe.</strong> Card Crest never asks for your card number, CVV, PIN or OTP. Never share personal or contact details with anyone.<br><br>
        ${esc(m.reason)}<br><br>
        Card Crest, Bengaluru, India &middot; <a href="${esc(m.site)}" style="color:#0e5c3c;text-decoration:none">Visit Card Crest</a>
      </div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = `${m.title}\n\n${m.intro}\n\n${m.headline}\n` + m.lines.map(([k, v]) => `${k}: ${v}`).join("\n") +
    ((m.steps || []).length ? "\n\nWhat happens next:\n" + (m.steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n") : "") +
    `\n\n${m.button}: ${m.link}\n\n${m.note}\n\nStay safe: Card Crest never asks for your card number, CVV, PIN or OTP.\n${m.reason}`;
  return { html, text };
}

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

    // the request behind the alert, to write a clear summary
    let request: any = null;
    if (row.request_id) {
      const { data } = await admin.from("mk_requests").select("module, details, fee_snapshot, accept_by").eq("id", row.request_id).maybeSingle();
      request = data;
    }

    const site = (Deno.env.get("SITE_URL") || "").replace(/\/?$/, "/");
    const gif = site + "assets/email/happy-payment.gif";
    const reason = 'You receive this email because you turned on "Email me alerts". You can turn it off any time on the Earn page of your account.';
    let subject = String(row.title || "Card Crest update");
    let mail;

    if (row.title === "Payment held safely") {
      // the buyer's confirmation
      const sum = summariseBuyer(request);
      const amount = request?.fee_snapshot?.total;
      subject = amount != null ? `Your payment of ${rupees(amount)} is held safely` : "Your payment is held safely";
      mail = render({
        eyebrow: "Payment confirmed", title: "Your payment is held safely",
        intro: amount != null
          ? `Thank you. We have received your payment of ${rupees(amount)} and are holding it securely until your request is completed.`
          : "Thank you. We have received your payment and are holding it securely until your request is completed.",
        headline: sum.headline, lines: sum.lines,
        steps: [
          "A cardholder whose card fits your request accepts it. The first to accept gets it.",
          "They complete it with their own card and upload proof.",
          "You check the proof and confirm. Only then is the money released to them.",
        ],
        button: "Track your request", link: site + "#/market/requests",
        note: "If nobody accepts before the time shown, your payment is refunded to you in full, automatically.",
        reason, site, gif,
      });
    } else {
      // a new request for a cardholder
      const sum = request ? summarise(request) : { headline: row.title, lines: [] as Line[] };
      const earn = sum.lines.find((l) => l[0] === "You would earn");
      subject = request && earn
        ? `New request: ${sum.headline.replace(/^./, (c) => c.toUpperCase())}. Earn ${earn[1]}`
        : String(row.title);
      mail = render({
        eyebrow: "Share & Earn", title: "New request you can fulfil",
        intro: request ? "A new request matches one of your cards. Here are the details." : String(row.body || ""),
        headline: sum.headline, lines: sum.lines,
        button: "View the request", link: site + "#/market/earn",
        note: "The first cardholder to accept gets the request. Open Card Crest, check the details and accept it with your own card.",
        reason, site, gif,
      });
    }

    const user_ = Deno.env.get("SMTP_USER") || Deno.env.get("GMAIL_USER")!;
    const pass_ = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("GMAIL_APP_PASSWORD")!;
    const host_ = Deno.env.get("SMTP_HOST") || (Deno.env.get("GMAIL_USER") ? "smtp.gmail.com" : "smtp.hostinger.com");
    const port_ = Number(Deno.env.get("SMTP_PORT") || 465);
    const smtp = new SMTPClient({
      connection: { hostname: host_, port: port_, tls: port_ === 465, auth: { username: user_, password: pass_ } },
    });
    await smtp.send({ from: `Card Crest <${user_}>`, to, subject, content: mail.text, html: mail.html });
    await smtp.close();
    await mark("SENT");
    return new Response("sent", { status: 200 });
  } catch (e) {
    console.error("send-alert-email failed", e);
    await mark("FAILED");
    return new Response("failed", { status: 500 });
  }
});
