"use client";

// Small, quiet charts in the style of a trading app: a trend line with a soft fill, a change chip, and a
// market map where each sector is a tile sized by how many decks came in and coloured by its direction.
// All of them draw numbers that code has already worked out; nothing here is estimated.
import { describeChange } from "@/lib/change";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./ui";

/** A smooth line through the points, with an optional soft fill under it. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  tone = "indigo",
  fill = true,
  fluid = false,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "indigo" | "up" | "down" | "white";
  fill?: boolean;
  /** Stretch to the box set by className (width and height), keeping the line weight. */
  fluid?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const color = { indigo: "#4f46e5", up: "#059669", down: "#e11d48", white: "#ffffff" }[tone];
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i * (width - 2 * pad)) / (values.length - 1), height - pad - ((v - min) / Math.max(1e-9, max - min)) * (height - 2 * pad)]);
  // Catmull-Rom to Bezier, for a soft curve that still passes through every point.
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
  }
  const last = pts[pts.length - 1];
  if (fluid)
    return (
      <div className={cx("relative", className)} aria-hidden>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={tone === "white" ? 0.35 : 0.22} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {fill && <path d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#g${id})`} />}
          <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(last[0] / width) * 100}%`, top: `${(last[1] / height) * 100}%`, background: color }} />
      </div>
    );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cx("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={tone === "white" ? 0.35 : 0.22} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#g${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

/** "▲ +34%", "▼ −15%" or, within ±5%, a neutral "+3%". Always a percentage change, never a ratio:
 * 8 decks against 3 is +167%, not "2.7×". A zero baseline has no percentage; see describeChange. */
export function changeText(value: number) {
  const flat = Math.abs(value) < 0.05;
  const pct = Math.round(value * 100);
  const signed = `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;
  return flat ? signed : `${value > 0 ? "▲" : "▼"} ${signed}`;
}

/** The change as a chip: green up, red down, grey within ±5%. With `from` (previous, current counts) a zero
 * baseline shows as "New · 0→N" or "No activity" instead of a made-up percentage. */
export function Delta({ value, className, solid, from }: { value: number; className?: string; solid?: boolean; from?: [number, number] }) {
  const said = from ? describeChange(from[0], from[1]) : null;
  if (said && said.value === null)
    return (
      <span title={said.aria} aria-label={said.aria} className={cx("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap", solid ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700", className)}>
        {said.text}
      </span>
    );
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap",
        flat
          ? solid
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-600"
          : up
            ? solid
              ? "bg-emerald-400/20 text-emerald-200"
              : "bg-emerald-50 text-emerald-700"
            : solid
              ? "bg-red-400/20 text-red-200"
              : "bg-red-50 text-red-700",
        className,
      )}
    >
      <span title={said?.aria}>{changeText(value)}</span>
    </span>
  );
}

export interface MapItem {
  key: string;
  label: string;
  value: number;
  change: number;
  href: string;
  sub?: string;
  /** Monthly counts, oldest first; drawn on the biggest tiles. */
  trend?: number[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap: tiles as close to square as the sizes allow. Returns rectangles in 0..100 units. */
export function squarify(values: number[], box: Rect = { x: 0, y: 0, w: 100, h: 100 }): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));
  const scale = (box.w * box.h) / total;
  const areas = values.map((v) => v * scale);
  const out: Rect[] = new Array(values.length);
  let rect = { ...box };
  let i = 0;
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0);
    const mx = Math.max(...row);
    const mn = Math.min(...row);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (i < areas.length) {
    const side = Math.min(rect.w, rect.h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
    const s = row.reduce((a, b) => a + b, 0);
    if (rect.w >= rect.h) {
      const w = s / rect.h;
      let y = rect.y;
      row.forEach((a, k) => {
        out[i + k] = { x: rect.x, y, w, h: a / w };
        y += a / w;
      });
      rect = { x: rect.x + w, y: rect.y, w: rect.w - w, h: rect.h };
    } else {
      const h = s / rect.w;
      let x = rect.x;
      row.forEach((a, k) => {
        out[i + k] = { x, y: rect.y, w: a / h, h };
        x += a / h;
      });
      rect = { x: rect.x, y: rect.y + h, w: rect.w, h: rect.h - h };
    }
    i = j;
  }
  return out;
}

