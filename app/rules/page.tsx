"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLinks } from "@/components/links-store";
import { useStore } from "@/components/store";
import { Button, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { hydrate, loadState, persist, saveState } from "@/lib/db/client";
import { escapeHtml, openPrintableReport } from "@/lib/export";
import { DEFAULT_FUND_CONFIG, type FundConfig } from "@/lib/fund-analytics";
import { DEFAULT_RULES, fitScore, usd } from "@/lib/rules";
import {
  DEFAULT_THESIS,
  type PortfolioCovenant,
  type ProcessStep,
  type QualityBar,
  type StageBar,
  type Thesis,
} from "@/lib/thesis";
import { COUNTRIES, SECTORS, STAGES, type Band } from "@/lib/types";
import { calculateVCMetrics, GRADE_BADGE_STYLE } from "@/lib/vc-metrics";

const THESIS_KEY = "ds.thesis.v1";
const FUND_CONFIG_KEY = "ds.fund.config.v1";

type RulesTab = "mandate" | "vehicle" | "quality" | "governance";

type ModalState =
  | { kind: "vehicle" }
  | { kind: "stage"; index: number }
  | { kind: "quality"; index: number | null }
  | { kind: "process"; index: number }
  | { kind: "covenant"; index: number | null }
  | null;

const BAND_TONE: Record<Band, { pill: string; border: string; active: string }> = {
  Priority: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    border: "border-emerald-200 hover:border-emerald-400",
    active: "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/15",
  },
  Review: {
    pill: "bg-amber-50 text-amber-800 ring-amber-200",
    border: "border-amber-200 hover:border-amber-400",
    active: "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/15",
  },
  "Outside focus": {
    pill: "bg-slate-100 text-slate-600 ring-slate-200",
    border: "border-slate-200 hover:border-slate-400",
    active: "border-slate-500 bg-slate-100/70 ring-2 ring-slate-500/15",
  },
};

const MIN_PRESETS = [100_000, 250_000, 500_000, 1_000_000];
const MAX_PRESETS = [3_000_000, 6_000_000, 10_000_000, 15_000_000];

function mergeThesis(raw: Partial<Thesis> | null | undefined): Thesis {
  if (!raw) return DEFAULT_THESIS;
  return {
    ...DEFAULT_THESIS,
    ...raw,
    stageBars: Array.isArray(raw.stageBars) && raw.stageBars.length > 0
      ? raw.stageBars.map((bar, i) => ({ ...DEFAULT_THESIS.stageBars[i], ...bar }))
      : DEFAULT_THESIS.stageBars,
    quality: Array.isArray(raw.quality) && raw.quality.length > 0
      ? raw.quality.map((q, i) => ({
          category: DEFAULT_THESIS.quality[i]?.category ?? "Unit Economics",
          enforcedBy: DEFAULT_THESIS.quality[i]?.enforcedBy ?? "IC Diligence Review",
          ...q,
        }))
      : DEFAULT_THESIS.quality,
    exclusions: Array.isArray(raw.exclusions) ? raw.exclusions : DEFAULT_THESIS.exclusions,
    process: Array.isArray(raw.process) && raw.process.length > 0
      ? raw.process.map((step, i) => ({ ...DEFAULT_THESIS.process[i], ...step }))
      : DEFAULT_THESIS.process,
    beforeIC: Array.isArray(raw.beforeIC) ? raw.beforeIC : DEFAULT_THESIS.beforeIC,
    portfolio: Array.isArray(raw.portfolio) && raw.portfolio.length > 0
      ? raw.portfolio.map((c, i) => ({ party: DEFAULT_THESIS.portfolio[i]?.party ?? "Fund", ...c }))
      : DEFAULT_THESIS.portfolio,
  };
}

