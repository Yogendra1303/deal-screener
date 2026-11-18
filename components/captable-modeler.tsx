"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, cx } from "@/components/ui";
import { calculateCapTable, type CapTableInput, type RoundInstrument } from "@/lib/captable";
import { hydrate, persist } from "@/lib/db/client";
import { usd } from "@/lib/rules";

const STATE_KEY = "ds.captable.v1";

interface Props {
  dealId: string;
  companyName: string;
  defaultAskUsd?: number | null;
  defaultValuationUsd?: number | null;
}

function defaultInput(ask?: number | null, val?: number | null): CapTableInput {
  const roundSizeUsd = ask && ask > 0 ? ask : 1_500_000;
  const valuationUsd = val && val > 0 ? val : Math.round(roundSizeUsd * 4);
  return {
    instrument: "post_safe",
    valuationUsd,
    roundSizeUsd,
    fundCheckUsd: Math.min(roundSizeUsd, Math.max(250_000, Math.round(roundSizeUsd * 0.4))),
    optionPoolPct: 10,
    discountPct: 20,
    existingFoundersPct: 92,
    nextRoundPreMoneyUsd: Math.round((valuationUsd + roundSizeUsd) * 2.5),
    nextRoundSizeUsd: Math.round(roundSizeUsd * 3.5),
  };
}

function fmtCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return usd(n);
}

