import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { driver, getState, insertAuditLog, mergeDeals, putPitchDeck, putState } from "@/lib/db/repository";
import { validatePdfBinary } from "@/lib/file-security";
import { createPitchToken } from "@/lib/founder-token";
import { requireRole } from "@/lib/nextauth";
import { logAndNotify } from "@/lib/notify";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import { SECTORS } from "@/lib/types";

export const maxDuration = 60;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "email-pitch"
  );
}

function parseFromHeader(raw: string): { name: string; email: string } {
  const m = raw.match(/^(?:"?([^"<]+)"?\s*)?<([^>]+)>$/);
  if (m) {
    return { name: (m[1] || m[2].split("@")[0]).trim(), email: m[2].trim().toLowerCase() };
  }
  const email = raw.trim().toLowerCase();
  return { name: email.split("@")[0] || "Founder", email };
}

function detectSector(text: string): string {
  const hay = text.toLowerCase();
  for (const s of SECTORS) {
    if (hay.includes(s.toLowerCase())) return s;
  }
  if (/fintech|payment|bank|credit|payroll/.test(hay)) return "Fintech";
  if (/health|clinic|medical|bio|patient/.test(hay)) return "Healthtech";
  if (/climate|solar|carbon|energy|ev\b/.test(hay)) return "Climate";
  if (/freight|truck|logistics|warehouse|supply/.test(hay)) return "Logistics";
  if (/saas|b2b|enterprise|ai\b|software/.test(hay)) return "B2B software";
  return "B2B software";
}

function detectAskUsd(text: string): number {
  const m = text.match(/\$\s*(\d+(?:\.\d+)?)\s*([mk])?/i);
  if (!m) return 1_000_000;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return 1_000_000;
  const u = (m[2] || "").toLowerCase();
  const usd = u === "m" ? Math.round(n * 1_000_000) : u === "k" ? Math.round(n * 1_000) : Math.round(n);
  return Math.min(4_000_000, Math.max(50_000, usd));
}

function hasValidWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.AARKA_INBOUND_SECRET || process.env.AARKA_WEBHOOK_SECRET;
  if (!expected) return false;
  const supplied = req.headers.get("x-aarka-secret") || req.headers.get("authorization") || "";
  return supplied === expected || supplied === `Bearer ${expected}`;
}

/**
 * Automated Inbox Ingestion Webhook (pitches@aarkavc.xyz).
 * Strictly authenticated: requires AARKA_INBOUND_SECRET / AARKA_WEBHOOK_SECRET OR an approved VC session.
 * Accepts standard Resend / Postmark / Mailgun JSON email payloads with optional base64 PDF attachments.
 */
