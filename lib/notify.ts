import { Resend } from "resend";
import { insertAuditLog } from "./db/repository";

export type AuditEventType = "VC_LOGIN" | "FOUNDER_LOGIN" | "FOUNDER_SUBMIT";

export interface LogDetails extends Record<string, unknown> {
  subject?: string;
  message?: string;
  name?: string;
  companyName?: string;
  stage?: string;
  amountUsd?: number;
}

const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const SENDER_EMAIL = "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Yogendra Kapkoti · Aarka <onboarding@resend.dev>";

function buildFounderThankYouEmail(actorEmail: string, details: LogDetails): { subject: string; text: string; html: string } {
  const company = String(details.companyName ?? "your company");
  const founder = String(details.name ?? "Founder");
  const stage = String(details.stage ?? "Seed");
  const sector = String(details.sector ?? "Technology");
  const amount =
    typeof details.amountUsd === "number"
      ? `$${details.amountUsd.toLocaleString("en-US")}`
      : details.amountUsd
        ? `$${String(details.amountUsd)}`
        : "Not specified";

  const subject = "Thank you for your submission to Aarka";
  const text = [
    `Hi ${founder},`,
    "",
    `Thank you for your submission, ${founder}. We have received your pitch deck and company details for ${company} (${stage} · ${sector} · Ask: ${amount}).`,
    "",
    `Your submission is now logged in our live investment review queue. Our team reviews every deck and verifies core metrics directly against your materials. If we need any additional information, we will reach out to you at ${actorEmail}.`,
    "",
    "Warm regards,",
    "Yogendra Kapkoti",
    "Aarka Investment Team",
    SENDER_EMAIL,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#2563eb;">Aarka · Investment Team</div>
      <h1 style="margin:10px 0 0;font-size:20px;font-weight:600;color:#0f172a;">Thank you for your submission, ${escapeHtml(founder)}</h1>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#334155;">
        We have received the pitch deck and company details for <strong>${escapeHtml(company)}</strong> and logged your record into our live investment review queue.
      </p>
      <table style="margin-top:18px;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;padding:12px 0;width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Company</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(company)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Founder</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(founder)} (${escapeHtml(actorEmail)})</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Sector &amp; Stage</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(sector)} · ${escapeHtml(stage)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Funding Ask</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(amount)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Status</td><td style="padding:6px 0;color:#059669;font-size:13px;font-weight:600;">Received · In Live Review Queue</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#475569;">
        Our team reviews every submission and will follow up directly if we need additional context or financial sheets.
      </p>
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;font-size:13px;color:#0f172a;">
        <strong>Yogendra Kapkoti</strong><br />
        <span style="color:#64748b;">Aarka · <a href="mailto:${SENDER_EMAIL}" style="color:#2563eb;text-decoration:none;">${SENDER_EMAIL}</a></span>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

function buildEmail(eventType: AuditEventType, actorEmail: string, details: LogDetails): { subject: string; text: string; html: string } {
  if (eventType === "FOUNDER_SUBMIT") {
    const company = String(details.companyName ?? "New Company");
    const founder = String(details.name ?? actorEmail);
    const stage = String(details.stage ?? "Seed");
    const amount = typeof details.amountUsd === "number" ? details.amountUsd.toLocaleString("en-US") : String(details.amountUsd ?? "0");
    const subject = details.subject ?? `🚀 NEW PITCH: ${company}`;
    const text = details.message ?? `${founder} just submitted a ${stage} pitch asking for $${amount}.`;
    return {
      subject,
      text,
      html: renderHtml(subject, text, actorEmail, details),
    };
  }
  if (eventType === "VC_LOGIN") {
    const name = String(details.name ?? actorEmail);
    const subject = details.subject ?? `👀 VC LOGIN: ${name}`;
    const text = details.message ?? `${actorEmail} just accessed the VC dashboard.`;
    return {
      subject,
      text,
      html: renderHtml(subject, text, actorEmail, details),
    };
  }
  const name = String(details.name ?? actorEmail);
  const subject = details.subject ?? `👋 FOUNDER LOGIN: ${name}`;
  const text = details.message ?? `${actorEmail} accessed the founder portal.`;
  return {
    subject,
    text,
    html: renderHtml(subject, text, actorEmail, details),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

function renderHtml(subject: string, bodyText: string, actorEmail: string, details: LogDetails): string {
  const rows = Object.entries(details)
    .filter(([k, v]) => k !== "subject" && k !== "message" && v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;text-transform:capitalize;">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">Aarka · Operational Alert</div>
      <h1 style="margin:8px 0 0;font-size:18px;font-weight:600;color:#0f172a;">${escapeHtml(subject)}</h1>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#334155;">${escapeHtml(bodyText)}</p>
      <table style="margin-top:18px;border-top:1px solid #f1f5f9;padding-top:12px;width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:12px;">Actor</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(actorEmail)}</td></tr>
        ${rows}
      </table>
    </div>
  </body>
</html>`;
}

async function sendAlertEmail(eventType: AuditEventType, actorEmail: string, details: LogDetails): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const { subject, text, html } = buildEmail(eventType, actorEmail, details);

  if (eventType === "FOUNDER_SUBMIT" && actorEmail && actorEmail.includes("@")) {
    const founderEmail = actorEmail.trim().toLowerCase();
    const thankYou = buildFounderThankYouEmail(founderEmail, details);
    const ccList = founderEmail !== SENDER_EMAIL.toLowerCase() ? [SENDER_EMAIL] : undefined;

    const res = await resend.emails.send({
      from: ALERT_FROM,
      to: founderEmail,
      cc: ccList,
      replyTo: SENDER_EMAIL,
      subject: "Thank you for your submission to Aarka",
      text: thankYou.text,
      html: thankYou.html,
    });

    if (res.error) {
      console.error("[notify][FOUNDER_SUBMIT] Resend delivery failed:", JSON.stringify(res.error));
    }
    return;
  }

  const res = await resend.emails.send({
    from: ALERT_FROM,
    to: ALERT_TO,
    replyTo: SENDER_EMAIL,
    subject,
    text,
    html,
  });

  if (res.error) {
    console.error(`[notify][${eventType}] Resend delivery failed:`, JSON.stringify(res.error));
  }
}

/**
 * Logs an event to Supabase audit_logs and sends an alert email via Resend simultaneously.
 * Uses Promise.allSettled so neither failure nor network latency blocks the caller.
 */
export async function logAndNotify(eventType: AuditEventType, email: string, details: LogDetails = {}): Promise<void> {
  const actor = email.trim().toLowerCase() || "unknown";
  await Promise.allSettled([
    insertAuditLog(eventType, actor, details),
    sendAlertEmail(eventType, actor, details),
  ]);
}
