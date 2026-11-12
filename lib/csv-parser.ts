// Reads the founder's monthly CSV and works out the headline figures by code: latest MRR, implied ARR,
// month-on-month growth, customers, burn, cash, runway and headcount. Nothing here is estimated by an AI.
import { parseSheet, sheetGrowth } from "./sheet";
import type { SheetRow } from "./types";

export interface SheetSummary {
  months: number;
  from: string;
  to: string;
  currency: string;
  /** Latest month's revenue (treated as MRR). */
  mrr: number | null;
  /** MRR × 12. */
  impliedArr: number | null;
  /** Growth from the month before to the latest month, in percent. */
  momGrowthPct: number | null;
  /** Average compounded monthly growth over the last six months, in percent. */
  avgGrowthPct: number | null;
  customers: number | null;
  /** Latest monthly net burn. Positive means the company loses money. */
  burn: number | null;
  cash: number | null;
  /** cash ÷ burn, in months, when both are known and burn is positive. */
  runwayMonths: number | null;
  headcount: number | null;
}

const latest = (rows: SheetRow[], key: keyof SheetRow): number | null => {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key];
    if (typeof v === "number") return v;
  }
  return null;
};

export function summariseSheet(rows: SheetRow[]): SheetSummary {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  const last = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const mrr = last?.revenue ?? null;
  const mom = mrr != null && prev?.revenue != null && prev.revenue > 0 ? ((mrr - prev.revenue) / prev.revenue) * 100 : null;
  const growth = sheetGrowth(sorted);
  const burn = latest(sorted, "netBurn");
  const cash = latest(sorted, "cash");
  return {
    months: sorted.length,
    from: sorted[0]?.month ?? "",
    to: last?.month ?? "",
    currency: sorted.find((r) => r.currency)?.currency ?? "",
    mrr,
    impliedArr: mrr != null ? mrr * 12 : null,
    momGrowthPct: mom != null ? +mom.toFixed(1) : null,
    avgGrowthPct: growth ? +growth.pct.toFixed(1) : null,
    customers: latest(sorted, "customers"),
    burn,
    cash,
    runwayMonths: burn != null && burn > 0 && cash != null ? +(cash / burn).toFixed(1) : null,
    headcount: latest(sorted, "headcount"),
  };
}

/** The CSV text to rows plus the headline figures. Throws a plain message when the sheet can't be read. */
export function parseCsv(text: string): { rows: SheetRow[]; summary: SheetSummary } {
  const rows = parseSheet(text);
  return { rows, summary: summariseSheet(rows) };
}
