// The top of the funnel: how each pitch email became a deal record, who the founders are relative to
// the problem they're solving, what the fund decided and when to look again, and what the market
// around each deal is doing. All companies, people, competitors and market numbers here are
// fictional sample data. The rules that turn them into scores and labels are plain code.
import { addDays, fmtDay } from "./dates";
import { DEMO_DATE } from "./portfolio/health";

// ---------- Founder-market fit ----------

/** How a founder's past work relates to the problem this company solves. A judgement read from the deck. */
export type Relation = "direct" | "adjacent" | "none";

export interface FounderProfile {
  name: string;
  role: string;
  /** Their main past role, as the deck's team page states it. */
  past: string;
  from: number;
  to: number;
  relation: Relation;
  /** One line on why the past work does or doesn't relate. */
  why: string;
  /** Built a company before, and in which space. */
  priorCompany?: { what: string; sameSpace: boolean };
}

export type FitLevel = "Strong" | "Mixed" | "Weak";

export interface FitResult {
  level: FitLevel;
  working: string[];
  domainYears: number;
  repeat: boolean;
  tenPlus: boolean;
}

/**
 * Founder-market fit, worked out by code from the team page.
 * A founder is "deep" with 5+ years directly in the problem (as the buyer, the operator or the builder of
 * the same thing), or after founding a company in the same space. Strong: one deep founder plus a second
 * founder with direct or adjacent experience (or a repeat founder). Mixed: one deep founder alone, or only
 * shorter or adjacent experience. Weak: nobody has worked on this problem before.
 * School, age, gender and home town are never inputs.
 */
export const FIT_DEEP_YEARS = 5;

export function founderFit(founders: FounderProfile[]): FitResult {
  const years = (f: FounderProfile) => Math.max(0, f.to - f.from);
  const deep = (f: FounderProfile) => (f.relation === "direct" && years(f) >= FIT_DEEP_YEARS) || Boolean(f.priorCompany?.sameSpace);
  const some = (f: FounderProfile) => f.relation === "direct" || (f.relation === "adjacent" && years(f) >= FIT_DEEP_YEARS);
  const working = founders.map((f) => {
    const y = years(f);
    const tag = deep(f) ? "deep" : some(f) ? "some" : "none";
    return `${f.name}: ${y} ${y === 1 ? "year" : "years"} as ${f.past} (${f.relation}${f.priorCompany ? `; built ${f.priorCompany.what} before` : ""}) → ${tag}`;
  });
  const deepCount = founders.filter(deep).length;
  const backed = founders.filter((f) => some(f) || deep(f)).length;
  const level: FitLevel = deepCount >= 1 && backed >= 2 ? "Strong" : deepCount >= 1 || backed >= 1 ? "Mixed" : "Weak";
  const directYears = founders.filter((f) => f.relation === "direct").map(years);
  working.push(
    level === "Strong"
      ? "Strong: a founder with deep experience in this exact problem, backed by a second founder who knows it too."
      : level === "Mixed"
        ? "Mixed: some relevant experience, but not a full team that has lived this problem. Ask who covers the gap."
        : "Weak: nobody on the team has worked on this problem. Execution risk is high; ask why them, why now.",
  );
  return {
    level,
    working,
    domainYears: directYears.length ? Math.max(...directYears) : 0,
    repeat: founders.some((f) => f.priorCompany),
    tenPlus: founders.some((f) => f.relation === "direct" && years(f) >= 10),
  };
}

// ---------- How each pitch arrived ----------

export const PARTNER_INBOX = "kabir@samplefund.example";
export const PITCH_ADDRESS = "pitches@in.samplefund.example";

export interface Ingest {
  to: string;
  subject: string;
  /** Minutes from the email landing to a deal record existing (grouping and the code checks). */
  minutes: number;
}

// ---------- Competitors and the market ----------

export type Signal = "Raised" | "Stalled" | "Launched" | "Shut down" | "Hired" | "Expanded";

export interface Competitor {
  name: string;
  what: string;
  signal: Signal;
  detail: string;
  when: string; // YYYY-MM
}

export interface FunnelProfile {
  id: string;
  city: string;
  /** A finer label than the sector, for the queue. */
  category: string;
  founders: FounderProfile[];
  ingest: Ingest;
  competitors: Competitor[];
  /** Someone at the fund who knows a founder, when that isn't already in the contacts list. */
  warm?: { who: string; how: string };
}

