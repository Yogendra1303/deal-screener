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
const ALERT_FROM = process.env.RESEND_FROM ?? "Fund Hub Alerts <onboarding@resend.dev>";

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
      <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563eb;">Fund Hub · Operational Alert</div>
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
  await resend.emails.send({
    from: ALERT_FROM,
    to: ALERT_TO,
    subject,
    text,
    html,
  });
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
