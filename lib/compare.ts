// The compare grid: companies as rows, standard metrics as columns, one currency.
// Every cell keeps its sources and the code's working, so it can be opened and checked.
import { fmtMoney, fmtMonth } from "./format";
import { usd } from "./rules";
import { sheetGrowth } from "./sheet";
import { addMonths, companyHealth, reportStatus, runwayMonths, type CompanyBand } from "./portfolio/health";
import type { PortfolioCompany } from "./portfolio/types";
import { burnMultiple, dealFacts, growth3, misEvidence, portfolioFacts, type Evidence, type FactStatus } from "./provenance";
import type { DealResult, SheetRow } from "./types";
import { calculateVCMetrics } from "./vc-metrics";

/** Reference exchange rates (units per US dollar). */
export const FX: Record<string, number> = { USD: 1, INR: 84, AED: 3.6725, SAR: 3.75, EUR: 0.92, GBP: 0.79 };
export const FX_NOTE = "Reference FX rates: ₹84, AED 3.6725, SAR 3.75, €0.92, and £0.79 to one US dollar.";

/** Reporting health as a number so the column sorts: higher is healthier. "Too early" has no rank and sorts last. */
export const REPORTING_RANK: Record<string, number> = { "On track": 3, Slipping: 2, "Gone quiet": 1 };

export type ColKey = "conviction" | "revenue" | "growth" | "burnMultiple" | "runway" | "plan" | "customers" | "round" | "reporting";

export const COLUMNS: { key: ColKey; label: string; hint: string; better: "high" | "low" | null }[] = [
  { key: "conviction", label: "Conviction", hint: "5-pillar institutional conviction score (0-100, Grade A to G)", better: "high" },
  { key: "revenue", label: "Revenue a month", hint: "Latest month, in US dollars", better: "high" },
  { key: "growth", label: "Growth", hint: "Average a month over the last 3 months, compounded", better: "high" },
  { key: "burnMultiple", label: "Burn multiple", hint: "Net burn over 3 months ÷ new annual revenue in them. Lower is better", better: "low" },
  { key: "runway", label: "Runway", hint: "Cash ÷ latest net burn", better: "high" },
  { key: "plan", label: "Vs deck's plan", hint: "Reported revenue against the pitch deck's plan for that month", better: "high" },
  { key: "customers", label: "Customers", hint: "Paying customers, latest month", better: "high" },
  { key: "round", label: "Round", hint: "The fund's cheque and stake, or the round being raised", better: null },
  { key: "reporting", label: "Reporting", hint: "Reporting health band, worked out by code", better: null },
];

export interface Cell {
  sort: number | null;
  text: string;
  /** The same figure in the company's own currency, for money cells. */
  local?: string;
  sub?: string;
  /** The month the figure describes (YYYY-MM), so rows from different periods are never silently ranked as like for like. */
  asOf?: string;
  status: FactStatus | null;
  evidence: Evidence[];
  working: string[];
  why?: string;
}

export interface CompareRow {
  id: string;
  name: string;
  kind: "Portfolio" | "Pitch";
  href: string;
  sector: string;
  currency: string;
  band?: CompanyBand;
  cells: Record<ColKey, Cell>;
}

