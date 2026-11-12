// Where every key number came from, and whether anything has checked it. Plain code, no AI.
// Each number gets one of five labels, with the sources behind it and the code's working.
import { GAP_TOLERANCE } from "./checks";
import { fmtMoney, fmtMonth, fmtNum } from "./format";
import { usd } from "./rules";
import { rowFor, sheetGrowth } from "./sheet";
import { addMonths, lastDueMonth, reportStatus, runwayMonths } from "./portfolio/health";
import { METRICS, type MetricKey, type MonthlyReport, type PortfolioCompany } from "./portfolio/types";
import type { MoneyFactT, NumberFactT, TextFactT } from "./schema";
import type { CheckId, DealResult, SheetRow } from "./types";

export type FactStatus = "Claimed" | "Reported" | "Checked" | "Conflict" | "Missing";
export const FACT_STATUSES: FactStatus[] = ["Checked", "Reported", "Claimed", "Conflict", "Missing"];

export const STATUS_MEANING: Record<FactStatus, string> = {
  Claimed: "Only the founder says it: deck, form or call.",
  Reported: "From the founder's monthly report or numbers sheet.",
  Checked: "A second, independent source agrees.",
  Conflict: "Two sources disagree. A person decides; nothing is corrected.",
  Missing: "Expected or asked for, not received.",
};

export interface Evidence {
  source: string; // "Pitch deck", "Numbers sheet", "Application form", "Sep 2026 MIS", "Registry (sample)"
  value: string;
  file?: string;
  page?: number | null;
  quote?: string | null;
  url?: string | null; // a link that opens the file (at the page, for PDFs)
}

export interface KeyFact {
  key: string;
  label: string;
  value: string;
  sub?: string;
  status: FactStatus;
  why: string;
  evidence: Evidence[];
  working?: string[];
  /** Shown on the company overview; the rest live in the Numbers tab. */
  headline: boolean;
}

const gap = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);
const pct1 = (n: number) => `${n.toFixed(1)}%`;

// ---------------- Pitches ----------------

