import { cx } from "./ui";
import { fmtMonth } from "@/lib/format";
import {
  COMPANY_BAND_MEANING,
  FUND_BAND_MEANING,
  daysLate,
  dueDateFor,
  fmtShort,
  monthStatus,
  type CompanyBand,
  type FundBand,
  type MonthStatus,
} from "@/lib/portfolio/health";
import type { PortfolioCompany } from "@/lib/portfolio/types";

const COMPANY_STYLE: Record<CompanyBand, string> = {
  "On track": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Slipping: "bg-amber-50 text-amber-800 ring-amber-200",
  "Gone quiet": "bg-red-50 text-red-700 ring-red-200",
  "Too early": "bg-slate-100 text-slate-600 ring-slate-200",
};

const FUND_STYLE: Record<FundBand, string> = {
  Responsive: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Slow: "bg-amber-50 text-amber-800 ring-amber-200",
};

const DOT: Record<CompanyBand | FundBand, string> = {
  "On track": "bg-emerald-500",
  Responsive: "bg-emerald-500",
  Slipping: "bg-amber-400",
  Slow: "bg-amber-400",
  "Gone quiet": "bg-red-500",
  "Too early": "bg-slate-400",
};

export function HealthChip({ side, band, label = true }: { side: "company" | "fund"; band: CompanyBand | FundBand; label?: boolean }) {
  const style = side === "company" ? COMPANY_STYLE[band as CompanyBand] : FUND_STYLE[band as FundBand];
  const meaning = side === "company" ? COMPANY_BAND_MEANING[band as CompanyBand] : FUND_BAND_MEANING[band as FundBand];
  return (
    <span
      title={meaning}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", style)}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", DOT[band])} />
      {label && <span className="font-normal opacity-75">{side === "company" ? "Company:" : "Fund:"}</span>}
      {band}
    </span>
  );
}

export const CELL: Record<MonthStatus, string> = {
  "on time": "bg-emerald-500",
  late: "bg-amber-400",
  missing: "bg-red-500",
  excused: "bg-slate-400",
  "not due": "bg-white ring-1 ring-inset ring-slate-300",
  "before investment": "bg-slate-100",
};

export const CELL_LABEL: Record<MonthStatus, string> = {
  "on time": "On time",
  late: "Late",
  missing: "Missing",
  excused: "Agreed delay",
  "not due": "Not due yet",
  "before investment": "Before investment",
};

/** One line on a month: "Came 18 days late", "Missing, 14 days overdue", "Due 15 Nov". */
export function monthDetail(company: PortfolioCompany, month: string, today: string): string {
  const status = monthStatus(company, month, today);
  const r = company.reports.find((x) => x.month === month);
  switch (status) {
    case "on time":
      return `On time, ${fmtShort(r!.receivedAt!)}`;
    case "late":
      return `Came ${daysLate(r!, today)} days late`;
    case "missing":
      return `Missing, ${daysLate(r ?? { month, dueDate: dueDateFor(month), receivedAt: null, numbers: {}, acknowledgedAt: null }, today)} days overdue`;
    case "excused":
      return r?.receivedAt ? `Agreed delay, sent ${fmtShort(r.receivedAt)}` : "Agreed delay";
    case "not due":
      return `Due ${fmtShort(dueDateFor(month))}`;
    default:
      return "Before investment";
  }
}

export function MonthStrip({
  company,
  months,
  today,
  size = "sm",
}: {
  company: PortfolioCompany;
  months: string[];
  today: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1" role="list" aria-label="Monthly reports">
      {months.map((m) => {
        const status = monthStatus(company, m, today);
        const text = `${fmtMonth(m)}: ${monthDetail(company, m, today)}`;
        return (
          <span
            key={m}
            role="listitem"
            title={text}
            aria-label={text}
            className={cx("shrink-0 rounded-[3px]", size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5", CELL[status])}
          />
        );
      })}
    </div>
  );
}

export function StripLegend({ statuses = ["on time", "late", "missing", "excused", "not due"] }: { statuses?: MonthStatus[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {statuses.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cx("h-3 w-3 rounded-[3px]", CELL[s])} />
          {CELL_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

/** A tiny trend line. Values are drawn as given; nothing is smoothed or filled in. */
export function Sparkline({ values, className }: { values: (number | null)[]; className?: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <span className="text-xs text-slate-400">—</span>;
  const w = 80;
  const h = 24;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => (hi === lo ? h / 2 : h - 3 - ((v - lo) / (hi - lo)) * (h - 6));
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cx("h-6 w-20", className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r="2" fill="currentColor" />
    </svg>
  );
}

export function DemoDate({ today }: { today: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600" title="Active reporting period">
      Reporting period: Q4 {today.slice(0, 4)}
    </span>
  );
}
