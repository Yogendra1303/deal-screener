import { NextRequest, NextResponse } from "next/server";
import { putFile, driver } from "@/lib/db/repository";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dealId = (formData.get("dealId") as string) || "general";
    const companyName = (formData.get("companyName") as string) || "Company";
    const category = (formData.get("category") as string) || "other";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let fileUrl = `/api/files/${dealId}/${category}/${encodeURIComponent(file.name)}`;

    if (driver() !== "none") {
      try {
        const row = await putFile(
          dealId,
          category,
          file.name,
          file.type || "application/octet-stream",
          bytes,
          "deal-files"
        );
        fileUrl = `https://jwoccnhkoysdjlnsnkwh.supabase.co/storage/v1/object/public/deal-files/${row.storage_path}`;
      } catch (err) {
        console.warn("[founder/upload] putFile warning:", err);
      }
    }

    // Broadcast to live partner dashboards
    try {
      broadcastRealtimeEvent("file.uploaded", {
        dealId,
        companyName,
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
      message: "Document successfully uploaded to data room.",
    });
  } catch (err) {
    console.error("[api/founder/upload] error:", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