export function dealFacts(deal: DealResult, deckUrl: string | null = deal.deck.url): KeyFact[] {
  const r = deal.record;
  const t = r.traction;
  const sheet = deal.sheet ?? [];
  const flagged = (id: CheckId) => deal.flags.some((f) => f.checkId === id && f.kind === "conflict");
  const file = deal.deck.fileName;
  const deck = (f: { page: number | null; quote: string | null }, value: string): Evidence => ({
    source: "Pitch deck",
    value,
    file,
    page: f.page,
    quote: f.quote,
    url: deckUrl && f.page ? `${deckUrl}#page=${f.page}` : deckUrl,
  });
  const sheetEv = (row: SheetRow, value: string): Evidence => ({ source: "Numbers sheet", value: `${value} in ${fmtMonth(row.month)}`, file: "Monthly numbers sheet (CSV)" });
  const facts: KeyFact[] = [];

  // Revenue: the deck's figure against the founder's sheet.
  {
    const fact = t.mrr.amount != null ? t.mrr : t.arr.amount != null ? t.arr : null;
    const annual = fact === t.arr;
    const row = sheet.length ? rowFor(sheet, "revenue", fact?.asOf) : null;
    const cur = fact?.currency || row?.currency || "";
    const money = (n: number) => fmtMoney(n, cur);
    const ev: Evidence[] = [];
    const working: string[] = [];
    if (fact) ev.push(deck(fact, `${money(fact.amount!)} ${annual ? "a year" : "a month"}`));
    if (row?.revenue != null) {
      ev.push(sheetEv(row, money(row.revenue)));
      if (annual) working.push(`Sheet, ${fmtMonth(row.month)}: ${money(row.revenue)} × 12 = ${money(row.revenue * 12)} a year`);
      if (fact) {
        const deckMonthly = annual ? fact.amount! / 12 : fact.amount!;
        working.push(`Gap between deck and sheet: ${Math.round(gap(deckMonthly, row.revenue) * 100)}%. Flagged above ${GAP_TOLERANCE * 100}%.`);
      }
    }
    const conflict = flagged("revenue_deck_vs_sheet");
    facts.push({
      key: "revenue",
      label: "Revenue",
      value: fact ? `${money(fact.amount!)}${annual ? " ARR" : " a month"}` : row?.revenue != null ? `${money(row.revenue)} a month` : "Not stated",
      sub: conflict && row?.revenue != null ? `Sheet supports ${annual ? money(row.revenue * 12) : money(row.revenue)}` : row ? `${fmtMonth(row.month)}, sheet` : fact?.asOf ? fmtMonth(fact.asOf) : undefined,
      status: conflict ? "Conflict" : fact && row ? "Checked" : fact ? "Claimed" : row ? "Reported" : "Missing",
      why: conflict
        ? "The deck's figure is more than 10% above what the founder's own sheet supports."
        : fact && row
          ? "The deck and the monthly sheet agree within 10%."
          : fact
            ? "Only the deck states it; no sheet to compare."
            : row
              ? "From the founder's sheet; the deck doesn't state revenue."
              : "Neither the deck nor a sheet gives revenue.",
      evidence: ev,
      working,
      headline: true,
    });
  }

  // Growth
  {
    const g = sheet.length ? sheetGrowth(sheet) : null;
    const claimed = t.monthlyGrowthPct.value;
    const conflict = flagged("growth_deck_vs_sheet");
    const ev: Evidence[] = [];
    if (claimed != null) ev.push(deck(t.monthlyGrowthPct, `${claimed}% a month`));
    if (g) ev.push({ source: "Numbers sheet", value: `${pct1(g.pct)} a month, ${fmtMonth(g.from.month)} to ${fmtMonth(g.to.month)}`, file: "Monthly numbers sheet (CSV)" });
    const cur = g?.from.currency ?? "";
    facts.push({
      key: "growth",
      label: "Monthly growth",
      value: claimed != null ? `${claimed}%` : g ? pct1(g.pct) : "Not stated",
      sub: g ? `Sheet: ${pct1(g.pct)} average` : undefined,
      status: conflict ? "Conflict" : claimed != null && g ? "Checked" : claimed != null ? "Claimed" : g ? "Reported" : "Missing",
      why: conflict
        ? "The deck's growth rate is well above the sheet's average."
        : claimed != null && g
          ? "The sheet's compounded average matches the deck."
          : claimed != null
            ? "Only the deck states it."
            : g
              ? "Worked out from the sheet; the deck doesn't state it."
              : "Not stated, and no sheet to work it out from.",
      evidence: ev,
      working: g
        ? [
            `(${fmtMoney(g.to.revenue, cur)} ÷ ${fmtMoney(g.from.revenue, cur)}) ^ (1 ÷ ${sheet.filter((x) => x.revenue).slice(-6).length - 1}) − 1 = ${pct1(g.pct)} a month`,
          ]
        : [],
      headline: true,
    });
  }

  // Counts against the sheet: customers and team size.
  const count = (key: string, label: string, f: NumberFactT, field: "customers" | "headcount", check: CheckId, isKey: boolean) => {
    const row = sheet.length ? rowFor(sheet, field, f.asOf) : null;
    const actual = row?.[field] ?? null;
    const conflict = flagged(check);
    const ev: Evidence[] = [];
    if (f.value != null) ev.push(deck(f, fmtNum(f.value)));
    if (row && actual != null) ev.push(sheetEv(row, fmtNum(actual)));
    facts.push({
      key,
      label,
      value: f.value != null ? fmtNum(f.value) : actual != null ? fmtNum(actual) : "Not stated",
      sub: row && actual != null ? `Sheet: ${fmtNum(actual)} in ${fmtMonth(row.month).split(" ")[0]}` : undefined,
      status: conflict ? "Conflict" : f.value != null && actual != null ? "Checked" : f.value != null ? "Claimed" : actual != null ? "Reported" : "Missing",
      why: conflict
        ? "The deck and the sheet differ by more than 10%."
        : f.value != null && actual != null
          ? "The deck and the sheet agree."
          : f.value != null
            ? "Only the deck states it."
            : actual != null
              ? "From the sheet only."
              : "Not stated anywhere yet.",
      evidence: ev,
      headline: isKey,
    });
  };
  count("customers", "Paying customers", t.customers, "customers", "customers_deck_vs_sheet", true);

  // Burn and cash: deck against the sheet's latest month.
  const moneyAgainstSheet = (key: string, label: string, f: MoneyFactT, field: "netBurn" | "cash") => {
    const row = sheet.length ? rowFor(sheet, field, f.asOf) : null;
    const actual = row?.[field] ?? null;
    const cur = f.currency || row?.currency || "";
    const off = f.amount != null && actual ? gap(f.amount, actual) > GAP_TOLERANCE : false;
    const ev: Evidence[] = [];
    if (f.amount != null) ev.push(deck(f, fmtMoney(f.amount, cur)));
    if (row && actual != null) ev.push(sheetEv(row, fmtMoney(actual, cur)));
    facts.push({
      key,
      label,
      value: f.amount != null ? fmtMoney(f.amount, cur) : actual != null ? fmtMoney(actual, cur) : "Not stated",
      sub: row && actual != null ? `Sheet: ${fmtMoney(actual, cur)}` : undefined,
      status: off ? "Conflict" : f.amount != null && actual != null ? "Checked" : f.amount != null ? "Claimed" : actual != null ? "Reported" : "Missing",
      why: off
        ? "The deck and the sheet differ by more than 10%."
        : f.amount != null && actual != null
          ? "The deck and the sheet agree within 10%."
          : f.amount != null
            ? "Only the deck states it."
            : actual != null
              ? "From the sheet only."
              : "Not stated anywhere yet.",
      evidence: ev,
      headline: key === "burn",
    });
  };
  moneyAgainstSheet("burn", "Net burn a month", t.monthlyBurn, "netBurn");
  moneyAgainstSheet("cash", "Cash in bank", t.cash, "cash");

  // Runway: the deck's figure against the code's own sum.
  {
    const cashRow = sheet.length ? rowFor(sheet, "cash") : null;
    const cash = cashRow?.cash ?? t.cash.amount;
    const burn = cashRow?.netBurn ?? t.monthlyBurn.amount;
    const cur = cashRow?.currency || t.cash.currency || "";
    const computed = cash && burn ? cash / burn : null;
    const stated = t.runwayMonths.value;
    const conflict = flagged("runway_maths");
    const ev: Evidence[] = [];
    if (stated != null) ev.push(deck(t.runwayMonths, `${stated} months`));
    facts.push({
      key: "runway",
      label: "Runway",
      value: computed != null ? `${computed.toFixed(1)} months` : stated != null ? `${stated} months` : "Not stated",
      sub: stated != null ? `Deck says ${stated}` : undefined,
      status: conflict ? "Conflict" : computed != null && stated != null ? "Checked" : stated != null ? "Claimed" : computed != null ? "Reported" : "Missing",
      why: conflict
        ? "The deck's runway doesn't match cash divided by burn."
        : computed != null && stated != null
          ? "Cash divided by burn matches the deck's figure."
          : computed != null
            ? "Worked out from cash and burn; the deck doesn't state it."
            : "Needs both cash and burn.",
      evidence: ev,
      working: computed != null ? [`${fmtMoney(cash, cur)} cash ÷ ${fmtMoney(burn, cur)} burn a month = ${computed.toFixed(1)} months`] : [],
      headline: true,
    });
  }

  const claimOnly = (key: string, label: string, f: TextFactT | NumberFactT, show: (v: string) => string, missingWhy: string, isKey: boolean) => {
    const v = f.value == null ? null : String(f.value);
    facts.push({
      key,
      label,
      value: v == null ? "Not stated" : show(v),
      status: v == null ? "Missing" : "Claimed",
      why: v == null ? missingWhy : "Only the deck states it. Nothing else to check it against yet.",
      evidence: v == null ? [] : [deck(f, show(v))],
      headline: isKey,
    });
  };
  claimOnly("margin", "Gross margin", t.grossMarginPct, (v) => `${v}%`, "Not in the deck. Ask for gross margin by month.", true);
  claimOnly("retention", "Retention", t.retention, (v) => v, "Not in the deck. Ask for revenue retention by cohort.", true);
  {
    // "118% net revenue retention" reads better as 118%, with the words underneath.
    const r = facts.at(-1)!;
    const m = r.value.match(/^(\d+(?:\.\d+)?%)\s+(.+)$/);
    if (m) {
      r.value = m[1];
      r.sub = m[2];
    }
  }

  // Round: deck against the form.
  {
    const a = r.round.amount;
    const conflict = flagged("round_deck_vs_form");
    const ev: Evidence[] = [];
    if (a.amount != null) ev.push(deck(a, `${a.currency && a.currency !== "USD" ? fmtMoney(a.amount, a.currency) : usd(a.amount)}${r.round.instrument.value ? ` ${r.round.instrument.value}` : ""}`));
    if (deal.form.amountUsd) ev.push({ source: "Application form", value: usd(deal.form.amountUsd), file: "Founder's form" });
    facts.push({
      key: "round",
      label: "Round",
      value: a.amount != null ? `${usd(a.amount)}${r.round.instrument.value ? ` ${r.round.instrument.value}` : ""}` : deal.form.amountUsd ? usd(deal.form.amountUsd) : "Not stated",
      sub: deal.form.stage,
      status: conflict ? "Conflict" : a.amount != null && deal.form.amountUsd ? "Checked" : a.amount != null || deal.form.amountUsd ? "Claimed" : "Missing",
      why: conflict
        ? "The deck and the application form ask for different amounts."
        : a.amount != null && deal.form.amountUsd
          ? "The deck and the form agree on the amount. Both come from the founder, so this checks consistency, not truth."
          : "Stated in one place only.",
      evidence: ev,
      headline: true,
    });
  }
  {
    const v = r.round.valuation;
    facts.push({
      key: "valuation",
      label: "Valuation or cap",
      value: v.amount != null ? fmtMoney(v.amount, v.currency) : "Not stated",
      status: v.amount != null ? "Claimed" : "Missing",
      why: v.amount != null ? "Only the deck states it." : "The deck gives no valuation or cap. Without it the fund can't work out what it would own.",
      evidence: v.amount != null ? [deck(v, fmtMoney(v.amount, v.currency))] : [],
      headline: true,
    });
  }
  facts.push({
    key: "concentration",
    label: "Top customer share",
    value: "Not stated",
    status: "Missing",
    why: "No deck shows revenue by customer. Ask what share the top three customers make up.",
    evidence: [],
    headline: true,
  });

  // Founding date: deck against the registry.
  {
    const f = r.company.foundedYear;
    const reg = deal.registry;
    const conflict = flagged("founded_vs_registry");
    const ev: Evidence[] = [];
    if (f.value != null) ev.push(deck(f, String(f.value)));
    if (reg) ev.push({ source: "Registry (sample)", value: `${reg.legalName}, incorporated ${reg.incorporated}`, file: reg.source });
    facts.push({
      key: "founded",
      label: "Founded",
      value: f.value != null ? String(f.value) : reg ? reg.incorporated.slice(0, 4) : "Not stated",
      sub: reg ? `Registry: ${reg.incorporated}` : undefined,
      status: conflict ? "Conflict" : f.value != null && reg ? "Checked" : f.value != null ? "Claimed" : reg ? "Reported" : "Missing",
      why: conflict ? "The deck and the registry give different years." : f.value != null && reg ? "The registry record (a fictional sample) agrees." : "Only one source.",
      evidence: ev,
      headline: false,
    });
  }
  count("team", "Team size", t.teamSize, "headcount", "team_deck_vs_sheet", false);
  return facts;
}

