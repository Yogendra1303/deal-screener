import { NextRequest, NextResponse } from "next/server";
import { getDeal, getState, insertAuditLog, putState } from "@/lib/db/repository";
import { runLiveEnrichment, type EnrichmentReport } from "@/lib/enrichment";
import { auth, requireRole } from "@/lib/nextauth";

export const maxDuration = 30;

const STATE_KEY = "deal_enrichment_v1";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const all = (await getState<Record<string, EnrichmentReport>>(STATE_KEY).catch(() => undefined)) ?? {};
  return NextResponse.json({ ok: true, report: all[id] ?? null });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    companyName?: string;
    website?: string;
    country?: string;
    founderNames?: string[];
  };

  const deal = await getDeal(id).catch(() => null);
  const companyName = String(body.companyName || deal?.company_name || id).trim();
  const website = String(body.website || deal?.website || "").trim();
  const country = String(body.country || deal?.country || "").trim();
  const founderNames = Array.isArray(body.founderNames)
    ? body.founderNames.map((n) => String(n))
    : deal?.founder_name
      ? [deal.founder_name]
      : [];

  const report = await runLiveEnrichment({
    dealId: id,
    companyName,
    website,
    country,
    founderNames,
  });

  const all = (await getState<Record<string, EnrichmentReport>>(STATE_KEY).catch(() => undefined)) ?? {};
  await putState(STATE_KEY, { ...all, [id]: report });

  const session = await auth().catch(() => null);
  void insertAuditLog("DEAL_ENRICH", session?.user?.email || "partner", {
    dealId: id,
    companyName,
    websiteReachable: report.website?.reachable ?? null,
    mentionsCount: report.mentions.length,
    message: `Ran live website & registry enrichment on ${companyName} (${report.mentions.length} public mentions).`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, report });
}
