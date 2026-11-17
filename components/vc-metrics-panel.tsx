"use client";

import { useMemo } from "react";
import { calculateVCMetrics } from "@/lib/vc-metrics";
import type { SheetRow } from "@/lib/types";
import type { DealRecord } from "@/lib/schema";
import { Card, cx } from "./ui";

export function VCMetricsPanel({
  sheet,
  record,
  askAmount,
  className,
}: {
  sheet: SheetRow[] | null;
  record?: Partial<DealRecord> | null;
  askAmount?: number | null;
  className?: string;
}) {
  const vc = useMemo(
    () => calculateVCMetrics(sheet, record, askAmount),
    [sheet, record, askAmount]
  );

  return (
    <Card className={cx("p-5 border border-slate-200 bg-white shadow-xs space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Institutional VC Scorecard
          </span>
          <span
            className={cx(
              "px-2 py-0.5 rounded text-[11px] font-semibold",
              vc.verdict === "Strong Conviction"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : vc.verdict === "Capital Efficiency Concern"
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            )}
          >
            {vc.verdict}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">VC Conviction Score:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold font-mono text-slate-900">{vc.overallScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Burn Multiple */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Burn Multiple</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.2 rounded",
                vc.burnMultiple.tier === "Exceptional"
                  ? "bg-emerald-100 text-emerald-800"
                  : vc.burnMultiple.tier === "Good"
                  ? "bg-blue-100 text-blue-800"
                  : vc.burnMultiple.tier === "High Burn Alarm"
                  ? "bg-red-100 text-red-800"
                  : "bg-slate-200 text-slate-700"
              )}
            >
              {vc.burnMultiple.tier}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{vc.burnMultiple.formatted}</div>
          <div className="text-[10px] text-slate-500 leading-tight truncate" title={vc.burnMultiple.explanation}>
            {vc.burnMultiple.explanation}
          </div>
        </div>

        {/* 2. Runway & Zero Cash Date */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Runway</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.2 rounded",
                vc.runway.status === "Healthy"
                  ? "bg-emerald-100 text-emerald-800"
                  : vc.runway.status === "Adequate"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
              )}
            >
              {vc.runway.status}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{vc.runway.formatted}</div>
          <div className="text-[10px] text-slate-500 leading-tight">
            {vc.runway.zeroCashDate ? `Zero cash: ${vc.runway.zeroCashDate}` : "Standard forecast"}
          </div>
        </div>

        {/* 3. Magic Number */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Magic Number</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">
              {vc.magicNumber.rating}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{vc.magicNumber.formatted}</div>
          <div className="text-[10px] text-slate-500 leading-tight truncate" title={vc.magicNumber.explanation}>
            {vc.magicNumber.explanation}
          </div>
        </div>

        {/* 4. Implied Ownership & Mandate */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Target Ownership</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.2 rounded",
                vc.ownership.status.includes("Within Mandate")
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              {vc.ownership.status.split(" ")[0]}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-900">{vc.ownership.formattedOwnership}</div>
          <div className="text-[10px] text-slate-500 leading-tight">
            {vc.ownership.impliedPostMoney
              ? `Implied Post: $${(vc.ownership.impliedPostMoney / 1_000_000).toFixed(1)}M`
              : "Mandate: 10-20%"}
          </div>
        </div>
      </div>
    </Card>
  );
}