// ---------------- Portfolio companies ----------------

const metricLabel = (k: MetricKey) => METRICS.find((m) => m.key === k)!.label;
const isMoney = (k: MetricKey) => METRICS.find((m) => m.key === k)!.money;

function sentReports(c: PortfolioCompany, today: string): MonthlyReport[] {
  return c.reports.filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today).sort((a, b) => a.month.localeCompare(b.month));
}

export function misEvidence(c: PortfolioCompany, r: MonthlyReport, k: MetricKey): Evidence[] {
  const n = r.numbers[k];
  if (!n) return [];
  const show = (v: number) => (isMoney(k) ? fmtMoney(v, c.currency) : fmtNum(v));
  const file = r.fileName;
  if (n.inFile != null && n.inFile !== n.value)
    return [
      { source: `${fmtMonth(r.month)} MIS file`, value: show(n.inFile), file, page: n.page },
      { source: "Founder's form", value: show(n.value), file: `Typed on the founder page, ${r.receivedAt!.slice(0, 10)}` },
    ];
  return [{ source: `${fmtMonth(r.month)} MIS`, value: show(n.value), file, page: n.page, quote: file ? "Same figure typed on the founder's form" : "Typed on the founder's form; no file sent" }];
}

/** Average monthly growth over the last three months, compounded. Needs the month three back. */
export function growth3(c: PortfolioCompany, today: string): { pct: number; from: MonthlyReport; to: MonthlyReport } | null {
  const sent = sentReports(c, today).filter((r) => r.numbers.revenue);
  const to = sent.at(-1);
  if (!to) return null;
  const from = sent.find((r) => r.month === addMonths(to.month, -3));
  if (!from) return null;
  const pct = (Math.pow(to.numbers.revenue!.value / from.numbers.revenue!.value, 1 / 3) - 1) * 100;
  return { pct, from, to };
}

