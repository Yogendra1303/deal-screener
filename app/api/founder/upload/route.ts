import { NextRequest, NextResponse } from "next/server";
import { driver, getDeal, putFile } from "@/lib/db/repository";
import { auth, authEnabled, requireRole } from "@/lib/nextauth";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export const maxDuration = 60;

const ALLOWED_CATEGORIES = new Set(["deck_pdf", "monthly_csv", "financial_sheet", "cap_table", "customer_contracts", "legal"]);
const MAX_BYTES = 32 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const gate = await requireRole(["VC", "FOUNDER", "analyst", "partner"]);
  if (!gate.ok) return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dealId = String(formData.get("dealId") || "").trim();
    const rawCategory = String(formData.get("category") || "").trim();
    const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : "financial_sheet";

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Please select a file to upload." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 32 MB limit." }, { status: 413 });
    }
    if (!dealId) {
      return NextResponse.json({ error: "Missing deal ID." }, { status: 400 });
    }

    const deal = await getDeal(dealId);
    if (!deal) {
      return NextResponse.json({ error: "Pitch record not found." }, { status: 404 });
    }

    // Strict founder ownership check: founders can ONLY upload into their own pitch record.
    if (authEnabled()) {
      const session = await auth();
      const email = session?.user?.email?.trim().toLowerCase();
      const isVc = session?.role === "VC";
      const ownerEmail = (
        deal.founder_email ||
        (deal.intake_json as { form?: { email?: string } } | null)?.form?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!isVc && (!email || ownerEmail !== email)) {
        return NextResponse.json({ error: "You can only upload documents to your own submission." }, { status: 403 });
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileUrl = `/api/founder/file?dealId=${encodeURIComponent(dealId)}&fileType=${encodeURIComponent(category)}`;

    if (driver() !== "none") {
      await putFile(dealId, category, file.name, file.type || "application/octet-stream", bytes, "pitch_decks");
    }

    try {
      broadcastRealtimeEvent("file.uploaded", {
        dealId,
        companyName: deal.company_name || dealId,
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
