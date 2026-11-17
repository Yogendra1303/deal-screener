import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getDeal, getState, insertAuditLog, putState } from "@/lib/db/repository";
import { createPitchToken, extractDealOwnerEmail } from "@/lib/founder-token";
import { auth, requireRole } from "@/lib/nextauth";

export interface OutreachRecord {
  id: string;
  dealId: string;
  toEmail: string;
  subject: string;
  body: string;
  sentBy: string;
  sentAt: string;
  delivered: boolean;
  dataRoomUrl?: string;
}

const STATE_KEY = "deal_outreach_v1";
const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Aarka Investment Team <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const all = (await getState<Record<string, OutreachRecord[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  return NextResponse.json({ ok: true, history: Array.isArray(all[id]) ? all[id] : [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    toEmail?: string;
    subject?: string;
    message?: string;
    includeDataRoomLink?: boolean;
  };

  const deal = await getDeal(id).catch(() => null);
  const toEmail = (String(body.toEmail || "").trim() || extractDealOwnerEmail(deal)).toLowerCase();
  const subject = String(body.subject || "").trim().slice(0, 160);
  const message = String(body.message || "").trim().slice(0, 4000);

  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return NextResponse.json({ error: "Please provide a valid founder email address." }, { status: 400 });
  }
  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  }

  const session = await auth().catch(() => null);
  const partnerEmail = session?.user?.email?.trim().toLowerCase() || ALERT_TO;
  const partnerName = session?.user?.name?.trim() || "Aarka Investment Team";

  const includeLink = body.includeDataRoomLink !== false;
  const dataRoomUrl = includeLink
    ? `https://www.aarkavc.xyz/founder/dataroom/${encodeURIComponent(id)}?token=${encodeURIComponent(createPitchToken(id, toEmail))}`
    : undefined;

  let delivered = false;
  let deliveryNote = "Logged in workspace";

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#2563eb;">Aarka · Investment Diligence</div>
      <h1 style="margin:10px 0 0;font-size:18px;font-weight:600;color:#0f172a;">${escapeHtml(subject)}</h1>
      <div style="margin-top:16px;font-size:14px;line-height:1.65;color:#334155;white-space:pre-line;">${escapeHtml(message)}</div>
      ${
        dataRoomUrl
          ? `<div style="margin-top:22px;padding:16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
              <div style="font-size:12px;font-weight:600;color:#0f172a;">Upload requested files privately</div>
              <p style="margin:4px 0 12px;font-size:12px;color:#64748b;">Use your private encrypted data room link below to share financials, decks, or updated metrics directly with our team:</p>
              <a href="${escapeHtml(dataRoomUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:9px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Open Private Data Room →</a>
            </div>`
          : ""
      }
      <div style="margin-top:22px;padding-top:14px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
        Sent by <strong style="color:#0f172a;">${escapeHtml(partnerName)}</strong> · Aarka
      </div>
    </div>
  </body>
</html>`;

    const res = await resend.emails.send({
      from: ALERT_FROM,
      to: toEmail,
      cc: partnerEmail !== toEmail ? [partnerEmail] : undefined,
      replyTo: partnerEmail,
      subject,
      text: `${message}${dataRoomUrl ? `\n\nPrivate Data Room: ${dataRoomUrl}` : ""}\n\n— ${partnerName}, Aarka`,
      html,
    });

    if (!res.error) {
      delivered = true;
      deliveryNote = `Sent to ${toEmail}`;
    } else {
      deliveryNote = "Saved & copied to partner inbox (verify aarkavc.xyz domain in Resend for direct external delivery)";
      // Partner copy so outreach text + private link is immediately usable
      await resend.emails
        .send({
          from: ALERT_FROM,
          to: ALERT_TO,
          replyTo: toEmail,
          subject: `[Draft Copy for ${toEmail}] ${subject}`,
          text: `Intended Founder: ${toEmail}\n\n${message}${dataRoomUrl ? `\n\nPrivate Data Room Link: ${dataRoomUrl}` : ""}`,
          html,
        })
        .catch(() => undefined);
    }
  }

  const record: OutreachRecord = {
    id: `out-${Date.now().toString(36)}`,
    dealId: id,
    toEmail,
    subject,
    body: message,
    sentBy: partnerName,
    sentAt: new Date().toISOString(),
    delivered,
    dataRoomUrl,
  };

  const all = (await getState<Record<string, OutreachRecord[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  const nextList = [record, ...(Array.isArray(all[id]) ? all[id] : [])].slice(0, 30);
  await putState(STATE_KEY, { ...all, [id]: nextList });

  void insertAuditLog("FOUNDER_OUTREACH", partnerEmail, {
    name: partnerName,
    dealId: id,
    toEmail,
    subject,
    delivered,
    message: `${partnerName} sent diligence follow-up "${subject}" to ${toEmail}.`,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    record,
    history: nextList,
    deliveryNote,
  });
}
