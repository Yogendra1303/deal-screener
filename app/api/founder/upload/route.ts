import { NextRequest, NextResponse } from "next/server";
import { driver, putFile } from "@/lib/db/repository";
import { authorizeFounderDealAccess } from "@/lib/founder-token";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export const maxDuration = 60;

const ALLOWED_CATEGORIES = new Set(["deck_pdf", "monthly_csv", "financial_sheet", "cap_table", "customer_contracts", "legal"]);
const MAX_BYTES = 32 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
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
    const tokenSuffix = token ? `&token=${encodeURIComponent(token)}` : "";
    const fileUrl = `/api/founder/file?dealId=${encodeURIComponent(dealId)}&fileType=${encodeURIComponent(category)}${tokenSuffix}`;

    if (driver() !== "none") {
      await putFile(dealId, category, file.name, file.type || "application/octet-stream", bytes, "pitch_decks");
    }

    try {
      broadcastRealtimeEvent("file.uploaded", {
        dealId,
        companyName: gate.deal.company_name || dealId,
        fileName: file.name,
        category,
        fileUrl,
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
      message: "Document uploaded to your data room.",
    });
  } catch (err) {
    console.error("[api/founder/upload] error:", err);
    return NextResponse.json({ error: "Failed to upload document." }, { status: 500 });
  }
}
