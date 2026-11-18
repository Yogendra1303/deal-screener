import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { processDeal } from "@/lib/pipeline";
import { parseSheet } from "@/lib/sheet";
import { MissingKeyError, hasKey } from "@/lib/ai";
import { sampleById } from "@/lib/data";
import { STATE_KEYS } from "@/lib/db/project";
import { driver, getState, insertAuditLog, mergeDeals, patchDeal, putFinancialFile, putPitchDeck, putState } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import type { DealResult, Flag, FormInput, SheetRow } from "@/lib/types";

// A deck takes one to a few minutes. Vercel stops the function after this many seconds.
export const maxDuration = 300;

const MAX_PDF_BYTES = 32 * 1024 * 1024; // Claude's PDF limit

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function summarizeChecks(flags: Flag[]): string {
  const gaps = flags.filter((f) => f.kind === "conflict").length;
  const missing = flags.filter((f) => f.kind === "missing").length;
  const parts: string[] = [];
  if (gaps > 0) parts.push(`${gaps} Math Gap${gaps > 1 ? "s" : ""}`);
  if (missing > 0) parts.push(`${missing} Missing Fact${missing > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "Checks Clear";
}

export async function POST(request: Request) {
  const gate = await requireRole();
  if (!gate.ok) return bad(gate.status === 401 ? "Sign in first." : "Your account isn't permitted.", gate.status);

  if (!hasKey()) return bad(new MissingKeyError().message, 503);

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return bad("Send the deck as a multipart form upload.");
  }

  const deck = fd.get("deck");
  if (!(deck instanceof File) || deck.size === 0) return bad("Attach the pitch deck as a PDF.");
  if (deck.size > MAX_PDF_BYTES) return bad("The deck is larger than 32 MB.");
  const bytes = Buffer.from(await deck.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== "%PDF-") return bad("The deck must be a PDF file.");

  let sheet: SheetRow[] | null = null;
  let sheetBytes: Uint8Array | null = null;
  let sheetFileName: string | null = null;
  const sheetFile = fd.get("sheet");
  if (sheetFile instanceof File && sheetFile.size > 0) {
    try {
      const text = await sheetFile.text();
      sheet = parseSheet(text);
      sheetBytes = new TextEncoder().encode(text);
      sheetFileName = sheetFile.name || "financials.csv";
    } catch (e) {
      return bad(`Monthly sheet: ${(e as Error).message}`);
    }
  }

  // Sample decks use their stored form answers; uploads send their own.
  const sampleId = String(fd.get("sampleId") ?? "");
  const sample = sampleId ? sampleById(sampleId) : undefined;
  let form: FormInput;
  if (sample) {
    form = sample.form;
  } else {
    try {
      form = JSON.parse(String(fd.get("form") ?? "")) as FormInput;
    } catch {
      return bad("The form answers are missing.");
    }
    if (!form.companyName?.trim()) return bad("Company name is required.");
  }

  const id = sample ? sample.id : `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const receivedAt = sample ? sample.receivedAt : new Date().toISOString();
  const deckUrl = sample ? `/samples/${sample.deckFile}` : `/api/files/${encodeURIComponent(id)}/deck_pdf`;
  const session = await auth().catch(() => null);
  const actor = session?.user?.email?.trim().toLowerCase() || "partner";
  const urlObj = new URL(request.url);
  const isAsync = fd.get("async") === "true" || urlObj.searchParams.get("async") === "true";

  // 1. Upfront database persistence: Commit deal row & raw files BEFORE extraction starts
  // This guarantees that network blips, tab closures, or timeouts never drop uploaded files.
  if (driver() !== "none") {
    await mergeDeals([
      {
        id,
        slug: id,
        company_name: form.companyName.trim(),
        sector: form.sector || "B2B software",
        sub_category: form.sector || "B2B software",
        stage: form.stage || "Seed",
        country: form.country || "Global",
        city: null,
        ask_amount: form.amountUsd,
        currency: "USD",
        status: "New",
        checks_status: "AI Screening in Progress...",
        ai_status: "Processing",
        received_at: receivedAt,
        is_historical: false,
        website: form.website || null,
        founder_name: form.founders?.[0]?.name || null,
        founder_email: form.email || null,
      },
    ]).catch(() => undefined);

    if (!sample) {
      await putPitchDeck(id, deck.name || "deck.pdf", "application/pdf", new Uint8Array(bytes)).catch(() => undefined);
      if (sheetBytes && sheetFileName) {
        await putFinancialFile(id, "monthly_csv", sheetFileName, "text/csv", sheetBytes).catch(() => undefined);
      }
    }
    revalidatePath("/deals");
    revalidatePath("/");
  }

  const runExtraction = async (onStep?: (msg: string) => void): Promise<DealResult> => {
    const deal = await processDeal({
      id,
      source: sample ? "sample" : "upload",
      receivedAt,
      form,
      pdfBase64: bytes.toString("base64"),
      fileName: deck.name || "deck.pdf",
      deckUrl,
      sheet,
      onStep,
    });

    if (driver() !== "none") {
      const teamScore = deal.scores.find((s) => s.key === "team")?.level ?? null;
      await patchDeal(id, {
        company_name: form.companyName.trim(),
        sector: form.sector || "B2B software",
        sub_category: deal.record.company.sector.value || form.sector || "B2B software",
        stage: form.stage || "Seed",
        country: form.country || "Global",
        city: deal.record.company.city.value || null,
        ask_amount: form.amountUsd,
        currency: "USD",
        status: "New",
        band: deal.band,
        founder_fit: teamScore,
        website: form.website || null,
        founder_name: form.founders?.[0]?.name || null,
        founder_email: form.email || null,
        summary: deal.ai.summary,
        checks_json: deal.flags,
        checks_status: summarizeChecks(deal.flags),
        ai_status: "Complete",
        received_at: receivedAt,
        is_historical: false,
        record_json: deal,
      }).catch(() => undefined);

      const existingDeals = (await getState<Record<string, DealResult>>(STATE_KEYS.deals).catch(() => undefined)) ?? {};
      await putState(STATE_KEYS.deals, { ...existingDeals, [id]: deal }).catch(() => undefined);

      void insertAuditLog("DEAL_AI_PROCESSED", actor, {
        dealId: id,
        companyName: form.companyName,
        band: deal.band,
        flagsCount: deal.flags.length,
      }).catch(() => undefined);

      try {
        broadcastRealtimeEvent("deal.created", { id, company_name: form.companyName, band: deal.band });
      } catch {
        // non-blocking
      }
      revalidatePath("/deals");
      revalidatePath("/");
    }

    return deal;
  };

  // If async mode requested, run via background task and immediately return 202 Accepted
  if (isAsync) {
    after(async () => {
      try {
        await runExtraction();
      } catch (err) {
        console.error(`[process][async] Failed for ${id}:`, err);
        await patchDeal(id, {
          ai_status: "Failed",
          checks_status: `AI Extraction Failed: ${(err as Error).message?.slice(0, 120) || "Unknown error"}`,
        }).catch(() => undefined);
      }
    });

    return NextResponse.json(
      { ok: true, dealId: id, status: "Processing", companyName: form.companyName },
      { status: 202 },
    );
  }

  // Stream progress as NDJSON for interactive frontend upload dialogs
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const deal = await runExtraction((message) => send({ type: "step", message }));
        send({ type: "result", deal });
      } catch (e) {
        console.error("process failed", e);
        const errMsg = (e as Error).message || "Processing failed.";
        await patchDeal(id, {
          ai_status: "Failed",
          checks_status: `AI Extraction Failed: ${errMsg.slice(0, 120)}`,
        }).catch(() => undefined);
        send({ type: "error", error: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
