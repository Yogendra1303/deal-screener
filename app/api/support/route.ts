import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getDeal, getState, insertAuditLog, putState } from "@/lib/db/repository";
import { createPitchToken, extractDealOwnerEmail } from "@/lib/founder-token";
import { auth, requireRole } from "@/lib/nextauth";
import {
  EMPTY_SUPPORT_STORE,
  SUPPORT_CATEGORIES,
  SUPPORT_STATE_KEY,
  type OfficeHourBooking,
  type SupportCategory,
  type SupportMessage,
  type SupportStoreData,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support";

const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Aarka Platform Team <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}

async function readStore(): Promise<SupportStoreData> {
  const raw = (await getState<Partial<SupportStoreData>>(SUPPORT_STATE_KEY).catch(() => undefined)) ?? {};
  return {
    tickets: Array.isArray(raw.tickets) ? raw.tickets : EMPTY_SUPPORT_STORE.tickets,
    bookings: Array.isArray(raw.bookings) ? raw.bookings : EMPTY_SUPPORT_STORE.bookings,
  };
}

function validCategory(raw: unknown): SupportCategory {
  const s = String(raw || "");
  return SUPPORT_CATEGORIES.includes(s as SupportCategory) ? (s as SupportCategory) : "Pitch & Deck Feedback";
}

async function notifyEmail(opts: {
  to: string;
  replyTo: string;
  partnerName: string;
  companyName: string;
  subject: string;
  body: string;
  replyUrl?: string;
}): Promise<{ delivered: boolean; note: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !opts.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.to)) {
    return { delivered: false, note: "Saved in Founder Support Desk" };
  }
  const resend = new Resend(apiKey);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4f46e5;">Aarka · Founder Support Desk</div>
      <h1 style="margin:10px 0 0;font-size:18px;font-weight:600;color:#0f172a;">${escapeHtml(opts.subject)}</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b;">Company: ${escapeHtml(opts.companyName)}</p>
      <div style="margin-top:16px;font-size:14px;line-height:1.65;color:#334155;white-space:pre-line;">${escapeHtml(opts.body)}</div>
      ${
        opts.replyUrl
          ? `<div style="margin-top:22px;padding:16px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
              <div style="font-size:12px;font-weight:600;color:#0f172a;">Reply directly to our team</div>
              <p style="margin:4px 0 12px;font-size:12px;color:#64748b;">Use your private Aarka Founder Portal link below to reply, share missing numbers, or request intros &amp; hiring help:</p>
              <a href="${escapeHtml(opts.replyUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:9px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">Open Founder Support Thread →</a>
            </div>`
          : ""
      }
      <div style="margin-top:22px;padding-top:14px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;">
        Sent by <strong style="color:#0f172a;">${escapeHtml(opts.partnerName)}</strong> · Aarka
      </div>
    </div>
  </body>