export function CapTableModeler({ dealId, companyName, defaultAskUsd, defaultValuationUsd }: Props) {
  const baseline = useMemo(() => defaultInput(defaultAskUsd, defaultValuationUsd), [defaultAskUsd, defaultValuationUsd]);
  const [input, setInput] = useState<CapTableInput>(baseline);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    let localAll: Record<string, CapTableInput> | null = null;
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) {
        localAll = JSON.parse(raw) as Record<string, CapTableInput>;
        if (localAll[dealId]) setInput({ ...baseline, ...localAll[dealId] });
      }
    } catch {
      // ignore
    }
    void hydrate<Record<string, CapTableInput>>(
      STATE_KEY,
      (remote) => {
        if (remote && remote[dealId]) {
          setInput((prev) => ({ ...prev, ...remote[dealId] }));
        }
      },
      localAll,
    );
  }, [dealId, baseline]);

  const out = useMemo(() => calculateCapTable(input), [input]);

  function update<K extends keyof CapTableInput>(key: K, val: CapTableInput[K]) {
    setInput((prev) => ({ ...prev, [key]: val }));
  }

  function saveScenario() {
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      const all = raw ? (JSON.parse(raw) as Record<string, CapTableInput>) : {};
      const next = { ...all, [dealId]: input };
      window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
      persist(STATE_KEY, next);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2200);
    } catch {
      // ignore
    }
  }

  function copySchedule() {
    const summary = [
      `Aarka Cap Table & Dilution Schedule · ${companyName}`,
      `Instrument: ${input.instrument === "post_safe" ? "YC Post-Money SAFE" : input.instrument === "pre_safe" ? "Pre-Money SAFE" : "Priced Equity"}`,
      `Implied Post-Money Valuation: ${fmtCompactUsd(out.postMoneyUsd)}`,
      `Round Raise: ${fmtCompactUsd(input.roundSizeUsd)} | Aarka Check: ${fmtCompactUsd(input.fundCheckUsd)}`,
      `Aarka Effective Ownership: ${out.fundOwnershipPct}%`,
      `Co-Investors Ownership: ${coInvestorPct}%`,
      `Founders Retention: ${out.foundersPostRoundPct}%`,
      `Unallocated Option Pool: ${out.optionPoolPct}%`,
      `Series A Pro-Rata Reserve Required: ${fmtCompactUsd(out.proRataCheckRequiredUsd)} (Maintains ${out.ownershipWithProRataPct}%)`,
    ].join("\n");
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(summary);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2200);
    }
  }

  const coInvestorPct = Math.max(0, Math.round((out.totalNewInvestorPct - out.fundOwnershipPct) * 100) / 100);
  const slices = [
    { label: "Founders", pct: out.foundersPostRoundPct, color: "bg-slate-800" },
    { label: "Aarka Fund", pct: out.fundOwnershipPct, color: "bg-blue-600" },
    { label: "Co-investors", pct: coInvestorPct, color: "bg-sky-400" },
    { label: "Option Pool", pct: out.optionPoolPct, color: "bg-amber-400" },
    { label: "Prior Investors", pct: out.otherExistingPct, color: "bg-slate-300" },
  ].filter((s) => s.pct > 0);

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySchedule}
              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              {copiedNotice ? "Copied Schedule!" : "Copy Schedule"}
            </button>
            <button
              type="button"
              onClick={() => setInput(baseline)}
              className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveScenario}
              className="cursor-pointer rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
            >
              {savedNotice ? "Saved" : "Save scenario"}
            </button>
          </div>
        }
      >
        Cap Table &amp; Pro-Rata Dilution Modeler
      </SectionTitle>
      <p className="mb-4 text-xs text-slate-500">
        Model Aarka&apos;s post-round ownership in {companyName}, SAFE/priced dilution, option pool carve-out, and Series A pro-rata reserve requirements.
      </p>

      {/* Instrument selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["post_safe", "YC Post-Money SAFE"],
            ["pre_safe", "Pre-Money SAFE"],
            ["priced", "Priced Equity Round"],
          ] as [RoundInstrument, string][]
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => update("instrument", val)}
            className={cx(
              "cursor-pointer rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              input.instrument === val
                ? "border-blue-600 bg-blue-50 text-blue-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Inputs grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumInput
          label={input.instrument === "post_safe" ? "Valuation Cap ($)" : "Pre-Money Valuation ($)"}
          value={input.valuationUsd}
          step={250_000}
          min={100_000}
          onChange={(v) => update("valuationUsd", v)}
        />
        <NumInput
          label="Total Round Size ($)"
          value={input.roundSizeUsd}
          step={100_000}
          min={0}
          onChange={(v) => update("roundSizeUsd", v)}
        />
        <NumInput
          label="Aarka Check Size ($)"
          value={input.fundCheckUsd}
          step={50_000}
          min={0}
          onChange={(v) => update("fundCheckUsd", v)}
        />
        <NumInput
          label="Option Pool (%)"
          value={input.optionPoolPct}
          step={1}
          min={0}
          max={30}
          onChange={(v) => update("optionPoolPct", v)}
        />
        {input.instrument === "post_safe" ? (
          <NumInput
            label="SAFE Discount (%)"
            value={input.discountPct}
            step={5}
            min={0}
            max={50}
            onChange={(v) => update("discountPct", v)}
          />
        ) : (
          <NumInput
            label="Existing Founders (%)"
            value={input.existingFoundersPct}
            step={2}
            min={10}
            max={100}
            onChange={(v) => update("existingFoundersPct", v)}
          />
        )}
        <NumInput
          label="Series A Pre-Money ($)"
          value={input.nextRoundPreMoneyUsd}
          step={1_000_000}
          min={input.valuationUsd}
          onChange={(v) => update("nextRoundPreMoneyUsd", v)}
        />
        <NumInput
          label="Series A Raise Size ($)"
          value={input.nextRoundSizeUsd}
          step={500_000}
          min={0}
          onChange={(v) => update("nextRoundSizeUsd", v)}
        />
        <div className="flex flex-col justify-center rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Aarka Post-Round</span>
          <span className="mt-0.5 text-xl font-bold tabular-nums text-blue-900">{out.fundOwnershipPct.toFixed(2)}%</span>
          <span className="text-[11px] text-blue-700/80">at {fmtCompactUsd(out.postMoneyUsd)} post</span>
        </div>
      </div>

      {/* Ownership Stack Bar */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">Post-Round Cap Table Breakdown</span>
          <span className="tabular-nums">Post-Money: {fmtCompactUsd(out.postMoneyUsd)}</span>
        </div>
        <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
          {slices.map((s) => (
            <div
              key={s.label}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${s.pct}%`}
              className={cx("h-full transition-all", s.color)}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {slices.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-slate-700">
              <span className={cx("h-2.5 w-2.5 rounded-xs", s.color)} />
              <span>{s.label}</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900">{s.pct.toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Series A Pro-Rata Strip */}
      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Series A Pro-Rata Check</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900">
            {fmtCompactUsd(out.proRataCheckRequiredUsd)}
          </p>
          <p className="text-[11px] text-slate-500">To hold {out.ownershipWithProRataPct.toFixed(2)}% ownership</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Without Pro-Rata</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900">
            {out.ownershipWithoutProRataPct.toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-500">
            Diluted by {(out.fundOwnershipPct - out.ownershipWithoutProRataPct).toFixed(2)}% pts
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Implied Step-Up</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-emerald-700">
            {out.impliedStepUpMultiple.toFixed(1)}x
          </p>
          <p className="text-[11px] text-slate-500">At {fmtCompactUsd(out.nextRoundPostMoneyUsd)} Series A post</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Aarka Paper Stake</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900">
            {fmtCompactUsd(out.fundStakeValueAtNextRoundUsd)}
          </p>
          <p className="text-[11px] text-slate-500">Initial check value at Series A</p>
        </div>
      </div>
    </Card>
  );
}

function NumInput({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-blue-600">
      <span className="block text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-0.5 w-full bg-transparent font-mono text-sm font-semibold tabular-nums text-slate-900 focus:outline-none"
      />
    </label>
  );
}
