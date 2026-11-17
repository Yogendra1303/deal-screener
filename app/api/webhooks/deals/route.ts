import { NextRequest, NextResponse } from "next/server";
import { mergeDeals, type DealRow } from "@/lib/db/repository";
import { requireRole } from "@/lib/nextauth";
import { calculateVCMetrics } from "@/lib/vc-metrics";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-aarka-secret") || req.headers.get("authorization");
    const expectedSecret = process.env.AARKA_WEBHOOK_SECRET;
    const validSecret = Boolean(expectedSecret && (secret === `Bearer ${expectedSecret}` || secret === expectedSecret));
    if (!validSecret) {
      const gate = await requireRole();
      if (!gate.ok) {
        return NextResponse.json({ error: "Unauthorized webhook request" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const companyName = body.company_name || body.name || body.company;
    if (!companyName) {
      return NextResponse.json({ error: "Missing required field: company_name" }, { status: 400 });
    }

    const id = `wh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const askAmount = Number(body.ask_amount || body.ask || 1_500_000);
    const mrr = Number(body.mrr || body.monthly_revenue || 25_000);
    const cash = Number(body.cash || body.cash_balance || 450_000);
    const burn = Number(body.burn || body.net_burn || 35_000);

    // Compute VC metrics
    const sampleRows = [
      { month: "2026-08", currency: "USD", revenue: Math.round(mrr * 0.75), customers: 12, headcount: 5, netBurn: burn, cash: cash + burn * 2 },
      { month: "2026-09", currency: "USD", revenue: Math.round(mrr * 0.88), customers: 15, headcount: 5, netBurn: burn, cash: cash + burn },
      { month: "2026-10", currency: "USD", revenue: mrr, customers: 18, headcount: 6, netBurn: burn, cash: cash },
    ];
    const vc = calculateVCMetrics(sampleRows, null, askAmount);

    const dealRow: Partial<DealRow> & { id: string } = {
      id,
      slug,
      company_name: companyName,
      sector: body.sector || "B2B software",
      sub_category: body.sub_category || "Enterprise Tech",
      stage: body.stage || "Seed",
      country: body.country || "India",
      city: body.city || "Bengaluru",
      ask_amount: askAmount,
      currency: "USD",
      founder_name: body.founder_name || "Founder",
      founder_email: body.email || null,
      owner: null,
      status: "unreviewed",
      checks_status: `Runway: ${vc.runway.formatted} · Burn: ${vc.burnMultiple.formatted}`,
      band: null,
      founder_fit: null,
      is_historical: false,
      record_json: null,
      intake_json: null,
      decision_json: null,
      research_pack_json: null,
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await mergeDeals([dealRow]);

    // Broadcast live event across all open partner dashboards
    broadcastRealtimeEvent("deal.created", dealRow);

    return NextResponse.json({
      success: true,
      deal_id: id,
      slug,
      company_name: companyName,
      vc_metrics: vc,
      message: "Deal successfully ingested and broadcasted to live dashboards.",
    });
  } catch (err) {
    console.error("[api/webhooks/deals] error:", err);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
