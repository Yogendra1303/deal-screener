import { NextRequest, NextResponse } from "next/server";
import { driver, insertAuditLog, patchDeal, putFile } from "@/lib/db/repository";
import { validateFinancialBinary, validatePdfBinary } from "@/lib/file-security";
import { authorizeFounderDealAccess } from "@/lib/founder-token";
import { checkRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import { parseSheet } from "@/lib/sheet";
import { calculateVCMetrics } from "@/lib/vc-metrics";

export const maxDuration = 60;

const ALLOWED_CATEGORIES = new Set(["deck_pdf", "monthly_csv", "financial_sheet", "cap_table", "customer_contracts", "legal"]);
const MAX_BYTES = 32 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit("founder_upload", getRequestIp(req), 20, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429, headers: rateLimitHeaders(rate) });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dealId = String(formData.get("dealId") || "").trim();
    const token = String(formData.get("token") || req.headers.get("x-pitch-token") || "").trim();
    const rawCategory = String(formData.get("category") || "").trim();
    const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : "financial_sheet";

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Please select a file to upload." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 32 MB limit." }, { status: 413 });
    }

    // Strict row-level authorization: valid deal-scoped HMAC token OR verified owner/VC session
    const gate = await authorizeFounderDealAccess(dealId, token);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.pdf$/i.test(file.name)) {
      const check = validatePdfBinary(bytes, file.name);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    } else if (/\.(csv|xlsx|xls)$/i.test(file.name)) {
      const check = validateFinancialBinary(bytes, file.name);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    }
    const tokenSuffix = token ? `&token=${encodeURIComponent(token)}` : "";
    const fileUrl = `/api/founder/file?dealId=${encodeURIComponent(dealId)}&fileType=${encodeURIComponent(category)}${tokenSuffix}`;

    let rescoredSummary: string | null = null;
    if (driver() !== "none") {
      await putFile(dealId, category, file.name, file.type || "application/octet-stream", bytes, "pitch_decks");

      // Automatically parse newly uploaded CSVs and refresh financial cross-check status on the deal
      if (/\.csv$/i.test(file.name) && (category === "monthly_csv" || category === "financial_sheet")) {
        try {
          const text = new TextDecoder("utf-8").decode(bytes);
          const rows = parseSheet(text);
          if (rows.length > 0) {
            const vc = calculateVCMetrics(rows, null, gate.deal.ask_amount);
            rescoredSummary = `CSV Updated (${rows.length} mo) · Runway: ${vc.runway.formatted}`;
            await patchDeal(dealId, {
              financial_file_url: `/api/files/${encodeURIComponent(dealId)}/${encodeURIComponent(category)}`,
              checks_status: rescoredSummary,
              updated_at: new Date().toISOString(),
            });
          }
        } catch {
          // Non-standard CSV format still saved cleanly in data room
        }
      }

      void insertAuditLog("FOUNDER_FILE_UPLOAD", gate.email || "founder", {
        dealId,
        companyName: gate.deal.company_name || dealId,
        fileName: file.name,
        category,
        rescoredSummary,
      }).catch(() => undefined);
    }

    try {
      broadcastRealtimeEvent("file.uploaded", {
        dealId,
        companyName: gate.deal.company_name || dealId,
        fileName: file.name,
        category,
        fileUrl,
        rescoredSummary,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      category,
      rescoredSummary,
      message: rescoredSummary
        ? `Document uploaded and financial metrics updated (${rescoredSummary}).`
        : "Document uploaded to your data room.",
    });
  } catch (err) {
    console.error("[api/founder/upload] error:", err);
    return NextResponse.json({ error: "Failed to upload document." }, { status: 500 });
  }
}
