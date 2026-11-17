import { NextRequest, NextResponse } from "next/server";
import { driver, getState, patchDeal, putState } from "@/lib/db/repository";
import { authorizeFounderDealAccess } from "@/lib/founder-token";
import { calculateVCMetrics } from "@/lib/vc-metrics";
import { broadcastRealtimeEvent } from "@/lib/realtime";

interface SavedFounderMetrics {
  mrr?: string;
  cash?: string;
  burn?: string;
  headcount?: string;
  updatedAt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const dealId = String(body.dealId || "").trim();
    const token = String(body.token || req.headers.get("x-pitch-token") || "").trim();

    // Strict row-level authorization: valid deal-scoped HMAC token OR verified owner/VC session
    const gate = await authorizeFounderDealAccess(dealId, token);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    const mrrStr = String(body.mrr ?? "").trim();
    const cashStr = String(body.cash ?? "").trim();
    const burnStr = String(body.burn ?? "").trim();
    const headStr = String(body.headcount ?? "").trim();

    const numMrr = Number(mrrStr.replace(/[^0-9.]/g, "")) || 0;
    const numCash = Number(cashStr.replace(/[^0-9.]/g, "")) || 0;
    const numBurn = Number(burnStr.replace(/[^0-9.]/g, "")) || 0;
    const numHead = Number(headStr.replace(/[^0-9.]/g, "")) || 0;

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

    const vc = calculateVCMetrics(sheetRows, null, gate.deal.ask_amount);
    const updatedAt = new Date().toISOString();

    if (driver() !== "none") {
      await patchDeal(dealId, {
        checks_status: `Runway: ${vc.runway.formatted} · Burn: ${vc.burnMultiple.formatted}`,
        updated_at: updatedAt,
      });

      const existing = (await getState<Record<string, SavedFounderMetrics>>("founder_metrics_v1").catch(() => undefined)) ?? {};
      await putState("founder_metrics_v1", {
        ...existing,
        [dealId]: {
          mrr: mrrStr,
          cash: cashStr,
          burn: burnStr,
          headcount: headStr,
          updatedAt,
        },
      });
    }

    broadcastRealtimeEvent("metrics.updated", {
      dealId,
      companyName: gate.deal.company_name || dealId,
      vc_metrics: vc,
      updatedAt,
    });

    return NextResponse.json({
      ok: true,
      updatedAt,
      message: "Financial metrics saved to your submission.",
    });
  } catch (err) {
    console.error("[api/founder/metrics] error:", err);
    return NextResponse.json({ error: "Failed to save financial metrics." }, { status: 500 });
  }
}
