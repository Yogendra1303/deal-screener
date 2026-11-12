"use client";

import { useEffect, useRef, useState } from "react";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { addMonths } from "@/lib/portfolio/health";
import type { PortfolioCompany } from "@/lib/portfolio/types";

/**
 * Monthly revenue as reported, with the two things the pitch deck said: revenue when it pitched,
 * and its plan for a later month. One series, so no legend; the two deck points are labelled directly.
 */
export function RevenueChart({ c }: { c: PortfolioCompany }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reported = c.reports.filter((r) => r.numbers.revenue).map((r) => ({ month: r.month, value: r.numbers.revenue!.value }));
  const pitchMonth = c.pitch.receivedAt.slice(0, 7);
  const lastMonth = reported.at(-1)?.month ?? pitchMonth;
  const planInRange = c.pitch.plan.month <= addMonths(lastMonth, 1);
  const endMonth = planInRange && c.pitch.plan.month > lastMonth ? c.pitch.plan.month : lastMonth;
  const months: string[] = [];
  for (let m = pitchMonth; m <= endMonth; m = addMonths(m, 1)) months.push(m);

  const pitchValue = c.pitch.claims.revenue?.value ?? null;
  const all = [...reported.map((r) => r.value), ...(pitchValue != null ? [pitchValue] : []), ...(planInRange ? [c.pitch.plan.revenue] : [])];
  const max = niceMax(Math.max(...all, 1));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];

  const h = 240;
  const pad = { l: 64, r: 32, t: 20, b: 32 };
  const x = (m: string) => pad.l + (months.indexOf(m) / Math.max(1, months.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = reported.map((r, i) => `${i ? "L" : "M"}${x(r.month).toFixed(1)} ${y(r.value).toFixed(1)}`).join(" ");
  const money = (v: number) => fmtMoney(v, c.currency);
  const labelEvery = Math.ceil(months.length / Math.max(2, Math.floor((w - pad.l) / 64)));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const step = (w - pad.l - pad.r) / Math.max(1, months.length - 1);
    setHover(Math.max(0, Math.min(months.length - 1, Math.round((px - pad.l) / step))));
  }

  const hm = hover != null ? months[hover] : null;
  const hRep = hm ? reported.find((r) => r.month === hm) : undefined;
  const tipLines = hm
    ? [
        hRep ? `Reported: ${money(hRep.value)}` : null,
        hm === pitchMonth && pitchValue != null ? `Deck at pitch: ${money(pitchValue)} (p. ${c.pitch.claims.revenue!.page})` : null,
        hm === c.pitch.plan.month && planInRange ? `Deck's plan: ${money(c.pitch.plan.revenue)} (p. ${c.pitch.plan.page})` : null,
      ].filter(Boolean)
    : [];

  return (
    <div ref={box} className="relative">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Monthly revenue for ${c.name}, as reported, with the pitch deck's figures`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-none select-none"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {t === 0 ? "0" : money(t)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % labelEvery === 0 || i === months.length - 1 ? (
            <text key={m} x={x(m)} y={h - 10} textAnchor="middle" fontSize="11" fill="#64748b">
              {fmtMonth(m).replace(" 20", " ’")}
            </text>
          ) : null,
        )}
        {hm && <line x1={x(hm)} x2={x(hm)} y1={pad.t} y2={h - pad.b} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />}
        <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {reported.map((r) => (
          <circle key={r.month} cx={x(r.month)} cy={y(r.value)} r={hm === r.month ? 5 : 3.5} fill="#4f46e5" stroke="#fff" strokeWidth="2" />
        ))}
        {pitchValue != null && (
          <g>
            <circle cx={x(pitchMonth)} cy={y(pitchValue)} r="5" fill="#fff" stroke="#475569" strokeWidth="2" />
            <text x={x(pitchMonth) + 9} y={y(pitchValue) - 8} fontSize="11" fill="#334155">
              At pitch
            </text>
          </g>
        )}
        {planInRange && (
          <g>
            <path
              d={`M${x(c.pitch.plan.month)} ${y(c.pitch.plan.revenue) - 7}l7 7l-7 7l-7 -7z`}
              fill="#fff"
              stroke="#475569"
              strokeWidth="2"
            />
            <text x={x(c.pitch.plan.month) - 10} y={y(c.pitch.plan.revenue) - 10} textAnchor="end" fontSize="11" fill="#334155">
              Deck&apos;s plan
            </text>
          </g>
        )}
      </svg>
      {hm && tipLines.length > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow"
          style={x(hm) > w / 2 ? { right: w - x(hm) + 12 } : { left: x(hm) + 12 }}
        >
          <div className="font-medium">{fmtMonth(hm)}</div>
          {tipLines.map((t) => (
            <div key={t}>{t}</div>
          ))}
        </div>
      )}
      {!planInRange && (
        <p className="mt-1 text-xs text-slate-500">
          The deck&apos;s plan is for {fmtMonth(c.pitch.plan.month)}: {money(c.pitch.plan.revenue)} (p. {c.pitch.plan.page}). Not reached yet.
        </p>
      )}
    </div>
  );
}

function niceMax(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10];
  const n = v / exp;
  return (steps.find((s) => s >= n) ?? 10) * exp;
}
