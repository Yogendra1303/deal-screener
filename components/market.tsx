"use client";

// Market charts in a terminal style: light panels, thin marks, fixed-width numbers and a hover readout on every mark.
// Every number here is counted by code from the deal-flow rows or read from the sample market table (lib/funnel.ts).
import { describeChange, windowCounts } from "@/lib/change";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { changeText } from "./charts";
import { TempPill, slugOf, type FlowRow, type SectorStat } from "./flow";
import { LABEL, cx } from "./ui";
import { fmtMonth } from "@/lib/format";
import { MONTHS, TEMP_SHARE, type Temperature, TEMP_RULE_TEXT } from "@/lib/funnel";

// ---------- Shared pieces ----------

export const PANEL = "rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]";

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** What happened to a company, in four buckets that stack cleanly. */
export type Outcome = "Meeting" | "Open" | "Never opened" | "Passed or held";
export const OUTCOMES: Outcome[] = ["Meeting", "Open", "Never opened", "Passed or held"];
export const OUTCOME_COLOR: Record<Outcome, string> = {
  Meeting: "#059669",
  Open: "#64748b",
  "Never opened": "#f59e0b",
  "Passed or held": "#cbd5e1",
};
export const outcomeOf = (r: Pick<FlowRow, "label">): Outcome =>
  r.label === "Meeting set"
    ? "Meeting"
    : r.label === "Passed" || r.label === "On hold"
      ? "Passed or held"
      : r.label === "Never opened"
        ? "Never opened"
        : "Open";

export const TEMP_COLOR: Record<Temperature, string> = {
  "Heating up": "#059669",
  Crowding: "#d97706",
  Steady: "#94a3b8",
  Cooling: "#dc2626",
};

/** Per-sector numbers the grid and the map share. */
export interface SectorFacts {
  m: SectorStat;
  decks6: number;
  decks3: number;
  companies: number;
  strong: number;
  rated: number;
  meetings: number;
  passed: number;
  fits: number;
}

export function sectorFacts(rows: FlowRow[], market: SectorStat[]): SectorFacts[] {
  return market.map((m) => {
    const mine = rows.filter((r) => r.sector === m.sector && r.dates.some((d) => MONTHS.includes(d.slice(0, 7))));
    return {
      m,
      decks6: sum(m.counts),
      decks3: sum(m.counts.slice(-3)),
      companies: mine.length,
      strong: mine.filter((r) => r.fit === "Strong").length,
      rated: mine.filter((r) => r.fit).length,
      meetings: mine.filter((r) => r.status === "Meeting set").length,
      passed: mine.filter((r) => r.status === "Passed" || r.status === "On hold").length,
      fits: mine.filter((r) => r.fits).length,
    };
  });
}

/** Deck dates per month, split by what happened to the company. */
export function monthlyOutcomes(rows: FlowRow[]): Record<Outcome, number>[] {
  return MONTHS.map((ym) => {
    const out = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
    for (const r of rows) {
      const n = r.dates.filter((d) => d.startsWith(ym)).length;
      if (n) out[outcomeOf(r)] += n;
    }
    return out;
  });
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface Tip {
  x: number;
  y: number;
  flip: boolean;
  body: React.ReactNode;
}

/** A hover readout that follows the pointer inside a relative box. */
function useTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, body: React.ReactNode) => {
    const b = box.current?.getBoundingClientRect();
    if (!b) return;
    const p =
      "clientX" in e
        ? { x: e.clientX, y: e.clientY }
        : (() => {
            const r = (e.target as Element).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top };
          })();
    setTip({
      x: p.x - b.left,
      y: p.y - b.top,
      flip: p.x - b.left > b.width / 2,
      body,
    });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-max max-w-[15rem] rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
    >
      {tip.body}
    </div>
  ) : null;
  return { box, show, hide, node };
}

function TipRows({ title, rows }: { title: string; rows: [string, React.ReactNode, string?][] }) {
  return (
    <>
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map(([k, v, color]) => (
        <p key={k} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-300">
            {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
            {k}
          </span>
          <span className="font-mono font-semibold">{v}</span>
        </p>
      ))}
    </>
  );
}

