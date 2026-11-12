// The evidence matrix: every cross-check laid out as Metric | Deck claim | Support | Variance | State | Source.
// Display only. It recomputes each comparison with the same helpers and thresholds as runChecks() in
// lib/checks.ts, so a row reads "Conflict" exactly when the engine raised a flag (a test holds the two together).
// It never edits a founder's number and never decides anything.
import type { DealRecord, MoneyFactT, NumberFactT } from "./schema";
import type { FormInput, RegistryRecord, SheetRow } from "./types";
import { GAP_TOLERANCE } from "./checks";
import { fmtMoney, fmtMonth, fmtNum } from "./format";
import { rowFor, sheetGrowth } from "./sheet";
import { usd } from "./rules";

export type EvidenceState = "conflict" | "match" | "not_run";

export interface EvidenceRow {
  checkId: string;
  metric: string;
  /** What the deck states, formatted; null when the deck says nothing. */
  deck: string | null;
  deckPage: number | null;
  deckQuote: string | null;
  /** The other source's figure, normalised to the deck's basis; null when there is none. */
  support: string | null;
  /** Where the support comes from, with its period. */
  supportSource: string;
  /** Signed variance against the support, as a fraction (0.302 = +30.2%); null when not computable. */
  variance: number | null;
  /** Variance in words: "+30.2%", "+4.1 pts", "2 years", or "N/A". */
  varianceText: string;
  /** The engine's rule for this check, in words. */
  rule: string;
  state: EvidenceState;
  /** Why the check did not run, or a caveat about the comparison (period, basis). */
  note: string | null;
  /** The arithmetic, written out, when there is a comparison. */
  formula: string | null;
}

const sameCurrency = (a?: string | null, b?: string | null) => !a || !b || a.trim().toUpperCase() === b.trim().toUpperCase();
/** Signed to one decimal; the sign follows the rounded figure, so −0.04% reads "0.0%", never "−0.0%". */
const signed1 = (n: number, unit: string) => {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}${unit}`;
};
const signedPct = (v: number) => signed1(v * 100, "%");
const SHEET_NOTE = "Founder-reported sheet: it corroborates the deck, it is not independent verification.";

function deckOf(f: MoneyFactT | NumberFactT) {
  return { deckPage: f.page ?? null, deckQuote: f.quote ?? null };
}

function periodNote(asOf: string | null | undefined, month: string): string | null {
  return asOf && asOf !== month ? `Period differs: the deck dates this ${fmtMonth(asOf)}; the sheet's nearest row is ${fmtMonth(month)}.` : null;
}

