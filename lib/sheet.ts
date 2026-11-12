import type { SheetRow } from "./types";

// Reads the founder's monthly numbers sheet (CSV).
// Columns: month (YYYY-MM), currency, revenue, customers, headcount, net_burn, cash.
// Only month and revenue are required.

export function parseSheet(csv: string): SheetRow[] {
  const lines = csv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("The sheet needs a header row and at least one month.");
  const header = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iMonth = col("month");
  const iRevenue = col("revenue", "mrr", "monthlyrevenue");
  if (iMonth < 0 || iRevenue < 0) throw new Error("The sheet needs 'month' and 'revenue' columns.");
  const iCurrency = col("currency");
  const iCustomers = col("customers");
  const iHeadcount = col("headcount", "team", "teamsize", "staff");
  const iBurn = col("netburn", "burn");
  const iCash = col("cash", "cashend", "cashinbank");

  const rows = lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const num = (i: number) => {
      if (i < 0) return null;
      const raw = (cells[i] ?? "").replace(/[, ]/g, "");
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    return {
      month: normaliseMonth(cells[iMonth] ?? ""),
      currency: iCurrency >= 0 ? (cells[iCurrency] || "").toUpperCase() : "",
      revenue: num(iRevenue),
      customers: num(iCustomers),
      headcount: num(iHeadcount),
      netBurn: num(iBurn),
      cash: num(iCash),
    } satisfies SheetRow;
  });
  return rows.filter((r) => r.month).sort((a, b) => a.month.localeCompare(b.month));
}

function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normaliseMonth(s: string): string {
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : "";
}

/** The row for a given month, or the latest row that has the field. */
export function rowFor(sheet: SheetRow[], field: keyof SheetRow, month?: string | null): SheetRow | null {
  const withField = sheet.filter((r) => r[field] != null);
  if (!withField.length) return null;
  if (month) {
    const exact = withField.find((r) => r.month === month);
    if (exact) return exact;
  }
  return withField[withField.length - 1];
}

/** Average month-on-month revenue growth over the last `months` months, compounded. */
export function sheetGrowth(sheet: SheetRow[], months = 6): { pct: number; from: SheetRow; to: SheetRow } | null {
  const rows = sheet.filter((r) => r.revenue != null && r.revenue > 0);
  if (rows.length < 3) return null;
  const slice = rows.slice(-months);
  const from = slice[0];
  const to = slice[slice.length - 1];
  const periods = slice.length - 1;
  const pct = (Math.pow(to.revenue! / from.revenue!, 1 / periods) - 1) * 100;
  return { pct, from, to };
}
