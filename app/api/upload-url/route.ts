import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function safe(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 100);
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "pitch"
  );
}

export async function POST(req: Request) {
  try {
    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    if (!sbUrl || !sbKey) {
      // Local fallback mode when Supabase is not configured
      return NextResponse.json({ ok: true, direct: false });
    }

    const body = (await req.json().catch(() => ({}))) as {
      fileName?: string;
      fileType?: string;
      dealSlug?: string;
    };

    const fileName = safe(body.fileName || "document.pdf");
    const fileType = safe(body.fileType || "deck_pdf");
    const dealSlug = slugify(body.dealSlug || "pitch");

    const storagePath = `${dealSlug}-${Date.now().toString(36)}/${fileType}/${fileName}`;
    const sb = createClient(sbUrl, sbKey);

    const { data, error } = await sb.storage.from("pitch_decks").createSignedUploadUrl(storagePath);
    if (error || !data) {
      console.error("[upload-url] createSignedUploadUrl error:", error);
      return NextResponse.json({ error: error?.message || "Failed to generate upload URL." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      direct: true,
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
      bucket: "pitch_decks",
    });
  } catch (err) {
    console.error("[upload-url] unexpected error:", err);
    return NextResponse.json({ error: "Could not generate upload URL." }, { status: 500 });
  }
}
