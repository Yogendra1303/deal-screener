import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { hasKey } from "@/lib/ai";
import { summariseSheet } from "@/lib/csv-parser";
import { STATE_KEYS } from "@/lib/db/project";
import {
  driver,
  getFile,
  getState,
  mergeDeals,
  patchDeal,
  putFinancialFile,
  putPitchDeck,
  putState,
  recordUploadedFile,
} from "@/lib/db/repository";
import { logAndNotify } from "@/lib/notify";
import { recordAndAlertError } from "@/lib/error-logger";
import { validateFinancialBinary, validatePdfBinary } from "@/lib/file-security";
import { createPitchToken } from "@/lib/founder-token";
import { checkRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import { finishDeal, processDeal } from "@/lib/pipeline";
import { parseSheet } from "@/lib/sheet";
import type { DealResult, Flag, FormInput, SheetRow } from "@/lib/types";
import { checkUpload } from "@/lib/upload";

export const maxDuration = 60;

const MAX_MANDATE_USD = 4_000_000;
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const SUBMIT_WINDOW_MS = 15 * 60 * 1000;
const SUBMIT_LIMIT = 10;
const submitHits = new Map<string, number[]>();

function checkSubmitRate(ip: string): boolean {
  const now = Date.now();
  const prev = (submitHits.get(ip) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (prev.length >= SUBMIT_LIMIT) {
    submitHits.set(ip, prev);
    return false;
  }
  prev.push(now);
  submitHits.set(ip, prev);
  return true;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "pitch"
  );
}

function splitLocation(location: string): { city: string | null; country: string } {
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] };
  }
  return { city: parts[0] || null, country: parts[0] ? parts[0] : "Global" };
}

