"use client";

import Link from "next/link";
import { Disclosure } from "@/components/disclosure";
import { useMemo, useState } from "react";
import { StatusDot, StatusKey, useEvidence } from "@/components/evidence";
import { usePortfolio } from "@/components/portfolio-store";
import { useMyCompanies } from "@/components/scope";
import { useWorkspace } from "@/components/workspace";
import { useLinks } from "@/components/links-store";
import { useStore } from "@/components/store";
import { Card, cx } from "@/components/ui";
import { DEFINITIONS } from "@/lib/agents";
import { COLUMNS, FX_NOTE, dealRow, portfolioRow, type Cell, type ColKey, type CompareRow } from "@/lib/compare";
import type { KeyFact } from "@/lib/provenance";

const METRICS: { key: ColKey; label: string; plain: string; bar?: number; barText?: string; unit: (n: number) => string }[] = [
  { key: "revenue", label: "Revenue", plain: "Money coming in each month, in US dollars", unit: (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1e3).toFixed(1)}K`) },
  { key: "growth", label: "Growth", plain: "How fast revenue grows a month, over 3 months", bar: 10, barText: "Seed bar: 10% a month", unit: (n) => `${n.toFixed(1)}%` },
  { key: "burnMultiple", label: "Burn multiple", plain: "Cash burned for each $1 of new yearly revenue. Lower is better", bar: 2, barText: "Fund bar: 2× or less", unit: (n) => `${n.toFixed(1)}×` },
  { key: "runway", label: "Cash left", plain: "Months until the cash runs out at today's burn", bar: 9, barText: "Alert under 9 months", unit: (n) => `${n.toFixed(1)} mo` },
  { key: "plan", label: "Vs plan", plain: "Revenue against what the pitch deck promised for that month", bar: 0, barText: "0% = on plan", unit: (n) => `${n > 0 ? "+" : ""}${Math.round(n)}%` },
  { key: "customers", label: "Customers", plain: "Paying customers in the latest month", unit: (n) => Math.round(n).toLocaleString("en-IN") },
];

type Show = "all" | "Portfolio" | "Pitch";
type Money = "usd" | "local";

const BAND_TONE: Record<string, string> = {
  "On track": "text-emerald-700",
  Slipping: "text-amber-800",
  "Gone quiet": "text-red-700",
  "Too early": "text-slate-500",
};

export default function ComparePage() {
  const store = useStore();
  const p = usePortfolio();
  const cos = useMyCompanies();
  const links = useLinks();
  const w = useWorkspace();
  const ev = useEvidence();
  const [show, setShow] = useState<Show>("all");
  const [money, setMoney] = useState<Money>("usd");
  const [sort, setSort] = useState<{ col: ColKey; dir: "asc" | "desc" }>({ col: "revenue", dir: "desc" });
  const [metric, setMetric] = useState<ColKey>("growth");

  const rows = useMemo(
    () => [
      ...cos.map((c) => portfolioRow(c, p.today)),
      ...store.deals.filter((d) => w.role === "Partner" || links.ownerOf(d.id) === w.me).map(dealRow),
    ],
    [cos, p.today, store.deals, links, w.role, w.me],
  );
  const shown = rows
    .filter((r) => show === "all" || r.kind === show)
    .sort((a, b) => {
      const x = a.cells[sort.col].sort;
      const y = b.cells[sort.col].sort;
      if (x == null && y == null) return a.name.localeCompare(b.name);
      if (x == null) return 1;
      if (y == null) return -1;
      return sort.dir === "asc" ? x - y : y - x;
    });

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
    <div className="space-y-5">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="mt-1 text-sm text-slate-600">
          How each company stands against the others on one measure at a time, in one currency and on the same definitions. Pick a
          measure, read the ranking, and click any company for the sources behind its number.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            ["all", "All"],
            ["Portfolio", "Portfolio"],
            ["Pitch", "Pitches"],
          ]}
        />
        <Segmented
          label="Money in"
          value={money}
          onChange={setMoney}
          options={[
            ["usd", "US dollars"],
            ["local", "Own currency"],
          ]}
        />
      </div>

      <MetricPicker value={metric} onChange={setMetric} />
      <Ranked rows={rows.filter((r) => show === "all" || r.kind === show)} metric={metric} onOpen={(r) => openCell(r, metric, r.cells[metric])} />

      <Disclosure
        className="rounded-2xl bg-white ring-1 ring-slate-200"
        buttonClassName="px-5 py-4"
        summary={
          <>
            <span className="font-semibold text-slate-900">Full table</span>
            <span className="ml-2 text-sm text-slate-500">Every metric for every company, sortable</span>
          </>
        }
      >
        <div className="border-t border-slate-200">
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="sticky left-0 z-10 w-40 border-b border-slate-200 bg-slate-50 px-4 py-2.5 font-medium">Company</th>
                {COLUMNS.map((c) => {
                  const active = sort.col === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className="border-b border-slate-200 px-3 py-2.5 font-medium"
                    >
                      <button
                        title={c.hint}
                        onClick={() => setSort({ col: c.key, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
                        className={cx("inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-900", active && "text-slate-900")}
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
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="group">
                  <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2.5 text-left font-normal group-hover:bg-slate-50">
                    <Link href={r.href} className="font-semibold text-slate-900 hover:text-indigo-700">
                      {r.name}
                    </Link>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={cx("rounded px-1 py-px font-semibold uppercase tracking-wide", r.kind === "Pitch" ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700")}>
                        {r.kind}
                      </span>
                      <span className="truncate">{r.sector}</span>
                    </span>
                  </th>
                  {COLUMNS.map((col) => {
                    const cell = r.cells[col.key];
                    const main = money === "local" && cell.local ? cell.local : cell.text;
                    const clickable = cell.status != null && (cell.evidence.length > 0 || cell.working.length > 0 || cell.status === "Missing");
                    const body = (
                      <>
                        <span className="flex items-center gap-1.5">
                          {cell.status && <StatusDot status={cell.status} />}
                          <span
                            className={cx(
                              "whitespace-nowrap font-medium tabular-nums",
                              cell.sort == null && cell.status == null ? "text-slate-400" : "text-slate-900",
                              col.key === "reporting" && BAND_TONE[cell.text],
                            )}
                          >
                            {main}
                          </span>
                        </span>
                        {cell.sub && <span className="mt-0.5 block whitespace-nowrap text-[11px] text-slate-500">{cell.sub}</span>}
                      </>
                    );
                    return (
                      <td key={col.key} className="border-b border-slate-100 px-1.5 py-1.5 align-top group-hover:bg-slate-50">
                        {clickable ? (
                          <button onClick={() => openCell(r, col.key, cell)} className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                            {body}
                          </button>
                        ) : (
                          <div className="px-1.5 py-1" title={cell.why}>
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
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <span>{FX_NOTE}</span>
          <span>Pitches use the founder&apos;s numbers sheet; portfolio companies use their monthly reports.</span>
        </div>
      </div>

        </div>
      </Disclosure>

      <StatusKey statuses={["Checked", "Reported", "Conflict", "Missing", "Claimed"]} />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">How each column is worked out</h2>
        <p className="mt-1 text-xs text-slate-500">
          One dictionary for every company, so the numbers mean the same thing across the grid. Founders&apos; own labels are mapped to these
          before anything is compared.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {DEFINITIONS.map((d) => (
            <div key={d.name}>
              <dt className="font-medium text-slate-800">{d.name}</dt>
              <dd className="text-slate-600">{d.rule}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([k, l]) => (
          <button
            key={k}
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cx("rounded-md px-3 py-1 font-medium", value === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricPicker({ value, onChange }: { value: ColKey; onChange: (k: ColKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Measure" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {METRICS.map((m) => {
        const on = value === m.key;
        return (
          <button
            key={m.key}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.key)}
            className={cx("rounded-xl px-3 py-2.5 text-left ring-1 transition", on ? "bg-slate-900 text-white ring-slate-900" : "bg-white ring-slate-200 hover:ring-slate-300")}
          >
            <span className="block text-sm font-semibold">{m.label}</span>
            <span className={cx("mt-0.5 block text-[11px] leading-snug", on ? "text-white/70" : "text-slate-500")}>{m.plain}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ranked({ rows, metric, onOpen }: { rows: CompareRow[]; metric: ColKey; onOpen: (r: CompareRow) => void }) {
  const m = METRICS.find((x) => x.key === metric)!;
  const lowBetter = metric === "burnMultiple";
  const withVal = rows.filter((r) => r.cells[metric].sort != null).sort((a, b) => (lowBetter ? a.cells[metric].sort! - b.cells[metric].sort! : b.cells[metric].sort! - a.cells[metric].sort!));
  const without = rows.filter((r) => r.cells[metric].sort == null);
  const vals = withVal.map((r) => r.cells[metric].sort!);
  const lo = Math.min(0, ...vals, m.bar ?? 0);
  const hi = Math.max(0, ...vals, m.bar ?? 0) || 1;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const good = (v: number) => (m.bar == null ? null : lowBetter ? v <= m.bar : v >= m.bar);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{m.label}, best first</h2>
        <span className="flex flex-wrap gap-x-4 text-xs text-slate-500">
          {median != null && (
            <span>
              Median <span className="font-semibold text-slate-900">{m.unit(median)}</span>
            </span>
          )}
          {m.barText && <span>{m.barText}</span>}
        </span>
      </div>
      <ul className="mt-4 space-y-1.5">
        {withVal.map((r) => {
          const c = r.cells[metric];
          const v = c.sort!;
          const ok = good(v);
          const left = Math.min(pos(0), pos(v));
          const width = Math.max(Math.abs(pos(v) - pos(0)), 0.8);
          return (
            <li key={r.id}>
              <button onClick={() => onOpen(r)} className="grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7rem]">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{r.name}</span>
                  <span className={cx("text-[10px] font-semibold uppercase tracking-wide", r.kind === "Pitch" ? "text-slate-700" : "text-slate-700")}>{r.kind}</span>
                </span>
                <span className="relative h-5 rounded bg-slate-100">
                  <span
                    className={cx("absolute inset-y-0 rounded", ok == null ? "bg-slate-700" : ok ? "bg-emerald-500" : "bg-red-400")}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                  {median != null && <span aria-hidden className="absolute inset-y-[-3px] w-px bg-slate-900/60" style={{ left: `${pos(median)}%` }} title="Median" />}
                  {m.bar != null && m.bar !== 0 && <span aria-hidden className="absolute inset-y-[-3px] w-0.5 bg-amber-500" style={{ left: `${pos(m.bar)}%` }} title={m.barText} />}
                </span>
                <span className="flex items-center justify-end gap-1.5 text-right">
                  {c.status && <StatusDot status={c.status} />}
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{m.unit(v)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {without.length > 0 && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          No figure yet: {without.map((r) => `${r.name}${r.cells[metric].why ? "" : ""}`).join(", ")}. Usually a report or sheet that hasn&apos;t arrived.
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {m.bar != null && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-emerald-500" /> Meets the fund&apos;s bar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-red-400" /> Below it
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-slate-900/60" /> Median
        </span>
        <span>Click a company for its sources.</span>
      </p>
    </section>
  );
}