const toUsd = (n: number, cur: string): number | null => {
  const rate = FX[(cur || "USD").toUpperCase()];
  if (!rate || !Number.isFinite(n)) return null;
  return n / rate;
};
const usdText = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`);
const empty = (text = "-", why?: string): Cell => ({ sort: null, text, status: null, evidence: [], working: [], why });

function moneyCell(value: number, cur: string, status: FactStatus, evidence: Evidence[], label: string): Cell {
  const v = toUsd(value, cur);
  if (v == null) {
    return {
      sort: null,
      text: fmtMoney(value, cur),
      local: fmtMoney(value, cur),
      sub: label,
      status,
      evidence,
      working: [`Reported in ${cur} (no FX rate configured)`],
    };
  }
  return {
    sort: v,
    text: usdText(v),
    local: fmtMoney(value, cur),
    sub: label,
    status,
    evidence,
    working: cur === "USD" ? [] : [`${fmtMoney(value, cur)} ÷ ${FX[cur.toUpperCase()]} = ${usdText(v)} (reference rate)`],
  };
}

export function portfolioRow(c: PortfolioCompany, today: string): CompareRow {
  const facts = portfolioFacts(c, today);
  const fact = (k: string) => facts.find((f) => f.key === k)!;
  const sent = c.reports.filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today && r.numbers.revenue);
  const last = sent.at(-1);
  const month = (m: string) => fmtMonth(m).split(" ")[0];

  const revenue = last
    ? { ...moneyCell(last.numbers.revenue!.value, c.currency, fact("revenue").status === "Conflict" ? "Conflict" : "Reported", misEvidence(c, last, "revenue"), month(last.month)), asOf: last.month }
    : empty("No report");
  const owed = last ? c.reports.filter((r) => r.month > last.month && reportStatus(r, today) === "missing") : [];
  if (owed.length) {
    revenue.sub = `${revenue.sub}; ${owed.map((r) => month(r.month)).join(", ")} not sent`;
    revenue.status = "Missing";
    revenue.why = `The latest reports (${owed.map((r) => fmtMonth(r.month)).join(", ")}) haven't arrived, so this is an older month.`;
  }

  const g = growth3(c, today);
  const growth: Cell = g
    ? {
        sort: g.pct,
        text: `${g.pct >= 0 ? "" : "−"}${Math.abs(g.pct).toFixed(1)}%`,
        sub: `${month(g.from.month)} to ${month(g.to.month)}`,
        asOf: g.to.month,
        status: g.to.numbers.revenue!.inFile != null ? "Conflict" : "Reported",
        evidence: [...misEvidence(c, g.from, "revenue"), ...misEvidence(c, g.to, "revenue")],
        working: fact("growth").working ?? [],
      }
    : empty("-", "Needs four months of reports.");

  const b = burnMultiple(c, today);
  const bm: Cell = b
    ? {
        sort: b.value,
        text: b.value != null ? `${b.value.toFixed(1)}×` : "n/a",
        sub: b.note ?? "3 months",
        asOf: g?.to.month,
        status: last?.numbers.revenue?.inFile != null ? "Conflict" : "Reported",
        evidence: [],
        working: b.working,
      }
    : empty("-", "Needs four months of reports.");

  const rwFact = fact("runway");
  const rwReport = [...c.reports].reverse().find((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today && runwayMonths(r) != null);
  const rw = rwReport ? runwayMonths(rwReport)! : null;
  const runway: Cell =
    rw != null
      ? { sort: rw, text: `${rw.toFixed(1)} mo`, sub: month(rwReport!.month), asOf: rwReport!.month, status: "Reported", evidence: rwFact.evidence, working: rwFact.working ?? [] }
      : empty();

  const pf = fact("plan");
  const plan: Cell =
    pf.status === "Claimed"
      ? { sort: null, text: "Not yet", sub: pf.value, status: "Claimed", evidence: pf.evidence, working: [], why: pf.why }
      : pf.status === "Missing"
        ? { sort: null, text: "No report", sub: pf.sub, status: "Missing", evidence: pf.evidence, working: [], why: pf.why }
        : (() => {
            const parsed = parseFloat(pf.value.replace("−", "-"));
            return { sort: Number.isFinite(parsed) ? parsed : null, text: pf.value, sub: pf.sub?.split(":")[0], status: pf.status, evidence: pf.evidence, working: pf.working ?? [] };
          })();

  const cf = fact("customers");
  const custReport = [...sent].reverse().find((r) => r.numbers.customers);
  const customers: Cell = custReport
    ? {
        sort: custReport.numbers.customers!.value,
        text: String(custReport.numbers.customers!.value),
        sub: cf.status === "Missing" ? `${month(custReport.month)}; latest not sent` : month(custReport.month),
        asOf: custReport.month,
        status: cf.status === "Missing" ? "Missing" : "Reported",
        evidence: cf.evidence,
        working: [],
      }
    : empty();

  const band = companyHealth(c, today).band;
  return {
    id: c.id,
    name: c.name,
    kind: "Portfolio",
    href: `/portfolio/${c.id}`,
    sector: c.sector,
    currency: c.currency,
    band,
    cells: {
      conviction: empty("Portfolio", "Active portfolio investment; tracked under reporting health."),
      revenue,
      growth,
      burnMultiple: bm,
      runway,
      plan,
      customers,
      round: {
        sort: c.investment.amountUsd,
        text: `${usd(c.investment.amountUsd)} · ${c.investment.ownershipPct}%`,
        sub: `${c.investment.round}, ${fmtMonth(c.investment.date.slice(0, 7))}`,
        status: null,
        evidence: [{ source: "Fund's own record", value: `${c.investment.round}: ${usd(c.investment.amountUsd)} for ${c.investment.ownershipPct}%` }],
        working: [],
      },
      reporting: { sort: REPORTING_RANK[band] ?? null, text: band, status: null, evidence: [], working: [], why: "Reporting health, worked out by code from dates and counts." },
    },
  };
}