function summarizeChecks(flags: Flag[]): string {
  const gaps = flags.filter((f) => f.kind === "conflict").length;
  const missing = flags.filter((f) => f.kind === "missing").length;
  const parts: string[] = [];
  if (gaps > 0) parts.push(`${gaps} Math Gap${gaps > 1 ? "s" : ""}`);
  if (missing > 0) parts.push(`${missing} Missing Fact${missing > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "Checks Clear";
}

interface DirectFilePayload {
  storagePath: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  previewCsv?: string;
}

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req);
    const rate = checkRateLimit("submit_pitch", ip, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many submissions in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }

    const contentType = req.headers.get("content-type") || "";

    let founderName = "";
    let founderEmail = "";
    let linkedinUrl = "";
    let companyName = "";
    let website = "";
    let sector = "";
    let oneLinePitch = "";
    let stage = "Seed";
    let location = "";
    let priorFunding: number | null = null;
    let ref = "";
    let askAmount = NaN;
    let honeypot = "";

    // Direct uploaded files metadata (lightweight JSON)
    let directDeck: DirectFilePayload | null = null;
    let directFin: DirectFilePayload | null = null;

    // Fallback FormData files
    let formDeckFile: File | null = null;
    let formFinFile: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      honeypot = String(body.companyWebsite ?? "").trim();
      founderName = String(body.founderName ?? body.name ?? "").trim().slice(0, 120);
      founderEmail = String(body.founderEmail ?? body.email ?? "").trim().toLowerCase().slice(0, 160);
      linkedinUrl = normalizeUrl(String(body.linkedinUrl ?? "").slice(0, 240));
      companyName = String(body.companyName ?? "").trim().slice(0, 120);
      website = normalizeUrl(String(body.website ?? "").slice(0, 240));
      sector = String(body.sector ?? "").trim().slice(0, 80);
      oneLinePitch = String(body.oneLinePitch ?? "").trim().slice(0, 120);
      stage = String(body.stage ?? "").trim().slice(0, 40) || "Seed";
      location = String(body.location ?? "").trim().slice(0, 120);
      priorFunding = typeof body.priorFunding === "number" && Number.isFinite(body.priorFunding) ? body.priorFunding : null;
      ref = String(body.ref ?? "").trim().slice(0, 80);
      askAmount = typeof body.askAmount === "number" ? body.askAmount : Number(body.askAmount);

      if (body.deck && typeof body.deck.storagePath === "string") {
        const sp = body.deck.storagePath.trim();
        if (sp.includes("..") || sp.startsWith("/")) {
          return NextResponse.json({ error: "Invalid pitch deck upload reference." }, { status: 400 });
        }
        directDeck = {
          storagePath: sp,
          fileName: String(body.deck.fileName || "deck.pdf").slice(0, 140),
          mimeType: String(body.deck.mimeType || "application/pdf"),
          size: typeof body.deck.size === "number" ? body.deck.size : undefined,
        };
      }
      if (body.financials && typeof body.financials.storagePath === "string") {
        const sp = body.financials.storagePath.trim();
        if (sp.includes("..") || sp.startsWith("/")) {
          return NextResponse.json({ error: "Invalid financials upload reference." }, { status: 400 });
        }
        directFin = {
          storagePath: sp,
          fileName: String(body.financials.fileName || "financials.csv").slice(0, 140),
          mimeType: String(body.financials.mimeType || "text/csv"),
          size: typeof body.financials.size === "number" ? body.financials.size : undefined,
          previewCsv: typeof body.financials.previewCsv === "string" ? body.financials.previewCsv : undefined,
        };
      }
    } else {
      const formData = await req.formData();
      honeypot = String(formData.get("companyWebsite") ?? "").trim();
      founderName = String(formData.get("founderName") ?? formData.get("name") ?? "").trim().slice(0, 120);
      founderEmail = String(formData.get("founderEmail") ?? formData.get("email") ?? "").trim().toLowerCase().slice(0, 160);
      linkedinUrl = normalizeUrl(String(formData.get("linkedinUrl") ?? "").slice(0, 240));
      companyName = String(formData.get("companyName") ?? "").trim().slice(0, 120);
      website = normalizeUrl(String(formData.get("website") ?? "").slice(0, 240));
      sector = String(formData.get("sector") ?? "").trim().slice(0, 80);
      oneLinePitch = String(formData.get("oneLinePitch") ?? "").trim().slice(0, 120);
      stage = String(formData.get("stage") ?? "").trim().slice(0, 40) || "Seed";
      location = String(formData.get("location") ?? "").trim().slice(0, 120);
      const priorRaw = String(formData.get("priorFunding") ?? "").replace(/[^0-9.]/g, "");
      priorFunding = priorRaw ? Number(priorRaw) : null;
      ref = String(formData.get("ref") ?? "").trim().slice(0, 80);
      const askRaw = String(formData.get("askAmount") ?? "").replace(/[^0-9.]/g, "");
      askAmount = askRaw ? Number(askRaw) : NaN;

      const fDeck = formData.get("deck");
      const fFin = formData.get("financials");
      if (fDeck instanceof File && fDeck.size > 0) formDeckFile = fDeck;
      if (fFin instanceof File && fFin.size > 0) formFinFile = fFin;
    }

    // Silent honeypot filter for spam bots
    if (honeypot) {
      return NextResponse.json({ ok: true, id: `pitch-${Date.now().toString(36)}`, receivedAt: new Date().toISOString() });
    }

    if (!founderName || !founderEmail || !companyName || !sector) {
      return NextResponse.json({ error: "Please complete all required founder and company fields." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founderEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (!Number.isFinite(askAmount) || askAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid funding ask amount in USD." }, { status: 400 });
    }
    if (askAmount > MAX_MANDATE_USD) {
      return NextResponse.json({ error: "Our current fund mandate is strictly capped at $4M." }, { status: 400 });
    }
    if (!directDeck && !formDeckFile) {
      return NextResponse.json({ error: "Please attach your pitch deck PDF." }, { status: 400 });
    }
    if ((directDeck?.size ?? 0) > MAX_PDF_BYTES || (formDeckFile?.size ?? 0) > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Pitch deck PDF must be 32 MB or smaller." }, { status: 413 });
    }

    const id = `${slugify(companyName)}-${Date.now().toString(36)}`;
    const receivedAt = new Date().toISOString();
    const drv = driver();
    const { city, country } = splitLocation(location);

    const deckFileName = directDeck ? directDeck.fileName : formDeckFile?.name || "deck.pdf";
    const deckFileSize = directDeck?.size ?? formDeckFile?.size ?? 0;
    const fileUrl = `/api/files/${encodeURIComponent(id)}/deck_pdf`;

    const hasFin = Boolean(directFin || (formFinFile && formFinFile.size > 0));
    const finFileName = directFin ? directFin.fileName : formFinFile?.name || "financials.csv";
    const finFileSize = directFin?.size ?? formFinFile?.size ?? 0;
    const finFileType = /\.csv$/i.test(finFileName) ? "monthly_csv" : "financial_sheet";
    const financialFileUrl = hasFin ? `/api/files/${encodeURIComponent(id)}/${finFileType}` : null;

    let sheet: SheetRow[] | null = null;
    if (directFin?.previewCsv) {
      try {
        sheet = parseSheet(directFin.previewCsv);
      } catch {
        sheet = null;
      }
    } else if (formFinFile && /\.csv$/i.test(formFinFile.name)) {
      try {
        sheet = parseSheet(await formFinFile.text());
      } catch {
        sheet = null;
      }
    }

    const form: FormInput = {
      companyName,
      website,
      country,
      sector,
      stage,
      amountUsd: askAmount,
      founders: [{ name: founderName, profileUrl: linkedinUrl }],
      email: founderEmail,
    };

    const files = [
      { name: deckFileName, size: deckFileSize, at: receivedAt.slice(0, 10), key: `pitch:${id}`, url: fileUrl },
      ...(hasFin
        ? [{ name: finFileName, size: finFileSize, at: receivedAt.slice(0, 10), key: `fin:${id}`, url: financialFileUrl! }]
        : []),
    ];

    const intake = {
      id,
      via: (ref ? "Referral" : "Website") as "Referral" | "Website",
      owner: ref || undefined,
      receivedAt,
      oneLiner: oneLinePitch || `${sector} · ${stage}${location ? ` · ${location}` : ""}`,
      form,
      files,
    };

    if (drv !== "none") {
      // 1. Initial insert into deals table (must happen before referencing in deal_files)
      await mergeDeals([
        {
          id,
          slug: id,
          company_name: companyName,
          sector,
          sub_category: sector,
          stage,
          country,
          city,
          ask_amount: askAmount,
          currency: "USD",
          status: "New",
          checks_status: "Unscreened",
          ai_status: "Processing",
          band: null,
          founder_fit: null,
          owner: ref || null,
          website,
          linkedin_url: linkedinUrl,
          founder_name: founderName,
          founder_email: founderEmail,
          one_line_pitch: oneLinePitch || null,
          location: location || null,
          prior_funding: Number.isFinite(priorFunding) ? priorFunding : null,
          financial_file_url: financialFileUrl,
          received_at: receivedAt,
          is_historical: false,
          record_json: null,
          intake_json: intake,
          decision_json: null,
          research_pack_json: null,
        },
      ]);

      // 2. Also sync the inbound record into app_state (ds.links.v1) so every browser store & dashboard tab sees it immediately
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
          ...(ref ? { owners: { ...(existingLinks.owners ?? {}), [id]: ref } } : {}),
        });
      } catch (stateErr) {
        console.error("[submit-pitch][state-sync]", stateErr);
      }

      // 3. Link or store assets in Supabase Storage / local files (with binary magic-byte validation)
      if (directDeck) {
        await recordUploadedFile(id, "deck_pdf", directDeck.fileName, directDeck.mimeType || "application/pdf", directDeck.storagePath);
      } else if (formDeckFile) {
        const pdfBytes = new Uint8Array(await formDeckFile.arrayBuffer());
        const pdfCheck = validatePdfBinary(pdfBytes, formDeckFile.name);
        if (!pdfCheck.ok) {
          return NextResponse.json({ error: pdfCheck.error }, { status: 400 });
        }
        await putPitchDeck(id, formDeckFile.name, formDeckFile.type || "application/pdf", pdfBytes);
      }

      if (directFin) {
        await recordUploadedFile(id, finFileType, directFin.fileName, directFin.mimeType || "text/csv", directFin.storagePath);
      } else if (formFinFile) {
        const finBytes = new Uint8Array(await formFinFile.arrayBuffer());
        const finCheck = validateFinancialBinary(finBytes, formFinFile.name);
        if (!finCheck.ok) {
          return NextResponse.json({ error: finCheck.error }, { status: 400 });
        }
        await putFinancialFile(id, finFileType, formFinFile.name, formFinFile.type || "text/csv", finBytes);
      }

      // 3. Trigger AI extraction (async via after() when Anthropic key is present to avoid request timeout)
      const runExtraction = async () => {
        try {
          let pdfBuffer: Buffer | null = null;
          const fileResult = await getFile(id, "deck_pdf");
          if (fileResult?.bytes) {
            pdfBuffer = Buffer.from(fileResult.bytes);
          }

          if (!sheet && hasFin) {
            const finResult = await getFile(id, finFileType);
            if (finResult?.bytes && finFileType === "monthly_csv") {
              try {
                sheet = parseSheet(Buffer.from(finResult.bytes).toString("utf8"));
              } catch {
                sheet = null;
              }
            }
          }

          if (hasKey() && pdfBuffer && pdfBuffer.subarray(0, 5).toString() === "%PDF-") {
            const deal = await processDeal({
              id,
              source: "upload",
              receivedAt,
              form,
              pdfBase64: pdfBuffer.toString("base64"),
              fileName: deckFileName,
              deckUrl: fileUrl,
              sheet,
            });
            const checksSummary = summarizeChecks(deal.flags);
            const teamScore = deal.scores.find((s) => s.key === "team")?.level ?? null;

            await patchDeal(id, {
              record_json: deal,
              band: deal.band,
              founder_fit: teamScore,
              summary: deal.ai.summary,
              checks_json: deal.flags,
              checks_status: checksSummary,
              ai_status: "Complete",
            });

            const existingDeals = (await getState<Record<string, DealResult>>(STATE_KEYS.deals)) ?? {};
            await putState(STATE_KEYS.deals, { ...existingDeals, [id]: deal });
          } else {
            // Deterministic code checks when ANTHROPIC_API_KEY is not configured
            const sheetSum = sheet && sheet.length ? summariseSheet(sheet) : null;
            const gold = {
              mrr: sheetSum?.mrr != null ? { amount: sheetSum.mrr, currency: sheetSum.currency || "USD" } : null,
              arr: sheetSum?.impliedArr != null ? { amount: sheetSum.impliedArr, currency: sheetSum.currency || "USD" } : null,
              growth: sheetSum?.avgGrowthPct ?? null,
              customers: sheetSum?.customers ?? null,
              team: sheetSum?.headcount ?? null,
              burn: sheetSum?.burn != null ? { amount: sheetSum.burn, currency: sheetSum.currency || "USD" } : null,
              cash: sheetSum?.cash != null ? { amount: sheetSum.cash, currency: sheetSum.currency || "USD" } : null,
              runway: sheetSum?.runwayMonths ?? null,
              round: askAmount,
              founded: null,
            };
            const preview = checkUpload(form, {
              gold,
              asOf: sheetSum?.to || null,
              sub: sector,
              city: city ?? "",
              founders: [],
              sheet,
              sheetFile: hasFin ? finFileName : null,
              deckFile: deckFileName,
              by: "System",
            });

            const dealObj = finishDeal({
              id,
              source: "upload",
              receivedAt,
              form,
              fileName: deckFileName,
              deckUrl: fileUrl,
              record: preview.record,
              sheet,
              registry: null,
              profiles: [],
              flags: preview.flags,
              assessment: {
                summary: oneLinePitch || `${companyName} (${sector}, ${stage}) submitted for review.`,
                founderChecks: [],
                traction: {
                  level: sheetSum?.mrr ? "Mixed" : "Weak",
                  reason: sheetSum?.mrr ? `Monthly revenue of $${sheetSum.mrr.toLocaleString()} reported in financials.` : "Early stage metrics without revenue history.",
                  evidence: sheetSum?.mrr ? [`Latest MRR: $${sheetSum.mrr.toLocaleString()}`, `Average growth: ${sheetSum.avgGrowthPct ?? 0}%`] : ["No revenue history in submission."],
                },
                team: {
                  level: "Mixed",
                  reason: `${founderName} (${linkedinUrl || "LinkedIn profile submitted"})`,
                  evidence: [`Founder: ${founderName}`],
                },
                strengths: [hasFin ? "Financial spreadsheet provided" : "Pitch deck attached"],
                concerns: preview.flags.filter((f) => f.kind === "conflict").map((f) => f.title),
                founderQuestions: [],
              },
              model: "deterministic-v2",
              runLog: [{ step: "Deterministic financial parsing & math checks", ms: 45 }],
            });

            const checksSummary = summarizeChecks(dealObj.flags);
            await patchDeal(id, {
              record_json: dealObj,
              checks_json: dealObj.flags,
              checks_status: checksSummary,
              band: dealObj.band,
              founder_fit: dealObj.scores.find((s) => s.key === "team")?.level ?? "Mixed",
              summary: dealObj.ai.summary,
              ai_status: "Complete",
            });

            const existingDeals = (await getState<Record<string, DealResult>>(STATE_KEYS.deals)) ?? {};
            await putState(STATE_KEYS.deals, { ...existingDeals, [id]: dealObj });
          }
        } catch (err) {
          console.error("[submit-pitch][ai]", err);
          await patchDeal(id, { ai_status: "Failed" }).catch(() => undefined);
        } finally {
          revalidatePath("/deals");
          revalidatePath("/");
        }
      };

      if (hasKey()) {
        after(runExtraction);
      } else {
        await runExtraction();
      }
    }

    const trackingToken = createPitchToken(id, founderEmail);
    const statusUrl = `/founder/dataroom/${encodeURIComponent(id)}?token=${encodeURIComponent(trackingToken)}`;

    await logAndNotify("FOUNDER_SUBMIT", founderEmail, {
      name: founderName,
      companyName,
      stage,
      amountUsd: askAmount,
      sector,
      location: location || undefined,
      dealId: id,
      receivedAt,
      statusUrl: `https://www.aarkavc.xyz${statusUrl}`,
      subject: `🚀 NEW PITCH: ${companyName}`,
      message: `${founderName} (${founderEmail}) just submitted a ${stage} pitch for ${companyName} asking for $${askAmount.toLocaleString("en-US")}.`,
    });

    revalidatePath("/deals");
    revalidatePath("/");

    try {
      broadcastRealtimeEvent("deal.created", {
        id,
        company_name: companyName,
        founder_name: founderName,
        founder_email: founderEmail,
        sector,
        stage,
        ask_amount: askAmount,
        receivedAt,
        fileUrl,
      });
    } catch {
      // broadcast non-blocking
    }

    return NextResponse.json({
      ok: true,
      id,
      receivedAt,
      trackingToken,
      statusUrl,
      aiStatus: hasKey() && drv !== "none" ? "Processing" : "Complete",
      persisted: drv === "none" ? "client" : drv,
      fileUrl,
      financialFileUrl,
    });
  } catch (e) {
    const err = e as Error;
    void recordAndAlertError({
      source: "api_route",
      message: err?.message || "Failed to submit pitch.",
      stack: err?.stack,
      url: "/api/submit-pitch",
      component: "POST /api/submit-pitch",
    });
    return NextResponse.json({ error: err?.message || "Failed to submit pitch." }, { status: 500 });
  }
}
