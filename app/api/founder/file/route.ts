import { NextRequest, NextResponse } from "next/server";
import { getDeal, getFile } from "@/lib/db/repository";
import { auth, authEnabled } from "@/lib/nextauth";

/** Allows a signed-in founder (or VC partner) to download ONLY files belonging to their own submitted deal. */
export async function GET(req: NextRequest) {
  const dealId = req.nextUrl.searchParams.get("dealId")?.trim() || "";
  const fileType = req.nextUrl.searchParams.get("fileType")?.trim() || "";
  if (!dealId || !fileType) {
    return NextResponse.json({ error: "Missing dealId or fileType." }, { status: 400 });
  }

  if (authEnabled()) {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isVc = session?.role === "VC";
    if (!isVc) {
      const deal = await getDeal(dealId);
      const ownerEmail = (
        deal?.founder_email ||
        (deal?.intake_json as { form?: { email?: string } } | null)?.form?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!deal || ownerEmail !== email) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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