export default function RulesPage() {
  const { rules, setRules, deals, unprocessed, bandOf, overrules } = useStore();
  const links = useLinks();
  const w = useWorkspace();
  const canEdit = w.role === "Partner";

  const [activeTab, setActiveTab] = useState<RulesTab>("mandate");
  const [thesis, setThesisState] = useState<Thesis>(DEFAULT_THESIS);
  const [fundConfig, setFundConfigState] = useState<FundConfig>(DEFAULT_FUND_CONFIG);
  const [savedPulse, setSavedPulse] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  // Mandate Simulator states
  const [baselineBands, setBaselineBands] = useState<Record<string, Band> | null>(null);
  const [openBand, setOpenBand] = useState<Band | "unscreened" | null>("Outside focus");

  // Inline quick-add states for Exclusions & Pre-IC Gates
  const [newExclusion, setNewExclusion] = useState("");
  const [newGate, setNewGate] = useState("");
  const [editingGateIdx, setEditingGateIdx] = useState<number | null>(null);
  const [editingGateVal, setEditingGateVal] = useState("");
  const [selectedProcessIdx, setSelectedProcessIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    try {
      const rawThesis = window.localStorage.getItem(THESIS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (rawThesis) setThesisState(mergeThesis(JSON.parse(rawThesis) as Partial<Thesis>));
    } catch {
      // Use defaults
    }
    void loadState<Partial<Thesis>>(THESIS_KEY).then((res) => {
      if (alive && res.found && res.value) {
        const merged = mergeThesis(res.value);
        setThesisState(merged);
        try {
          window.localStorage.setItem(THESIS_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
    });

    let localFund: FundConfig | null = null;
    try {
      const rawFund = window.localStorage.getItem(FUND_CONFIG_KEY);
      if (rawFund) {
        localFund = { ...DEFAULT_FUND_CONFIG, ...(JSON.parse(rawFund) as Partial<FundConfig>) };
        setFundConfigState(localFund);
      }
    } catch {
      // ignore
    }
    void hydrate<FundConfig>(
      FUND_CONFIG_KEY,
      (remote) => {
        if (alive && remote) setFundConfigState((prev) => ({ ...DEFAULT_FUND_CONFIG, ...prev, ...remote }));
      },
      localFund,
    );

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!baselineBands && deals.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBaselineBands(Object.fromEntries(deals.map((d) => [d.id, bandOf(d)])));
    }
  }, [baselineBands, deals, bandOf]);

  const flashSaved = () => {
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1800);
  };

  const commitThesis = (next: Thesis) => {
    setThesisState(next);
    try {
      window.localStorage.setItem(THESIS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    saveState(THESIS_KEY, next);
    flashSaved();
  };

  const commitFundConfig = (next: FundConfig) => {
    setFundConfigState(next);
    try {
      window.localStorage.setItem(FUND_CONFIG_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    persist(FUND_CONFIG_KEY, next);
    flashSaved();
  };

  const updateRules = (next: typeof rules) => {
    if (!canEdit) return;
    setRules(next);
    flashSaved();
  };

  const toggleFilter = (key: "stages" | "countries" | "sectors", value: string) => {
    if (!canEdit) return;
    const list = rules[key];
    updateRules({
      ...rules,
      [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    });
  };

  // Compute live Conviction Grade & Band stats for every screened deal
  const dealSnapshots = useMemo(
    () =>
      deals.map((d) => {
        const band = bandOf(d);
        const fit = fitScore(d.form, rules);
        const liveScores = d.scores.map((s) => (s.key === "fit" ? fit : s));
        const metrics = calculateVCMetrics(d.sheet, d.record, d.form.amountUsd, { deal: d, scores: liveScores });
        return {
          deal: d,
          band,
          fit,
          grade: metrics.conviction.grade,
          score: metrics.conviction.score,
          tierLabel: metrics.conviction.tierLabel,
        };
      }),
    [deals, bandOf, rules],
  );

  const unscreenedRows = useMemo(() => {
    const forms = [
      ...unprocessed.map((u) => ({ id: u.id, form: u.form })),
      ...links.inbound
        .filter((i) => !deals.some((d) => d.id === i.id) && !unprocessed.some((u) => u.id === i.id))
        .map((i) => ({ id: i.id, form: i.form })),
    ];
    return forms.map((x) => ({ ...x, fit: fitScore(x.form, rules) }));
  }, [unprocessed, links.inbound, deals, rules]);

  const counts = useMemo(() => {
    const priority = dealSnapshots.filter((x) => x.band === "Priority").length;
    const review = dealSnapshots.filter((x) => x.band === "Review").length;
    const outside = dealSnapshots.filter((x) => x.band === "Outside focus").length;
    const unscreenedFit = unscreenedRows.filter((x) => x.fit.level === "Strong").length;
    const totalAll = dealSnapshots.length + unscreenedRows.length;
    const totalFit = dealSnapshots.filter((x) => x.fit.level === "Strong").length + unscreenedFit;
    return { priority, review, outside, unscreenedFit, totalAll, totalFit };
  }, [dealSnapshots, unscreenedRows]);

  const movedDeals = useMemo(() => {
    if (!baselineBands) return [];
    return dealSnapshots.filter((x) => baselineBands[x.deal.id] && baselineBands[x.deal.id] !== x.band);
  }, [baselineBands, dealSnapshots]);

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deals) map[d.form.stage] = (map[d.form.stage] ?? 0) + 1;
    for (const u of unscreenedRows) map[u.form.stage] = (map[u.form.stage] ?? 0) + 1;
    return map;
  }, [deals, unscreenedRows]);

  const initialDeployUsd = Math.round(fundConfig.committedUsd * (1 - fundConfig.reserveTargetPct / 100));
  const reservePoolUsd = Math.round(fundConfig.committedUsd * (fundConfig.reserveTargetPct / 100));

  const exportMandatePdf = () => {
    const html = `
      <div class="sec">
        <h2>1. Fund Vehicle &amp; Allocation</h2>
        <div class="grid">
          <div class="kpi"><div class="k">Fund Vehicle</div><div class="v">${escapeHtml(fundConfig.fundName)}</div></div>
          <div class="kpi"><div class="k">Committed Capital</div><div class="v">${escapeHtml(usd(fundConfig.committedUsd))}</div></div>
          <div class="kpi"><div class="k">Follow-on Reserves</div><div class="v">${escapeHtml(`${fundConfig.reserveTargetPct}% (${usd(reservePoolUsd)})`)}</div></div>
          <div class="kpi"><div class="k">Target Portfolio</div><div class="v">${escapeHtml(thesis.companies)}</div></div>
        </div>
        <p class="sub" style="margin-top:8px">Vintage ${escapeHtml(thesis.vintage)} · Life: ${escapeHtml(thesis.fundLife)} · Investment Period: ${escapeHtml(thesis.investmentPeriod)}</p>
      </div>
      <div class="sec">
        <h2>2. Active Screening Filters (Enforced by Code)</h2>
        <table>
          <tbody>
            <tr><th>Target Stages</th><td>${escapeHtml(rules.stages.join(", ") || "None")}</td></tr>
            <tr><th>Target Geographies</th><td>${escapeHtml(rules.countries.join(", ") || "None")}</td></tr>
            <tr><th>Target Sectors</th><td>${escapeHtml(rules.sectors.join(", ") || "None")}</td></tr>
            <tr><th>Round Size Corridor</th><td>${escapeHtml(`${usd(rules.minRoundUsd)} to ${usd(rules.maxRoundUsd)}`)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="sec">
        <h2>3. Stage Investment Playbooks</h2>
        <table>
          <thead><tr><th>Stage</th><th>Cheque</th><th>Ownership</th><th>Max Post-Money</th><th>Revenue Bar</th><th>Growth Bar</th></tr></thead>
          <tbody>
            ${thesis.stageBars
              .map(
                (s) =>
                  `<tr><td><strong>${escapeHtml(s.stage)}</strong></td><td>${escapeHtml(s.cheque)}</td><td>${escapeHtml(s.ownership)}</td><td>${escapeHtml(s.maxPostMoney)}</td><td>${escapeHtml(s.revenue)}</td><td>${escapeHtml(s.growth)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="sec">
        <h2>4. Quantitative Quality Bars &amp; Hard Exclusions</h2>
        <table>
          <thead><tr><th>Metric</th><th>Target Threshold</th><th>Rationale</th></tr></thead>
          <tbody>
            ${thesis.quality
              .map((q) => `<tr><td><strong>${escapeHtml(q.label)}</strong></td><td>${escapeHtml(q.value)}</td><td>${escapeHtml(q.why)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
        <p style="margin-top:10px;font-size:12px"><strong>Hard Exclusions:</strong> ${escapeHtml(thesis.exclusions.join(" · "))}</p>
      </div>
      <div class="sec">
        <h2>5. Pre-IC Gates &amp; Portfolio Covenants</h2>
        <ul>${thesis.beforeIC.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
        <table style="margin-top:10px">
          <thead><tr><th>Covenant</th><th>Owner</th><th>Standard</th></tr></thead>
          <tbody>
            ${thesis.portfolio
              .map((c) => `<tr><td><strong>${escapeHtml(c.label)}</strong></td><td>${escapeHtml(c.party ?? "Fund")}</td><td>${escapeHtml(c.value)}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    openPrintableReport(
      `${fundConfig.fundName} Investment Mandate & Rules`,
      `Generated from live workspace mandate · ${counts.totalFit} of ${counts.totalAll} active pitches fit written filters`,
      html,
    );
  };

  const resetAll = () => {
    if (!canEdit) return;
    setRules(DEFAULT_RULES);
    commitThesis(DEFAULT_THESIS);
    commitFundConfig(DEFAULT_FUND_CONFIG);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Investment Policy &amp; Mandate Engine
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            Fund rules
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure {fundConfig.fundName}&apos;s live screening filters, stage check bars, quality guardrails, IC governance gates, and portfolio SLAs. Every partner update syncs immediately across Pitches, Conviction Matrix, and Fund Analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedPulse && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Saved to workspace
            </span>
          )}
          <span
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              canEdit
                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            <span className={cx("h-2 w-2 rounded-full", canEdit ? "bg-indigo-500" : "bg-amber-500")} />
            {canEdit ? "Partner Edit Mode" : "Analyst Read-Only"}
          </span>
          <button
            type="button"
            onClick={exportMandatePdf}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Export Mandate PDF
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={resetAll}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800"
            >
              Reset Defaults
            </button>
          )}
        </div>
      </div>

      {/* 4 Live Interactive KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("mandate")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            activeTab === "mandate" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Live Mandate Fit</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Live Engine</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {counts.totalFit}
            <span className="text-sm font-normal text-slate-400"> / {counts.totalAll} fit</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            {rules.stages.length} stages · {rules.countries.length} geos · {rules.sectors.length} sectors →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vehicle")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            activeTab === "vehicle" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Fund Vehicle</span>
            <span className="font-mono text-[10px] font-semibold text-indigo-700">Synced /fund</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {usd(fundConfig.committedUsd)}
            <span className="text-sm font-normal text-slate-400"> · {fundConfig.reserveTargetPct}% res</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            {thesis.stageBars.length} stage playbooks · Edit vehicle →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quality")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            activeTab === "quality" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Quality &amp; Red Lines</span>
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">{thesis.exclusions.length} no&apos;s</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {thesis.quality.length}
            <span className="text-sm font-normal text-slate-400"> quality bars</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Margins, burn, runway &amp; exclusions →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("governance")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            activeTab === "governance" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>IC &amp; Portfolio SLA</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{thesis.beforeIC.length} gates</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {thesis.process.length}
            <span className="text-sm font-normal text-slate-400"> IC steps</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            {thesis.portfolio.length} post-investment covenants →
          </p>
        </button>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div
          className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold"
          role="tablist"
        >
          {(
            [
              ["mandate", "01 · Screening Mandate (Live)"],
              ["vehicle", "02 · Fund Vehicle & Stage Bars"],
              ["quality", "03 · Quality Bars & Exclusions"],
              ["governance", "04 · IC Governance & Covenants"],
            ] as [RulesTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={cx(
                "cursor-pointer rounded-lg px-3.5 py-1.5 transition",
                activeTab === key ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Link
          href="/method"
          className="text-xs font-semibold text-indigo-700 hover:underline"
        >
          See how Mandate maps to Pillar 5 (15% weight) →
        </Link>
      </div>

      {/* TAB 1: LIVE SCREENING MANDATE & IMPACT SIMULATOR */}
      {activeTab === "mandate" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Left: Editable Hard Filters */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Active Screening Filters</h2>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Sorts Pitches Live
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Deterministic TypeScript checks every new pitch and intake form against these parameters. Toggle any chip to re-band the pipeline in real time.
                </p>
              </div>
            </div>

            <FilterChipGroup
              title="Target Stages"
              countLabel={`${rules.stages.length} of ${STAGES.length} active`}
              options={STAGES}
              selected={rules.stages}
              onToggle={(v) => toggleFilter("stages", v)}
              canEdit={canEdit}
            />

            <FilterChipGroup
              title="Target Geographies"
              countLabel={`${rules.countries.length} of ${COUNTRIES.length} active`}
              options={COUNTRIES}
              selected={rules.countries}
              onToggle={(v) => toggleFilter("countries", v)}
              canEdit={canEdit}
              quickAction={
                canEdit
                  ? {
                      label: rules.countries.length === COUNTRIES.length ? "Core 3 (IN/UAE/KSA)" : "Select All Geos",
                      onClick: () =>
                        updateRules({
                          ...rules,
                          countries:
                            rules.countries.length === COUNTRIES.length
                              ? ["India", "UAE", "Saudi Arabia"]
                              : [...COUNTRIES],
                        }),
                    }
                  : undefined
              }
            />

            <FilterChipGroup
              title="Target Sectors"
              countLabel={`${rules.sectors.length} of ${SECTORS.length} active`}
              options={SECTORS}
              selected={rules.sectors}
              onToggle={(v) => toggleFilter("sectors", v)}
              canEdit={canEdit}
              quickAction={
                canEdit
                  ? {
                      label: rules.sectors.length === SECTORS.length ? "Reset Core 7" : "Select All Sectors",
                      onClick: () =>
                        updateRules({
                          ...rules,
                          sectors:
                            rules.sectors.length === SECTORS.length ? [...DEFAULT_RULES.sectors] : [...SECTORS],
                        }),
                    }
                  : undefined
              }
            />

            {/* Round Size Corridor */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Target Round Size Corridor (USD)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Pitches raising outside this range are flagged as Outside focus in Pillar 5.
                  </p>
                </div>
                <span className="rounded-md bg-white px-2.5 py-1 font-mono text-xs font-bold text-indigo-700 ring-1 ring-slate-200">
                  {usd(rules.minRoundUsd)} to {usd(rules.maxRoundUsd)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Minimum Round ({usd(rules.minRoundUsd)})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50_000}
                    disabled={!canEdit}
                    value={rules.minRoundUsd}
                    onChange={(e) => updateRules({ ...rules, minRoundUsd: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
                  />
                  {canEdit && (
                    <div className="flex flex-wrap gap-1">
                      {MIN_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateRules({ ...rules, minRoundUsd: amt })}
                          className={cx(
                            "cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition",
                            rules.minRoundUsd === amt
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300",
                          )}
                        >
                          {usd(amt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Maximum Round ({usd(rules.maxRoundUsd)})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={250_000}
                    disabled={!canEdit}
                    value={rules.maxRoundUsd}
                    onChange={(e) => updateRules({ ...rules, maxRoundUsd: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
                  />
                  {canEdit && (
                    <div className="flex flex-wrap gap-1">
                      {MAX_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateRules({ ...rules, maxRoundUsd: amt })}
                          className={cx(
                            "cursor-pointer rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition",
                            rules.maxRoundUsd === amt
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300",
                          )}
                        >
                          {usd(amt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right: Live Mandate Impact & Conviction Simulator */}
          <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Live Mandate Impact Simulator</h2>
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {deals.length} screened · {unscreenedRows.length} queued
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Click any bucket below to inspect each pitch&apos;s live Conviction Grade (A-G) and exact rule pass/fail reasoning.
              </p>
            </div>

            {/* Live Band Diff Banner */}
            {movedDeals.length > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs">
                <p className="font-bold uppercase tracking-wider text-indigo-800">
                  Live Shift ({movedDeals.length} deal{movedDeals.length === 1 ? "" : "s"} re-banded)
                </p>
                <ul className="mt-2 space-y-1.5">
                  {movedDeals.map((x) => (
                    <li key={x.deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-indigo-100">
                      <Link href={`/deals/${x.deal.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                        {x.deal.form.companyName}
                      </Link>
                      <span className="font-mono text-[11px] font-semibold text-indigo-700">
                        {baselineBands?.[x.deal.id]} → {x.band}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clickable Band Tiles */}
            <div className="grid grid-cols-2 gap-2.5">
              {(["Priority", "Review", "Outside focus"] as Band[]).map((band) => {
                const count =
                  band === "Priority" ? counts.priority : band === "Review" ? counts.review : counts.outside;
                const isOpen = openBand === band;
                return (
                  <button
                    key={band}
                    type="button"
                    onClick={() => setOpenBand(isOpen ? null : band)}
                    className={cx(
                      "cursor-pointer rounded-xl border p-3 text-left transition",
                      isOpen ? BAND_TONE[band].active : cx("bg-white", BAND_TONE[band].border),
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset", BAND_TONE[band].pill)}>
                        {band}
                      </span>
                      <span className="font-mono text-lg font-bold text-slate-900">{count}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {band === "Priority"
                        ? "Fits mandate + strong traction"
                        : band === "Review"
                          ? "Fits mandate; needs diligence"
                          : "Fails 1+ filter rule"}
                    </p>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setOpenBand(openBand === "unscreened" ? null : "unscreened")}
                className={cx(
                  "cursor-pointer rounded-xl border p-3 text-left transition",
                  openBand === "unscreened"
                    ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/15"
                    : "border-slate-200 bg-white hover:border-indigo-300",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    Unscreened
                  </span>
                  <span className="font-mono text-lg font-bold text-slate-900">{unscreenedRows.length}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {counts.unscreenedFit} fit by form · {unscreenedRows.length - counts.unscreenedFit} outside
                </p>
              </button>
            </div>

            {/* Expanded Deal List for Selected Bucket */}
            {openBand && (
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 text-xs">
                  <span className="font-semibold text-slate-800">
                    {openBand === "unscreened" ? "Unscreened Queue (Form Pre-Check)" : `${openBand} Pitches`}
                  </span>
                  <Link href="/deals" className="font-semibold text-indigo-600 hover:underline">
                    Open Pipeline →
                  </Link>
                </div>

                {openBand === "unscreened" ? (
                  unscreenedRows.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">No unscreened pitches in queue.</p>
                  ) : (
                    <ul className="mt-2 max-h-72 divide-y divide-slate-200/70 overflow-y-auto pr-1">
                      {unscreenedRows.map((r) => (
                        <li key={r.id} className="py-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <Link href={`/deals/${r.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                              {r.form.companyName}
                            </Link>
                            <span
                              className={cx(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                                r.fit.level === "Strong"
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                  : "bg-slate-100 text-slate-600 ring-slate-200",
                              )}
                            >
                              {r.fit.level === "Strong" ? "Fits Mandate" : "Outside Focus"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {r.form.stage} · {r.form.country} · {r.form.sector}
                            {r.form.amountUsd ? ` · ${usd(r.form.amountUsd)}` : ""}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-600">{r.fit.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  (() => {
                    const list = dealSnapshots.filter((x) => x.band === openBand);
                    if (list.length === 0) {
                      return <p className="py-6 text-center text-xs text-slate-500">No screened pitches currently in {openBand}.</p>;
                    }
                    return (
                      <ul className="mt-2 max-h-72 divide-y divide-slate-200/70 overflow-y-auto pr-1">
                        {list.map(({ deal, fit, grade, score }) => (
                          <li key={deal.id} className="py-2.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <Link href={`/deals/${deal.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                                {deal.form.companyName}
                              </Link>
                              <span
                                className={cx(
                                  "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ring-1 ring-inset",
                                  GRADE_BADGE_STYLE[grade],
                                )}
                              >
                                Grade {grade} · {score}/100
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {deal.form.stage} · {deal.form.country} · {deal.form.sector}
                              {deal.form.amountUsd ? ` · ${usd(deal.form.amountUsd)}` : ""}
                              {overrules[deal.id]?.band ? " · Partner override" : ""}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              {openBand === "Outside focus" ? fit.reason : deal.bandReasons.join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    );
                  })()
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: FUND VEHICLE & STAGE INVESTMENT PLAYBOOKS */}
      {activeTab === "vehicle" && (
        <div className="space-y-6">
          {/* Fund Vehicle Section (Synced with /fund) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Fund Vehicle Parameters</h2>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    Synced with /fund Analytics
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Click any parameter card to modify committed capital, follow-on reserve target, vintage, or valuation multiple. Changes update Fund Analytics immediately.
                </p>
              </div>
              {canEdit && (
                <Button variant="secondary" onClick={() => setModal({ kind: "vehicle" })}>
                  Edit Vehicle Parameters
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Fund Name & Size", value: `${fundConfig.fundName} · ${usd(fundConfig.committedUsd)}`, sub: `${usd(initialDeployUsd)} initial deployment` },
                { label: "Follow-on Reserves", value: `${fundConfig.reserveTargetPct}% (${usd(reservePoolUsd)})`, sub: thesis.reserves },
                { label: "Target Portfolio Size", value: thesis.companies, sub: "Diversification & pacing target" },
                { label: "Vintage & Fund Life", value: `${thesis.vintage} · ${thesis.fundLife.split(",")[0]}`, sub: thesis.fundLife },
                { label: "Investment Period", value: thesis.investmentPeriod, sub: "Active new-company deployment" },
                { label: "ARR Valuation Multiple", value: `${fundConfig.arrMultiple ?? 8}x ARR`, sub: "Used in /fund fair-value NAV" },
                { label: "Realized Distributions", value: usd(fundConfig.realizedDistributionsUsd ?? 0), sub: "Feeds DPI & Gross TVPI" },
                { label: "Active Round Corridor", value: `${usd(rules.minRoundUsd)} to ${usd(rules.maxRoundUsd)}`, sub: "Enforced on all incoming pitches" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => canEdit && setModal({ kind: "vehicle" })}
                  disabled={!canEdit}
                  className={cx(
                    "group rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left transition",
                    canEdit ? "cursor-pointer hover:border-indigo-300 hover:bg-white hover:shadow-xs" : "cursor-default",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </span>
                    {canEdit && (
                      <span className="text-[10px] font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                        Edit
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">{item.value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{item.sub}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Interactive Stage Playbook Cards */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Stage Investment Playbooks</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Cheque sizing, target ownership, valuation ceilings, and Conviction Grade floors by stage. Click any stage card to edit targets.
                </p>
              </div>
              <Link href="/deals" className="text-xs font-semibold text-indigo-700 hover:underline">
                View Active Pipeline by Stage →
              </Link>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {thesis.stageBars.map((bar, idx) => {
                const activeCount = stageCounts[bar.stage] ?? 0;
                const enabledInMandate = rules.stages.includes(bar.stage);
                return (
                  <div
                    key={bar.stage}
                    onClick={() => canEdit && setModal({ kind: "stage", index: idx })}
                    role={canEdit ? "button" : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setModal({ kind: "stage", index: idx });
                      }
                    }}
                    className={cx(
                      "group flex flex-col rounded-xl border bg-white p-5 shadow-2xs transition",
                      canEdit ? "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md" : "",
                      enabledInMandate ? "border-slate-200" : "border-slate-200/70 bg-slate-50/50 opacity-75",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900 group-hover:text-indigo-700">
                          {bar.stage}
                        </span>
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                            enabledInMandate
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200",
                          )}
                        >
                          {enabledInMandate ? "Active" : "Paused"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        {activeCount} pitch{activeCount === 1 ? "" : "es"}
                      </span>
                    </div>

                    {/* Top 3 Financial Pillars */}
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Cheque</p>
                        <p className="mt-0.5 text-xs font-bold text-slate-900">{bar.cheque}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Ownership</p>
                        <p className="mt-0.5 text-xs font-bold text-slate-900">{bar.ownership}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Max Post-$</p>
                        <p className="mt-0.5 text-xs font-bold text-indigo-700">{bar.maxPostMoney}</p>
                      </div>
                    </div>

                    <dl className="mt-4 flex-1 space-y-2.5 text-xs">
                      <div>
                        <dt className="font-semibold text-slate-500">Revenue Bar</dt>
                        <dd className="mt-0.5 text-slate-800">{bar.revenue}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Growth Velocity</dt>
                        <dd className="mt-0.5 text-slate-800">{bar.growth}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Conviction Floor</dt>
                        <dd className="mt-0.5 font-medium text-indigo-700">
                          {bar.convictionFloor ?? "Grade B+ (75+)"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">Qualitative Signal</dt>
                        <dd className="mt-0.5 text-slate-600">{bar.other}</dd>
                      </div>
                    </dl>

                    {canEdit && (
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-400">Synced to Mandate PDF</span>
                        <span className="font-semibold text-indigo-600 group-hover:underline">
                          Edit {bar.stage} Bar →
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: QUANTITATIVE QUALITY BARS & HARD EXCLUSIONS */}
      {activeTab === "quality" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Quantitative Quality Bars */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Quantitative Quality Bars</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Checked during deal diligence, Pillar 4 Unit Economics, and monthly portfolio MIS reviews. Click any tile to edit.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setModal({ kind: "quality", index: null })}
                  className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  + Add Quality Bar
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {thesis.quality.map((q, idx) => (
                <button
                  key={`${q.label}-${idx}`}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && setModal({ kind: "quality", index: idx })}
                  className={cx(
                    "group flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition",
                    canEdit ? "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-sm" : "cursor-default",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {q.category ?? "Unit Economics"}
                    </span>
                    <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-800 ring-1 ring-inset ring-indigo-200/80">
                      {q.value}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                    {q.label}
                  </h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{q.why}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2.5 text-[11px]">
                    <span className="font-medium text-slate-500">{q.enforcedBy ?? "IC Diligence Review"}</span>
                    {canEdit && <span className="font-semibold text-indigo-600 group-hover:underline">Edit →</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Hard Exclusions ("Never Invest In") */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 flex flex-col">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Hard Exclusions (Red Lines)</h2>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                  Auto-Pass
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Pitches in these categories are declined politely regardless of traction, revenue growth, or valuation.
              </p>
            </div>

            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newExclusion.trim();
                  if (!trimmed) return;
                  commitThesis({ ...thesis, exclusions: [...thesis.exclusions, trimmed] });
                  setNewExclusion("");
                }}
                className="mt-4 flex gap-2"
              >
                <input
                  type="text"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="Add a hard exclusion rule..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="cursor-pointer shrink-0 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  + Add
                </button>
              </form>
            )}

            <ul className="mt-4 space-y-2 flex-1">
              {thesis.exclusions.map((ex, idx) => (
                <li
                  key={`${ex}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-rose-200/80 bg-rose-50/50 px-3.5 py-2.5 text-xs text-slate-800"
                >
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700">
                      ×
                    </span>
                    <span className="leading-relaxed font-medium">{ex}</span>
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        commitThesis({
                          ...thesis,
                          exclusions: thesis.exclusions.filter((_, i) => i !== idx),
                        })
                      }
                      title="Remove exclusion"
                      className="cursor-pointer shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-500 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* TAB 4: IC GOVERNANCE, PRE-IC CHECKLIST & PORTFOLIO COVENANTS */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          {/* Interactive 6-Step IC Pipeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Investment Committee Decision Pipeline</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  From first deck upload to executed wire (typically 10 to 14 weeks). Click any step to inspect or customize SLA, owner, and gate criteria.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] font-semibold text-slate-700">
                {thesis.process.length} Governed Stages
              </span>
            </div>

            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {thesis.process.map((step, idx) => {
                const active = selectedProcessIdx === idx;
                return (
                  <li key={`${step.step}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedProcessIdx(idx)}
                      className={cx(
                        "flex h-full w-full cursor-pointer flex-col rounded-xl border p-3.5 text-left transition",
                        active
                          ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/15"
                          : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                          Step 0{idx + 1}
                        </span>
                        <span className="rounded bg-indigo-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                          {step.days}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-900">{step.step}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-600">{step.who}</p>
                      <p className="mt-auto pt-2 text-[11px] leading-snug text-slate-500">{step.output}</p>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Active Step Detail Strip */}
            {thesis.process[selectedProcessIdx] && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      STEP 0{selectedProcessIdx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {thesis.process[selectedProcessIdx].step}
                    </span>
                    <span className="font-semibold text-indigo-700">
                      · {thesis.process[selectedProcessIdx].days}
                    </span>
                    <span className="text-slate-500">
                      · Owner: {thesis.process[selectedProcessIdx].who}
                    </span>
                  </div>
                  <p className="text-slate-700">
                    <strong className="font-semibold text-slate-900">Deliverable:</strong> {thesis.process[selectedProcessIdx].output}
                    {thesis.process[selectedProcessIdx].gate && (
                      <>
                        {" · "}
                        <strong className="font-semibold text-slate-900">Exit Gate:</strong> {thesis.process[selectedProcessIdx].gate}
                      </>
                    )}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "process", index: selectedProcessIdx })}
                    className="cursor-pointer shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
                  >
                    Edit Step 0{selectedProcessIdx + 1}
                  </button>
                )}
              </div>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Mandatory Pre-IC Gate Checklist */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-semibold text-slate-900">Mandatory Pre-IC Gates</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Every condition below must be satisfied before a deal enters formal Investment Committee voting.
                </p>
              </div>

              {canEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = newGate.trim();
                    if (!trimmed) return;
                    commitThesis({ ...thesis, beforeIC: [...thesis.beforeIC, trimmed] });
                    setNewGate("");
                  }}
                  className="mt-4 flex gap-2"
                >
                  <input
                    type="text"
                    value={newGate}
                    onChange={(e) => setNewGate(e.target.value)}
                    placeholder="Add a mandatory Pre-IC condition..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    + Add Gate
                  </button>
                </form>
              )}

              <ul className="mt-4 space-y-2">
                {thesis.beforeIC.map((gate, idx) => (
                  <li
                    key={`${gate}-${idx}`}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-800"
                  >
                    {editingGateIdx === idx ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingGateVal}
                          onChange={(e) => setEditingGateVal(e.target.value)}
                          className="flex-1 rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-xs focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = editingGateVal.trim();
                            if (val) {
                              const next = [...thesis.beforeIC];
                              next[idx] = val;
                              commitThesis({ ...thesis, beforeIC: next });
                            }
                            setEditingGateIdx(null);
                          }}
                          className="cursor-pointer rounded-md bg-indigo-600 px-2.5 py-1 font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGateIdx(null)}
                          className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5 text-emerald-600 font-bold">✓</span>
                          <span className="leading-relaxed font-medium">{gate}</span>
                        </span>
                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGateIdx(idx);
                                setEditingGateVal(gate);
                              }}
                              className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                commitThesis({
                                  ...thesis,
                                  beforeIC: thesis.beforeIC.filter((_, i) => i !== idx),
                                })
                              }
                              className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-rose-600"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* Post-Investment Covenants & SLAs */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">After We Invest (Covenants &amp; SLAs)</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Mutual commitments tracked automatically in Portfolio Oversight and Runway Radar. Click any tile to edit.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "covenant", index: null })}
                    className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    + Add SLA
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {thesis.portfolio.map((cov, idx) => {
                  const isFounder = cov.party === "Founder";
                  return (
                    <button
                      key={`${cov.label}-${idx}`}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => canEdit && setModal({ kind: "covenant", index: idx })}
                      className={cx(
                        "group flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-left transition",
                        canEdit ? "cursor-pointer hover:border-indigo-300 hover:bg-white hover:shadow-xs" : "cursor-default",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cx(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                            isFounder
                              ? "bg-blue-50 text-blue-700 ring-blue-200"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                          )}
                        >
                          {isFounder ? "Founder SLA" : "Fund Promise"}
                        </span>
                        {canEdit && (
                          <span className="text-[10px] font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                            Edit
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">{cov.label}</p>
                      <p className="mt-0.5 text-xs font-bold leading-snug text-slate-900">{cov.value}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* MODALS FOR PARTNER EDITING */}
      {modal?.kind === "vehicle" && (
        <VehicleModal
          fundConfig={fundConfig}
          thesis={thesis}
          onClose={() => setModal(null)}
          onSave={(nextFund, nextThesis) => {
            commitFundConfig(nextFund);
            commitThesis(nextThesis);
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "stage" && thesis.stageBars[modal.index] && (
        <StageBarModal
          bar={thesis.stageBars[modal.index]}
          onClose={() => setModal(null)}
          onSave={(updated) => {
            const next = [...thesis.stageBars];
            next[modal.index] = updated;
            commitThesis({ ...thesis, stageBars: next });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "quality" && (
        <QualityBarModal
          initial={modal.index != null ? thesis.quality[modal.index] : null}
          onClose={() => setModal(null)}
          onDelete={
            modal.index != null
              ? () => {
                  commitThesis({ ...thesis, quality: thesis.quality.filter((_, i) => i !== modal.index) });
                  setModal(null);
                }
              : undefined
          }
          onSave={(updated) => {
            const next = [...thesis.quality];
            if (modal.index != null) next[modal.index] = updated;
            else next.push(updated);
            commitThesis({ ...thesis, quality: next });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "process" && thesis.process[modal.index] && (
        <ProcessStepModal
          step={thesis.process[modal.index]}
          index={modal.index}
          onClose={() => setModal(null)}
          onSave={(updated) => {
            const next = [...thesis.process];
            next[modal.index] = updated;
            commitThesis({ ...thesis, process: next });
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "covenant" && (
        <CovenantModal
          initial={modal.index != null ? thesis.portfolio[modal.index] : null}
          onClose={() => setModal(null)}
          onDelete={
            modal.index != null
              ? () => {
                  commitThesis({ ...thesis, portfolio: thesis.portfolio.filter((_, i) => i !== modal.index) });
                  setModal(null);
                }
              : undefined
          }
          onSave={(updated) => {
            const next = [...thesis.portfolio];
            if (modal.index != null) next[modal.index] = updated;
            else next.push(updated);
            commitThesis({ ...thesis, portfolio: next });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function FilterChipGroup({
  title,
  countLabel,
  options,
  selected,
  onToggle,
  canEdit,
  quickAction,
}: {
  title: string;
  countLabel: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  canEdit: boolean;
  quickAction?: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</p>
          <span className="font-mono text-[11px] text-slate-400">{countLabel}</span>
        </div>
        {quickAction && (
          <button
            type="button"
            onClick={quickAction.onClick}
            className="cursor-pointer text-[11px] font-semibold text-indigo-600 hover:underline"
          >
            {quickAction.label}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              disabled={!canEdit}
              className={cx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition disabled:cursor-default",
                on
                  ? "bg-slate-900 text-white ring-slate-900 shadow-2xs"
                  : "bg-white text-slate-600 ring-slate-200",
                canEdit && (on ? "cursor-pointer hover:bg-slate-800" : "cursor-pointer hover:border-indigo-300 hover:bg-slate-50"),
              )}
            >
              {on ? "✓ " : ""}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function VehicleModal({
  fundConfig,
  thesis,
  onClose,
  onSave,
}: {
  fundConfig: FundConfig;
  thesis: Thesis;
  onClose: () => void;
  onSave: (f: FundConfig, t: Thesis) => void;
}) {
  const [fundName, setFundName] = useState(fundConfig.fundName);
  const [committedM, setCommittedM] = useState(String(+(fundConfig.committedUsd / 1_000_000).toFixed(2)));
  const [reservePct, setReservePct] = useState(String(fundConfig.reserveTargetPct));
  const [arrMultiple, setArrMultiple] = useState(String(fundConfig.arrMultiple ?? 8));
  const [vintage, setVintage] = useState(thesis.vintage);
  const [fundLife, setFundLife] = useState(thesis.fundLife);
  const [investmentPeriod, setInvestmentPeriod] = useState(thesis.investmentPeriod);
  const [companies, setCompanies] = useState(thesis.companies);

  return (
    <ModalShell
      title="Edit Fund Vehicle Parameters"
      subtitle="Committed capital, reserves, and ARR multiple sync directly with Fund Analytics (/fund)."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const committedUsd = Math.max(100_000, Math.round((Number(committedM) || 25) * 1_000_000));
          const pct = Math.min(90, Math.max(0, Number(reservePct) || 0));
          const mult = Math.max(1, Number(arrMultiple) || 8);
          onSave(
            {
              ...fundConfig,
              fundName: fundName.trim() || "Aarka Fund I",
              committedUsd,
              reserveTargetPct: pct,
              arrMultiple: mult,
            },
            {
              ...thesis,
              fundName: fundName.trim() || "Aarka Fund I",
              fundSize: usd(committedUsd),
              reserves: `${pct}% held back for follow-on rounds`,
              vintage: vintage.trim() || thesis.vintage,
              fundLife: fundLife.trim() || thesis.fundLife,
              investmentPeriod: investmentPeriod.trim() || thesis.investmentPeriod,
              companies: companies.trim() || thesis.companies,
            },
          );
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fund Name" value={fundName} onChange={setFundName} />
          <Field label="Committed Capital ($M)" value={committedM} onChange={setCommittedM} type="number" step="0.5" />
          <Field label="Follow-on Reserves (%)" value={reservePct} onChange={setReservePct} type="number" step="5" />
          <Field label="NAV Valuation Multiple (x ARR)" value={arrMultiple} onChange={setArrMultiple} type="number" step="0.5" />
          <Field label="Vintage Year" value={vintage} onChange={setVintage} />
          <Field label="Target Portfolio Size" value={companies} onChange={setCompanies} />
        </div>
        <Field label="Fund Life" value={fundLife} onChange={setFundLife} />
        <Field label="Investment Period" value={investmentPeriod} onChange={setInvestmentPeriod} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save &amp; Sync Vehicle</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function StageBarModal({
  bar,
  onClose,
  onSave,
}: {
  bar: StageBar;
  onClose: () => void;
  onSave: (b: StageBar) => void;
}) {
  const [cheque, setCheque] = useState(bar.cheque);
  const [ownership, setOwnership] = useState(bar.ownership);
  const [maxPostMoney, setMaxPostMoney] = useState(bar.maxPostMoney);
  const [revenue, setRevenue] = useState(bar.revenue);
  const [growth, setGrowth] = useState(bar.growth);
  const [convictionFloor, setConvictionFloor] = useState(bar.convictionFloor ?? "");
  const [other, setOther] = useState(bar.other);

  return (
    <ModalShell title={`Edit ${bar.stage} Investment Playbook`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...bar,
            cheque: cheque.trim() || bar.cheque,
            ownership: ownership.trim() || bar.ownership,
            maxPostMoney: maxPostMoney.trim() || bar.maxPostMoney,
            revenue: revenue.trim() || bar.revenue,
            growth: growth.trim() || bar.growth,
            convictionFloor: convictionFloor.trim() || bar.convictionFloor,
            other: other.trim() || bar.other,
          });
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Target Cheque" value={cheque} onChange={setCheque} />
          <Field label="Target Ownership" value={ownership} onChange={setOwnership} />
          <Field label="Max Post-Money" value={maxPostMoney} onChange={setMaxPostMoney} />
        </div>
        <Field label="Revenue Bar" value={revenue} onChange={setRevenue} />
        <Field label="Growth Velocity" value={growth} onChange={setGrowth} />
        <Field label="Conviction Grade Floor" value={convictionFloor} onChange={setConvictionFloor} />
        <Field label="Qualitative Signals (Also Look For)" value={other} onChange={setOther} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save {bar.stage} Bar</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function QualityBarModal({
  initial,
  onClose,
  onDelete,
  onSave,
}: {
  initial: QualityBar | null;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (q: QualityBar) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [category, setCategory] = useState<NonNullable<QualityBar["category"]>>(
    initial?.category ?? "Unit Economics",
  );
  const [enforcedBy, setEnforcedBy] = useState(initial?.enforcedBy ?? "Pillar 4 · Unit Economics");
  const [why, setWhy] = useState(initial?.why ?? "");

  return (
    <ModalShell title={initial ? `Edit Quality Bar: ${initial.label}` : "Add New Quality Bar"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !value.trim()) return;
          onSave({
            label: label.trim(),
            value: value.trim(),
            category,
            enforcedBy: enforcedBy.trim() || "IC Diligence Review",
            why: why.trim() || "Verified during institutional diligence.",
          });
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Metric Name" value={label} onChange={setLabel} placeholder="e.g. Net Revenue Retention" />
          <Field label="Target Threshold" value={value} onChange={setValue} placeholder="e.g. 110% or higher" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block space-y-1">
            <span className="block font-semibold text-slate-700">Category</span>
            <DropdownSelect
              ariaLabel="Quality bar category"
              value={category}
              onChange={(v) => setCategory(v as NonNullable<QualityBar["category"]>)}
              options={[
                { value: "Unit Economics", label: "Unit Economics" },
                { value: "Capital Efficiency", label: "Capital Efficiency" },
                { value: "Risk & Ownership", label: "Risk & Ownership" },
              ]}
              size="sm"
              className="w-full"
            />
          </div>
          <Field label="Checked Where" value={enforcedBy} onChange={setEnforcedBy} />
        </div>
        <Field label="Rationale (Why This Matters)" value={why} onChange={setWhy} />
        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="cursor-pointer text-xs font-semibold text-rose-600 hover:underline"
            >
              Delete quality bar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Quality Bar</Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function ProcessStepModal({
  step,
  index,
  onClose,
  onSave,
}: {
  step: ProcessStep;
  index: number;
  onClose: () => void;
  onSave: (s: ProcessStep) => void;
}) {
  const [name, setName] = useState(step.step);
  const [days, setDays] = useState(step.days);
  const [who, setWho] = useState(step.who);
  const [output, setOutput] = useState(step.output);
  const [gate, setGate] = useState(step.gate ?? "");

  return (
    <ModalShell title={`Edit IC Stage 0${index + 1}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            step: name.trim() || step.step,
            days: days.trim() || step.days,
            who: who.trim() || step.who,
            output: output.trim() || step.output,
            gate: gate.trim() || undefined,
          });
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stage Title" value={name} onChange={setName} />
          <Field label="Target SLA" value={days} onChange={setDays} />
        </div>
        <Field label="Decision Owner(s)" value={who} onChange={setWho} />
        <Field label="Output Deliverable" value={output} onChange={setOutput} />
        <Field label="Exit Gate Criterion" value={gate} onChange={setGate} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Stage</Button>
        </div>
      </form>
    </ModalShell>
  );
}

function CovenantModal({
  initial,
  onClose,
  onDelete,
  onSave,
}: {
  initial: PortfolioCovenant | null;
  onClose: () => void;
  onDelete?: () => void;
  onSave: (c: PortfolioCovenant) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [party, setParty] = useState<"Founder" | "Fund">(initial?.party ?? "Fund");

  return (
    <ModalShell title={initial ? `Edit Covenant: ${initial.label}` : "Add Post-Investment Covenant"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !value.trim()) return;
          onSave({ label: label.trim(), value: value.trim(), party });
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Covenant Title" value={label} onChange={setLabel} placeholder="e.g. Quarterly Board Pack" />
          <div className="block space-y-1">
            <span className="block font-semibold text-slate-700">Commitment Owner</span>
            <DropdownSelect
              ariaLabel="Commitment Owner"
              value={party}
              onChange={(v) => setParty(v as "Founder" | "Fund")}
              options={[
                { value: "Founder", label: "Founder SLA" },
                { value: "Fund", label: "Fund Promise" },
              ]}
              size="sm"
              className="w-full"
            />
          </div>
        </div>
        <Field label="Standard / Terms" value={value} onChange={setValue} placeholder="e.g. Delivered 5 days prior to board meeting" />
        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="cursor-pointer text-xs font-semibold text-rose-600 hover:underline"
            >
              Delete covenant
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Covenant</Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
