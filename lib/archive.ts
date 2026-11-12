// Sample deck figures for the deal-flow history, so every archived company opens as a full record.
// Made from a fixed recipe seeded by the company id: the same company always gets the same numbers.
// A few decks carry a planted gap or missing facts, and the real check code (runChecks) finds them.
// None of this is an AI reading: these are fictional figures, labelled as sample data wherever they show.
import { runChecks } from "./checks";
import { coverage, type Coverage } from "./coverage";
import { flowById, lastDeck, type FlowCompany } from "./flow";
import { recordFromGold, type Gold } from "./gold";
import type { DealRecord } from "./schema";
import type { FormInput, SheetRow } from "./types";

export interface Archive {
  record: DealRecord;
  form: FormInput;
  sheet: SheetRow[] | null;
  sheetFile: string | null;
  deckFile: string;
  /** Month the deck's numbers are for (the month before it was sent). */
  asOf: string;
  /** What the recipe planted, so tests can confirm the checks find exactly these. */
  planted: string[];
  cover: Coverage;
}

const BANDS: Record<string, { mrr: [number, number]; team: [number, number]; age: [number, number] }> = {
  "Pre-seed": { mrr: [0, 12_000], team: [3, 8], age: [0, 2] },
  Seed: { mrr: [15_000, 90_000], team: [8, 25], age: [1, 3] },
  "Series A": { mrr: [90_000, 400_000], team: [25, 70], age: [2, 5] },
  "Series B": { mrr: [400_000, 1_500_000], team: [70, 180], age: [4, 7] },
  "Series C or later": { mrr: [1_500_000, 4_000_000], team: [150, 400], age: [6, 10] },
};
const CONSUMER = new Set(["Consumer brands", "Edtech", "Food supply", "Mobility"]);

function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const prevMonth = (ym: string, back = 1) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const round = (n: number, to: number) => Math.round(n / to) * to;

export function archiveOf(c: FlowCompany): Archive {
  const r = seeded(c.id);
  const between = ([lo, hi]: [number, number]) => lo + r() * (hi - lo);
  const deck = lastDeck(c);
  const band = BANDS[deck.stage] ?? BANDS.Seed;
  const asOf = prevMonth(deck.at.slice(0, 7));
  const planted: string[] = [];

  const mrr = round(between(band.mrr), 1000);
  const growth = Math.round(between([3, 14]));
  const team = Math.round(between(band.team));
  const customers = mrr === 0 ? null : Math.max(3, Math.round((mrr / between([900, 6000])) * (CONSUMER.has(c.sector) ? 60 : 1)));
  const burn = round(mrr * between([0.6, 1.8]) + team * between([3500, 6000]), 1000);
  const cash = round(burn * between([7, 24]), 10_000);
  let runway: number | null = Math.round(cash / burn);
  const founded = Number(deck.at.slice(0, 4)) - Math.round(between(band.age));
  let ask = deck.askUsd;

  // How the deck states revenue: annual only, monthly only, or both.
  const form = r();
  let gold: Gold = {
    mrr: form < 0.3 || form >= 0.8 ? { amount: mrr, currency: "USD" } : null,
    arr: form >= 0.3 ? { amount: mrr * 12, currency: "USD" } : null,
    growth,
    customers,
    team,
    burn: { amount: burn, currency: "USD" },
    cash: { amount: cash, currency: "USD" },
    runway,
    round: ask,
    founded,
  };
  if (mrr === 0) gold = { ...gold, mrr: null, arr: null, growth: null };

  // A few decks get one planted problem. Rates are fixed so the history looks like a real inbox, not a test.
  const roll = r();
  const hasSheet = r() < 0.65 && mrr > 0;
  let sheetMrr = mrr;
  let sheetGrowthPct = growth;
  let sheetCustomers = customers;
  const sheetTeam = team;
  if (hasSheet && roll < 0.12) {
    sheetMrr = round(mrr / between([1.2, 1.45]), 100);
    planted.push("revenue_deck_vs_sheet");
  } else if (hasSheet && roll < 0.18 && growth >= 8) {
    sheetGrowthPct = Math.max(1, growth - Math.round(between([5, 8])));
    planted.push("growth_deck_vs_sheet");
  } else if (hasSheet && roll < 0.24 && customers && customers >= 30) {
    sheetCustomers = Math.round(customers / between([1.3, 1.7]));
    planted.push("customers_deck_vs_sheet");
  } else if (roll >= 0.24 && roll < 0.29 && gold.mrr && gold.arr) {
    gold = { ...gold, arr: { amount: round(mrr * 12 * between([1.25, 1.5]), 1000), currency: "USD" } };
    planted.push("arr_vs_mrr_maths");
  } else if (roll >= 0.29 && roll < 0.34) {
    runway = Math.round(cash / burn) + 6 + Math.round(between([0, 4]));
    gold = { ...gold, runway };
    planted.push("runway_maths");
  } else if (roll >= 0.34 && roll < 0.37) {
    ask = round(deck.askUsd * between([1.3, 1.6]), 50_000);
    gold = { ...gold, round: ask };
    planted.push("round_deck_vs_form");
  }
  // Missing facts: most decks state everything; some leave one or two out; a few leave out three or more.
  const gaps = r();
  if (gaps < 0.1) {
    gold = { ...gold, burn: null, customers: null, growth: null, cash: null, runway: null };
    planted.push("missing_core_facts");
  } else if (gaps < 0.35) {
    gold = r() < 0.5 ? { ...gold, burn: null, cash: null, runway: null } : { ...gold, customers: null };
  }

  const record = recordFromGold(gold, c.name);
  record.oneLiner = `${c.sub} in ${c.city}.`;
  for (const f of [record.traction.mrr, record.traction.arr]) if (f.amount != null) f.asOf = asOf;

  let sheet: SheetRow[] | null = null;
  if (hasSheet) {
    sheet = [];
    for (let k = 5; k >= 0; k--) {
      const month = prevMonth(asOf, k);
      const f = Math.pow(1 + sheetGrowthPct / 100, -k);
      sheet.push({
        month,
        currency: "USD",
        revenue: round(sheetMrr * f, 100),
        customers: sheetCustomers == null ? null : Math.max(1, Math.round(sheetCustomers * Math.pow(f, 0.7))),
        headcount: Math.max(2, sheetTeam - Math.round(k / 2)),
        netBurn: round(burn * (1 - k * 0.02), 100),
        cash: round(cash + burn * k, 1000),
      });
    }
  }

  const intake: FormInput = {
    companyName: c.name,
    website: c.domain,
    country: c.country,
    sector: c.sector,
    stage: deck.stage,
    amountUsd: deck.askUsd,
    founders: c.founder ? [{ name: c.founder, profileUrl: "" }] : [],
    email: c.email,
  };
  const flags = runChecks({ record, form: intake, sheet, registry: null });
  const cover = coverage({ record, form: intake, sheet, registry: null, flags });
  return {
    record,
    form: intake,
    sheet,
    sheetFile: sheet ? `${c.name.replace(/\s/g, "")}-monthly-${asOf}.csv` : null,
    deckFile: deck.file,
    asOf,
    // A planted gap only counts when its check could run (missing facts can switch a check off).
    planted: planted.filter((p) => p === "missing_core_facts" || cover.lines.find((l) => l.id === p)?.ran),
    cover,
  };
}

const CACHE = new Map<string, Archive>();
export function archiveById(id: string): Archive | null {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const c = flowById(id);
  if (!c) return null;
  const a = archiveOf(c);
  CACHE.set(id, a);
  return a;
}