/** Seven colour grades, like a trading heatmap: muted near flat, brighter the bigger the move. */
export const GRADES = [
  { upTo: -0.5, color: "#e5484d", label: "Down 50%+" },
  { upTo: -0.2, color: "#b4363d", label: "Down 20–50%" },
  { upTo: -0.05, color: "#7d3a43", label: "Down a little" },
  { upTo: 0.05, color: "#3b4252", label: "Flat" },
  { upTo: 0.2, color: "#2f6b4a", label: "Up a little" },
  { upTo: 0.5, color: "#2a8a50", label: "Up 20–50%" },
  { upTo: Infinity, color: "#1f9d55", label: "Up 50%+" },
];
export const gradeOf = (c: number) => (GRADES.find((g) => c < g.upTo) ?? GRADES[GRADES.length - 1]).color;

/**
 * A market map on a dark ground: tile size is how many decks came in over 6 months; colour is the
 * direction over the last 3 months against the 3 before. Each tile links to its sector.
 */
export function MarketMap({ items, height: wanted = 320 }: { items: MapItem[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  // On a phone the map grows taller so the small tiles still have room.
  const height = width < 520 ? Math.max(wanted, Math.round(width * 1.15)) : wanted;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sorted = [...items].filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const rects = squarify(sorted.map((x) => x.value));
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl bg-slate-950" style={{ height }}>
      {sorted.map((it, k) => {
        const r = rects[k];
        const w = (r.w / 100) * width - 4;
        const h = (r.h / 100) * height - 4;
        // What fits: the full tile, a two-line tile, or the name alone.
        const size = h >= 84 && w >= 100 ? "full" : h >= 48 && w >= 64 ? "compact" : h >= 22 && w >= 40 ? "name" : "none";
        const chart = size === "full" && h >= 128 && w >= 130 && it.trend;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={cx(
              "group absolute flex overflow-hidden rounded-lg text-white transition duration-200 hover:z-10 hover:ring-2 hover:ring-white/70",
              size === "full" ? "flex-col justify-between p-2.5 sm:p-3" : size === "compact" ? "flex-col justify-center gap-0.5 px-2 py-1.5" : "items-center px-1.5",
            )}
            style={{
              left: `calc(${r.x}% + 2px)`,
              top: `calc(${r.y}% + 2px)`,
              width: `calc(${r.w}% - 4px)`,
              height: `calc(${r.h}% - 4px)`,
              background: `linear-gradient(145deg, ${gradeOf(it.change)} 0%, color-mix(in srgb, ${gradeOf(it.change)} 78%, #020617) 100%)`,
            }}
            title={`${it.label}: ${it.value} decks in 6 months, ${changeText(it.change)} in the last 3 months against the 3 before`}
            aria-label={`${it.label}: ${it.value} decks, ${changeText(it.change)}`}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
            {size !== "none" && (
              <span className={cx("relative font-semibold leading-tight drop-shadow-sm", size === "full" ? "line-clamp-2 text-sm sm:text-base" : size === "compact" ? "truncate text-xs" : "truncate text-[10px]")}>{it.label}</span>
            )}
            {chart && <Sparkline values={it.trend!} fluid tone="white" className="relative my-1 h-8 w-full max-w-[12rem] flex-none opacity-80" />}
            {size === "full" && (
              <span className="relative flex items-end justify-between gap-1">
                <span className="text-lg font-semibold tabular-nums sm:text-2xl">{it.value}</span>
                <span className="text-xs font-semibold tabular-nums text-white/90">{changeText(it.change)}</span>
              </span>
            )}
            {size === "compact" && (
              <span className="relative flex items-baseline gap-1.5 text-[11px] tabular-nums text-white/90">
                <span className="text-sm font-semibold text-white">{it.value}</span>
                {changeText(it.change)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** The colour key for the market map. */
export function GradeKey({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2 text-[11px] text-slate-400", className)}>
      <span>Falling</span>
      <span className="flex overflow-hidden rounded-full">
        {GRADES.map((g) => (
          <span key={g.label} title={g.label} className="h-2 w-5" style={{ background: g.color }} />
        ))}
      </span>
      <span>Rising</span>
    </div>
  );
}

/** A thin bar split into coloured parts, for a pipeline or a mix. */
export function StackBar({ parts, className }: { parts: { label: string; value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className={cx("space-y-2", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => (
          <span key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cx("h-2 w-2 rounded-full", p.color)} />
            {p.label} <span className="font-semibold tabular-nums text-slate-900">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
