// The "perfect reading" of each sample deck, used to measure how accurately the AI reads numbers,
// and to test the code checks without calling the AI.
import type { DealRecord, MoneyFactT, NumberFactT, TextFactT } from "./schema";
import { fmtMoney, fmtNum } from "./format";

type Money = { amount: number; currency: string } | null;

export interface Gold {
  mrr: Money;
  arr: Money;
  growth: number | null;
  customers: number | null;
  team: number | null;
  burn: Money;
  cash: Money;
  runway: number | null;
  round: number | null;
  founded: number | null;
}

const text = (value: string | null = null): TextFactT => ({ value, page: null, quote: null });
const num = (value: number | null): NumberFactT => ({ value, asOf: null, page: value == null ? null : 1, quote: null });
const money = (m: Money, asOf: string | null = null): MoneyFactT => ({
  amount: m?.amount ?? null,
  currency: m?.currency ?? null,
  asOf: m ? asOf : null,
  page: m ? 1 : null,
  quote: null,
});

/** A deal record holding exactly the gold facts. */
export function recordFromGold(g: Gold, name: string): DealRecord {
  return {
    oneLiner: "",
    company: {
      name: text(name), website: text(), country: text(), city: text(), sector: text(), businessModel: text(),
      stage: text(), foundedYear: num(g.founded), description: text(),
    },
    round: {
      amount: money(g.round == null ? null : { amount: g.round, currency: "USD" }),
      instrument: text(), valuation: money(null), useOfFunds: text(), priorFunding: text(),
    },
    traction: {
      mrr: money(g.mrr, "2026-09"), arr: money(g.arr, "2026-09"), monthlyGrowthPct: num(g.growth), customers: num(g.customers),
      users: num(null), retention: text(), grossMarginPct: num(null), monthlyBurn: money(g.burn), cash: money(g.cash),
      runwayMonths: num(g.runway), teamSize: num(g.team),
    },
    team: [{ name: "Founder", role: null, page: 1, pastRoles: [{ company: "X", title: "Y", startYear: 2015, endYear: 2020, page: 1, quote: null }] }],
    market: { sizeClaim: money(null), sizeMethod: text(), competitors: [] },
  };
}

/** Compares the AI's reading of the key numbers with the gold values. */
export function compareWithGold(record: DealRecord, g: Gold): { field: string; expected: string; got: string; ok: boolean }[] {
  const t = record.traction;
  const close = (a: number | null, b: number | null) =>
    a == null || b == null ? a === b : Math.abs(a - b) <= Math.max(0.01 * Math.abs(b), 0.05);
  const m = (field: string, got: MoneyFactT, exp: Money) => ({
    field,
    expected: exp ? fmtMoney(exp.amount, exp.currency) : "not stated",
    got: got.amount != null ? fmtMoney(got.amount, got.currency) : "not stated",
    ok: close(got.amount, exp?.amount ?? null) && (!exp || !got.currency || got.currency.toUpperCase() === exp.currency),
  });
  const n = (field: string, got: number | null, exp: number | null, show: (x: number) => string = fmtNum) => ({
    field,
    expected: exp == null ? "not stated" : show(exp),
    got: got == null ? "not stated" : show(got),
    ok: close(got, exp),
  });
  return [
    m("Monthly revenue", t.mrr, g.mrr),
    m("Annual revenue", t.arr, g.arr),
    n("Monthly growth", t.monthlyGrowthPct.value, g.growth),
    n("Customers", t.customers.value, g.customers),
    n("Team size", t.teamSize.value, g.team),
    m("Monthly burn", t.monthlyBurn, g.burn),
    m("Cash", t.cash, g.cash),
    n("Runway", t.runwayMonths.value, g.runway),
    n("Round size", record.round.amount.amount, g.round, (x) => fmtMoney(x, "USD")),
    n("Founded", record.company.foundedYear.value, g.founded, String),
  ];
}