const P = (id: string, x: Omit<FunnelProfile, "id">): FunnelProfile => ({ id, ...x });

/** The ten sample decks, plus the pitch that came in by email. Founder lines are copied from each deck's team page. */
export const FUNNEL: Record<string, FunnelProfile> = Object.fromEntries(
  [
    P("ledgerly", {
      city: "Pune",
      category: "Accounts payable software",
      founders: [
        { name: "Ananya Rao", role: "CEO", past: "finance controller, Kestrel Auto Components", from: 2015, to: 2022, relation: "direct", why: "Ran payables at a manufacturer: she was the buyer." },
        { name: "Vikram Joshi", role: "CTO", past: "senior engineer, Brightpath Software", from: 2016, to: 2022, relation: "direct", why: "Built an invoicing platform." },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Ledgerly: Seed deck and monthly numbers", minutes: 3 },
      competitors: [
        { name: "Payably", what: "AP automation for mid-market", signal: "Raised", detail: "$8M Series A", when: "2026-09" },
        { name: "InvoiceKart", what: "Invoice capture for SMEs", signal: "Stalled", detail: "No round since 2024; team shrank", when: "2026-07" },
      ],
    }),
    P("mandiflow", {
      city: "Bengaluru",
      category: "Fresh produce supply to restaurants",
      founders: [
        { name: "Rahul Menon", role: "CEO", past: "category head, FreshKart Retail", from: 2016, to: 2021, relation: "direct", why: "Ran a ₹300 Cr fruit and vegetable category." },
        { name: "Sneha Kulkarni", role: "COO", past: "operations manager, Coastline Logistics", from: 2014, to: 2020, relation: "direct", why: "Ran cold-chain operations for South India." },
      ],
      ingest: { to: PITCH_ADDRESS, subject: "Series A: Mandiflow (farm to kitchen, next morning)", minutes: 4 },
      competitors: [
        { name: "KitchenCrate", what: "Restaurant supplies marketplace", signal: "Raised", detail: "$22M Series B", when: "2026-08" },
        { name: "Harvestly", what: "Farm-gate sourcing", signal: "Shut down", detail: "Closed operations in two cities", when: "2026-06" },
      ],
    }),
    P("remitwell", {
      city: "Dubai",
      category: "Cross-border payroll",
      founders: [
        { name: "Omar Haddad", role: "CEO", past: "VP product, Gulfstone Bank", from: 2016, to: 2022, relation: "direct", why: "Led the bank's payments products." },
        { name: "Maria Santos", role: "CTO", past: "staff engineer, Paylane", from: 2017, to: 2023, relation: "direct", why: "Built card and payout systems." },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Remitwell | payroll across borders | Seed", minutes: 3 },
      competitors: [
        { name: "Wagebridge", what: "Payroll for Gulf SMEs", signal: "Raised", detail: "$12M Series A", when: "2026-10" },
        { name: "Salarium", what: "Payroll and compliance", signal: "Expanded", detail: "Launched in Saudi Arabia", when: "2026-08" },
      ],
    }),
    P("sunroof-grid", {
      city: "Ahmedabad",
      category: "Rooftop solar financing",
      founders: [
        { name: "Karan Patel", role: "CEO", past: "project lead, Helios Power Systems", from: 2015, to: 2023, relation: "direct", why: "Delivered 400+ rooftop projects." },
        { name: "Divya Shah", role: "CFO", past: "associate director, Greenbridge Capital", from: 2017, to: 2023, relation: "direct", why: "Structured clean-energy debt, the other half of this model." },
      ],
      ingest: { to: PITCH_ADDRESS, subject: "Sunroof Grid: rooftop solar, no money down", minutes: 5 },
      competitors: [
        { name: "Rooftopia", what: "Residential solar on lease", signal: "Raised", detail: "$15M debt and equity", when: "2026-09" },
        { name: "SolarSathi", what: "Solar for small businesses", signal: "Hired", detail: "New CFO from a large lender", when: "2026-10" },
      ],
    }),
    P("rostrly", {
      city: "Riyadh",
      category: "Retail workforce scheduling",
      founders: [
        { name: "Faisal Al-Harbi", role: "CEO", past: "head of retail operations, Najd Hypermarkets", from: 2014, to: 2022, relation: "direct", why: "Ran 60 stores and 4,000 staff: the buyer." },
        { name: "Lina Mansour", role: "CTO", past: "engineering manager, Cloudnest", from: 2016, to: 2022, relation: "adjacent", why: "Led a 25-person engineering team on general business software." },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Rostrly Series A: shift scheduling for Gulf retail", minutes: 4 },
      competitors: [
        { name: "Shiftwise Gulf", what: "Scheduling for hospitality", signal: "Launched", detail: "Added a retail product", when: "2026-09" },
        { name: "Rotafy", what: "Global scheduling app", signal: "Expanded", detail: "Opened a Riyadh office", when: "2026-07" },
      ],
    }),
    P("loomhaus", {
      city: "Jaipur",
      category: "Handloom home textiles (D2C)",
      founders: [
        { name: "Meera Singh", role: "Founder", past: "handloom collection designer", from: 2015, to: 2025, relation: "direct", why: "Ten years designing handloom collections." },
        { name: "Arjun Rathore", role: "Co-founder", past: "D2C home brands operator", from: 2018, to: 2025, relation: "direct", why: "Has built D2C home brands.", priorCompany: { what: "D2C home brands", sameSpace: true } },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Loomhaus pre-seed: handloom for modern homes", minutes: 2 },
      competitors: [
        { name: "Threadnest", what: "Online home textiles", signal: "Raised", detail: "$5M Series A", when: "2026-06" },
        { name: "Weavora", what: "Artisan marketplace", signal: "Stalled", detail: "Paused new categories", when: "2026-08" },
      ],
    }),
    P("tutorbridge", {
      city: "Hyderabad",
      category: "After-school tutoring",
      founders: [
        { name: "Priya Nair", role: "CEO", past: "academic director, Brightminds Schools", from: 2012, to: 2022, relation: "direct", why: "Ran curriculum for 14 schools." },
        { name: "Sameer Khan", role: "CTO", past: "engineering lead, Quizly", from: 2018, to: 2023, relation: "direct", why: "Built live classroom software." },
      ],
      ingest: { to: PITCH_ADDRESS, subject: "Tutorbridge seed deck", minutes: 3 },
      competitors: [
        { name: "Learnloop", what: "Live tutoring app", signal: "Shut down", detail: "Wound down after a failed raise", when: "2026-05" },
        { name: "Vidyapath", what: "Regional-language classes", signal: "Raised", detail: "$4M Seed", when: "2026-09" },
      ],
    }),
    P("clinicall", {
      city: "Boston",
      category: "Remote heart monitoring",
      founders: [
        { name: "Daniel Brooks", role: "CEO", past: "VP operations, Harborview Cardiology Group", from: 2012, to: 2019, relation: "direct", why: "Ran operations for the clinics that buy this." },
        { name: "Grace Liu", role: "CTO", past: "principal engineer, Medisync", from: 2013, to: 2019, relation: "direct", why: "Built medical device software." },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Clinicall Series B: $25M", minutes: 2 },
      competitors: [{ name: "CardiaWatch", what: "Remote cardiac monitoring", signal: "Raised", detail: "$60M Series C", when: "2026-08" }],
    }),
    P("parkwise", {
      city: "Dubai",
      category: "Ticketless parking",
      founders: [
        { name: "Ahmed Saleh", role: "CEO", past: "general manager, CityPark Operations", from: 2014, to: 2021, relation: "direct", why: "Ran 30 car parks in Dubai and Sharjah." },
        { name: "Rohan Desai", role: "CTO", past: "senior engineer, Visionlane", from: 2016, to: 2021, relation: "direct", why: "Built number-plate recognition systems." },
      ],
      ingest: { to: PITCH_ADDRESS, subject: "Parkwise: ticketless parking (Seed)", minutes: 3 },
      competitors: [
        { name: "Gatepass", what: "Parking payments", signal: "Raised", detail: "$9M Series A", when: "2026-10" },
        { name: "Spotly", what: "Parking marketplace", signal: "Stalled", detail: "Exited two malls", when: "2026-07" },
      ],
    }),
    P("freightnest", {
      city: "Dubai",
      category: "Software for freight forwarders",
      founders: [
        { name: "Nikhil Bansal", role: "CEO", past: "regional director, Seabridge Forwarding", from: 2012, to: 2021, relation: "direct", why: "Ran a $40M forwarding P&L: the buyer." },
        { name: "Aisha Rahman", role: "CPO", past: "product manager, Cargolink", from: 2017, to: 2022, relation: "direct", why: "Shipped a freight booking platform." },
      ],
      ingest: { to: PARTNER_INBOX, subject: "Freightnest | OS for small forwarders | Seed", minutes: 4 },
      competitors: [
        { name: "Cargodesk", what: "Forwarder software", signal: "Raised", detail: "$6M Seed extension", when: "2026-09" },
        { name: "Shiplane", what: "Digital freight forwarder", signal: "Hired", detail: "New India country head", when: "2026-10" },
      ],
      warm: { who: "Arjun Bhat", how: "Met Nikhil at a Dubai logistics meetup in August" },
    }),
    P("shelfsense-mail", {
      city: "Mumbai",
      category: "Retail shelf cameras",
      founders: [
        { name: "Kunal Desai", role: "Founder", past: "brand manager, a packaged-snacks company", from: 2018, to: 2024, relation: "direct", why: "Was the buyer: brands pay to know when shelves run empty." },
      ],
      ingest: { to: PITCH_ADDRESS, subject: "Shelfsense seed deck", minutes: 0 },
      competitors: [{ name: "Shelfwise AI", what: "Shelf analytics", signal: "Raised", detail: "$3M Seed", when: "2026-08" }],
    }),
  ].map((x) => [x.id, x]),
);

// ---------- Decisions: pass, hold, and when to look again ----------

export const PASS_REASONS = [
  "Outside focus",
  "Too early",
  "Founder-market fit",
  "Market size",
  "Competition",
  "Unit economics",
  "Valuation",
  "Regulation",
  "Numbers don't hold up",
] as const;
export type PassReason = (typeof PASS_REASONS)[number];

/** A first draft of the re-engage trigger for each reason. The person edits it. */
export const TRIGGER_HINT: Record<PassReason, string> = {
  "Outside focus": "Only if the fund's rules change to cover this stage, country or sector.",
  "Too early": "Six months of revenue growth at 10%+ a month, or a lead investor committing.",
  "Founder-market fit": "A cofounder who has worked on this problem joins.",
  "Market size": "Proof the product sells beyond the first segment.",
  Competition: "A funded rival stalls or exits, or they win a top customer from one.",
  "Unit economics": "Gross margin above 40% for three months in a row.",
  Valuation: "The next round is priced within the fund's range.",
  Regulation: "The licence is granted.",
  "Numbers don't hold up": "Bank statements that match the deck.",
};

export interface Decision {
  status: "Passed" | "On hold";
  reason: PassReason;
  note: string;
  trigger: string;
  checkOn: string | null;
  by: string;
  at: string;
}

/** Two of the sample decks were already decided before the demo date. */
export const SEED_DECISIONS: Record<string, Decision> = {
  clinicall: {
    status: "Passed",
    reason: "Outside focus",
    note: "A $25M Series B in the US. Stage, country and round size are all outside the fund's rules. Strong team; not our fund.",
    trigger: TRIGGER_HINT["Outside focus"],
    checkOn: null,
    by: "Kabir Shah",
    at: "2026-10-20",
  },
  loomhaus: {
    status: "On hold",
    reason: "Too early",
    note: "Founders know the craft and the channel. Only a few months of sales, so there is nothing yet to show repeat buying.",
    trigger: "₹15 L monthly revenue with 30% of buyers ordering again, or a seed lead committing.",
    checkOn: "2027-01-20",
    by: "Kabir Shah",
    at: "2026-10-22",
  },
};

/** Pitches the fund passed on earlier in the year. The repository remembers why, and watches for the trigger. */
export interface PastDeal {
  id: string;
  name: string;
  sector: string;
  category: string;
  city: string;
  stage: string;
  receivedAt: string;
  decision: Decision;
  /** What has happened since, as the monthly check found it. */
  since?: { what: string; when: string; meetsTrigger: boolean };
  fit: FitLevel;
  fitWhy: string;
}

const past = (x: Omit<PastDeal, "decision"> & { reason: PassReason; note: string; trigger: string; checkOn: string; at: string; by?: string; status?: Decision["status"] }): PastDeal => {
  const { reason, note, trigger, checkOn, at, by, status, ...rest } = x;
  return { ...rest, decision: { status: status ?? "Passed", reason, note, trigger, checkOn, at, by: by ?? "Kabir Shah" } };
};

export const PAST_DEALS: PastDeal[] = [
  past({
    id: "kiranaloop", name: "Kiranaloop", sector: "B2B software", category: "Ordering app for corner shops", city: "Bengaluru", stage: "Seed", receivedAt: "2026-04-08",
    reason: "Too early", note: "Good team, ₹18 L monthly revenue.", trigger: "₹50 L monthly revenue.", checkOn: "2026-10-08", at: "2026-04-14",
    since: { what: "Founder's update: ₹62 L monthly revenue in September", when: "2026-10-05", meetsTrigger: true },
    fit: "Strong", fitWhy: "CEO ran distribution for a consumer goods company for 9 years.",
  }),
  past({
    id: "voltharbor", name: "Voltharbor", sector: "Mobility", category: "EV charging for fleets", city: "Dubai", stage: "Seed", receivedAt: "2026-04-28",
    reason: "Competition", note: "Two better-funded rivals in the same depots.", trigger: "A funded rival stalls or exits.", checkOn: "2026-11-02", at: "2026-05-02",
    since: { what: "The larger rival shut down its Dubai depots", when: "2026-09-18", meetsTrigger: true },
    fit: "Mixed", fitWhy: "CEO ran fleet operations; nobody has built charging hardware.",
  }),
  past({
    id: "neuroquill", name: "Neuroquill", sector: "B2B software", category: "AI model hosting", city: "Mumbai", stage: "Seed", receivedAt: "2026-06-03",
    reason: "Founder-market fit", note: "Founder spent 8 years in D2C brand marketing. Nobody on the team has built infrastructure software.", trigger: "A cofounder who has run AI infrastructure joins.", checkOn: "2026-12-10", at: "2026-06-10",
    fit: "Weak", fitWhy: "No founder has worked on infrastructure software.",
  }),
  past({
    id: "agrisprout", name: "Agrisprout", sector: "Food supply", category: "Crop-quality testing", city: "Pune", stage: "Pre-seed", receivedAt: "2026-03-24",
    reason: "Market size", note: "Works for one crop in one state.", trigger: "Sells beyond grapes in Maharashtra.", checkOn: "2026-09-30", at: "2026-03-30",
    fit: "Strong", fitWhy: "Founder ran quality labs for an exporter for 11 years.",
  }),
  past({
    id: "paydune", name: "Paydune", sector: "Fintech", category: "Buy now, pay later for clinics", city: "Riyadh", stage: "Seed", receivedAt: "2026-08-05",
    reason: "Regulation", note: "Needs a finance licence it doesn't have yet.", trigger: "The licence is granted.", checkOn: "2026-11-12", at: "2026-08-12",
    since: { what: "Founder says the licence was granted", when: "2026-10-21", meetsTrigger: true },
    fit: "Strong", fitWhy: "CEO ran credit at a Saudi bank for 7 years.",
  }),
  past({
    id: "cartfable", name: "Cartfable", sector: "Consumer brands", category: "Kids' clothing (D2C)", city: "Jaipur", stage: "Seed", receivedAt: "2026-07-15",
    reason: "Valuation", note: "Asking $30M post-money on ₹40 L monthly revenue.", trigger: "Next round priced under $15M post-money.", checkOn: "2027-01-21", at: "2026-07-21",
    fit: "Mixed", fitWhy: "Strong brand founder; no one has run supply.",
  }),
  past({
    id: "coldvine", name: "Coldvine", sector: "Logistics", category: "Cold-chain trucking", city: "Hyderabad", stage: "Seed", receivedAt: "2026-09-01",
    reason: "Too early", status: "On hold", note: "Three months of revenue, one large customer.", trigger: "Five paying customers.", checkOn: "2027-03-05", at: "2026-09-05",
    fit: "Strong", fitWhy: "Both founders ran cold-chain fleets.",
  }),
  past({
    id: "sunterrace", name: "Sunterrace", sector: "Climate", category: "Solar for factories", city: "Ahmedabad", stage: "Seed", receivedAt: "2026-06-20",
    reason: "Unit economics", note: "Gross margin of 12% after installation.", trigger: "Gross margin above 25% for a quarter.", checkOn: "2026-12-25", at: "2026-06-25",
    fit: "Strong", fitWhy: "Founder built 300 MW of commercial solar.",
  }),
];

/** Is it time to look at a passed or held deal again? A trigger met beats a date reached. */
export function reengageState(d: Decision, since: PastDeal["since"] | undefined, today = DEMO_DATE): { due: boolean; why: string } {
  if (since?.meetsTrigger) return { due: true, why: `Trigger met: ${since.what.charAt(0).toLowerCase()}${since.what.slice(1)}.` };
  if (d.checkOn && d.checkOn <= today) return { due: true, why: `Check date ${fmtDay(d.checkOn)} has passed. Look for news before writing.` };
  if (!d.checkOn) return { due: false, why: "No check date: kept for market data only." };
  return { due: false, why: `Next check ${fmtDay(d.checkOn)}.` };
}

export function defaultCheckOn(reason: PassReason, today = DEMO_DATE): string | null {
  if (reason === "Outside focus") return null;
  return addDays(today, reason === "Too early" || reason === "Valuation" ? 180 : 90);
}

// ---------- Market temperature ----------

export interface MarketRow {
  sector: string;
  /** Decks each month, May to October 2026: the recipe for the small fictional deal-flow history in lib/flow.ts
   * (about 75 decks, so the demo stays readable; a real fund sees thousands). */
  inbound: number[];
  /** Money raised by startups in the sector across India and the Gulf, last 90 days and the 90 before, $M. Sample. */
  raised: [number, number];
  /** Number of rounds behind that money, last 90 days and the 90 before. Sample. */
  rounds: [number, number];
}

export const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

export const MARKET: MarketRow[] = [
  { sector: "B2B software", inbound: [1, 2, 2, 3, 3, 4], raised: [410, 320], rounds: [46, 38] },
  { sector: "Fintech", inbound: [2, 2, 2, 2, 1, 2], raised: [520, 610], rounds: [31, 36] },
  { sector: "Logistics", inbound: [1, 1, 1, 1, 2, 3], raised: [140, 95], rounds: [14, 10] },
  { sector: "Mobility", inbound: [2, 1, 1, 1, 0, 0], raised: [60, 110], rounds: [6, 9] },
  { sector: "Climate", inbound: [1, 1, 1, 1, 2, 3], raised: [180, 150], rounds: [12, 11] },
  { sector: "Food supply", inbound: [1, 1, 1, 1, 1, 1], raised: [90, 85], rounds: [9, 9] },
  { sector: "Consumer brands", inbound: [2, 1, 2, 1, 2, 1], raised: [120, 170], rounds: [18, 25] },
  { sector: "Edtech", inbound: [1, 1, 1, 0, 1, 0], raised: [40, 75], rounds: [5, 8] },
  { sector: "Healthtech", inbound: [1, 1, 1, 1, 1, 1], raised: [150, 140], rounds: [11, 12] },
];

export type Temperature = "Heating up" | "Crowding" | "Steady" | "Cooling";

export const TEMP_SHARE = 0.15;

/**
 * Code reads two moves: decks the fund receives (last 3 months against the 3 before) and money raised in the
 * sector (last 90 days against the 90 before). Both up by more than 15%: heating up. More decks but money flat
 * or falling: crowding, so expect cheaper rounds and more noise. Both down: cooling. Otherwise steady.
 */
export function temperature(r: Pick<MarketRow, "inbound" | "raised">): { temp: Temperature; inboundChange: number; moneyChange: number } {
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const inboundChange = sum(r.inbound.slice(-3)) / Math.max(1, sum(r.inbound.slice(-6, -3))) - 1;
  const moneyChange = r.raised[0] / r.raised[1] - 1;
  const temp: Temperature =
    inboundChange > TEMP_SHARE && moneyChange > TEMP_SHARE
      ? "Heating up"
      : inboundChange > TEMP_SHARE && moneyChange <= 0
        ? "Crowding"
        : inboundChange < -TEMP_SHARE || moneyChange < -TEMP_SHARE
          ? "Cooling"
          : "Steady";
  return { temp, inboundChange, moneyChange };
}

export const PULSE_DAYS = 5;

/** How a sample deck reached the fund: by email to the partner, to the pitch address, or the form. */
export function sampleChannel(id: string): "Partner email" | "Pitch email" | "Pitch form" {
  const f = FUNNEL[id];
  return !f ? "Pitch form" : f.ingest.to === PARTNER_INBOX ? "Partner email" : "Pitch email";
}
