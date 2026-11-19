"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Disclosure } from "@/components/disclosure";
import { StatusDot, StatusKey, useEvidence } from "@/components/evidence";
import { useLinks } from "@/components/links-store";
import { usePortfolio } from "@/components/portfolio-store";
import { useMyCompanies } from "@/components/scope";
import { useStore } from "@/components/store";
import { Card, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { DEFINITIONS } from "@/lib/agents";
import { COLUMNS, FX_NOTE, dealRow, periodScope, portfolioRow, type Cell, type ColKey, type CompareRow } from "@/lib/compare";
import { fmtMonth } from "@/lib/format";
import type { KeyFact } from "@/lib/provenance";

const METRICS: { key: ColKey; label: string; plain: string; bar?: number; barText?: string; unit: (n: number) => string }[] = [
  { key: "conviction", label: "Conviction", plain: "5-pillar institutional conviction score (0 to 100, Grade A to G)", bar: 75, barText: "Grade B bar: 75+", unit: (n) => `${Math.round(n)}/100` },
  { key: "revenue", label: "Revenue", plain: "Latest monthly recurring or invoiced revenue, USD normalized", unit: (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`) },
  { key: "growth", label: "Growth", plain: "Compounded monthly revenue growth over the last 3 months", bar: 10, barText: "Seed bar: 10% / mo", unit: (n) => `${n.toFixed(1)}%` },
  { key: "burnMultiple", label: "Burn multiple", plain: "Net cash burned for each $1 of new annualized revenue (lower is better)", bar: 2, barText: "Target: 2.0x or less", unit: (n) => `${n.toFixed(1)}x` },
  { key: "runway", label: "Cash left", plain: "Months of runway remaining at the latest monthly net burn", bar: 9, barText: "Watch under 9 mo", unit: (n) => `${n.toFixed(1)} mo` },
  { key: "plan", label: "Vs plan", plain: "Reported monthly revenue compared against the pitch deck plan", bar: 0, barText: "0% = on plan", unit: (n) => `${n > 0 ? "+" : ""}${Math.round(n)}%` },
  { key: "customers", label: "Customers", plain: "Paying customers recorded in the latest reporting month", unit: (n) => Math.round(n).toLocaleString("en-US") },
];

type Show = "all" | "Portfolio" | "Pitch";
type Money = "usd" | "local";

const BAND_TONE: Record<string, string> = {
  "On track": "text-emerald-700",
  Slipping: "text-amber-800",
  "Gone quiet": "text-rose-700",
  "Too early": "text-slate-500",
};

const RIGHT_COLS = new Set<ColKey>(["conviction", "revenue", "growth", "burnMultiple", "runway", "plan", "customers"]);

function calcMedian(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function hasFinancialMetrics(r: CompareRow): boolean {
  return (
    r.cells.revenue.sort != null ||
    r.cells.growth.sort != null ||
    r.cells.burnMultiple.sort != null ||
    r.cells.runway.sort != null ||
    r.cells.customers.sort != null
  );
}

export default function ComparePage() {
  const store = useStore();
  const p = usePortfolio();
  const cos = useMyCompanies();
  const links = useLinks();
  const w = useWorkspace();
  const ev = useEvidence();

  const [show, setShow] = useState<Show>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [money, setMoney] = useState<Money>("usd");
  const [hideIncomplete, setHideIncomplete] = useState(false);
  const [sort, setSort] = useState<{ col: ColKey; dir: "asc" | "desc" }>({ col: "revenue", dir: "desc" });
  const [metric, setMetric] = useState<ColKey>("revenue");

  const rows = useMemo(
    () => [
      ...cos.map((c) => portfolioRow(c, p.today)),
      ...store.deals.filter((d) => w.role === "Partner" || links.ownerOf(d.id) === w.me).map(dealRow),
    ],
    [cos, p.today, store.deals, links, w.role, w.me],
  );

  const sectorOptions = useMemo(() => {
    const sectors = [...new Set(rows.map((r) => r.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "All sectors" }, ...sectors.map((s) => ({ value: s, label: s }))];
  }, [rows]);

  const scopeCounts = useMemo(
    () => ({
      all: rows.length,
      Portfolio: rows.filter((r) => r.kind === "Portfolio").length,
      Pitch: rows.filter((r) => r.kind === "Pitch").length,
    }),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (show === "all" || r.kind === show) &&
          (sectorFilter === "all" || r.sector === sectorFilter) &&
          (!hideIncomplete || hasFinancialMetrics(r)),
      ),
    [rows, show, sectorFilter, hideIncomplete],
  );

  const sortedRows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const x = a.cells[sort.col].sort;
      const y = b.cells[sort.col].sort;
      if (x == null && y == null) return a.name.localeCompare(b.name);
      if (x == null) return 1;
      if (y == null) return -1;
      return sort.dir === "asc" ? x - y : y - x;
    });
  }, [filtered, sort]);

  const summary = useMemo(() => {
    const revVals = filtered.map((r) => r.cells.revenue.sort).filter((n): n is number => n != null);
    const growthVals = filtered.map((r) => r.cells.growth.sort).filter((n): n is number => n != null);
    const revScope = periodScope(filtered, "revenue");
    const metricKeys: ColKey[] = ["revenue", "growth", "burnMultiple", "runway", "plan", "customers"];
    let conflicts = 0;
    for (const r of filtered) {
      if (metricKeys.some((k) => r.cells[k].status === "Conflict")) conflicts++;
    }
    return {
      total: filtered.length,
      portfolio: filtered.filter((r) => r.kind === "Portfolio").length,
      pitches: filtered.filter((r) => r.kind === "Pitch").length,
      medianRev: calcMedian(revVals),
      revCount: revVals.length,
      medianGrowth: calcMedian(growthVals),
      growthCount: growthVals.length,
      conflicts,
      stale: revScope.stale.size,
    };
  }, [filtered]);

  function openCell(r: CompareRow, key: ColKey, cell: Cell) {
    const col = COLUMNS.find((c) => c.key === key)!;
    const fact: KeyFact = {
      key,
      label: col.label,
      value: money === "local" && cell.local ? cell.local : cell.text,
      sub: [cell.sub, money === "usd" && cell.local && r.currency !== "USD" ? `${cell.local} in ${r.currency}` : null].filter(Boolean).join(" · "),
      status: cell.status ?? "Reported",
      why: cell.why ?? col.hint + ".",
      evidence: cell.evidence,
      working: cell.working,
      headline: true,
    };
    ev.open({ fact, company: { id: r.id, name: r.name, side: r.kind === "Pitch" ? "deal" : "portfolio" } });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
          Fund Intelligence · Cross-Company Matrix
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">Compare</h1>
        <p className="mt-1 text-sm text-slate-600">
          Compare portfolio companies and active pitches side by side on standardized definitions and a single currency.
        </p>
      </div>

      {/* Compact Single-Row Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Show cohort">
            {(
              [
                ["all", `All (${scopeCounts.all})`],
                ["Portfolio", `Portfolio (${scopeCounts.Portfolio})`],
                ["Pitch", `Pitches (${scopeCounts.Pitch})`],
              ] as [Show, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={show === k}
                onClick={() => setShow(k)}
                className={cx(
                  "cursor-pointer rounded-md px-3 py-1 transition-colors",
                  show === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <DropdownSelect
            ariaLabel="Filter by sector"
            value={sectorFilter}
            onChange={setSectorFilter}
            options={sectorOptions}
            size="sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Currency display">
            {(
              [
                ["usd", "USD"],
                ["local", "Own currency"],
              ] as [Money, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={money === k}
                onClick={() => setMoney(k)}
                className={cx(
                  "cursor-pointer rounded-md px-3 py-1 transition-colors",
                  money === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHideIncomplete((v) => !v)}
            title="Hide companies without reported financial metrics (revenue, growth, runway, or customers)"
            className={cx(
              "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              hideIncomplete
                ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {hideIncomplete ? "Hiding incomplete" : "Showing all"}
          </button>
        </div>
      </div>

      {/* 4-Tile Balanced Cohort Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Companies Shown</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900">{summary.total}</p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.portfolio} portfolio · {summary.pitches} {summary.pitches === 1 ? "pitch" : "pitches"}
          </p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Median Revenue / mo</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {summary.medianRev != null ? METRICS[1].unit(summary.medianRev) : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">USD normalized · of {summary.revCount} reported</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Median 3m Growth</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {summary.medianGrowth != null ? `${summary.medianGrowth.toFixed(1)}%` : "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Seed bar: 10% / mo · {summary.growthCount} tracked</p>
        </Card>

        <Card className="p-4 shadow-2xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Verification Flags</p>
          <p
            className={cx(
              "mt-1.5 font-mono text-2xl font-bold",
              summary.conflicts > 0
                ? "text-rose-700"
                : summary.stale > 0
                  ? "text-amber-700"
                  : "text-emerald-700",
            )}
          >
            {summary.conflicts + summary.stale === 0 ? "0" : summary.conflicts + summary.stale}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.conflicts + summary.stale === 0
              ? "All reported periods verified"
              : `${summary.conflicts} conflicted · ${summary.stale} stale`}
          </p>
        </Card>
      </div>

      {/* Primary Hero View: Always-Expanded Side-by-Side Comparison Matrix */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Side-by-side matrix</h2>
            <p className="text-xs text-slate-500">
              Click any column header to sort. Click a figure to open its source citation and formula.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Sorted by {COLUMNS.find((c) => c.key === sort.col)?.label} ({sort.dir === "desc" ? "high → low" : "low → high"})
          </span>
        </div>

        {sortedRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            <p>No companies match these filters.</p>
            {(show !== "all" || sectorFilter !== "all" || hideIncomplete) && (
              <button
                type="button"
                onClick={() => {
                  setShow("all");
                  setSectorFilter("all");
                  setHideIncomplete(false);
                }}
                className="mt-2 cursor-pointer text-xs font-semibold text-indigo-700 hover:underline"
              >
                Reset filters →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="sticky left-0 z-10 w-44 border-b border-slate-200 bg-slate-50 px-4 py-2.5 shadow-[1px_0_0_#e2e8f0]">
                    Company
                  </th>
                  {COLUMNS.map((c) => {
                    const active = sort.col === c.key;
                    const right = RIGHT_COLS.has(c.key);
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                        className={cx("border-b border-slate-200 bg-slate-50 px-3.5 py-2.5", right && "text-right")}
                      >
                        <button
                          type="button"
                          title={c.hint}
                          onClick={() => setSort({ col: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                          className={cx(
                            "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap uppercase tracking-wider hover:text-slate-900",
                            right && "justify-end",
                            active && "text-slate-900",
                          )}
                        >
                          {c.label}
                          <span aria-hidden className={cx("text-[10px]", active ? "" : "text-slate-300")}>
                            {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((r) => (
                  <tr key={r.id} className="group transition-colors hover:bg-slate-50/80">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-3 text-left align-middle font-normal shadow-[1px_0_0_#f1f5f9] group-hover:bg-slate-50/80"
                    >
                      <Link href={r.href} className="font-semibold text-slate-900 hover:text-indigo-700">
                        {r.name}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span
                          className={cx(
                            "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            r.kind === "Portfolio" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {r.kind}
                        </span>
                        <span className="truncate">{r.sector}</span>
                      </span>
                    </th>
                    {COLUMNS.map((col) => {
                      const cell = r.cells[col.key];
                      const main = money === "local" && cell.local ? cell.local : cell.text;
                      const right = RIGHT_COLS.has(col.key);
                      const clickable = cell.status != null && (cell.evidence.length > 0 || cell.working.length > 0 || cell.status === "Missing");
                      const body = (
                        <>
                          <span className={cx("flex items-center gap-1.5", right && "justify-end")}>
                            {cell.status && <StatusDot status={cell.status} />}
                            {cell.status === "Conflict" && (
                              <span className="inline-flex items-center rounded-sm bg-rose-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800">
                                Conflict
                              </span>
                            )}
                            <span
                              className={cx(
                                "whitespace-nowrap font-mono text-xs font-medium tabular-nums",
                                cell.sort == null && cell.status == null ? "text-slate-400" : "text-slate-900",
                                col.key === "reporting" && BAND_TONE[cell.text],
                              )}
                            >
                              {main}
                            </span>
                          </span>
                          {cell.sub && (
                            <span className={cx("mt-0.5 block whitespace-nowrap text-[11px] text-slate-500", right && "text-right")}>
                              {cell.sub}
                            </span>
                          )}
                        </>
                      );
                      return (
                        <td key={col.key} className="px-3.5 py-3 align-middle group-hover:bg-slate-50/80">
                          {clickable ? (
                            <button
                              type="button"
                              onClick={() => openCell(r, col.key, cell)}
                              className={cx(
                                "block w-full cursor-pointer rounded-md px-1.5 py-1 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                                right ? "text-right" : "text-left",
                              )}
                            >
                              {body}
                            </button>
                          ) : (
                            <div className={cx("px-1.5 py-1", right ? "text-right" : "text-left")} title={cell.why}>
                              {body}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">
          <span>{FX_NOTE}</span>
          <span>Click any metric with a status dot to inspect its source document and formula.</span>
        </div>
      </section>

      {/* Secondary View: Refined Single-Metric Benchmark Distribution */}
      <Ranked
        rows={filtered}
        metric={metric}
        money={money}
        show={show}
        onPickMetric={setMetric}
        onResetShow={() => setShow("all")}
        onOpen={(r) => openCell(r, metric, r.cells[metric])}
      />

      {/* Consolidated Methodology & Labels Disclosure */}
      <Disclosure
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
        buttonClassName="px-5 py-4 text-sm font-semibold text-slate-900"
        summary={
          <>
            <span>Definitions, FX rates &amp; verification labels</span>
            <span className="ml-2 text-xs font-normal text-slate-500">Column formulas and provenance legend</span>
          </>
        }
      >
        <div className="space-y-5 border-t border-slate-200 px-5 py-4">
          <StatusKey statuses={["Checked", "Reported", "Conflict", "Missing", "Claimed"]} />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">How each metric is calculated</h3>
            <dl className="mt-2.5 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              {DEFINITIONS.map((d) => (
                <div key={d.name}>
                  <dt className="font-medium text-slate-800">{d.name}</dt>
                  <dd className="text-slate-600">{d.rule}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{FX_NOTE}</p>
        </div>
      </Disclosure>
    </div>
  );
}

function Ranked({
  rows,
  metric,
  money,
  show,
  onPickMetric,
  onResetShow,
  onOpen,
}: {
  rows: CompareRow[];
  metric: ColKey;
  money: Money;
  show: Show;
  onPickMetric: (k: ColKey) => void;
  onResetShow: () => void;
  onOpen: (r: CompareRow) => void;
}) {
  const m = METRICS.find((x) => x.key === metric)!;
  const lowBetter = metric === "burnMultiple";
  const withVal = rows
    .filter((r) => r.cells[metric].sort != null)
    .sort((a, b) => (lowBetter ? a.cells[metric].sort! - b.cells[metric].sort! : b.cells[metric].sort! - a.cells[metric].sort!));
  const without = rows.filter((r) => r.cells[metric].sort == null);
  const vals = withVal.map((r) => r.cells[metric].sort!);
  const lo = Math.min(0, ...vals, m.bar ?? 0);
  const hi = Math.max(0, ...vals, m.bar ?? 0) || 1;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const median = calcMedian(vals);
  const good = (v: number) => (m.bar == null ? null : lowBetter ? v <= m.bar : v >= m.bar);
  const { matched, stale } = periodScope(rows, metric);
  const staleCount = withVal.filter((r) => stale.has(r.id)).length;
  const conflicted = withVal.filter((r) => r.cells[metric].status === "Conflict").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Benchmark ranking</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {m.plain}
            {median != null && (
              <>
                {" · "}Median of {vals.length}: <span className="font-semibold text-slate-900">{m.unit(median)}</span>
              </>
            )}
            {matched && ` · Most cover ${fmtMonth(matched)}`}
            {m.barText && ` · ${m.barText}`}
            {staleCount > 0 && <span className="text-amber-700"> · {staleCount} stale</span>}
            {conflicted > 0 && <span className="text-rose-700"> · {conflicted} conflicted</span>}
          </p>
        </div>

        {/* Single Sleek Horizontal Pill Tab Bar */}
        <div role="tablist" aria-label="Benchmark measure" className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1">
          {METRICS.map((item) => {
            const active = metric === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPickMetric(item.key)}
                className={cx(
                  "cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  active ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {withVal.length === 0 ? (
        <div className="my-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-600">
          {metric === "conviction" && show === "Portfolio" ? (
            <>
              <p>Conviction scoring (0 to 100) applies to evaluated pitches; portfolio companies are tracked via monthly MIS metrics.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onPickMetric("revenue")}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Switch to Revenue →
                </button>
                <button
                  type="button"
                  onClick={onResetShow}
                  className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  View All Companies
                </button>
              </div>
            </>
          ) : (
            <p>No companies in this cohort have a figure for {m.label.toLowerCase()} yet.</p>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {withVal.map((r) => {
            const c = r.cells[metric];
            const v = c.sort!;
            const ok = good(v);
            const left = Math.min(pos(0), pos(v));
            const width = Math.max(Math.abs(pos(v) - pos(0)), 1.2);
            const isConflict = c.status === "Conflict";
            const isStale = stale.has(r.id);
            const displayVal = metric === "revenue" && money === "local" && c.local ? c.local : m.unit(v);

            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="grid w-full cursor-pointer grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_10.5rem]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-900">{r.name}</span>
                      <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                        {r.kind}
                      </span>
                    </span>
                    {c.sub && (
                      <span className={cx("block truncate text-[11px]", isStale ? "font-medium text-amber-700" : "text-slate-500")}>
                        {c.sub}
                      </span>
                    )}
                  </span>

                  <span className="relative h-2.5 rounded-full bg-slate-100">
                    <span
                      className={cx(
                        "absolute inset-y-0 rounded-full",
                        isConflict
                          ? "border border-dashed border-rose-500 bg-rose-100"
                          : isStale
                            ? "border border-amber-400 bg-amber-200"
                            : ok == null
                              ? "bg-slate-700"
                              : ok
                                ? "bg-emerald-500"
                                : "bg-rose-400",
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    {median != null && (
                      <span
                        aria-hidden
                        className="absolute -inset-y-1 w-px bg-slate-900/70"
                        style={{ left: `${pos(median)}%` }}
                        title="Median"
                      />
                    )}
                    {m.bar != null && m.bar !== 0 && (
                      <span
                        aria-hidden
                        className="absolute -inset-y-1 w-0.5 rounded bg-amber-500"
                        style={{ left: `${pos(m.bar)}%` }}
                        title={m.barText}
                      />
                    )}
                  </span>

                  <span className="flex items-center justify-end gap-1.5 text-right">
                    {c.status && <StatusDot status={c.status} />}
                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">{displayVal}</span>
                    {isConflict && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Conflict</span>
                    )}
                    {!isConflict && isStale && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Stale</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {without.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>No figure yet:</span>
          {without.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
            >
              {r.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {m.bar != null && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-emerald-500" /> Meets bar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-rose-400" /> Below bar
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full border border-dashed border-rose-500 bg-rose-100" /> Conflicted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-full border border-amber-400 bg-amber-200" /> Stale period
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-slate-900/70" /> Median
        </span>
      </div>
    </section>
  );
}