/** Net burn over the last three months ÷ new annual revenue added in them. Lower is better. */
export function burnMultiple(c: PortfolioCompany, today: string): { value: number | null; working: string[]; note?: string } | null {
  const sent = sentReports(c, today).filter((r) => r.numbers.revenue);
  const to = sent.at(-1);
  if (!to) return null;
  const from = sent.find((r) => r.month === addMonths(to.month, -3));
  if (!from) return null;
  const window = [1, 2, 3].map((i) => sent.find((r) => r.month === addMonths(to.month, i - 3)));
  if (window.some((r) => !r?.numbers.burn)) return null;
  const burn = window.reduce((a, r) => a + r!.numbers.burn!.value, 0);
  const added = (to.numbers.revenue!.value - from.numbers.revenue!.value) * 12;
  const money = (n: number) => fmtMoney(n, c.currency);
  const working = [
    `Net burn ${fmtMonth(window[0]!.month).split(" ")[0]} to ${fmtMonth(to.month).split(" ")[0]}: ${window.map((r) => money(r!.numbers.burn!.value)).join(" + ")} = ${money(burn)}`,
    `New annual revenue: (${money(to.numbers.revenue!.value)} − ${money(from.numbers.revenue!.value)}) × 12 = ${money(added)}`,
  ];
  if (added <= 0) return { value: null, working, note: "Revenue fell" };
  working.push(`${money(burn)} ÷ ${money(added)} = ${(burn / added).toFixed(2)}×`);
  return { value: burn / added, working };
}

