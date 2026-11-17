import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { hasKey } from "@/lib/ai";
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
import { processDeal } from "@/lib/pipeline";
import { parseSheet } from "@/lib/sheet";
import type { DealResult, Flag, FormInput, SheetRow } from "@/lib/types";
import { checkUpload } from "@/lib/upload";

export const maxDuration = 60;

const MAX_MANDATE_USD = 4_000_000;

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
  return { city: parts[0] || null, country: "India" };
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

    // Direct uploaded files metadata (lightweight JSON)
    let directDeck: DirectFilePayload | null = null;
    let directFin: DirectFilePayload | null = null;

    // Fallback FormData files
    let formDeckFile: File | null = null;
    let formFinFile: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      founderName = String(body.founderName ?? "").trim();
      founderEmail = String(body.founderEmail ?? "").trim();
      linkedinUrl = String(body.linkedinUrl ?? "").trim();
      companyName = String(body.companyName ?? "").trim();
      website = String(body.website ?? "").trim();
      sector = String(body.sector ?? "").trim();
      oneLinePitch = String(body.oneLinePitch ?? "").trim().slice(0, 60);
      stage = String(body.stage ?? "").trim() || "Seed";
      location = String(body.location ?? "").trim();
      priorFunding = typeof body.priorFunding === "number" && Number.isFinite(body.priorFunding) ? body.priorFunding : null;
      ref = String(body.ref ?? "").trim();
      askAmount = typeof body.askAmount === "number" ? body.askAmount : Number(body.askAmount);

      if (body.deck && typeof body.deck.storagePath === "string") {
        directDeck = {
          storagePath: body.deck.storagePath,
          fileName: String(body.deck.fileName || "deck.pdf"),
          mimeType: String(body.deck.mimeType || "application/pdf"),
          size: typeof body.deck.size === "number" ? body.deck.size : undefined,
        };
      }
      if (body.financials && typeof body.financials.storagePath === "string") {
        directFin = {
          storagePath: body.financials.storagePath,
          fileName: String(body.financials.fileName || "financials.csv"),
          mimeType: String(body.financials.mimeType || "text/csv"),
          size: typeof body.financials.size === "number" ? body.financials.size : undefined,
          previewCsv: typeof body.financials.previewCsv === "string" ? body.financials.previewCsv : undefined,
        };
      }
    } else {
      const formData = await req.formData();
      founderName = String(formData.get("founderName") ?? "").trim();
      founderEmail = String(formData.get("founderEmail") ?? "").trim();
      linkedinUrl = String(formData.get("linkedinUrl") ?? "").trim();
      companyName = String(formData.get("companyName") ?? "").trim();
      website = String(formData.get("website") ?? "").trim();
      sector = String(formData.get("sector") ?? "").trim();
      oneLinePitch = String(formData.get("oneLinePitch") ?? "").trim().slice(0, 60);
      stage = String(formData.get("stage") ?? "").trim() || "Seed";
      location = String(formData.get("location") ?? "").trim();
      const priorRaw = String(formData.get("priorFunding") ?? "").replace(/[^0-9.]/g, "");
      priorFunding = priorRaw ? Number(priorRaw) : null;
      ref = String(formData.get("ref") ?? "").trim();
      const askRaw = String(formData.get("askAmount") ?? "").replace(/[^0-9.]/g, "");
      askAmount = askRaw ? Number(askRaw) : NaN;

      const fDeck = formData.get("deck");
      const fFin = formData.get("financials");
      if (fDeck instanceof File && fDeck.size > 0) formDeckFile = fDeck;
      if (fFin instanceof File && fFin.size > 0) formFinFile = fFin;
    }

    if (!founderName || !founderEmail || !companyName || !sector) {
      return NextResponse.json({ error: "Please complete all required founder and company fields." }, { status: 400 });
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

      // 2. Link or store assets in Supabase Storage / local files
      if (directDeck) {
        await recordUploadedFile(id, "deck_pdf", directDeck.fileName, directDeck.mimeType || "application/pdf", directDeck.storagePath);
      } else if (formDeckFile) {
        const pdfBytes = Buffer.from(await formDeckFile.arrayBuffer());
        await putPitchDeck(id, formDeckFile.name, formDeckFile.type || "application/pdf", new Uint8Array(pdfBytes));
      }

      if (directFin) {
        await recordUploadedFile(id, finFileType, directFin.fileName, directFin.mimeType || "text/csv", directFin.storagePath);
      } else if (formFinFile) {
        const finBytes = new Uint8Array(await formFinFile.arrayBuffer());
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
            const preview = checkUpload(form, {
              gold: { mrr: null, arr: null, growth: null, customers: null, team: null, burn: null, cash: null, runway: null, round: askAmount, founded: null },
              asOf: null,
              sub: sector,
              city: city ?? "",
              founders: [],
              sheet,
              sheetFile: hasFin ? finFileName : null,
              deckFile: deckFileName,
              by: "System",
            });
            await patchDeal(id, {
              checks_json: preview.flags,
              checks_status: summarizeChecks(preview.flags),
              summary: oneLinePitch || `${companyName} (${sector}, ${stage}) submitted for review.`,
              ai_status: "Complete",
            });
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

    after(() =>
      logAndNotify("FOUNDER_SUBMIT", founderEmail, {
        name: founderName,
        companyName,
        stage,
        amountUsd: askAmount,
        sector,
        location: location || undefined,
        dealId: id,
        subject: `🚀 NEW PITCH: ${companyName}`,
        message: `${founderName} just submitted a ${stage} pitch asking for $${askAmount.toLocaleString("en-US")}.`,
      }),
    );

    revalidatePath("/deals");
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      id,
      receivedAt,
      aiStatus: hasKey() && drv !== "none" ? "Processing" : "Complete",
      persisted: drv === "none" ? "client" : drv,
      fileUrl,
      financialFileUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to submit pitch." }, { status: 500 });
  }
}
