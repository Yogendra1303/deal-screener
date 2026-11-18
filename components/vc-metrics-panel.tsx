"use client";

import { useMemo, useState } from "react";
import { calculateVCMetrics, type ConvictionDimension, type VCMetricsResult } from "@/lib/vc-metrics";
import type { DealResult, SheetRow } from "@/lib/types";
import type { DealRecord } from "@/lib/schema";
import { Card, cx } from "./ui";

export function VCMetricsPanel({
  deal,
  sheet,
  record,
  askAmount,
  className,
}: {
  deal?: DealResult | null;
  sheet: SheetRow[] | null;
  record?: Partial<DealRecord> | null;
  askAmount?: number | null;
  className?: string;
}) {
  const [activeInspector, setActiveInspector] = useState<{
    title: string;
    dimension?: ConvictionDimension;
    isMasterFormula?: boolean;
  } | null>(null);

  const vc = useMemo(
    () => calculateVCMetrics(sheet, record, askAmount, deal ? { deal } : null),
    [sheet, record, askAmount, deal]
  );

  const gradeColors: Record<string, { bg: string; text: string; ring: string }> = {
    A: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
    B: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
    C: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
    D: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-200" },
    E: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
    G: { bg: "bg-slate-100", text: "text-slate-800", ring: "ring-slate-300" },
  };

  const gStyle = gradeColors[vc.grade] || gradeColors.G;

  return (
    <Card className={cx("p-5 border border-slate-200 bg-white shadow-xs space-y-4", className)}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Institutional VC Scorecard
          </span>
          <span className={cx("px-2 py-0.5 rounded text-[11px] font-semibold ring-1 ring-inset", gStyle.bg, gStyle.text, gStyle.ring)}>
            Grade {vc.grade}: {vc.conviction.tierLabel.split(" · ")[0]}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveInspector({ title: "Master VC Conviction Formula & Rating Matrix", isMasterFormula: true })}
            className="cursor-pointer text-xs font-semibold text-blue-600 underline decoration-blue-200 underline-offset-2 hover:text-blue-800"
          >
            Inspect Conviction Formula
          </button>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
            <span className="text-xs font-medium text-slate-500">Conviction:</span>
            <span className="text-base font-bold font-mono text-slate-900">{vc.overallScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>
      </div>

      {/* Pitch Deck Structural Validation Alert */}
      {((deal?.deckValidation && !deal.deckValidation.isPitchDeck) ||
        deal?.flags?.some((f) => f.checkId === "non_pitch_deck")) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900">
          <span>
            <strong>Pitch Deck Structural Alert:</strong>{" "}
            {deal?.deckValidation
              ? `Uploaded file classified as "${deal.deckValidation.documentType}" (${deal.deckValidation.pageCount} page${deal.deckValidation.pageCount === 1 ? "" : "s"}, ${deal.deckValidation.detectedSections.length}/7 standard pitch sections). Missing: ${deal.deckValidation.missingSections.slice(0, 4).join(", ")}.`
              : "Uploaded file does not match standard VC pitch deck structure. Conviction is clamped to Grade G."}
          </span>
          <button
            type="button"
            onClick={() => setActiveInspector({ title: "Data Completeness & Disclosures", dimension: vc.conviction.dimensions.disclosure })}
            className="cursor-pointer font-semibold underline hover:text-rose-950"
          >
            Inspect Deck Audit
          </button>
        </div>
      )}

      {/* Subtitle / Risk Alert */}
      {vc.conviction.missingFacts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
          <span>
            <strong>Data Disclosure Friction:</strong> {vc.conviction.missingFacts.length} of {vc.conviction.totalCoreFacts} core institutional facts missing from submission ({vc.conviction.missingFacts.slice(0, 4).join(", ")}{vc.conviction.missingFacts.length > 4 ? "..." : ""}).
          </span>
          <button
            type="button"
            onClick={() => setActiveInspector({ title: "Data Completeness & Disclosures", dimension: vc.conviction.dimensions.disclosure })}
            className="cursor-pointer font-semibold underline hover:text-amber-950"
          >
            Review Penalties
          </button>
        </div>
      )}

      {/* 8 Clickable Multi-Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tile 1: Master Conviction Grade & Multiplier */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Master VC Conviction Formula & Rating Matrix", isMasterFormula: true })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Conviction Grade</span>
            <span className={cx("text-[10px] font-bold px-1.5 py-0.5 rounded", gStyle.bg, gStyle.text)}>
              Grade {vc.grade}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-xl font-bold text-slate-900">{vc.overallScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate" title={vc.conviction.tierLabel}>
            {vc.conviction.tierLabel}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Click to view formula &gt;
          </div>
        </button>

        {/* Tile 2: Data Completeness & Disclosures */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Data Completeness & Disclosures", dimension: vc.conviction.dimensions.disclosure })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Data Completeness</span>
            <span className={cx("text-[10px] font-semibold px-1.5 py-0.5 rounded", vc.conviction.disclosedCount >= 8 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
              {Math.round(vc.conviction.completenessRatio * 100)}%
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">
            {vc.conviction.disclosedCount} <span className="text-xs font-normal text-slate-400">of {vc.conviction.totalCoreFacts}</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {vc.conviction.missingFacts.length ? `${vc.conviction.missingFacts.length} core facts missing` : "All core facts disclosed"}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Inspect checklist &gt;
          </div>
        </button>

        {/* Tile 3: Financial Integrity & Math Veracity */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Financial Integrity & Math Veracity", dimension: vc.conviction.dimensions.veracity })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Financial Integrity</span>
            <span className={cx("text-[10px] font-semibold px-1.5 py-0.5 rounded", vc.conviction.dimensions.veracity.score >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
              {vc.conviction.dimensions.veracity.rating}
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">
            {vc.conviction.dimensions.veracity.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {vc.conviction.dimensions.veracity.summary}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Audit gap math &gt;
          </div>
        </button>

        {/* Tile 4: Founder Pedigree & Background Signal */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Founder Pedigree & Background Signal", dimension: vc.conviction.dimensions.founder })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Founder Signal</span>
            <span className={cx("text-[10px] font-semibold px-1.5 py-0.5 rounded", vc.conviction.dimensions.founder.score >= 60 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
              {vc.conviction.dimensions.founder.rating}
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">
            {vc.conviction.dimensions.founder.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {vc.conviction.dimensions.founder.summary}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            View pedigree rubric &gt;
          </div>
        </button>

        {/* Tile 5: Burn Multiple */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Unit Economics & Capital Efficiency", dimension: vc.conviction.dimensions.economics })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Burn Multiple</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
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
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{vc.burnMultiple.formatted}</div>
          <div className="mt-1 text-[10px] text-slate-500 truncate" title={vc.burnMultiple.explanation}>
            {vc.burnMultiple.explanation}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Sequoia benchmark &gt;
          </div>
        </button>

        {/* Tile 6: Runway & Zero Cash Date */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Unit Economics & Capital Efficiency", dimension: vc.conviction.dimensions.economics })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Runway</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
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
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{vc.runway.formatted}</div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {vc.runway.zeroCashDate ? `Zero cash: ${vc.runway.zeroCashDate}` : "No cash balance provided"}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Runway curve &gt;
          </div>
        </button>

        {/* Tile 7: SaaS Magic Number */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Unit Economics & Capital Efficiency", dimension: vc.conviction.dimensions.economics })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Magic Number</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
              {vc.magicNumber.rating}
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{vc.magicNumber.formatted}</div>
          <div className="mt-1 text-[10px] text-slate-500 truncate" title={vc.magicNumber.explanation}>
            {vc.magicNumber.explanation}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            GTM conversion &gt;
          </div>
        </button>

        {/* Tile 8: Target Ownership & Valuation Mandate */}
        <button
          type="button"
          onClick={() => setActiveInspector({ title: "Fund Mandate & Ownership Feasibility", dimension: vc.conviction.dimensions.mandate })}
          className="group cursor-pointer rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-slate-900 hover:bg-white shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600">Target Ownership</span>
            <span
              className={cx(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                vc.ownership.status.includes("Within Mandate")
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              )}
            >
              {vc.ownership.status.split(" ")[0]}
            </span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900">{vc.ownership.formattedOwnership}</div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {vc.ownership.impliedPostMoney
              ? `Implied Post: $${(vc.ownership.impliedPostMoney / 1_000_000).toFixed(1)}M`
              : "Mandate: 10-20%"}
          </div>
          <div className="mt-2 text-[10px] font-medium text-blue-600 group-hover:underline">
            Check valuation &gt;
          </div>
        </button>
      </div>

      {/* Interactive Formula Inspector Modal */}
      {activeInspector && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Mathematical Audit &amp; Formula Inspector
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {activeInspector.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveInspector(null)}
                className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {activeInspector.isMasterFormula ? (
              <div className="space-y-4 text-xs">
                <div className="rounded-lg bg-slate-900 p-4 text-slate-100 font-mono space-y-2">
                  <div className="text-[11px] text-slate-400">// Master Aarka Conviction Formula</div>
                  <div className="text-sm font-bold text-emerald-400">
                    Conviction = round(RawWeightedScore × CompletenessMultiplier)
                  </div>
                  <div className="text-[11px] text-slate-300">
                    RawWeightedScore = (0.20 × Disclosure) + (0.25 × Veracity) + (0.20 × Founder) + (0.20 × Economics) + (0.15 × Mandate)
                  </div>
                  <div className="text-[11px] text-slate-300">
                    CompletenessMultiplier = max(0.15, CompletenessRatio^0.6)
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                  <div className="font-semibold text-slate-800">Current Deal Calculation:</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px]">
                    <div>Raw Weighted: {vc.conviction.rawWeightedScore} / 100</div>
                    <div>Completeness Ratio: {Math.round(vc.conviction.completenessRatio * 100)}%</div>
                    <div>Multiplier Applied: {vc.conviction.completenessMultiplier}x</div>
                    <div className="font-bold text-slate-900">Final Score: {vc.overallScore} / 100 (Grade {vc.grade})</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-slate-800">Institutional Grading Thresholds:</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                    <div><strong>Grade A (90-100):</strong> Elite Conviction (Top 1%)</div>
                    <div><strong>Grade B (75-89):</strong> Strong Conviction</div>
                    <div><strong>Grade C (60-74):</strong> Investigate Further</div>
                    <div><strong>Grade D (45-59):</strong> High Diligence Friction</div>
                    <div><strong>Grade E (25-44):</strong> Capital Efficiency Alarm</div>
                    <div><strong>Grade G (0-24):</strong> Unsubstantiated Intake</div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900 space-y-1">
                  <div className="font-bold">Next Recommended IC Action:</div>
                  <div>{vc.conviction.suggestedAction}</div>
                </div>
              </div>
            ) : activeInspector.dimension ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium">Dimension Weight:</span>
                    <span className="ml-1.5 font-bold font-mono text-slate-900">{activeInspector.dimension.weightPct}%</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium">Dimension Score:</span>
                    <span className="ml-1.5 font-bold font-mono text-slate-900">{activeInspector.dimension.score} / 100</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-900 p-3 text-slate-100 font-mono text-xs">
                  <span className="text-slate-400">// Governing Formula</span>
                  <div className="mt-1 font-bold text-emerald-400">{activeInspector.dimension.formula}</div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-800">Evaluated Parameters for this Deal:</span>
                  <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-[11px]">
                    {Object.entries(activeInspector.dimension.inputs).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-semibold text-slate-900 font-mono">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {activeInspector.dimension.penalties.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-rose-800">Active Friction &amp; Penalties Applied:</span>
                    <ul className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-900">
                      {activeInspector.dimension.penalties.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span>•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px]">
                  <span className="font-semibold text-slate-700">Tier-1 Institutional Benchmark:</span>
                  <p className="text-slate-600 mt-0.5">{activeInspector.dimension.benchmark}</p>
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveInspector(null)}
                className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