/** Build the matrix. Same inputs as runChecks(); same answer every time. */
export function evidenceMatrix(args: { record: DealRecord; form: FormInput; sheet: SheetRow[] | null; registry: RegistryRecord | null }): EvidenceRow[] {
  const { record, form, sheet, registry } = args;
  const t = record.traction;
  const rows: EvidenceRow[] = [];
  const hasSheet = Boolean(sheet && sheet.length);
  const noSheet = "No monthly sheet on file.";

  // 1. Revenue: deck vs sheet. Shown on the deck's own basis (annual if the deck states ARR).
  {
    const monthly = t.mrr.amount != null ? t.mrr : t.arr.amount != null ? t.arr : null;
    const isAnnual = monthly === t.arr;
    const rule = `Flag when |deck − sheet| ÷ sheet is strictly more than ${GAP_TOLERANCE * 100}%.`;
    const base: Omit<EvidenceRow, "support" | "supportSource" | "variance" | "varianceText" | "state" | "note" | "formula"> = {
      checkId: "revenue_deck_vs_sheet",
      metric: isAnnual ? "Revenue (annual)" : "Revenue (monthly)",
      deck: monthly ? `${fmtMoney(monthly.amount, monthly.currency)}${isAnnual ? " a year" : " a month"}` : null,
      ...(monthly ? deckOf(monthly) : { deckPage: null, deckQuote: null }),
      rule,
    };
    const row = monthly && hasSheet ? rowFor(sheet!, "revenue", monthly.asOf) : null;
    if (!monthly) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: "The deck states no revenue.", formula: null });
    else if (!hasSheet) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: noSheet, formula: null });
    else if (!row || !row.revenue) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: "The sheet has no revenue to compare (missing or zero), so there is no base for a percentage.", formula: null });
    else if (!sameCurrency(monthly.currency, row.currency))
      rows.push({ ...base, support: fmtMoney(row.revenue, row.currency), supportSource: `Monthly sheet, ${fmtMonth(row.month)}`, variance: null, varianceText: "N/A", state: "not_run", note: `Currency differs (deck ${monthly.currency}, sheet ${row.currency}); the prototype does not convert, so the check does not run.`, formula: null });
    else {
      const cur = monthly.currency || row.currency;
      const deckValue = monthly.amount!;
      const supportValue = isAnnual ? row.revenue * 12 : row.revenue;
      const variance = (deckValue - supportValue) / supportValue;
      // The engine compares monthly figures (ARR ÷ 12 against the sheet month). The ratio is identical.
      const gap = Math.abs((isAnnual ? deckValue / 12 : deckValue) - row.revenue) / Math.abs(row.revenue);
      rows.push({
        ...base,
        support: isAnnual ? `${fmtMoney(supportValue, cur)} a year` : `${fmtMoney(supportValue, cur)} a month`,
        supportSource: isAnnual ? `Monthly sheet: ${fmtMonth(row.month)} × 12, an annualised run-rate, not recognised ARR` : `Monthly sheet, ${fmtMonth(row.month)}`,
        variance,
        varianceText: signedPct(variance),
        state: gap > GAP_TOLERANCE ? "conflict" : "match",
        note: [periodNote(monthly.asOf, row.month), SHEET_NOTE].filter(Boolean).join(" "),
        formula: `(${fmtMoney(deckValue, cur)} − ${fmtMoney(supportValue, cur)}) ÷ ${fmtMoney(supportValue, cur)} × 100 = ${signedPct(variance)}`,
      });
    }
  }

  // 2. Growth: deck vs sheet (points, not a percentage of a percentage).
  {
    const claimed = t.monthlyGrowthPct.value;
    const growth = hasSheet ? sheetGrowth(sheet!) : null;
    const rule = "Flag when the deck and sheet differ by more than 3 points or 30% of the sheet's rate, whichever is larger.";
    const base = { checkId: "growth_deck_vs_sheet", metric: "Monthly growth", deck: claimed != null ? `${claimed}% a month` : null, ...deckOf(t.monthlyGrowthPct), rule };
    if (claimed == null) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: "The deck states no growth rate.", formula: null });
    else if (!growth) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: hasSheet ? "The sheet has fewer than 3 months of revenue." : noSheet, formula: null });
    else {
      const diff = claimed - growth.pct;
      const limit = Math.max(3, 0.3 * Math.abs(growth.pct));
      rows.push({
        ...base,
        support: `${growth.pct.toFixed(1)}% a month`,
        supportSource: `Monthly sheet, ${fmtMonth(growth.from.month)} to ${fmtMonth(growth.to.month)} (compounded)`,
        variance: null,
        varianceText: signed1(diff, " pts"),
        state: Math.abs(diff) > limit ? "conflict" : "match",
        note: SHEET_NOTE,
        formula: `${claimed}% − ${growth.pct.toFixed(1)}% = ${diff.toFixed(1)} pts; limit ${limit.toFixed(1)} pts`,
      });
    }
  }

  // 3 and 4. Customers and team size: deck vs sheet.
  const counts: [NumberFactT, "customers" | "headcount", string, string][] = [
    [t.customers, "customers", "customers_deck_vs_sheet", "Customers"],
    [t.teamSize, "headcount", "team_deck_vs_sheet", "Team size"],
  ];
  for (const [fact, field, checkId, metric] of counts) {
    const rule = `Flag when the gap is strictly more than ${GAP_TOLERANCE * 100}% and at least 3 apart.`;
    const base = { checkId, metric, deck: fact.value != null ? fmtNum(fact.value) : null, ...deckOf(fact), rule };
    const row = fact.value != null && hasSheet ? rowFor(sheet!, field, fact.asOf) : null;
    const actual = row?.[field];
    if (fact.value == null) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: `The deck states no ${metric.toLowerCase()}.`, formula: null });
    else if (!hasSheet) rows.push({ ...base, support: null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: noSheet, formula: null });
    else if (!row || actual == null || actual === 0)
      rows.push({ ...base, support: actual === 0 ? "0" : null, supportSource: "Monthly sheet", variance: null, varianceText: "N/A", state: "not_run", note: "The sheet has no non-zero figure to compare.", formula: null });
    else {
      const variance = (fact.value - actual) / actual;
      const conflict = Math.abs(variance) > GAP_TOLERANCE && Math.abs(fact.value - actual) >= 3;
      rows.push({
        ...base,
        support: fmtNum(actual),
        supportSource: `Monthly sheet, ${fmtMonth(row.month)}`,
        variance,
        varianceText: signedPct(variance),
        state: conflict ? "conflict" : "match",
        note: [periodNote(fact.asOf, row.month), SHEET_NOTE].filter(Boolean).join(" "),
        formula: `(${fmtNum(fact.value)} − ${fmtNum(actual)}) ÷ ${fmtNum(actual)} × 100 = ${signedPct(variance)}`,
      });
    }
  }

  // 5. The deck's own maths: ARR vs MRR × 12.
  {
    const rule = `Flag when ARR differs from MRR × 12 by strictly more than ${GAP_TOLERANCE * 100}%.`;
    const base = { checkId: "arr_vs_mrr_maths", metric: "ARR vs MRR × 12", deck: t.arr.amount ? `${fmtMoney(t.arr.amount, t.arr.currency)} a year` : null, ...deckOf(t.arr), rule };
    if (!t.mrr.amount || !t.arr.amount) rows.push({ ...base, support: null, supportSource: "Deck's own maths", variance: null, varianceText: "N/A", state: "not_run", note: "The deck needs both monthly and annual revenue for this check.", formula: null });
    else if (!sameCurrency(t.mrr.currency, t.arr.currency)) rows.push({ ...base, support: null, supportSource: "Deck's own maths", variance: null, varianceText: "N/A", state: "not_run", note: "Monthly and annual revenue are in different currencies.", formula: null });
    else {
      const cur = t.arr.currency || t.mrr.currency;
      const expected = t.mrr.amount * 12;
      const variance = (t.arr.amount - expected) / expected;
      rows.push({
        ...base,
        support: `${fmtMoney(expected, cur)} a year`,
        supportSource: `Deck's own maths: ${fmtMoney(t.mrr.amount, cur)} a month × 12`,
        variance,
        varianceText: signedPct(variance),
        state: Math.abs(variance) > GAP_TOLERANCE ? "conflict" : "match",
        note: null,
        formula: `(${fmtMoney(t.arr.amount, cur)} − ${fmtMoney(expected, cur)}) ÷ ${fmtMoney(expected, cur)} × 100 = ${signedPct(variance)}`,
      });
    }
  }

  // 6. The deck's own maths: runway vs cash ÷ burn. Note the engine's rule here is 2 months and 20%, not 10%.
  {
    const rule = "Flag when stated runway differs from cash ÷ burn by more than 2 months and more than 20%.";
    const base = { checkId: "runway_maths", metric: "Runway", deck: t.runwayMonths.value != null ? `${t.runwayMonths.value} months` : null, ...deckOf(t.runwayMonths), rule };
    if (!t.cash.amount || !t.monthlyBurn.amount || t.runwayMonths.value == null)
      rows.push({ ...base, support: null, supportSource: "Deck's own maths", variance: null, varianceText: "N/A", state: "not_run", note: "The deck needs runway, cash and monthly burn for this check (a zero or missing burn has no runway to compute).", formula: null });
    else if (!sameCurrency(t.cash.currency, t.monthlyBurn.currency)) rows.push({ ...base, support: null, supportSource: "Deck's own maths", variance: null, varianceText: "N/A", state: "not_run", note: "Cash and burn are in different currencies.", formula: null });
    else {
      const cur = t.cash.currency || t.monthlyBurn.currency;
      const computed = t.cash.amount / t.monthlyBurn.amount;
      const stated = t.runwayMonths.value;
      const variance = (stated - computed) / computed;
      rows.push({
        ...base,
        support: `${computed.toFixed(1)} months`,
        supportSource: `Deck's own maths: ${fmtMoney(t.cash.amount, cur)} ÷ ${fmtMoney(t.monthlyBurn.amount, cur)} a month`,
        variance,
        varianceText: signedPct(variance),
        state: Math.abs(stated - computed) > 2 && Math.abs(stated - computed) / computed > 0.2 ? "conflict" : "match",
        note: null,
        formula: `${fmtMoney(t.cash.amount, cur)} ÷ ${fmtMoney(t.monthlyBurn.amount, cur)} = ${computed.toFixed(1)} months; stated ${stated}`,
      });
    }
  }

  // 7. Round size: deck vs the ask typed on the intake form (USD only).
  {
    const round = record.round.amount;
    const rule = `Flag when deck and form differ by strictly more than ${GAP_TOLERANCE * 100}% (USD only).`;
    const base = { checkId: "round_deck_vs_form", metric: "Round size", deck: round.amount ? `${fmtMoney(round.amount, round.currency || "USD")} (deck)` : null, ...deckOf(round), rule };
    if (!round.amount) rows.push({ ...base, support: form.amountUsd ? `${usd(form.amountUsd)} (form)` : null, supportSource: "Intake form", variance: null, varianceText: "N/A", state: "not_run", note: "The deck states no round size.", formula: null });
    else if (!form.amountUsd) rows.push({ ...base, support: null, supportSource: "Intake form", variance: null, varianceText: "N/A", state: "not_run", note: "The form has no round ask.", formula: null });
    else if (round.currency && round.currency.toUpperCase() !== "USD") rows.push({ ...base, support: `${usd(form.amountUsd)} (form)`, supportSource: "Intake form", variance: null, varianceText: "N/A", state: "not_run", note: `The deck states ${round.currency}; the prototype compares USD only.`, formula: null });
    else {
      const variance = (round.amount - form.amountUsd) / form.amountUsd;
      rows.push({
        ...base,
        support: `${usd(form.amountUsd)} (form)`,
        supportSource: "Intake form, typed by the founder",
        variance,
        varianceText: signedPct(variance),
        state: Math.abs(variance) > GAP_TOLERANCE ? "conflict" : "match",
        note: null,
        formula: `(${usd(round.amount)} − ${usd(form.amountUsd)}) ÷ ${usd(form.amountUsd)} × 100 = ${signedPct(variance)}`,
      });
    }
  }

  // 8. Founding year: deck vs registry.
  {
    const founded = record.company.foundedYear;
    const rule = "Flag when the deck and registry are 1 year or more apart.";
    const base = { checkId: "founded_vs_registry", metric: "Founding year", deck: founded.value != null ? String(founded.value) : null, ...deckOf(founded), rule };
    if (founded.value == null) rows.push({ ...base, support: registry ? registry.incorporated.slice(0, 4) : null, supportSource: "Registry", variance: null, varianceText: "N/A", state: "not_run", note: "The deck states no founding year.", formula: null });
    else if (!registry) rows.push({ ...base, support: null, supportSource: "Registry", variance: null, varianceText: "N/A", state: "not_run", note: "No registry record on file.", formula: null });
    else {
      const regYear = Number(registry.incorporated.slice(0, 4));
      const diff = founded.value - regYear;
      rows.push({
        ...base,
        support: `${regYear} (incorporated ${registry.incorporated})`,
        supportSource: /sample/i.test(registry.source) ? "Registry (sample record)" : "Registry",
        variance: null,
        varianceText: diff === 0 ? "Same year" : `${Math.abs(diff)} year${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "later" : "earlier"}`,
        state: Math.abs(diff) >= 1 ? "conflict" : "match",
        note: null,
        formula: `${founded.value} − ${regYear} = ${diff}`,
      });
    }
  }

  return rows;
}
