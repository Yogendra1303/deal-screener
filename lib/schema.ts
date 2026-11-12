import { z } from "zod";

// The standard deal record. Every fact carries the deck page and the words it came from.
// These nullable shapes are what the app stores; the AI fills the "wire" version further down.

const page = z.number().int().nullable().describe("1-based PDF page number, or null");
const quote = z
  .string()
  .nullable()
  .describe("Short exact quote from that page (under 20 words), or null");

export const TextFact = z.object({
  value: z.string().nullable(),
  page,
  quote,
});

export const NumberFact = z.object({
  value: z.number().nullable(),
  asOf: z.string().nullable().describe("YYYY-MM if the deck dates the figure, else null"),
  page,
  quote,
});

export const MoneyFact = z.object({
  amount: z.number().nullable().describe("Plain number in the stated currency, e.g. 45600000"),
  currency: z.string().nullable().describe("ISO code: INR, USD, AED, SAR, ..."),
  asOf: z.string().nullable().describe("YYYY-MM if the deck dates the figure, else null"),
  page,
  quote,
});

export const PastRole = z.object({
  company: z.string(),
  title: z.string(),
  startYear: z.number().int().nullable(),
  endYear: z.number().int().nullable().describe("null if still there or not stated"),
  page,
  quote,
});

export const Founder = z.object({
  name: z.string(),
  role: z.string().nullable(),
  page,
  pastRoles: z.array(PastRole),
});

export const DealRecordSchema = z.object({
  oneLiner: z.string().describe("One plain sentence on what the company does"),
  company: z.object({
    name: TextFact,
    website: TextFact,
    country: TextFact,
    city: TextFact,
    sector: TextFact,
    businessModel: TextFact,
    stage: TextFact,
    foundedYear: NumberFact,
    description: TextFact,
  }),
  round: z.object({
    amount: MoneyFact,
    instrument: TextFact,
    valuation: MoneyFact,
    useOfFunds: TextFact,
    priorFunding: TextFact,
  }),
  traction: z.object({
    mrr: MoneyFact.describe("Monthly (recurring) revenue as stated"),
    arr: MoneyFact.describe("Annual recurring revenue or annual run-rate as stated"),
    monthlyGrowthPct: NumberFact.describe("Month-on-month growth in percent, e.g. 9 for 9%"),
    customers: NumberFact.describe("Paying customers (businesses or people)"),
    users: NumberFact,
    retention: TextFact,
    grossMarginPct: NumberFact,
    monthlyBurn: MoneyFact,
    cash: MoneyFact.describe("Cash in the bank"),
    runwayMonths: NumberFact,
    teamSize: NumberFact,
  }),
  team: z.array(Founder),
  market: z.object({
    sizeClaim: MoneyFact.describe("The largest market size the deck claims (TAM)"),
    sizeMethod: TextFact.describe("How the deck says it sized the market, if it says"),
    competitors: z.array(z.object({ name: z.string(), page })),
  }),
});

export type DealRecord = z.infer<typeof DealRecordSchema>;

// ---------------------------------------------------------------------------
// What the AI actually returns. Structured outputs allow at most 16 nullable
// (union) fields per request, so the AI marks missing facts with `stated: false`,
// empty strings and page 0 instead of null. `toRecord` turns that into the
// null-based DealRecord the rest of the app uses.

const wPage = z.number().int().describe("1-based PDF page number, or 0 if not stated");
const wQuote = z.string().describe("Short exact quote from that page (under 20 words), or empty");
const wAsOf = z.string().describe("YYYY-MM if the deck dates the figure, else empty");

const WText = z.object({
  stated: z.boolean().describe("false if the deck doesn't state this"),
  value: z.string(),
  page: wPage,
  quote: wQuote,
});
const WNumber = z.object({
  stated: z.boolean().describe("false if the deck doesn't state this; then value is 0"),
  value: z.number(),
  asOf: wAsOf,
  page: wPage,
  quote: wQuote,
});
const WMoney = z.object({
  stated: z.boolean().describe("false if the deck doesn't state this; then amount is 0"),
  amount: z.number().describe("Plain number in the stated currency, e.g. 45600000"),
  currency: z.string().describe("ISO code: INR, USD, AED, SAR, ... or empty"),
  asOf: wAsOf,
  page: wPage,
  quote: wQuote,
});
const WPastRole = z.object({
  company: z.string(),
  title: z.string(),
  startYear: z.number().int().describe("0 if not stated"),
  endYear: z.number().int().describe("0 if still there or not stated"),
  page: wPage,
  quote: wQuote,
});

export const DealRecordWireSchema = z.object({
  oneLiner: z.string().describe("One plain sentence on what the company does"),
  company: z.object({
    name: WText,
    website: WText,
    country: WText,
    city: WText,
    sector: WText,
    businessModel: WText,
    stage: WText,
    foundedYear: WNumber,
    description: WText,
  }),
  round: z.object({
    amount: WMoney,
    instrument: WText,
    valuation: WMoney,
    useOfFunds: WText,
    priorFunding: WText,
  }),
  traction: z.object({
    mrr: WMoney.describe("Monthly (recurring) revenue as stated"),
    arr: WMoney.describe("Annual recurring revenue or annual run-rate as stated"),
    monthlyGrowthPct: WNumber.describe("Month-on-month growth in percent, e.g. 9 for 9%"),
    customers: WNumber.describe("Paying customers (businesses or people)"),
    users: WNumber,
    retention: WText,
    grossMarginPct: WNumber,
    monthlyBurn: WMoney,
    cash: WMoney.describe("Cash in the bank"),
    runwayMonths: WNumber,
    teamSize: WNumber,
  }),
  team: z.array(
    z.object({
      name: z.string(),
      role: z.string().describe("Empty if not stated"),
      page: wPage,
      pastRoles: z.array(WPastRole),
    }),
  ),
  market: z.object({
    sizeClaim: WMoney.describe("The largest market size the deck claims (TAM)"),
    sizeMethod: WText.describe("How the deck says it sized the market, if it says"),
    competitors: z.array(z.object({ name: z.string(), page: wPage })),
  }),
});

