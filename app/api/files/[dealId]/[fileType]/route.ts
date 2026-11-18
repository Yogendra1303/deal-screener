// The original files behind a deal: the deck PDF, the monthly CSV, the intake form. PUT stores one, GET serves it back.
import { NextResponse } from "next/server";
import { NoDatabaseError, getFile, getFileSignedUrl, putFile } from "@/lib/db/repository";
import { requireRole } from "@/lib/nextauth";

// deck_pdf, monthly_csv, intake_form, registry_json, audit_html, or a founder-link file key.
const TYPE = /^[a-zA-Z0-9_.-]{1,120}$/;
const MAX = 32 * 1024 * 1024;
const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET(request: Request, ctx: { params: Promise<{ dealId: string; fileType: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const { dealId, fileType } = await ctx.params;
  try {
    const url = new URL(request.url);
    const direct = url.searchParams.get("direct") !== "false";

    // 1. Direct CDN signed redirect for Supabase Storage to eliminate serverless memory buffering
    if (direct) {
      const signed = await getFileSignedUrl(dealId, fileType, 300);
      if (signed?.url) {
        return NextResponse.redirect(signed.url, 307);
      }
    }

    // 2. Fallback to direct buffer response (local file storage driver or direct=false)
    const hit = await getFile(dealId, fileType);
    if (!hit) return Response.json({ error: "No such file." }, { status: 404 });
    const download = url.searchParams.get("download") != null;
    return new Response(hit.bytes as BodyInit, {
      headers: {
        "Content-Type": hit.row.mime_type,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${hit.row.file_name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ dealId: string; fileType: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const { dealId, fileType } = await ctx.params;
  if (!TYPE.test(fileType) || !/^[a-zA-Z0-9_.-]{1,80}$/.test(dealId)) return Response.json({ error: "Use letters, digits, dots, dashes and underscores in the deal id and file type." }, { status: 400 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return Response.json({ error: "The file is empty." }, { status: 400 });
  if (bytes.length > MAX) return Response.json({ error: "The file is larger than 32 MB." }, { status: 413 });
  const name = decodeURIComponent(request.headers.get("x-file-name") ?? "") || `${fileType}.bin`;
  try {
    const row = await putFile(dealId, fileType, name, request.headers.get("content-type") ?? "application/octet-stream", bytes);
    return Response.json({ ok: true, file: row, url: `/api/files/${encodeURIComponent(dealId)}/${encodeURIComponent(fileType)}` });
  } catch (e) {
    return fail(e);
  }
}
