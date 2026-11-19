import { NextRequest, NextResponse } from "next/server";
import { getState, listFiles, listFounderDeals, type DealRow, type FounderPitchSummary } from "@/lib/db/repository";
import { authorizeFounderDealAccess } from "@/lib/founder-token";
import { auth, authEnabled } from "@/lib/nextauth";

export interface SavedFounderMetrics {
  mrr?: string;
  cash?: string;
  burn?: string;
  headcount?: string;
  updatedAt?: string;
}

function mapPublicStatus(raw: string | null | undefined): string {
  switch ((raw ?? "").toLowerCase()) {
    case "meeting":
    case "meeting set":
      return "Meeting Scheduled";
    case "reviewing":
      return "Under Review";
    case "on hold":
      return "On Hold";
    case "passed":
      return "Passed";
    case "new":
    default:
      return "Received";
  }
}

function toSafeFounderSummary(d: DealRow): FounderPitchSummary {
  const intakeName = (d.intake_json as { form?: { companyName?: string } } | null)?.form?.companyName?.trim();
  const displayName =
    intakeName && (!d.company_name || d.company_name === d.id || d.company_name === d.slug)
      ? intakeName
      : d.company_name || intakeName || d.id;

  return {
    id: d.id,
    companyName: displayName,
    sector: d.sector,
    stage: d.stage,
    askAmount: d.ask_amount,
    receivedAt: d.received_at,
    status: mapPublicStatus(d.status),
    location: d.location || [d.city, d.country].filter(Boolean).join(", ") || null,
    website: d.website,
    oneLinePitch: d.one_line_pitch,
    founderName: d.founder_name,
    founderEmail: d.founder_email,
  };
}

/**
 * Strictly row-isolated Founder Data Room & Pitch Status API.
 * Enforces either:
 *   1) Cryptographic deal-scoped HMAC token (?id=<dealId>&token=<hmac>) - locked strictly to ONE dealId.
 *      Tampering with ?id= (e.g. 123 -> 124) immediately returns 403 Forbidden.
 *   2) Authenticated NextAuth session owning the requested dealId (or approved VC).
 * Never leaks internal math flags, partner notes, or any other startup's records.
 */
export async function GET(req: NextRequest) {
  const requestedId = req.nextUrl.searchParams.get("id")?.trim() || "";
  const token = req.nextUrl.searchParams.get("token")?.trim() || req.headers.get("x-pitch-token")?.trim() || "";

  try {
    // Path 1: Token-scoped access (strictly locked to ONE dealId)
    if (token) {
      if (!requestedId) {
        return NextResponse.json({ error: "Missing pitch ID." }, { status: 400 });
      }
      const gate = await authorizeFounderDealAccess(requestedId, token);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }

      const selected = toSafeFounderSummary(gate.deal);
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
        downloadUrl: `/api/founder/file?dealId=${encodeURIComponent(selected.id)}&fileType=${encodeURIComponent(f.file_type)}&token=${encodeURIComponent(token)}`,
      }));

      return NextResponse.json({
        user: { name: selected.founderName || "Founder", email: selected.founderEmail || "" },
        pitches: [selected],
        selected,
        files,
        metrics: metricsMap?.[selected.id] ?? null,
      });
    }

    // Path 2: Session-scoped access (must be signed in; if requestedId is passed, verify strict ownership!)
    if (!authEnabled()) {
      return NextResponse.json({ pitches: [], selected: null, files: [], metrics: null });
    }

    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "A valid pitch tracking link or sign-in is required." }, { status: 401 });
    }

    if (requestedId) {
      const gate = await authorizeFounderDealAccess(requestedId, null);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
      const selected = toSafeFounderSummary(gate.deal);
      const pitches = await listFounderDeals(email);
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

      return NextResponse.json({
        user: { name: session?.user?.name ?? email.split("@")[0], email },
        pitches: pitches.some((p) => p.id === selected.id) ? pitches : [selected],
        selected,
        files,
        metrics: metricsMap?.[selected.id] ?? null,
      });
    }

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

    const selected = pitches[0];
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

    return NextResponse.json({
      user: { name: session?.user?.name ?? email.split("@")[0], email },
      pitches,
      selected,
      files,
      metrics: metricsMap?.[selected.id] ?? null,
    });
  } catch (err) {
    console.error("[api/founder/dataroom] error:", err);
    return NextResponse.json({ error: "Could not load your data room." }, { status: 500 });
  }
}
