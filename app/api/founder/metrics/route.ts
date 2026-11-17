import { NextRequest, NextResponse } from "next/server";
import { driver, getDeal, getState, patchDeal, putState } from "@/lib/db/repository";
import { auth, authEnabled, requireRole } from "@/lib/nextauth";
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
  const gate = await requireRole(["VC", "FOUNDER", "analyst", "partner"]);
  if (!gate.ok) return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const dealId = String(body.dealId || "").trim();
    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const currentDeal = await getDeal(dealId);
    if (!currentDeal) {
      return NextResponse.json({ error: "Pitch record not found." }, { status: 404 });
    }

    // Strict founder ownership check
    if (authEnabled()) {
      const session = await auth();
      const email = session?.user?.email?.trim().toLowerCase();
      const isVc = session?.role === "VC";
      const ownerEmail = (
        currentDeal.founder_email ||
        (currentDeal.intake_json as { form?: { email?: string } } | null)?.form?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!isVc && (!email || ownerEmail !== email)) {
        return NextResponse.json({ error: "You can only update metrics for your own submission." }, { status: 403 });
      }
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

    const vc = calculateVCMetrics(sheetRows, null, currentDeal.ask_amount);
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
      companyName: currentDeal.company_name || dealId,
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