</html>`;

  const res = await resend.emails.send({
    from: ALERT_FROM,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: `${opts.body}${opts.replyUrl ? `\n\nReply directly here: ${opts.replyUrl}` : ""}\n\n${opts.partnerName}, Aarka`,
    html,
  });

  if (!res.error) return { delivered: true, note: `Emailed ${opts.to}` };

  await resend.emails
    .send({
      from: ALERT_FROM,
      to: ALERT_TO,
      replyTo: opts.to,
      subject: `[Support Desk Copy for ${opts.to}] ${opts.subject}`,
      text: `Intended Founder: ${opts.to}\nCompany: ${opts.companyName}\n\n${opts.body}${opts.replyUrl ? `\n\nFounder Link: ${opts.replyUrl}` : ""}`,
      html,
    })
    .catch(() => undefined);

  return { delivered: false, note: "Saved in Desk & copied to partner inbox" };
}

export async function GET() {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }
  const store = await readStore();
  return NextResponse.json({ ok: true, ...store });
}

export async function POST(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "create_ticket");
  const session = await auth().catch(() => null);
  const partnerName = session?.user?.name?.trim() || "Aarka Partner";
  const partnerEmail = session?.user?.email?.trim().toLowerCase() || ALERT_TO;
  const now = new Date().toISOString();
  const store = await readStore();

  if (action === "create_ticket") {
    const companyId = String(body.companyId || "").trim();
    const companyName = String(body.companyName || "").trim();
    const side = body.side === "portfolio" ? "portfolio" : "pitch";
    const category = validCategory(body.category);
    const subject = String(body.subject || "").trim().slice(0, 160);
    const messageText = String(body.message || "").trim().slice(0, 4000);
    const priority = body.priority === "Urgent" ? "Urgent" : "Normal";
    const owner = String(body.owner || partnerName).trim() || partnerName;
    const direction = body.direction === "founder_to_fund" ? "founder_to_fund" : "fund_to_founder";
    const sendEmail = body.sendEmail !== false;

    if (!companyId || !companyName || !subject || !messageText) {
      return NextResponse.json({ error: "Company, subject, and message are required." }, { status: 400 });
    }

    let founderEmail = String(body.founderEmail || "").trim().toLowerCase();
    if (!founderEmail && side === "pitch") {
      const deal = await getDeal(companyId).catch(() => null);
      founderEmail = extractDealOwnerEmail(deal);
    }

    const replyUrl =
      side === "pitch" && founderEmail
        ? `https://www.aarkavc.xyz/founder/dataroom/${encodeURIComponent(companyId)}?token=${encodeURIComponent(createPitchToken(companyId, founderEmail))}#support`
        : side === "portfolio"
          ? `https://www.aarkavc.xyz/founder/${encodeURIComponent(companyId)}`
          : undefined;

    const firstMsg: SupportMessage = {
      id: `msg-${Date.now().toString(36)}`,
      senderRole: direction === "founder_to_fund" ? "founder" : "fund",
      senderName: direction === "founder_to_fund" ? `${companyName} Founder` : partnerName,
      body: messageText,
      createdAt: now,
    };

    const ticket: SupportTicket = {
      id: `sup-${Date.now().toString(36)}`,
      companyId,
      companyName,
      side,
      category,
      direction,
      subject,
      status: "Open",
      priority,
      owner,
      founderEmail: founderEmail || undefined,
      replyUrl,
      createdAt: now,
      updatedAt: now,
      messages: [firstMsg],
    };

    const nextStore: SupportStoreData = {
      ...store,
      tickets: [ticket, ...store.tickets].slice(0, 150),
    };
    await putState(SUPPORT_STATE_KEY, nextStore);

    let deliveryNote = "Saved in Founder Support Desk";
    if (sendEmail && founderEmail && direction === "fund_to_founder") {
      const em = await notifyEmail({
        to: founderEmail,
        replyTo: partnerEmail,
        partnerName,
        companyName,
        subject: `[Aarka Support] ${subject}`,
        body: messageText,
        replyUrl,
      });
      deliveryNote = em.note;
    }

    void insertAuditLog("SUPPORT_TICKET_CREATED", partnerEmail, {
      ticketId: ticket.id,
      companyId,
      companyName,
      category,
      side,
      subject,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, ticket, deliveryNote, ...nextStore });
  }

  if (action === "reply_ticket") {
    const ticketId = String(body.ticketId || "").trim();
    const messageText = String(body.message || "").trim().slice(0, 4000);
    const nextStatus = body.status as SupportTicketStatus | undefined;
    const outcome = String(body.outcome || "").trim().slice(0, 500);
    const sendEmail = body.sendEmail === true;

    const idx = store.tickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    if (!messageText && !nextStatus) {
      return NextResponse.json({ error: "Reply message or status change required." }, { status: 400 });
    }

    const current = store.tickets[idx];
    const messages = messageText
      ? [
          ...current.messages,
          {
            id: `msg-${Date.now().toString(36)}`,
            senderRole: "fund" as const,
            senderName: partnerName,
            body: messageText,
            createdAt: now,
          },
        ]
      : current.messages;

    const status: SupportTicketStatus =
      nextStatus && ["Open", "In Progress", "Resolved"].includes(nextStatus) ? nextStatus : current.status;

    const updated: SupportTicket = {
      ...current,
      status,
      updatedAt: now,
      resolvedAt: status === "Resolved" ? now : current.resolvedAt,
      outcome: outcome || current.outcome,
      messages,
    };

    const nextTickets = [...store.tickets];
    nextTickets[idx] = updated;
    const nextStore: SupportStoreData = { ...store, tickets: nextTickets };
    await putState(SUPPORT_STATE_KEY, nextStore);

    let deliveryNote = "Reply logged";
    if (sendEmail && updated.founderEmail && messageText) {
      const em = await notifyEmail({
        to: updated.founderEmail,
        replyTo: partnerEmail,
        partnerName,
        companyName: updated.companyName,
        subject: `Re: ${updated.subject}`,
        body: messageText,
        replyUrl: updated.replyUrl,
      });
      deliveryNote = em.note;
    }

    void insertAuditLog("SUPPORT_TICKET_UPDATED", partnerEmail, {
      ticketId,
      companyName: updated.companyName,
      status,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, ticket: updated, deliveryNote, ...nextStore });
  }

  if (action === "book_office_hours") {
    const companyId = String(body.companyId || "").trim();
    const companyName = String(body.companyName || "").trim();
    const side = body.side === "portfolio" ? "portfolio" : "pitch";
    const partnerTarget = String(body.partnerName || partnerName).trim();
    const topic = String(body.topic || "").trim().slice(0, 160);
    const slotLabel = String(body.slotLabel || "").trim().slice(0, 80);
    const notes = String(body.notes || "").trim().slice(0, 1000);

    if (!companyId || !companyName || !topic || !slotLabel) {
      return NextResponse.json({ error: "Company, topic, and slot are required." }, { status: 400 });
    }

    const booking: OfficeHourBooking = {
      id: `oh-${Date.now().toString(36)}`,
      companyId,
      companyName,
      side,
      partnerName: partnerTarget,
      topic,
      slotLabel,
      notes: notes || undefined,
      status: "Scheduled",
      createdAt: now,
    };

    const nextStore: SupportStoreData = {
      ...store,
      bookings: [booking, ...store.bookings].slice(0, 100),
    };
    await putState(SUPPORT_STATE_KEY, nextStore);

    void insertAuditLog("OFFICE_HOURS_BOOKED", partnerEmail, {
      bookingId: booking.id,
      companyName,
      partnerName: partnerTarget,
      slotLabel,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, booking, ...nextStore });
  }

  if (action === "complete_office_hours") {
    const bookingId = String(body.bookingId || "").trim();
    const nextBookings = store.bookings.map((b) =>
      b.id === bookingId ? { ...b, status: "Completed" as const } : b,
    );
    const nextStore: SupportStoreData = { ...store, bookings: nextBookings };
    await putState(SUPPORT_STATE_KEY, nextStore);
    return NextResponse.json({ ok: true, ...nextStore });
  }

  return NextResponse.json({ error: "Unknown support action." }, { status: 400 });
}
