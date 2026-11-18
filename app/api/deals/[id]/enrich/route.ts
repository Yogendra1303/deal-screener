import { NextRequest, NextResponse } from "next/server";
import { driver, getDeal, getState, insertAuditLog, patchDeal, putState } from "@/lib/db/repository";
import { runLiveEnrichment, type EnrichmentReport } from "@/lib/enrichment";
import { auth, requireRole } from "@/lib/nextauth";
import { checkRateLimit, getRequestIp, rateLimitHeaders } from "@/lib/rate-limit";

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

  const rate = checkRateLimit("deal_enrich", getRequestIp(req), 20, 10 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many enrichment lookups. Please wait a minute and try again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
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

  // Mirror enrichment onto deals.research_pack_json when the deal row exists
  if (deal && driver() !== "none") {
    const prevPack = (deal.research_pack_json && typeof deal.research_pack_json === "object"
      ? deal.research_pack_json
      : {}) as Record<string, unknown>;
    await patchDeal(id, {
      research_pack_json: { ...prevPack, liveEnrichment: report },
    }).catch(() => undefined);
  }

  const session = await auth().catch(() => null);
  void insertAuditLog("DEAL_ENRICH", session?.user?.email || "partner", {
    dealId: id,
    companyName,
    websiteReachable: report.website?.reachable ?? null,
    mentionsCount: report.mentions.length,
    message: `Ran live website & registry enrichment on ${companyName} (${report.mentions.length} public mentions).`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, report }, { headers: rateLimitHeaders(rate) });
}
