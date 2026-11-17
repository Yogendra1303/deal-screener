import { NextRequest, NextResponse } from "next/server";
import { patchDeal, getDeal, driver } from "@/lib/db/repository";
import { calculateVCMetrics } from "@/lib/vc-metrics";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { dealId, mrr, cash, burn, headcount, notes } = body;

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const currentDeal = await getDeal(dealId);
    const numMrr = Number(mrr || 0);
    const numCash = Number(cash || 0);
    const numBurn = Number(burn || 0);
    const numHead = Number(headcount || 0);

    const sheetRows = [
      {
        month: new Date().toISOString().slice(0, 7),
        currency: "USD",
        revenue: numMrr,
        customers: null,
        headcount: numHead,
        netBurn: numBurn,
        cash: numCash,
      },
    ];

    const vc = calculateVCMetrics(sheetRows, null, currentDeal?.ask_amount);

    if (driver() !== "none") {
      await patchDeal(dealId, {
        checks_status: `Runway: ${vc.runway.formatted} · Burn: ${vc.burnMultiple.formatted} · Score: ${vc.overallScore}`,
        updated_at: new Date().toISOString(),
      });
    }

    broadcastRealtimeEvent("metrics.updated", {
      dealId,
      companyName: currentDeal?.company_name || dealId,
      vc_metrics: vc,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      vc_metrics: vc,
      message: "Financial metrics successfully synced to investment committee.",
    });
  } catch (err) {
    console.error("[api/founder/metrics] error:", err);
    return NextResponse.json({ error: "Failed to update metrics" }, { status: 500 });
  }
}
