import { NextRequest, NextResponse } from "next/server";
import { getState, listFiles, listFounderDeals } from "@/lib/db/repository";
import { auth, authEnabled } from "@/lib/nextauth";

export interface SavedFounderMetrics {
  mrr?: string;
  cash?: string;
  burn?: string;
  headcount?: string;
  updatedAt?: string;
}

/**
 * Strictly isolated founder data room API:
 * Returns ONLY the signed-in founder's own submitted pitches, own uploaded files,
 * and own saved financial metrics. Never returns data from any other startup.
 */
export async function GET(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json({ pitches: [], selected: null, files: [], metrics: null });
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in required to view your data room." }, { status: 401 });
  }

  try {
    const pitches = await listFounderDeals(email);
    if (!pitches.length) {
      return NextResponse.json({
        user: { name: session?.user?.name ?? email.split("@")[0], email },
        pitches: [],
        selected: null,
        files: [],
        metrics: null,
      });
    }

    const requestedId = req.nextUrl.searchParams.get("id")?.trim();
    const selected = (requestedId ? pitches.find((p) => p.id === requestedId) : null) ?? pitches[0];

    const [rawFiles, metricsMap] = await Promise.all([
      listFiles(selected.id).catch(() => []),
      getState<Record<string, SavedFounderMetrics>>("founder_metrics_v1").catch(() => undefined),
    ]);

    const files = rawFiles.map((f) => ({
      id: f.id,
      fileType: f.file_type,
      fileName: f.file_name,
      mimeType: f.mime_type,
      uploadedAt: f.created_at ?? null,
      downloadUrl: `/api/founder/file?dealId=${encodeURIComponent(selected.id)}&fileType=${encodeURIComponent(f.file_type)}`,
    }));

    const metrics = metricsMap?.[selected.id] ?? null;

    return NextResponse.json({
      user: { name: session?.user?.name ?? email.split("@")[0], email },
      pitches,
      selected,
      files,
      metrics,
    });
  } catch (err) {
    console.error("[api/founder/dataroom] error:", err);
    return NextResponse.json({ error: "Could not load your data room." }, { status: 500 });
  }
}