export function Legend({ items, className }: { items: [string, string][]; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600", className)}>
      {items.map(([label, color]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function PanelHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Small inline marks for the grids ----------

/** Six thin columns, one per month; the last three darker. */
export function MiniColumns({ values, max, className }: { values: number[]; max?: number; className?: string }) {
  const top = Math.max(1, max ?? Math.max(...values));
  return (
    <span className={cx("inline-flex h-6 items-end gap-[2px]", className)} aria-label={values.join(", ")}>
      {values.map((v, i) => (
        <span
          key={i}
          title={`${fmtMonth(MONTHS[i])}: ${v}`}
          className={cx("w-[6px] rounded-t-[2px]", i >= values.length - 3 ? "bg-slate-700" : "bg-slate-300")}
          style={{
            height: v ? `${Math.max(12, (v / top) * 100)}%` : "2px",
            opacity: v ? 1 : 0.6,
          }}
        />
      ))}
    </span>
  );
}

/** A change as a bar either side of zero (green up, red down) with the figure beside it. */
export function ChangeBar({ value, max = 1.5, className, from }: { value: number; max?: number; className?: string; from?: [number, number] }) {
  const said = from ? describeChange(from[0], from[1]) : null;
  // Growth from zero is undefined: say "New · 0→N" or "No activity" rather than draw a bar.
  if (said && said.value === null)
    return (
      <span className={cx("flex items-center gap-2", className)} title={said.aria}>
        <span className="relative h-2 w-20 shrink-0" aria-hidden />
        <span className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{said.text}</span>
      </span>
    );
  const flat = Math.abs(value) < 0.05;
  const w = Math.min(1, Math.abs(value) / max) * 50;
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <span className="relative h-2 w-20 shrink-0 rounded-sm bg-slate-100">
        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-slate-300" />
        {!flat && (
          <span
            className={cx("absolute inset-y-0 rounded-sm", value > 0 ? "bg-emerald-500" : "bg-red-500")}
            style={value > 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
          />
        )}
      </span>
      <span title={said?.aria} className={cx("w-16 whitespace-nowrap font-mono text-xs font-semibold tabular-nums", flat ? "text-slate-500" : value > 0 ? "text-emerald-700" : "text-red-700")}>
        {changeText(value)}
      </span>
    </span>
  );
}

/** One horizontal bar split into parts, with a 2px gap between parts. */
export function SplitBar({ parts, className }: { parts: { label: string; value: number; color: string }[]; className?: string }) {
  const total = sum(parts.map((p) => p.value));
  if (!total) return <span className={cx("block h-2 rounded-sm bg-slate-100", className)} />;
  return (
    <span
      className={cx("flex h-2 gap-[2px] overflow-hidden rounded-sm", className)}
      title={parts
        .filter((p) => p.value)
        .map((p) => `${p.label}: ${p.value}`)
        .join(" · ")}
    >
      {parts.map((p) =>
        p.value ? (
          <span
            key={p.label}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.color,
            }}
          />
        ) : null,
      )}
    </span>
  );
}

// ---------- Momentum map: decks against money ----------

/**
 * Every sector placed by two moves code already works out: decks the fund received (across) and money raised
 * in the sector (up). Bubble size is decks in 6 months; colour is the temperature code gives the sector.
 */
export function MomentumMap({ facts }: { facts: SectorFacts[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { box, show, hide, node } = useTip();
  const router = useRouter();
  const go = (sector: string) => router.push(`/sectors/${slugOf(sector)}`);
  const W = Math.max(280, width);
  const H = W < 480 ? 320 : 340;
  const pad = { l: 44, r: 16, t: 16, b: 34 };
  const xs = facts.map((f) => f.m.inboundChange);
  const ys = facts.map((f) => f.m.moneyChange);
  const x0 = Math.min(-0.75, Math.floor((Math.min(...xs) - 0.15) * 4) / 4);
  const x1 = Math.max(0.6, Math.ceil(Math.max(...xs) * 4) / 4 + 0.15);
  const yAbs = Math.max(0.5, Math.ceil(Math.max(...ys.map(Math.abs)) * 10) / 10 + 0.1);
  const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + ((yAbs - v) / (2 * yAbs)) * (H - pad.t - pad.b);
  const maxN = Math.max(...facts.map((f) => f.decks6), 1);
  const narrow = W < 480;
  const rOf = (n: number) => 4 + (narrow ? 10 : 15) * Math.sqrt(n / maxN);
  const xTicks = [x0, 0, TEMP_SHARE, x1 >= 1 ? 1 : null].filter((v): v is number => v != null && v <= x1);
  const yTicks = [-yAbs, -TEMP_SHARE, 0, TEMP_SHARE, yAbs].map((v) => Math.round(v * 100) / 100);
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  // Biggest first, so small bubbles sit on top and stay hoverable.
  const order = [...facts].sort((a, b) => b.decks6 - a.decks6);
  // Bubbles that land on almost the same spot are pushed apart sideways, so each one can be clicked.
  const centre = new Map<string, { x: number; y: number }>();
  for (const f of order) {
    const r = rOf(f.decks6);
    const p = { x: sx(f.m.inboundChange), y: sy(f.m.moneyChange) };
    for (let step = 1; step < 12; step++) {
      const clash = [...centre.entries()].find(([k, q]) => Math.hypot(q.x - p.x, q.y - p.y) < (r + rOf(facts.find((g) => g.m.sector === k)!.decks6)) * 0.7);
      if (!clash) break;
      const q = clash[1];
      const dir = p.x >= q.x ? 1 : -1;
      p.x += dir * 6;
      p.y += (p.y >= q.y ? 1 : -1) * 3;
    }
    centre.set(f.m.sector, p);
  }
  const cxOf = (f: SectorFacts) => centre.get(f.m.sector)!.x;
  const cyOf = (f: SectorFacts) => centre.get(f.m.sector)!.y;
  // Place each label beside its bubble where it doesn't hit another label or bubble: right, left, above, below.
  type Box = { x: number; y: number; w: number; h: number };
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const dots: Box[] = facts.map((f) => {
    const r = rOf(f.decks6);
    return {
      x: cxOf(f) - r,
      y: cyOf(f) - r,
      w: 2 * r,
      h: 2 * r,
    };
  });
  const placed: Box[] = [];
  const labels = new Map<string, { x: number; y: number; anchor: "start" | "end" | "middle" }>();
  for (const f of order) {
    const x = cxOf(f);
    const y = cyOf(f);
    const r = rOf(f.decks6);
    const w = f.m.sector.length * 6.3;
    const tries: {
      x: number;
      y: number;
      anchor: "start" | "end" | "middle";
      box: Box;
    }[] = [
      {
        x: x + r + 4,
        y,
        anchor: "start",
        box: { x: x + r + 4, y: y - 7, w, h: 14 },
      },
      {
        x: x - r - 4,
        y,
        anchor: "end",
        box: { x: x - r - 4 - w, y: y - 7, w, h: 14 },
      },
      {
        x,
        y: y - r - 7,
        anchor: "middle",
        box: { x: x - w / 2, y: y - r - 14, w, h: 14 },
      },
      {
        x,
        y: y + r + 9,
        anchor: "middle",
        box: { x: x - w / 2, y: y + r + 2, w, h: 14 },
      },
      {
        x: x + r * 0.7 + 2,
        y: y - r - 6,
        anchor: "start",
        box: { x: x + r * 0.7 + 2, y: y - r - 13, w, h: 14 },
      },
      {
        x: x - r * 0.7 - 2,
        y: y - r - 6,
        anchor: "end",
        box: { x: x - r * 0.7 - 2 - w, y: y - r - 13, w, h: 14 },
      },
      {
        x: x + r * 0.7 + 2,
        y: y + r + 8,
        anchor: "start",
        box: { x: x + r * 0.7 + 2, y: y + r + 1, w, h: 14 },
      },
      {
        x,
        y: y - r - 21,
        anchor: "middle",
        box: { x: x - w / 2, y: y - r - 28, w, h: 14 },
      },
    ];
    const fits = (b: Box) => b.x >= pad.l && b.x + b.w <= W - pad.r && b.y >= 0 && b.y + b.h <= H - pad.b;
    const pick =
      tries.find((t) => fits(t.box) && !placed.some((p) => hit(p, t.box)) && !dots.some((d) => hit(d, t.box))) ?? tries.find((t) => fits(t.box)) ?? tries[0];
    placed.push(pick.box);
    labels.set(f.m.sector, pick);
  }

  return (
    <section className={cx(PANEL, "flex flex-col")}>
      <PanelHead
        title="Momentum map"
        sub="Across: decks we received, last 3 months vs the 3 before. Up: capital raised across the sector."
        right={<Legend items={(Object.keys(TEMP_COLOR) as Temperature[]).map((t) => [t, TEMP_COLOR[t]])} />}
      />
      <div ref={box} className="relative flex-1 px-2 pb-2 pt-1">
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-label="Sectors by change in decks and change in money raised" className="block">
              {/* The heating-up corner: both moves above the line code uses. */}
              <rect x={sx(TEMP_SHARE)} y={pad.t} width={W - pad.r - sx(TEMP_SHARE)} height={sy(TEMP_SHARE) - pad.t} fill="#ecfdf5" />
              <rect x={sx(TEMP_SHARE)} y={sy(0)} width={W - pad.r - sx(TEMP_SHARE)} height={H - pad.b - sy(0)} fill="#fffbeb" />
              {yTicks.map((v) => (
                <g key={`y${v}`}>
                  <line
                    x1={pad.l}
                    x2={W - pad.r}
                    y1={sy(v)}
                    y2={sy(v)}
                    stroke={v === 0 ? "#94a3b8" : "#e2e8f0"}
                    strokeDasharray={Math.abs(v) === TEMP_SHARE ? "3 3" : undefined}
                  />
                  <text x={pad.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                    {fmt(v)}
                  </text>
                </g>
              ))}
              {xTicks.map((v) => (
                <g key={`x${v}`}>
                  <line
                    x1={sx(v)}
                    x2={sx(v)}
                    y1={pad.t}
                    y2={H - pad.b}
                    stroke={v === 0 ? "#94a3b8" : "#e2e8f0"}
                    strokeDasharray={v === TEMP_SHARE ? "3 3" : undefined}
                  />
                  <text x={sx(v)} y={H - pad.b + 14} textAnchor="middle" className="fill-slate-400 font-mono text-[10px]">
                    {narrow && v === TEMP_SHARE ? "" : fmt(v)}
                  </text>
                </g>
              ))}
              {!narrow && (
                <>
                  <text x={W - pad.r - 6} y={pad.t + 14} textAnchor="end" className="fill-emerald-700 text-[11px] font-semibold uppercase tracking-wider">
                    Heating up
                  </text>
                  <text x={W - pad.r - 6} y={H - pad.b - 8} textAnchor="end" className="fill-amber-700 text-[11px] font-semibold uppercase tracking-wider">
                    Crowding
                  </text>
                  <text x={pad.l + 6} y={H - pad.b - 8} className="fill-red-700 text-[11px] font-semibold uppercase tracking-wider">
                    Cooling
                  </text>
                </>
              )}
              <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="fill-slate-500 text-[10px]">
                Decks received →
              </text>
              {order.map((f) => {
                const cx_ = cxOf(f);
                const cy = cyOf(f);
                const r = rOf(f.decks6);
                const lab = labels.get(f.m.sector)!;
                const body = (
                  <TipRows
                    title={f.m.sector}
                    rows={[
                      ["Temperature", f.m.temp, TEMP_COLOR[f.m.temp]],
                      ["Decks, 6 months", f.decks6],
                      ["Decks change", changeText(f.m.inboundChange)],
                      ["Money change", changeText(f.m.moneyChange)],
                      ["Raised, 90 days", `$${f.m.raised[0]}M`],
                    ]}
                  />
                );
                return (
                  <g
                    key={f.m.sector}
                    role="link"
                    tabIndex={0}
                    aria-label={`${f.m.sector}: ${f.m.temp}`}
                    className="cursor-pointer outline-none"
                    onClick={() => go(f.m.sector)}
                    onKeyDown={(e) => e.key === "Enter" && go(f.m.sector)}
                    onMouseMove={(e) => show(e, body)}
                    onMouseLeave={hide}
                    onFocus={(e) => show(e, body)}
                    onBlur={hide}
                  >
                    <circle cx={cx_} cy={cy} r={r + 6} fill="transparent" />
                    <circle
                      cx={cx_}
                      cy={cy}
                      r={r}
                      fill={TEMP_COLOR[f.m.temp]}
                      fillOpacity={0.85}
                      stroke="#fff"
                      strokeWidth={2}
                      className="transition-[fill-opacity] hover:fill-opacity-100"
                    />
                    <text x={lab.x} y={lab.y} dy="0.32em" textAnchor={lab.anchor} className="pointer-events-none fill-slate-700 text-[11px] font-medium">
                      {f.m.sector}
                    </text>
                  </g>
                );
              })}
              <text transform={`translate(11 ${(pad.t + H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className="fill-slate-500 text-[10px]">
                Money raised →
              </text>
            </svg>
          )}
        </div>
        {node}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        Dashed lines are the ±{Math.round(TEMP_SHARE * 100)}% the temperature rule uses. Bigger bubble, more decks in 6 months. Click a sector to open it.{" "}
        <span className="text-slate-400">{TEMP_RULE_TEXT}</span>
      </p>
    </section>
  );
}

// ---------- Monthly columns, stacked by outcome ----------

export function OutcomeColumns({
  data,
  title = "Decks by month",
  sub = "Each deck, by what happened to the company since.",
  height = 240,
}: {
  data: Record<Outcome, number>[];
  title?: string;
  sub?: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { box, show, hide, node } = useTip();
  const W = Math.max(260, width);
  const H = W < 480 ? Math.min(height, 240) : height;
  const pad = { l: 28, r: 8, t: 12, b: 26 };
  const totals = data.map((d) => sum(OUTCOMES.map((o) => d[o])));
  const top = Math.max(4, Math.ceil(Math.max(...totals) / 4) * 4);
  const ticks = [0, top / 2, top];
  const band = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(44, band * 0.62);
  const sy = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);

  return (
    <section className={cx(PANEL, "flex flex-col")}>
      <PanelHead title={title} sub={sub} right={<Legend items={OUTCOMES.map((o) => [o, OUTCOME_COLOR[o]])} />} />
      <div ref={box} className="relative flex-1 px-2 pb-1 pt-2">
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={W} height={H} role="img" aria-label={`${title}: ${totals.join(", ")}`} className="block">
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "#94a3b8" : "#eef2f6"} />
                  <text x={pad.l - 6} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-slate-400 font-mono text-[10px]">
                    {v}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = pad.l + band * i + (band - bw) / 2;
                let acc = 0;
                const parts = OUTCOMES.filter((o) => d[o] > 0);
                const body = <TipRows title={`${fmtMonth(MONTHS[i])} · ${totals[i]} decks`} rows={OUTCOMES.map((o) => [o, d[o], OUTCOME_COLOR[o]])} />;
                return (
                  <g key={i} onMouseMove={(e) => show(e, body)} onMouseLeave={hide}>
                    <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent" className="hover:fill-slate-50" />
                    {parts.map((o, j) => {
                      const y1 = sy(acc);
                      acc += d[o];
                      const y2 = sy(acc);
                      const isTop = j === parts.length - 1;
                      const h = Math.max(1, y1 - y2 - (isTop ? 0 : 2));
                      return isTop ? (
                        <path key={o} d={roundTop(x, y2, bw, y1 - y2, 3)} fill={OUTCOME_COLOR[o]} />
                      ) : (
                        <rect key={o} x={x} y={y2 + 2} width={bw} height={h} fill={OUTCOME_COLOR[o]} />
                      );
                    })}
                    <text x={x + bw / 2} y={sy(totals[i]) - 5} textAnchor="middle" className="fill-slate-700 font-mono text-[10px] font-semibold">
                      {totals[i]}
                    </text>
                    <text
                      x={x + bw / 2}
                      y={H - 8}
                      textAnchor="middle"
                      className={cx("text-[10px]", i >= data.length - 3 ? "fill-slate-700 font-semibold" : "fill-slate-400")}
                    >
                      {fmtMonth(MONTHS[i]).slice(0, 3)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        {node}
      </div>
    </section>
  );
}

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// ---------- The sector grid ----------

/** The bar hides in a narrow grid; the figure stays. */
export const GRID_BAR = "[&>span:first-child]:hidden @lg:[&>span:first-child]:block";

type SortKey = "decks3" | "change" | "money" | "strong" | "meetings";

function SortHead({
  k,
  sort,
  dir = "desc",
  onSort,
  children,
  className,
}: {
  k?: SortKey;
  sort: SortKey;
  dir?: "asc" | "desc";
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const on = Boolean(k && sort === k);
  return (
    <th className={cx("whitespace-nowrap bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider", className)} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      {k ? (
        <button
          onClick={() => onSort(k)}
          className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900", on && "text-slate-900")}
          title={on ? `Sorted ${dir === "asc" ? "lowest" : "highest"} first. Click to reverse.` : "Click to sort"}
        >
          {children}
          <span aria-hidden className={on ? "" : "text-slate-300"}>
            {on ? (dir === "asc" ? "▴" : "▾") : "↕"}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

/** Every sector as one dense row: trend, decks, both moves, money, fit and outcomes. Sortable by header. */
export function SectorGrid({ facts }: { facts: SectorFacts[] }) {
  const [sort, setSort] = useState<SortKey>("change");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setDir("desc");
    }
  };
  const val = (f: SectorFacts): number =>
    sort === "decks3"
      ? f.decks3
      : sort === "change"
        ? f.m.inboundChange
        : sort === "money"
          ? f.m.raised[0]
          : sort === "strong"
            ? f.strong / Math.max(1, f.rated)
            : f.meetings;
  const sign = dir === "desc" ? 1 : -1;
  const list = [...facts].sort((a, b) => sign * (val(b) - val(a)) || b.decks6 - a.decks6 || a.m.sector.localeCompare(b.m.sector));
  const peak = Math.max(...facts.flatMap((f) => f.m.counts), 1);
  const tot = {
    decks6: sum(facts.map((f) => f.decks6)),
    decks3: sum(facts.map((f) => f.decks3)),
    raised: sum(facts.map((f) => f.m.raised[0])),
    raisedBefore: sum(facts.map((f) => f.m.raised[1])),
    rounds: sum(facts.map((f) => f.m.rounds[0])),
    strong: sum(facts.map((f) => f.strong)),
    rated: sum(facts.map((f) => f.rated)),
    meetings: sum(facts.map((f) => f.meetings)),
    companies: sum(facts.map((f) => f.companies)),
    passed: sum(facts.map((f) => f.passed)),
  };
  const before3 = tot.decks6 - tot.decks3;
  const H = SortHead;
  const hp = { sort, dir, onSort };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white @container">
      <PanelHead
        title="Every sector"
        sub="Click a header to sort. Capital raised and round counts track broader sector activity; everything else is counted from our decks."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <H className="sticky left-0 z-10 bg-slate-50 shadow-[1px_0_0_#e2e8f0]" {...hp}>
                Sector
              </H>
              <H className="hidden @2xl:table-cell" {...hp}>
                6 months
              </H>
              <H k="decks3" className="text-right" {...hp}>
                Decks 3m
              </H>
              <H k="change" {...hp}>
                Decks change
              </H>
              <H k="money" className="hidden text-right @3xl:table-cell" {...hp}>
                Raised 90d
              </H>
              <H className="hidden @3xl:table-cell" {...hp}>
                Money change
              </H>
              <H k="strong" className="hidden text-right @4xl:table-cell" {...hp}>
                Strong fit
              </H>
              <H k="meetings" className="hidden @xl:table-cell" {...hp}>
                What happened
              </H>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.m.sector} className="group border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 align-middle shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50/80">
                  <Link href={`/sectors/${slugOf(f.m.sector)}`} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TEMP_COLOR[f.m.temp] }} aria-hidden />
                    <span className="truncate font-semibold tracking-tight text-slate-900 group-hover:underline">{f.m.sector}</span>
                    <span className="hidden @lg:inline">
                      <TempPill t={f.m.temp} />
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 align-middle @2xl:table-cell">
                  <MiniColumns values={f.m.counts} max={peak} />
                </td>
                <td className="px-4 py-3 text-right align-middle font-mono font-semibold tabular-nums text-slate-900">{f.decks3}</td>
                <td className="px-4 py-3 align-middle">
                  <ChangeBar value={f.m.inboundChange} max={2} className={GRID_BAR} from={windowCounts(f.m.counts)} />
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-right align-middle font-mono tabular-nums text-slate-700 @3xl:table-cell">
                  ${f.m.raised[0]}M<span className="ml-1 text-[11px] text-slate-400">{f.m.rounds[0]} rds</span>
                </td>
                <td className="hidden px-4 py-3 align-middle @3xl:table-cell">
                  <ChangeBar value={f.m.moneyChange} max={0.6} />
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-right align-middle @4xl:table-cell">
                  <Link
                    href={`/sectors/${slugOf(f.m.sector)}?f=strong`}
                    title={`${f.strong} of ${f.rated} companies have strong founder-market fit. Click to list them.`}
                    className="inline-flex items-center gap-1 rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide tabular-nums text-emerald-800 hover:bg-emerald-200/80"
                  >
                    {f.strong} of {f.rated} <span className="font-normal text-emerald-700">({pct(f.strong, f.rated)}%)</span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 align-middle @xl:table-cell">
                  <span className="flex items-center gap-2" title={`${f.meetings} meetings, ${f.companies - f.meetings - f.passed} still open, ${f.passed} passed or on hold, of ${f.companies} companies`}>
                    <SplitBar
                      className="w-14 shrink-0"
                      parts={[
                        { label: "Meeting", value: f.meetings, color: OUTCOME_COLOR.Meeting },
                        { label: "Open", value: f.companies - f.meetings - f.passed, color: OUTCOME_COLOR.Open },
                        { label: "Passed or held", value: f.passed, color: OUTCOME_COLOR["Passed or held"] },
                      ]}
                    />
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-600">
                      {f.meetings} {f.meetings === 1 ? "meeting" : "meetings"} · {f.passed} passed / on hold
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 text-slate-900">
            <tr>
              <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider shadow-[1px_0_0_#e2e8f0]">All sectors</td>
              <td className="hidden px-3 py-2 @2xl:table-cell">
                <MiniColumns values={MONTHS.map((_, i) => sum(facts.map((f) => f.m.counts[i])))} />
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{tot.decks3}</td>
              <td className="px-3 py-2">
                <ChangeBar value={tot.decks3 / Math.max(1, before3) - 1} max={2} className={GRID_BAR} from={[before3, tot.decks3]} />
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums @3xl:table-cell">
                ${tot.raised.toLocaleString("en-US")}M<span className="ml-1 text-[11px] text-slate-400">{tot.rounds} rds</span>
              </td>
              <td className="hidden px-3 py-2 @3xl:table-cell">
                <ChangeBar value={tot.raised / Math.max(1, tot.raisedBefore) - 1} max={0.6} />
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right text-[11px] tabular-nums @4xl:table-cell">
                {tot.strong} of {tot.rated} ({pct(tot.strong, tot.rated)}%)
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-[11px] tabular-nums text-slate-600 @xl:table-cell">
                {tot.meetings} {tot.meetings === 1 ? "meeting" : "meetings"} · {tot.passed} passed / on hold · {tot.companies} companies
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ---------- Funnel for one sector ----------

export function Funnel({
  steps,
  active,
  onPick,
}: {
  steps: { key: string; label: string; value: number; note?: string }[];
  active?: string | null;
  onPick?: (key: string) => void;
}) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={s.key}>
          <button
            onClick={() => onPick?.(s.key)}
            disabled={!onPick}
            title={onPick ? `Show the ${s.value} ${s.value === 1 ? "company" : "companies"} in the table below` : undefined}
            className={cx(
              "block w-full rounded-md px-2 py-1.5 text-left transition-colors",
              onPick && "hover:bg-slate-50",
              active === s.key && "bg-slate-100 ring-1 ring-slate-300",
            )}
          >
            <span className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">{s.label}</span>
              <span className="font-mono tabular-nums text-slate-900">
                <span className="font-semibold">{s.value}</span>
                {i > 0 && <span className="ml-1.5 text-slate-400">{pct(s.value, top)}%</span>}
              </span>
            </span>
            <span className="mt-1 block h-2 rounded-sm bg-slate-100">
              <span className="block h-2 rounded-sm bg-slate-800" style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / top) * 100)}%` }} />
            </span>
            {s.note && <span className="mt-0.5 block text-[11px] text-slate-400">{s.note}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

export { PanelHead, TipRows };