/** A screened pitch, from its deck and numbers sheet, worked out the same way as the portfolio. */
export function dealRow(d: DealResult): CompareRow {
  const facts = dealFacts(d);
  const fact = (k: string) => facts.find((f) => f.key === k)!;
  const sheet = (d.sheet ?? []).filter((r) => r.revenue != null);
  const last = sheet.at(-1);
  const cur = last?.currency || d.record.traction.arr.currency || "USD";
  const month = (m: string) => fmtMonth(m).split(" ")[0];
  const sheetEv = (r: SheetRow, v: string): Evidence => ({ source: "Numbers sheet", value: `${v} in ${fmtMonth(r.month)}`, file: "Monthly numbers sheet (CSV)" });

  const deckMrr = d.record.traction.mrr.amount ?? (d.record.traction.arr.amount != null ? d.record.traction.arr.amount / 12 : null);
  const revenue = last
    ? { ...moneyCell(last.revenue!, cur, fact("revenue").status, fact("revenue").evidence, `${month(last.month)}, sheet`), asOf: last.month }
    : deckMrr != null
      ? moneyCell(deckMrr, d.record.traction.mrr.currency || cur, "Claimed", fact("revenue").evidence, "from deck")
      : empty();

  const from = last ? sheet.find((r) => r.month === addMonths(last.month, -3)) : undefined;
  const g3 = last && from && from.revenue! > 0 && last.revenue! >= 0 ? (Math.pow(last.revenue! / from.revenue!, 1 / 3) - 1) * 100 : null;
  const growth: Cell =
    g3 != null
      ? {
          sort: g3,
          text: `${g3.toFixed(1)}%`,
          sub: `${month(from!.month)} to ${month(last!.month)}`,
          asOf: last!.month,
          status: "Reported",
          evidence: [sheetEv(from!, fmtMoney(from!.revenue, cur)), sheetEv(last!, fmtMoney(last!.revenue, cur))],
          working: [`(${fmtMoney(last!.revenue, cur)} ÷ ${fmtMoney(from!.revenue, cur)}) ^ (1 ÷ 3) − 1 = ${g3.toFixed(1)}%`],
        }
      : sheetGrowth(d.sheet ?? [])
        ? empty("-", "Needs four months in the sheet.")
        : empty();

  let bm: Cell = empty("-", "Needs four months of revenue and burn in the sheet.");
  if (last && from) {
    const window = [1, 2, 3].map((i) => sheet.find((r) => r.month === addMonths(last.month, i - 3)));
    if (window.every((r) => r?.netBurn != null)) {
      const burn = window.reduce((a, r) => a + r!.netBurn!, 0);
      const added = (last.revenue! - from.revenue!) * 12;
      const working = [
        `Net burn ${month(window[0]!.month)} to ${month(last.month)}: ${window.map((r) => fmtMoney(r!.netBurn, cur)).join(" + ")} = ${fmtMoney(burn, cur)}`,
        `New annual revenue: (${fmtMoney(last.revenue, cur)} − ${fmtMoney(from.revenue, cur)}) × 12 = ${fmtMoney(added, cur)}`,
      ];
      if (added > 0) working.push(`${fmtMoney(burn, cur)} ÷ ${fmtMoney(added, cur)} = ${(burn / added).toFixed(2)}×`);
      bm = { sort: added > 0 ? burn / added : null, text: added > 0 ? `${(burn / added).toFixed(1)}×` : "n/a", sub: "3 months, sheet", asOf: last.month, status: "Reported", evidence: [], working };
    }
  }

  const rf = fact("runway");
  const rwNum = rf.status === "Missing" ? NaN : parseFloat(rf.value);
  const runway: Cell = Number.isFinite(rwNum)
    ? { sort: rwNum, text: `${rwNum.toFixed(1)} mo`, sub: rf.sub, status: rf.status, evidence: rf.evidence, working: rf.working ?? [] }
    : empty();

  const cf = fact("customers");
  const custNum = cf.status === "Missing" ? NaN : parseFloat(cf.value.replace(/,/g, ""));
  const customers: Cell = Number.isFinite(custNum)
    ? { sort: custNum, text: cf.value, sub: cf.sub, status: cf.status, evidence: cf.evidence, working: [] }
    : empty();

  const rd = fact("round");
  const vc = calculateVCMetrics(d.sheet, d.record, d.form.amountUsd, { deal: d });
  const conviction: Cell = {
    sort: vc.overallScore,
    text: `Grade ${vc.grade} · ${vc.overallScore}`,
    sub: vc.conviction.tierLabel.split(" · ")[0],
    status: vc.grade === "A" || vc.grade === "B" ? "Checked" : vc.grade === "G" ? "Missing" : "Reported",
    evidence: [
      {
        source: "5-Pillar Conviction Engine",
        value: `Grade ${vc.grade} (${vc.overallScore}/100) · ${vc.conviction.disclosedCount}/${vc.conviction.totalCoreFacts} core facts disclosed`,
      },
    ],
    working: [
      `Raw weighted score: ${vc.conviction.rawWeightedScore}/100 (Disclosure ${vc.conviction.dimensions.disclosure.score}, Veracity ${vc.conviction.dimensions.veracity.score}, Founder ${vc.conviction.dimensions.founder.score}, Economics ${vc.conviction.dimensions.economics.score}, Mandate ${vc.conviction.dimensions.mandate.score})`,
      `Completeness multiplier: ${vc.conviction.completenessMultiplier}x (${Math.round(vc.conviction.completenessRatio * 100)}% core disclosures)`,
      `Final conviction: ${vc.overallScore}/100 (Grade ${vc.grade})`,
    ],
    why: vc.conviction.suggestedAction,
  };
  return {
    id: d.id,
    name: d.form.companyName,
    kind: "Pitch",
    href: `/deals/${d.id}`,
    sector: d.form.sector,
    currency: cur,
    cells: {
      conviction,
      revenue,
      growth,
      burnMultiple: bm,
      runway,
      plan: empty("-", "Pitches have no plan to compare against yet."),
      customers,
      round: { sort: d.form.amountUsd, text: `Raising ${rd.value}`, sub: d.form.stage, status: rd.status, evidence: rd.evidence, working: [] },
      reporting: empty("Pitch", "Not invested, so no reporting yet."),
    },
  };
}

/** The reporting period most rows share, and which rows are older than it (stale). Display only: nothing is
 * dropped from a calculation here; the page says which values a median includes. */
export function periodScope(rows: CompareRow[], key: ColKey): { matched: string | null; stale: Set<string> } {
  const months = rows.map((r) => r.cells[key]).filter((c) => c.sort != null && c.asOf).map((c) => c.asOf!);
  if (!months.length) return { matched: null, stale: new Set() };
  const tally = months.reduce<Record<string, number>>((acc, m) => ((acc[m] = (acc[m] ?? 0) + 1), acc), {});
  const matched = Object.entries(tally).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
  const stale = new Set(rows.filter((r) => r.cells[key].sort != null && r.cells[key].asOf && r.cells[key].asOf! < matched).map((r) => r.id));
  return { matched, stale };
}