export async function POST(req: NextRequest) {
  if (!hasValidWebhookSecret(req)) {
    const gate = await requireRole();
    if (!gate.ok) {
      return NextResponse.json({ error: "Unauthorized inbound email webhook." }, { status: gate.status });
    }
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      from?: string;
      sender?: string;
      subject?: string;
      text?: string;
      html?: string;
      companyName?: string;
      sector?: string;
      askAmount?: number;
      attachments?: Array<{ filename?: string; content?: string; contentType?: string }>;
    };

    const rawFrom = String(body.from || body.sender || "").trim();
    const subject = String(body.subject || "Inbound Pitch Deck").trim().slice(0, 160);
    const textBody = String(body.text || "").trim().slice(0, 4000);
    const { name: founderName, email: founderEmail } = parseFromHeader(rawFrom);

    if (!founderEmail || !founderEmail.includes("@")) {
      return NextResponse.json({ error: "Valid sender 'from' email address is required." }, { status: 400 });
    }

    const derivedCompany =
      String(body.companyName || "").trim() ||
      subject
        .replace(/^(re|fwd|fw):\s*/i, "")
        .replace(/pitch\s*deck|seed\s*round|deck|intro|investment/gi, "")
        .replace(/[-|:\u2013\u2014]/g, " ")
        .trim()
        .slice(0, 60) ||
      founderEmail.split("@")[1]?.split(".")[0] ||
      "Inbound Startup";

    const sector = String(body.sector || "").trim() || detectSector(`${subject} ${textBody}`);
    const askAmount =
      typeof body.askAmount === "number" && Number.isFinite(body.askAmount) && body.askAmount > 0
        ? Math.min(4_000_000, Math.round(body.askAmount))
        : detectAskUsd(`${subject} ${textBody}`);

    const id = `${slugify(derivedCompany)}-${Date.now().toString(36)}`;
    const receivedAt = new Date().toISOString();
    const fileUrl = `/api/files/${encodeURIComponent(id)}/deck_pdf`;

    // Inspect optional base64 PDF attachment with strict binary magic-byte validation
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const pdfAtt = attachments.find(
      (a) => (a.filename && /\.pdf$/i.test(a.filename)) || (a.contentType || "").toLowerCase().includes("pdf"),
    );

    let deckFileName = `${slugify(derivedCompany)}-deck.pdf`;
    let deckSize = 0;

    if (pdfAtt?.content) {
      const pdfBytes = new Uint8Array(Buffer.from(pdfAtt.content, "base64"));
      deckFileName = String(pdfAtt.filename || deckFileName).slice(0, 120);
      const check = validatePdfBinary(pdfBytes, deckFileName);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      deckSize = pdfBytes.byteLength;
      if (driver() !== "none") {
        await putPitchDeck(id, deckFileName, "application/pdf", pdfBytes);
      }
    }

    const intake = {
      id,
      via: "Email" as const,
      receivedAt,
      oneLiner: `${sector} · Email inbox (${subject.slice(0, 80)})`,
      form: {
        companyName: derivedCompany,
        website: "",
        country: "Global",
        sector,
        stage: "Seed",
        amountUsd: askAmount,
        founders: [{ name: founderName, profileUrl: "" }],
        email: founderEmail,
      },
      files: [
        {
          name: deckFileName,
          size: deckSize,
          at: receivedAt.slice(0, 10),
          key: `pitch:${id}`,
          url: fileUrl,
        },
      ],
    };

    if (driver() !== "none") {
      await mergeDeals([
        {
          id,
          slug: id,
          company_name: derivedCompany,
          sector,
          sub_category: sector,
          stage: "Seed",
          country: "Global",
          city: null,
          ask_amount: askAmount,
          currency: "USD",
          status: "New",
          checks_status: pdfAtt ? "PDF Received · Unscreened" : "Email Logged · Awaiting PDF",
          ai_status: "Complete",
          band: null,
          founder_fit: null,
          owner: null,
          website: "",
          linkedin_url: "",
          founder_name: founderName,
          founder_email: founderEmail,
          one_line_pitch: subject.slice(0, 120),
          received_at: receivedAt,
          is_historical: false,
          record_json: null,
          intake_json: intake,
          decision_json: null,
          research_pack_json: null,
        },
      ]);

      try {
        const existingLinks = (await getState<{
          requests?: Record<string, unknown>;
          inbound?: Array<{ id: string } & Record<string, unknown>>;
          owners?: Record<string, string>;
          emails?: Record<string, unknown>;
        }>("ds.links.v1")) ?? { requests: {}, inbound: [], owners: {}, emails: {} };
        const prevInbound = Array.isArray(existingLinks.inbound) ? existingLinks.inbound.filter((x) => x?.id !== id) : [];
        await putState("ds.links.v1", {
          ...existingLinks,
          inbound: [intake, ...prevInbound],
        });
      } catch (err) {
        console.error("[inbound-email][state-sync]", err);
      }
    }

    const trackingToken = createPitchToken(id, founderEmail);
    const statusUrl = `/founder/dataroom/${encodeURIComponent(id)}?token=${encodeURIComponent(trackingToken)}`;

    void insertAuditLog("INBOUND_EMAIL_INGEST", founderEmail, {
      dealId: id,
      companyName: derivedCompany,
      sector,
      askAmount,
      hasPdf: Boolean(pdfAtt?.content),
      message: `Ingested inbound email pitch for ${derivedCompany} from ${founderEmail}.`,
    }).catch(() => undefined);

    void logAndNotify("FOUNDER_SUBMIT", founderEmail, {
      name: founderName,
      companyName: derivedCompany,
      stage: "Seed",
      amountUsd: askAmount,
      sector,
      dealId: id,
      receivedAt,
      statusUrl: `https://www.aarkavc.xyz${statusUrl}`,
    }).catch(() => undefined);

    try {
      broadcastRealtimeEvent("deal.created", {
        id,
        company_name: derivedCompany,
        founder_name: founderName,
        founder_email: founderEmail,
        sector,
        stage: "Seed",
        ask_amount: askAmount,
        receivedAt,
        fileUrl,
      });
    } catch {
      // non-blocking
    }

    revalidatePath("/deals");
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      dealId: id,
      companyName: derivedCompany,
      sector,
      askAmount,
      hasPdf: Boolean(pdfAtt?.content),
      statusUrl,
    });
  } catch (err) {
    console.error("[api/webhooks/inbound-email] error:", err);
    return NextResponse.json({ error: "Failed to ingest inbound email." }, { status: 500 });
  }
}
