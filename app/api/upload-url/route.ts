import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set(["deck_pdf", "monthly_csv", "financial_sheet"]);
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 25;
const ipHits = new Map<string, number[]>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const prev = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_LIMIT) {
    ipHits.set(ip, prev);
    return false;
  }
  prev.push(now);
  ipHits.set(ip, prev);
  return true;
}

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
    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (!checkRate(ip)) {
      return NextResponse.json({ error: "Too many upload requests. Please wait a few minutes and try again." }, { status: 429 });
    }

    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    if (!sbUrl || !sbKey) {
      return NextResponse.json({ ok: true, direct: false });
    }

    const body = (await req.json().catch(() => ({}))) as {
      fileName?: string;
      fileType?: string;
      dealSlug?: string;
    };

    const fileType = ALLOWED_TYPES.has(String(body.fileType || "")) ? String(body.fileType) : "deck_pdf";
    const fileName = safe(body.fileName || (fileType === "deck_pdf" ? "document.pdf" : "financials.csv"));

    if (fileType === "deck_pdf" && !/\.pdf$/i.test(fileName)) {
      return NextResponse.json({ error: "Pitch deck must be a PDF file." }, { status: 400 });
    }
    if (fileType !== "deck_pdf" && !/\.(csv|xlsx|xls)$/i.test(fileName)) {
      return NextResponse.json({ error: "Financial sheet must be a .csv or .xlsx file." }, { status: 400 });
    }

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