type W = z.infer<typeof DealRecordWireSchema>;
const pg = (n: number) => (n > 0 ? n : null);
const str = (s: string) => (s.trim() ? s.trim() : null);
const t = (f: z.infer<typeof WText>): TextFactT =>
  f.stated && f.value.trim() ? { value: f.value.trim(), page: pg(f.page), quote: str(f.quote) } : { value: null, page: null, quote: null };
const n = (f: z.infer<typeof WNumber>): NumberFactT =>
  f.stated ? { value: f.value, asOf: str(f.asOf), page: pg(f.page), quote: str(f.quote) } : { value: null, asOf: null, page: null, quote: null };
const m = (f: z.infer<typeof WMoney>): MoneyFactT =>
  f.stated
    ? { amount: f.amount, currency: str(f.currency)?.toUpperCase() ?? null, asOf: str(f.asOf), page: pg(f.page), quote: str(f.quote) }
    : { amount: null, currency: null, asOf: null, page: null, quote: null };

export function toRecord(w: W): DealRecord {
  return {
    oneLiner: w.oneLiner,
    company: {
      name: t(w.company.name),
      website: t(w.company.website),
      country: t(w.company.country),
      city: t(w.company.city),
      sector: t(w.company.sector),
      businessModel: t(w.company.businessModel),
      stage: t(w.company.stage),
      foundedYear: n(w.company.foundedYear),
      description: t(w.company.description),
    },
    round: {
      amount: m(w.round.amount),
      instrument: t(w.round.instrument),
      valuation: m(w.round.valuation),
      useOfFunds: t(w.round.useOfFunds),
      priorFunding: t(w.round.priorFunding),
    },
    traction: {
      mrr: m(w.traction.mrr),
      arr: m(w.traction.arr),
      monthlyGrowthPct: n(w.traction.monthlyGrowthPct),
      customers: n(w.traction.customers),
      users: n(w.traction.users),
      retention: t(w.traction.retention),
      grossMarginPct: n(w.traction.grossMarginPct),
      monthlyBurn: m(w.traction.monthlyBurn),
      cash: m(w.traction.cash),
      runwayMonths: n(w.traction.runwayMonths),
      teamSize: n(w.traction.teamSize),
    },
    team: w.team.map((f) => ({
      name: f.name,
      role: str(f.role),
      page: pg(f.page),
      pastRoles: f.pastRoles.map((r) => ({
        company: r.company,
        title: r.title,
        startYear: r.startYear > 0 ? r.startYear : null,
        endYear: r.endYear > 0 ? r.endYear : null,
        page: pg(r.page),
        quote: str(r.quote),
      })),
    })),
    market: {
      sizeClaim: m(w.market.sizeClaim),
      sizeMethod: t(w.market.sizeMethod),
      competitors: w.market.competitors.map((c) => ({ name: c.name, page: pg(c.page) })),
    },
  };
}

export type TextFactT = z.infer<typeof TextFact>;
export type NumberFactT = z.infer<typeof NumberFact>;
export type MoneyFactT = z.infer<typeof MoneyFact>;

export const LEVELS = ["Strong", "Mixed", "Weak", "Not enough info"] as const;

const Judgement = z.object({
  level: z.enum(LEVELS),
  reason: z.string().describe("One or two plain sentences"),
  evidence: z.array(z.string()).describe("Facts used, each with its source, e.g. 'MRR ₹38L in Sep 2026 (sheet)'"),
});

export const AssessmentSchema = z.object({
  summary: z.string().describe("Two or three sentences an analyst reads first"),
  traction: Judgement,
  team: Judgement,
  founderChecks: z.array(
    z.object({
      founder: z.string(),
      claim: z.string().describe("The role as the deck claims it"),
      verdict: z.enum(["match", "conflict", "not_found"]),
      detail: z.string().describe("What the profile shows, in one sentence"),
    }),
  ),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  founderQuestions: z.array(z.string()).describe("Polite, specific questions to send the founder"),
});

export type Assessment = z.infer<typeof AssessmentSchema>;

export const ResearchSchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      whatTheyDo: z.string(),
      howDifferent: z.string().describe("How they differ from this company"),
      namedInDeck: z.boolean(),
      url: z.string().nullable(),
    }),
  ),
  marketSize: z.object({
    low: z.number().nullable(),
    high: z.number().nullable(),
    currency: z.string(),
    whatItCounts: z.string().describe("e.g. 'yearly software spend by mid-size Indian manufacturers'"),
    steps: z.array(z.string()).describe("Bottom-up steps: count x price x share, each with its source"),
    deckClaimComment: z.string().describe("How this compares with the deck's own market size claim"),
  }),
  redFlags: z.array(z.object({ text: z.string(), url: z.string().nullable() })),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export type Research = z.infer<typeof ResearchSchema>;
