import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getState, insertAuditLog, putState } from "@/lib/db/repository";
import { authorizeFounderDealAccess, createPitchToken } from "@/lib/founder-token";
import {
  EMPTY_SUPPORT_STORE,
  SUPPORT_CATEGORIES,
  SUPPORT_STATE_KEY,
  type SupportCategory,
  type SupportStoreData,
  type SupportTicket,
} from "@/lib/support";

const ALERT_TO = process.env.ALERT_EMAIL ?? "yogendrakapkoti13@gmail.com";
const ALERT_FROM = process.env.RESEND_FROM ?? "Aarka Founder Portal <onboarding@resend.dev>";

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

export async function GET(req: NextRequest) {
  const dealId = String(req.nextUrl.searchParams.get("dealId") || "").trim();
  const token = String(req.nextUrl.searchParams.get("token") || req.headers.get("x-pitch-token") || "").trim();

  const gate = await authorizeFounderDealAccess(dealId, token);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const store = await readStore();
  return NextResponse.json({
    ok: true,
    tickets: store.tickets.filter((t) => t.companyId === dealId),
    bookings: store.bookings.filter((b) => b.companyId === dealId),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const dealId = String(body.dealId || "").trim();
  const token = String(body.token || req.headers.get("x-pitch-token") || "").trim();

  // Strict row-level authorization: valid deal-scoped HMAC token OR verified owner/VC session
  const gate = await authorizeFounderDealAccess(dealId, token);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const action = String(body.action || "create_ticket");
  const now = new Date().toISOString();
  const companyName = gate.deal.company_name || dealId;
  const founderEmail = gate.email || "";
  const senderName = String(body.senderName || "").trim() || `${companyName} Founder`;
  const store = await readStore();

  if (action === "reply_ticket") {
    const ticketId = String(body.ticketId || "").trim();
    const messageText = String(body.message || "").trim().slice(0, 4000);
    if (!messageText) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const idx = store.tickets.findIndex((t) => t.id === ticketId && t.companyId === dealId);
    if (idx === -1) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

    const current = store.tickets[idx];
    const updated: SupportTicket = {
      ...current,
      status: current.status === "Resolved" ? "Open" : current.status,
      updatedAt: now,
      messages: [
        ...current.messages,
        {
          id: `msg-${Date.now().toString(36)}`,
          senderRole: "founder",
          senderName,
          body: messageText,
          createdAt: now,
        },
      ],
    };

    const nextTickets = [...store.tickets];
    nextTickets[idx] = updated;
    await putState(SUPPORT_STATE_KEY, { ...store, tickets: nextTickets });

    void insertAuditLog("FOUNDER_SUPPORT_REPLY", founderEmail || "founder", {
      dealId,
      companyName,
      ticketId,
    }).catch(() => undefined);

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails
        .send({
          from: ALERT_FROM,
          to: ALERT_TO,
          replyTo: founderEmail || undefined,
          subject: `[Founder Reply · ${companyName}] ${updated.subject}`,
          text: `${senderName} replied on "${updated.subject}":\n\n${messageText}\n\nRespond inside Aarka: https://www.aarkavc.xyz/resources`,
        })
        .catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      ticket: updated,
      tickets: nextTickets.filter((t) => t.companyId === dealId),
      bookings: store.bookings.filter((b) => b.companyId === dealId),
    });
  }

  // Default: Founder submits a brand-new help request (YC-style Founder Support Desk)
  const category = validCategory(body.category);
  const subject = String(body.subject || "").trim().slice(0, 160);
  const messageText = String(body.message || "").trim().slice(0, 4000);
  if (!subject || !messageText) {
    return NextResponse.json({ error: "Please include both a topic summary and details." }, { status: 400 });
  }

  const replyUrl = founderEmail
    ? `https://www.aarkavc.xyz/founder/dataroom/${encodeURIComponent(dealId)}?token=${encodeURIComponent(createPitchToken(dealId, founderEmail))}#support`
    : undefined;

  const ticket: SupportTicket = {
    id: `sup-${Date.now().toString(36)}`,
    companyId: dealId,
    companyName,
    side: "pitch",
    category,
    direction: "founder_to_fund",
    subject,
    status: "Open",
    priority: category === "Missing Deck Details" || category === "Investor / Bridge Intro" ? "Urgent" : "Normal",
    owner: "Aarka Partner Desk",
    founderEmail: founderEmail || undefined,
    replyUrl,
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `msg-${Date.now().toString(36)}`,
        senderRole: "founder",
        senderName,
        body: messageText,
        createdAt: now,
      },
    ],
  };

  const nextTickets = [ticket, ...store.tickets].slice(0, 150);
  await putState(SUPPORT_STATE_KEY, { ...store, tickets: nextTickets });

  void insertAuditLog("FOUNDER_SUPPORT_REQUEST", founderEmail || "founder", {
    dealId,
    companyName,
    category,
    subject,
  }).catch(() => undefined);

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    await resend.emails
      .send({
        from: ALERT_FROM,
        to: ALERT_TO,
        replyTo: founderEmail || undefined,
        subject: `[Founder Ask · ${companyName}] ${category}: ${subject}`,
        text: `${senderName} (${founderEmail || "verified token"}) asked Aarka for help:\n\nCategory: ${category}\nSubject: ${subject}\n\n${messageText}\n\nRespond inside Aarka: https://www.aarkavc.xyz/resources`,
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    ticket,
    tickets: nextTickets.filter((t) => t.companyId === dealId),
    bookings: store.bookings.filter((b) => b.companyId === dealId),
  });
}
