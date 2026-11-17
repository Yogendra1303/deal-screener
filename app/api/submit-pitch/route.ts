import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { hasKey } from "@/lib/ai";
import { STATE_KEYS } from "@/lib/db/project";
import { driver, getState, mergeDeals, patchDeal, putFinancialFile, putPitchDeck, putState } from "@/lib/db/repository";
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const founderName = String(formData.get("founderName") ?? "").trim();
    const founderEmail = String(formData.get("founderEmail") ?? "").trim();
    const linkedinUrl = String(formData.get("linkedinUrl") ?? "").trim();
    const companyName = String(formData.get("companyName") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const sector = String(formData.get("sector") ?? "").trim();
    const oneLinePitch = String(formData.get("oneLinePitch") ?? "").trim().slice(0, 60);
    const stage = String(formData.get("stage") ?? "").trim() || "Seed";
    const location = String(formData.get("location") ?? "").trim();
    const priorRaw = String(formData.get("priorFunding") ?? "").replace(/[^0-9.]/g, "");
    const priorFunding = priorRaw ? Number(priorRaw) : null;
    const ref = String(formData.get("ref") ?? "").trim();
    const askRaw = String(formData.get("askAmount") ?? "").replace(/[^0-9.]/g, "");
    const askAmount = askRaw ? Number(askRaw) : NaN;
    const file = formData.get("deck");
    const fin = formData.get("financials");

    if (!founderName || !founderEmail || !companyName || !sector) {
      return NextResponse.json({ error: "Please complete all required founder and company fields." }, { status: 400 });
    }
    if (!Number.isFinite(askAmount) || askAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid funding ask amount in USD." }, { status: 400 });
    }
    if (askAmount > MAX_MANDATE_USD) {
      return NextResponse.json({ error: "Our current fund mandate is strictly capped at $4M." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Please attach your pitch deck PDF." }, { status: 400 });
    }

    const id = `${slugify(companyName)}-${Date.now().toString(36)}`;
    const receivedAt = new Date().toISOString();
    const drv = driver();
    const fileUrl = `/api/files/${encodeURIComponent(id)}/deck_pdf`;
    const hasFin = fin instanceof File && fin.size > 0;
    const finFileType = hasFin && /\.csv$/i.test(fin.name) ? "monthly_csv" : "financial_sheet";
    const financialFileUrl = hasFin ? `/api/files/${encodeURIComponent(id)}/${finFileType}` : null;
    const { city, country } = splitLocation(location);

    let sheet: SheetRow[] | null = null;
    if (hasFin && /\.csv$/i.test(fin.name)) {
      try {
        sheet = parseSheet(await fin.text());
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
      { name: file.name, size: file.size, at: receivedAt.slice(0, 10), key: `pitch:${id}`, url: fileUrl },
      ...(hasFin
        ? [{ name: fin.name, size: fin.size, at: receivedAt.slice(0, 10), key: `fin:${id}`, url: financialFileUrl! }]
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

    const pdfBytes = Buffer.from(await file.arrayBuffer());

    if (drv !== "none") {
      // 1. Store assets in Supabase Storage / local storage
      await putPitchDeck(id, file.name, file.type || "application/pdf", new Uint8Array(pdfBytes));
      if (hasFin) {
        const finBytes = new Uint8Array(await fin.arrayBuffer());
        await putFinancialFile(id, finFileType, fin.name, fin.type || "text/csv", finBytes);
      }

      // 2. Initial insert with status = "New" and ai_status = "Processing"
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

      // 3. Trigger AI extraction (async via after() when Anthropic key is present to avoid request timeout)
      const runExtraction = async () => {
        try {
          if (hasKey() && pdfBytes.subarray(0, 5).toString() === "%PDF-") {
            const deal = await processDeal({
              id,
              source: "upload",
              receivedAt,
              form,
              pdfBase64: pdfBytes.toString("base64"),
              fileName: file.name || "deck.pdf",
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
              sheetFile: hasFin ? fin.name : null,
              deckFile: file.name,
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