export function portfolioFacts(c: PortfolioCompany, today: string): KeyFact[] {
  const sent = sentReports(c, today);
  const latest = sent.at(-1);
  const due = c.reports.filter((r) => reportStatus(r, today) === "missing");
  const facts: KeyFact[] = [];
  const show = (k: MetricKey, v: number) => (isMoney(k) ? fmtMoney(v, c.currency) : fmtNum(v));
  const pitchEv = (k: MetricKey): Evidence[] => {
    const claim = c.pitch.claims[k];
    return claim ? [{ source: "Pitch deck, at pitch", value: show(k, claim.value), file: c.pitch.deckFile, page: claim.page }] : [];
  };
  const owedNote = due.length ? `${due.map((r) => fmtMonth(r.month).split(" ")[0]).join(" and ")} not sent` : undefined;

  for (const k of ["revenue", "burn", "cash", "customers"] as MetricKey[]) {
    const withIt = sent.filter((r) => r.numbers[k]);
    const last = withIt.at(-1);
    const n = last?.numbers[k];
    const gapInLatest = latest && !latest.numbers[k];
    const stale = Boolean(n && owedNote && due.some((r) => r.month > last!.month));
    const conflict = n?.inFile != null && n.inFile !== n.value;
    facts.push({
      key: k,
      label: metricLabel(k),
      value: n ? show(k, n.value) : "Not sent",
      sub: gapInLatest ? `${fmtMonth(latest!.month).split(" ")[0]} not sent${last ? `; ${fmtMonth(last.month).split(" ")[0]} shown` : ""}` : last ? `${fmtMonth(last.month)}${owedNote ? ` · ${owedNote}` : ""}` : undefined,
      status: !n || gapInLatest || stale ? "Missing" : conflict ? "Conflict" : "Reported",
      why: !n
        ? "No report has included it yet."
        : gapInLatest
          ? `The latest report (${fmtMonth(latest!.month)}) left it out. Showing the last month that had it.`
          : stale
            ? `${owedNote} yet, so this is the last figure the founder reported (${fmtMonth(last!.month)}).`
            : conflict
            ? `The founder typed ${show(k, n.value)}; page ${n.page} of the MIS shows ${show(k, n.inFile!)}. Ask which is right.`
            : "From the founder's monthly report. No second source has checked it.",
      evidence: last ? [...misEvidence(c, last, k), ...pitchEv(k)] : pitchEv(k),
      headline: true,
    });
  }

  // Runway, worked out by code.
  {
    const r = [...sent].reverse().find((x) => runwayMonths(x) != null);
    const rw = r ? runwayMonths(r) : null;
    facts.push({
      key: "runway",
      label: "Runway",
      value: rw != null ? `${rw.toFixed(1)} months` : "—",
      sub: r ? `At ${fmtMonth(r.month).split(" ")[0]}'s burn` : undefined,
      status: rw == null ? "Missing" : "Reported",
      why: rw == null ? "Needs cash and burn from the same month." : "Worked out by code from the founder's reported cash and burn.",
      evidence: r ? [...misEvidence(c, r, "cash"), ...misEvidence(c, r, "burn")] : [],
      working: r && rw != null ? [`${fmtMoney(r.numbers.cash!.value, c.currency)} ÷ ${fmtMoney(r.numbers.burn!.value, c.currency)} = ${rw.toFixed(1)} months`] : [],
      headline: true,
    });
  }

  // Against the deck's plan.
  {
    const plan = c.pitch.plan;
    const r = sent.find((x) => x.month === plan.month);
    const actual = r?.numbers.revenue;
    const planEv: Evidence = { source: "Pitch deck, plan", value: `${fmtMoney(plan.revenue, c.currency)} for ${fmtMonth(plan.month)}`, file: c.pitch.deckFile, page: plan.page };
    if (plan.month > lastDueMonth(today)) {
      facts.push({
        key: "plan",
        label: "Against the deck's plan",
        value: `${fmtMoney(plan.revenue, c.currency)} by ${fmtMonth(plan.month).replace(" 20", " ’")}`,
        sub: "Not reached yet",
        status: "Claimed",
        why: "The plan month hasn't been reported yet.",
        evidence: [planEv],
        headline: true,
      });
    } else if (!actual) {
      facts.push({
        key: "plan",
        label: "Against the deck's plan",
        value: "No report",
        sub: `${fmtMonth(plan.month)} not sent`,
        status: "Missing",
        why: `The deck planned ${fmtMoney(plan.revenue, c.currency)} for ${fmtMonth(plan.month)}, and that month's report hasn't arrived.`,
        evidence: [planEv],
        headline: true,
      });
    } else {
      const diff = (actual.value / plan.revenue - 1) * 100;
      facts.push({
        key: "plan",
        label: "Against the deck's plan",
        value: `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff))}%`,
        sub: `${fmtMonth(plan.month).split(" ")[0]}: ${fmtMoney(actual.value, c.currency)} vs ${fmtMoney(plan.revenue, c.currency)}`,
        status: actual.inFile != null && actual.inFile !== actual.value ? "Conflict" : "Reported",
        why: `Reported revenue for ${fmtMonth(plan.month)} against the plan in the pitch deck.`,
        evidence: [...misEvidence(c, r!, "revenue"), planEv],
        working: [`${fmtMoney(actual.value, c.currency)} ÷ ${fmtMoney(plan.revenue, c.currency)} − 1 = ${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)}%`],
        headline: true,
      });
    }
  }

  // Growth and burn multiple, worked out by code.
  {
    const g = growth3(c, today);
    facts.push({
      key: "growth",
      label: "Monthly growth",
      value: g ? pct1(g.pct) : "—",
      sub: g ? `Average, ${fmtMonth(g.from.month).split(" ")[0]} to ${fmtMonth(g.to.month).split(" ")[0]}` : "Needs four months of reports",
      status: g ? "Reported" : "Missing",
      why: g ? "Worked out by code from reported revenue, compounded over three months." : "Not enough months reported yet.",
      evidence: g ? [...misEvidence(c, g.from, "revenue"), ...misEvidence(c, g.to, "revenue")] : [],
      working: g ? [`(${fmtMoney(g.to.numbers.revenue!.value, c.currency)} ÷ ${fmtMoney(g.from.numbers.revenue!.value, c.currency)}) ^ (1 ÷ 3) − 1 = ${pct1(g.pct)}`] : [],
      headline: false,
    });
    const b = burnMultiple(c, today);
    facts.push({
      key: "burnMultiple",
      label: "Burn multiple",
      value: b?.value != null ? `${b.value.toFixed(1)}×` : b ? "n/a" : "—",
      sub: b?.note ?? "Burn ÷ new annual revenue, 3 months",
      status: b ? "Reported" : "Missing",
      why: b ? "Worked out by code from reported burn and revenue. Under 1× is efficient; over 2× is worth asking about." : "Needs four months of reports.",
      evidence: [],
      working: b?.working ?? [],
      headline: false,
    });
  }
  return facts;
}

/** Counts by status, for a one-line summary under the numbers. */
export function statusCounts(facts: KeyFact[]): Record<FactStatus, number> {
  const out = { Claimed: 0, Reported: 0, Checked: 0, Conflict: 0, Missing: 0 } as Record<FactStatus, number>;
  for (const f of facts) out[f.status]++;
  return out;
}
