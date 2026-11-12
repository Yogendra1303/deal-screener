// The original files behind a deal: the deck PDF, the monthly CSV, the intake form. PUT stores one, GET serves it back.
import { NoDatabaseError, getFile, putFile } from "@/lib/db/repository";

// deck_pdf, monthly_csv, intake_form, registry_json, audit_html, or a founder-link file key.
const TYPE = /^[a-zA-Z0-9_.-]{1,120}$/;
const MAX = 32 * 1024 * 1024;
const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET(request: Request, ctx: { params: Promise<{ dealId: string; fileType: string }> }) {
  const { dealId, fileType } = await ctx.params;
  try {
    const hit = await getFile(dealId, fileType);
    if (!hit) return Response.json({ error: "No such file." }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download") != null;
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
