import { NextRequest, NextResponse } from "next/server";
import { getFile, getFileSignedUrl } from "@/lib/db/repository";
import { authorizeFounderDealAccess } from "@/lib/founder-token";

/** Strictly row-isolated file download: requires valid HMAC token for dealId OR verified owner/VC session. */
export async function GET(req: NextRequest) {
  const dealId = req.nextUrl.searchParams.get("dealId")?.trim() || "";
  const fileType = req.nextUrl.searchParams.get("fileType")?.trim() || "";
  const token = req.nextUrl.searchParams.get("token")?.trim() || req.headers.get("x-pitch-token")?.trim() || "";

  if (!dealId || !fileType) {
    return NextResponse.json({ error: "Missing dealId or fileType." }, { status: 400 });
  }

  const gate = await authorizeFounderDealAccess(dealId, token);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // Direct CDN signed URL redirect for Supabase Storage (zero lambda memory usage)
  const direct = req.nextUrl.searchParams.get("direct") !== "false";
  if (direct) {
    const signed = await getFileSignedUrl(dealId, fileType, 300);
    if (signed?.url) {
      return NextResponse.redirect(signed.url, 307);
    }
  }

  const hit = await getFile(dealId, fileType);
  if (!hit) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new Response(hit.bytes as BodyInit, {
    headers: {
      "Content-Type": hit.row.mime_type,
      "Content-Disposition": `inline; filename="${hit.row.file_name.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
