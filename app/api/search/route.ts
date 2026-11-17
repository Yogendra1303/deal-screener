import { NextRequest, NextResponse } from "next/server";
import { listDeals, type DealRow } from "@/lib/db/repository";
import { SEED_RESULTS } from "@/lib/data";
import { requireRole } from "@/lib/nextauth";
import { searchDealsIndex } from "@/lib/search-index";

/** Partner-only Full-Text & Semantic Deal Search API across all Supabase deals & canonical records. */
export async function GET(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ ok: true, query: "", hits: [] });
  }

  try {
    const dbDeals = await listDeals().catch(() => []);
    const byId = new Map<string, DealRow>();

    // Include canonical seed deals so search works even before DB rows are touched
    for (const d of Object.values(SEED_RESULTS)) {
      byId.set(d.id, {
        id: d.id,
        slug: d.id,
        company_name: d.form.companyName,
        sector: d.form.sector,
        sub_category: d.record.company.sector.value || d.form.sector,
        stage: d.form.stage,
        country: d.form.country,
        city: d.record.company.city.value || null,
        ask_amount: d.form.amountUsd,
        currency: "USD",
        status: "New",
        band: d.band,
        founder_fit: d.scores.find((s) => s.key === "team")?.level ?? null,
        owner: null,
        is_historical: false,
        record_json: d,
        intake_json: null,
        decision_json: null,
        research_pack_json: null,
        received_at: d.receivedAt,
        updated_at: d.receivedAt,
      });
    }

    for (const row of dbDeals) {
      byId.set(row.id, row);
    }

    const hits = searchDealsIndex([...byId.values()], q, 12);
    return NextResponse.json({ ok: true, query: q, count: hits.length, hits });
  } catch (err) {
    console.error("[api/search] error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
