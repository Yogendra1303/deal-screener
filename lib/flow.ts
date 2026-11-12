// Six months of deal flow, kept small (about 75 decks) so the demo reads at a glance: one record per company,
// every deck it sent, what the fund decided and what happened after. Generated from a fixed recipe (the
// monthly counts in MARKET and the weights below) with a seeded random generator, so every computer gets
// the same fictional history. All names, people and events are made up.
//
// The maths that reads this history (look-again points, miss rate, temperature) is ordinary code and is
// the same whatever feeds it.
import { addDays } from "./dates";
import { MARKET, MONTHS, PAST_DEALS, TRIGGER_HINT, defaultCheckOn, type Decision, type FitLevel, type PassReason } from "./funnel";
import { DEMO_DATE, daysBetween } from "./portfolio/health";
import { DEFAULT_RULES } from "./rules";
import type { DealStatus, FundRules } from "./types";

export type Via = "Pitch email" | "Partner email" | "Website link" | "Analyst link" | "Intro";
export type SignalKind = "Raised elsewhere" | "Pitched again" | "Trigger met" | "Team grew" | "Shut down";
export type Outcome = "Never opened" | "Waiting" | "Meeting" | "On hold" | "Passed";

export interface FlowDeck {
  at: string; // YYYY-MM-DD
  stage: string;
  askUsd: number;
  via: Via;
  file: string;
}

export interface FlowSignal {
  kind: SignalKind;
  at: string;
  text: string;
  source: string;
}

export interface FlowCompany {
  id: string;
  name: string;
  domain: string;
  sector: string;
  sub: string;
  city: string;
  country: string;
  founder: string;
  email: string;
  fit: FitLevel;
  repeat: boolean;
  tenPlus: boolean;
  warm?: string; // who at the fund knows them
  decks: FlowDeck[]; // oldest first
  owner?: string;
  outcome: Outcome;
  decision?: Decision;
  meetingAt?: string;
  signals: FlowSignal[]; // oldest first
  /** Hand-written history (the earlier passes with notes), not generated. */
  written?: boolean;
}

export const FLOW_NOTE = "Fictional history: a small sample made from a fixed recipe. A real fund sees thousands of decks a year.";

// ---------- Recipe ----------

const SUBS: Record<string, [string, number, number][]> = {
  // [sub-category, weight in Nov 2025, weight in Oct 2026]
  "B2B software": [
    ["AI agents and copilots", 10, 45],
    ["Accounting and finance software", 15, 10],
    ["Sales and marketing tools", 15, 10],
    ["HR and payroll software", 12, 8],
    ["Security", 8, 7],
    ["Developer tools", 12, 12],
    ["Supply chain software", 10, 8],
  ],
  Fintech: [
    ["Payments", 25, 22],
    ["SME lending", 20, 18],
    ["Wealth and investing", 15, 10],
    ["Insurance", 12, 12],
    ["Cross-border payroll", 10, 16],
    ["Embedded finance", 10, 14],
  ],
  Logistics: [
    ["Freight software", 25, 35],
    ["Cold chain", 15, 25],
    ["Last-mile delivery", 35, 20],
    ["Warehousing", 25, 20],
  ],
  Mobility: [
    ["EV charging", 30, 20],
    ["Fleet software", 25, 25],
    ["Two-wheeler rental", 25, 15],
    ["Parking", 20, 20],
  ],
  Climate: [
    ["Rooftop solar", 25, 30],
    ["Carbon accounting", 20, 25],
    ["Battery recycling", 15, 25],
    ["Water", 20, 12],
    ["Green buildings", 20, 8],
  ],
  "Food supply": [
    ["Farm-to-kitchen supply", 35, 35],
    ["Crop testing", 20, 20],
    ["Cold storage", 20, 20],
    ["Farm inputs", 25, 25],
  ],
  "Consumer brands": [
    ["D2C fashion", 30, 25],
    ["Beauty and personal care", 25, 30],
    ["Home goods", 20, 20],
    ["Kids", 10, 10],
    ["Packaged food", 15, 20],
  ],
  Edtech: [
    ["Test prep", 35, 25],
    ["Upskilling", 30, 35],
    ["K-12 tutoring", 20, 20],
    ["Language learning", 15, 20],
  ],
  Healthtech: [
    ["Clinic software", 25, 25],
    ["Diagnostics", 25, 25],
    ["Mental health", 20, 20],
    ["Pharmacy delivery", 15, 15],
    ["Insurance claims", 15, 15],
  ],
};

const CITIES: [string, string, number][] = [
  ["Bengaluru", "India", 22],
  ["Mumbai", "India", 14],
  ["Delhi NCR", "India", 14],
  ["Hyderabad", "India", 7],
  ["Pune", "India", 6],
  ["Chennai", "India", 5],
  ["Ahmedabad", "India", 3],
  ["Jaipur", "India", 2],
  ["Kolkata", "India", 2],
  ["Dubai", "UAE", 10],
  ["Abu Dhabi", "UAE", 3],
  ["Riyadh", "Saudi Arabia", 6],
  ["Jeddah", "Saudi Arabia", 2],
  ["Doha", "Qatar", 2],
  ["Singapore", "Singapore", 3],
  ["London", "UK", 1],
  ["San Francisco", "USA", 1],
];

const STAGE_W: Record<string, number> = { "Pre-seed": 30, Seed: 40, "Series A": 20, "Series B": 7, "Series C or later": 3 };
const ASK: Record<string, [number, number]> = {
  "Pre-seed": [250_000, 1_200_000],
  Seed: [1_000_000, 4_500_000],
  "Series A": [4_000_000, 15_000_000],
  "Series B": [15_000_000, 40_000_000],
  "Series C or later": [40_000_000, 120_000_000],
};
const NEXT_STAGE: Record<string, string> = { "Pre-seed": "Seed", Seed: "Series A", "Series A": "Series B", "Series B": "Series C or later", "Series C or later": "Series C or later" };
const VIA_W: Record<Via, number> = { "Pitch email": 45, "Partner email": 20, "Website link": 25, "Analyst link": 6, Intro: 4 };

const PREFIX = "Aero Agri Alto Amber Apex Aqua Arc Astra Aura Bharat Bloom Blue Bright Cargo Cedar Clear Cloud Coral Crest Desi Dhan Echo Ember Fable Falcon Fern Flux Fold Glide Grain Halo Harbor Indigo Iris Jade Kaya Kite Kora Lark Leaf Lumen Maple Mesa Mint Monsoon Nexa Nimbus Noor Nova Oasis Opal Orbit Palm Pebble Pixel Prism Quill Raha Ripple Saffron Sage Sahara Shift Silk Solar Spark Spice Sprout Stack Swift Teal Terra Tide Trail Urban Vayu Verde Vista Wave Zen Zest Zora".split(" ");
const SUFFIX = "ly io hub loop base labs works stack flow pay kart nest grid wise bridge path mint cart desk deck port line link mart sense scale shift spot ware yard dock field gate view form craft rise verse bay hq go ai box fin med trail way ify ora iq nova pod row track sync".split(" ");
/** Names already used by the detailed samples, the earlier passes and the portfolio. */
const RESERVED = new Set(["kitebay", "brightcart", "voltnest", "nestara", "mandiwise", "sehatflow", "ledgerly", "mandiflow", "remitwell", "rostrly", "loomhaus", "tutorbridge", "clinicall", "parkwise", "freightnest", "shelfsense"]);

const FIRST = "Aarav Ananya Rohan Priya Karan Meera Vikram Sana Nikhil Isha Faisal Layla Yusuf Noura Hamad Reem Zoya Dev Tara Aditya Pooja Rahul Sneha Imran Fatima Khalid Maryam Varun Nisha Ayaan Diya Kunal Aisha Sameer Hiba Manav Rhea Tariq Leila Neel".split(" ");
const LAST = "Sharma Iyer Reddy Gupta Nair Khan Desai Kapoor Bose Pillai Verma Al-Mansoori Al-Qahtani Haddad Siddiqui Chopra Malhotra Banerjee Saxena Kumar Mehra Hegde Qureshi Al-Suwaidi Fernandes Bhatt Ghosh Sinha Trivedi Rizvi".split(" ");
const INVESTORS = ["Northgate Ventures", "Saffron Capital", "Dune Partners", "Monsoon VC", "Falcon Peak Capital", "Riverbend Ventures", "Arcadia Seed", "Lotus Bridge Capital", "Gulfstar Ventures", "Banyan Street"];

const REASON_W: Record<PassReason, number> = {
  "Outside focus": 0,
  "Too early": 30,
  "Founder-market fit": 6,
  "Market size": 9,
  Competition: 14,
  "Unit economics": 11,
  Valuation: 7,
  Regulation: 3,
  "Numbers don't hold up": 8,
};
/** How much more often a pass for this reason later raises elsewhere. */
const RAISE_MULT: Record<PassReason, number> = {
  "Outside focus": 0.5,
  "Too early": 1.5,
  "Founder-market fit": 0.5,
  "Market size": 0.9,
  Competition: 1,
  "Unit economics": 0.8,
  Valuation: 1.7,
  Regulation: 0.8,
  "Numbers don't hold up": 0.6,
};
const RAISE_BASE: Record<FitLevel, number> = { Strong: 0.35, Mixed: 0.15, Weak: 0.05 };
const TRIGGER_TEXT: Partial<Record<PassReason, string>> = {
  "Too early": "Founder's update: monthly revenue has doubled since the pass",
  "Market size": "Launched in a second country, which widens the market",
  Regulation: "Founder says the licence was granted",
  "Unit economics": "Founder reports a positive margin on each order",
  Competition: "The larger rival has paused new cities",
  Valuation: "Founder says the round was re-priced lower",
  "Numbers don't hold up": "Audited accounts now match the deck",
};

// ---------- Generator ----------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T extends string>(r: () => number, w: Record<T, number> | [T, number][]): T {
  const list = (Array.isArray(w) ? w : (Object.entries(w) as [T, number][])).filter(([, n]) => n > 0);
  const total = list.reduce((s, [, n]) => s + n, 0);
  let x = r() * total;
  for (const [k, n] of list) {
    x -= n;
    if (x < 0) return k;
  }
  return list[list.length - 1][0];
}

const pickOne = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const round50k = (n: number) => Math.round(n / 50_000) * 50_000;
const monthDays = (ym: string) => (ym === DEMO_DATE.slice(0, 7) ? Number(DEMO_DATE.slice(8)) : new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate());

/** Does a deck fit the fund's written rules? The same rule as fitScore, on the deck's own fields. */
export function fitsRules(d: { stage: string; askUsd: number | null }, sector: string, country: string, rules: FundRules): boolean {
  return (
    rules.stages.includes(d.stage) &&
    rules.countries.includes(country) &&
    rules.sectors.includes(sector) &&
    (d.askUsd == null || (d.askUsd >= rules.minRoundUsd && d.askUsd <= rules.maxRoundUsd))
  );
}

/** Builds the generated history. Same output on every call and every computer. */
export function generate(): FlowCompany[] {
  const r = mulberry32(20261029);
  const names = PREFIX.flatMap((p) => SUFFIX.map((s) => (["ai", "hq", "iq"].includes(s) ? `${p} ${s.toUpperCase()}` : `${p}${s}`))).filter(
    (n) => !RESERVED.has(n.toLowerCase().replace(/[^a-z]/g, "")),
  );
  // Shuffle the names once, deterministically.
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  let nameAt = 0;
  const out: FlowCompany[] = [];

  MONTHS.forEach((ym, m) => {
    // Every deck slot this month, in date order, so a re-pitch can only follow an earlier deck.
    const slots = MARKET.flatMap((row) => Array.from({ length: row.inbound[m] }, () => ({ sector: row.sector, day: 1 + Math.floor(r() * monthDays(ym)) })));
    slots.sort((a, b) => a.day - b.day);
    for (const slot of slots) {
      const at = `${ym}-${String(slot.day).padStart(2, "0")}`;
      const via = weighted(r, VIA_W);
      // About 1 in 12 decks is a company the fund passed on or held at least 60 days earlier, pitching again.
      if (m >= 2 && r() < 0.08) {
        const pool = out.filter(
          (c) => c.sector === slot.sector && c.decision && daysBetween(c.decks[c.decks.length - 1].at, at) >= 60 && !c.signals.some((s) => s.kind === "Shut down"),
        );
        if (pool.length) {
          const c = pickOne(r, pool);
          const last = c.decks[c.decks.length - 1];
          const stage = r() < 0.5 ? NEXT_STAGE[last.stage] : last.stage;
          const [lo, hi] = ASK[stage];
          const askUsd = round50k(lo + r() * (hi - lo));
          c.decks.push({ at, stage, askUsd, via, file: `${c.name.replace(/\s/g, "")}-deck-${at.slice(0, 7)}.pdf` });
          c.signals.push({ kind: "Pitched again", at, text: `Sent a new deck: ${stage}, raising $${(askUsd / 1e6).toFixed(1)}M`, source: "Pitch inbox" });
          continue;
        }
      }
      const name = names[nameAt++];
      const domain = `${name.toLowerCase().replace(/[^a-z]/g, "")}.example`;
      const [city, country] = weighted(r, CITIES.map(([c, k, w]) => [`${c}|${k}`, w] as [string, number])).split("|");
      const stage = weighted(r, STAGE_W);
      const [lo, hi] = ASK[stage];
      const askUsd = round50k(lo + r() * (hi - lo));
      const sub = weighted(r, SUBS[slot.sector].map(([s, w0, w1]) => [s, w0 + ((w1 - w0) * m) / 11] as [string, number]));
      const tenPlus = r() < 0.2;
      const fit: FitLevel = weighted(r, tenPlus ? { Strong: 50, Mixed: 40, Weak: 10 } : { Strong: 20, Mixed: 46, Weak: 34 });
      const first = pickOne(r, FIRST);
      const founder = `${first} ${pickOne(r, LAST)}`;
      const warm = via === "Intro" || r() < 0.04 ? pickOne(r, ["Kabir Shah", "Riya Menon", "Arjun Bhat"]) : undefined;
      out.push({
        id: `h-${String(out.length + 1).padStart(4, "0")}`,
        name,
        domain,
        sector: slot.sector,
        sub,
        city,
        country,
        founder,
        email: `${first.toLowerCase()}@${domain}`,
        fit,
        repeat: r() < 0.15,
        tenPlus,
        warm,
        decks: [{ at, stage, askUsd, via, file: `${name.replace(/\s/g, "")}-deck.pdf` }],
        outcome: "Waiting",
        signals: [],
      });
      decide(out[out.length - 1], r);
    }
  });
  return out;
}

/** What the fund did with a new company's first deck, and what happened after. */
function decide(c: FlowCompany, r: () => number) {
  const d = c.decks[0];
  const age = daysBetween(d.at, DEMO_DATE);
  const unreadP = age <= 6 ? 0.7 : age <= 14 ? 0.4 : 0.05;
  if (r() < unreadP) {
    c.outcome = age <= 6 ? "Waiting" : "Never opened";
    return;
  }
  if (age <= 6 && r() < 0.5) {
    c.outcome = "Waiting";
    c.owner = pickOne(r, ["Riya Menon", "Arjun Bhat"]);
    return;
  }
  c.owner = r() < 0.1 ? "Kabir Shah" : pickOne(r, ["Riya Menon", "Arjun Bhat"]);
  const decidedAt = addDays(d.at, 3 + Math.floor(r() * 18));
  const at = decidedAt > DEMO_DATE ? DEMO_DATE : decidedAt;
  const fits = fitsRules(d, c.sector, c.country, DEFAULT_RULES);
  const roll = r();
  if (fits && roll < (c.fit === "Strong" ? 0.22 : c.fit === "Mixed" ? 0.06 : 0.01)) {
    c.outcome = "Meeting";
    c.meetingAt = at;
    return;
  }
  const hold = fits && roll > 1 - (c.fit === "Strong" ? 0.1 : c.fit === "Mixed" ? 0.08 : 0.03);
  const reason: PassReason = !fits ? "Outside focus" : hold ? "Too early" : weighted(r, c.fit === "Weak" ? { ...REASON_W, "Founder-market fit": 25 } : REASON_W);
  c.outcome = hold ? "On hold" : "Passed";
  c.decision = { status: hold ? "On hold" : "Passed", reason, note: "", trigger: TRIGGER_HINT[reason], checkOn: defaultCheckOn(reason, at), by: c.owner, at };

  // After the pass: did the company raise elsewhere, meet its trigger, grow, or close?
  const raiseP = RAISE_BASE[c.fit] * RAISE_MULT[reason];
  if (r() < raiseP) {
    const when = addDays(at, 30 + Math.floor(r() * 120));
    if (when <= DEMO_DATE) {
      const stage = NEXT_STAGE[d.stage] === "Series C or later" && d.stage === "Series C or later" ? d.stage : r() < 0.6 ? d.stage : NEXT_STAGE[d.stage];
      const [lo, hi] = ASK[stage];
      const amt = round50k(lo + r() * (hi - lo));
      c.signals.push({ kind: "Raised elsewhere", at: when, text: `Raised $${(amt / 1e6).toFixed(1)}M ${stage} from ${pickOne(r, INVESTORS)}`, source: "Funding database (sample)" });
    }
  }
  if (TRIGGER_TEXT[reason] && r() < 0.2) {
    const when = addDays(at, 30 + Math.floor(r() * 120));
    if (when <= DEMO_DATE) c.signals.push({ kind: "Trigger met", at: when, text: TRIGGER_TEXT[reason]!, source: "Founder email" });
  }
  if (r() < 0.08) {
    const when = addDays(at, 45 + Math.floor(r() * 120));
    const from = 6 + Math.floor(r() * 10);
    if (when <= DEMO_DATE) c.signals.push({ kind: "Team grew", at: when, text: `Team grew from ${from} to ${from * 2 + Math.floor(r() * 8)} people`, source: "Profile data (sample)" });
  }
  if (!c.signals.some((s) => s.kind === "Raised elsewhere") && r() < 0.04) {
    const when = addDays(at, 60 + Math.floor(r() * 100));
    if (when <= DEMO_DATE) c.signals.push({ kind: "Shut down", at: when, text: "Website down and a strike-off filed with the registry", source: "Company registry (sample)" });
  }
  c.signals.sort((a, b) => a.at.localeCompare(b.at));
}

/** The detailed samples and the hand-written passes, filed under the same sub-categories as the history. */
export const SUB_FOR: Record<string, string> = {
  ledgerly: "Accounting and finance software",
  mandiflow: "Farm-to-kitchen supply",
  remitwell: "Cross-border payroll",
  "sunroof-grid": "Rooftop solar",
  rostrly: "HR and payroll software",
  loomhaus: "Home goods",
  tutorbridge: "K-12 tutoring",
  clinicall: "Diagnostics",
  parkwise: "Parking",
  freightnest: "Freight software",
  "shelfsense-mail": "Supply chain software",
  kiranaloop: "Supply chain software",
  voltharbor: "EV charging",
  neuroquill: "Developer tools",
  agrisprout: "Crop testing",
  paydune: "SME lending",
  cartfable: "Kids",
  coldvine: "Cold chain",
  sunterrace: "Rooftop solar",
};

/** The earlier passes written by hand (with real notes) join the same history. */
function written(): FlowCompany[] {
  return PAST_DEALS.map((p) => ({
    id: p.id,
    name: p.name,
    domain: `${p.id}.example`,
    sector: p.sector,
    sub: SUB_FOR[p.id] ?? p.category,
    city: p.city,
    country: ["Dubai", "Abu Dhabi"].includes(p.city) ? "UAE" : ["Riyadh", "Jeddah"].includes(p.city) ? "Saudi Arabia" : "India",
    founder: "",
    email: "",
    fit: p.fit,
    repeat: false,
    tenPlus: false,
    decks: [{ at: p.receivedAt, stage: p.stage, askUsd: ASK[p.stage]?.[0] ?? 1_000_000, via: "Pitch email" as Via, file: `${p.name}-deck.pdf` }],
    owner: p.decision.by,
    outcome: p.decision.status,
    decision: p.decision,
    signals: p.since ? [{ kind: (p.since.meetsTrigger ? "Trigger met" : "Team grew") as SignalKind, at: p.since.when, text: p.since.what, source: "Founder email" }] : [],
    written: true,
  }));
}

export const FLOW: FlowCompany[] = [...generate(), ...written()];
const BY_ID = new Map(FLOW.map((c) => [c.id, c]));
export const flowById = (id: string) => BY_ID.get(id);

/** The status a history record starts with, before anyone changes it in this browser. */
export function flowStatus(id: string): DealStatus | undefined {
  const c = BY_ID.get(id);
  if (!c) return undefined;
  return c.outcome === "Passed" || c.outcome === "On hold" ? c.outcome : c.outcome === "Meeting" ? "Meeting set" : "New";
}

// ---------- Reading the history ----------

export const lastDeck = (c: Pick<FlowCompany, "decks">) => c.decks[c.decks.length - 1];
export const firstDeck = (c: Pick<FlowCompany, "decks">) => c.decks[0];

/** Points for looking again at a passed or held company, each with its reason, so the rank shows its working. */
export const LOOK_POINTS = { trigger: 3, raised: 3, again: 2, heating: 1, strong: 1, checkDue: 1 } as const;
/** "Look again now": at least this many points, from an event in the last LOOK_RECENT_DAYS days. */
export const LOOK_NOW = 5;
export const LOOK_RECENT_DAYS = 60;
const EVENTS: SignalKind[] = ["Trigger met", "Raised elsewhere", "Pitched again"];

export function lookAgain(
  c: { decision?: Decision; outcome: Outcome; signals: FlowSignal[]; sector: string; fit: FitLevel | null },
  heating: Set<string>,
  today = DEMO_DATE,
): { points: number; parts: [string, number][]; event: boolean; now: boolean; latest?: FlowSignal } {
  const parts: [string, number][] = [];
  const d = c.decision;
  if (!d || (c.outcome !== "Passed" && c.outcome !== "On hold") || c.signals.some((s) => s.kind === "Shut down")) return { points: 0, parts, event: false, now: false };
  const after = c.signals.filter((s) => s.at >= d.at && s.at <= today);
  if (after.some((s) => s.kind === "Trigger met")) parts.push(["Trigger met", LOOK_POINTS.trigger]);
  if (after.some((s) => s.kind === "Raised elsewhere")) parts.push(["Raised elsewhere", LOOK_POINTS.raised]);
  if (after.some((s) => s.kind === "Pitched again")) parts.push(["Pitched again", LOOK_POINTS.again]);
  const event = parts.length > 0;
  if (heating.has(c.sector)) parts.push([`${c.sector} heating up`, LOOK_POINTS.heating]);
  if (c.fit === "Strong") parts.push(["Strong founder-market fit", LOOK_POINTS.strong]);
  if (d.checkOn && d.checkOn <= today) parts.push(["Check date passed", LOOK_POINTS.checkDue]);
  const points = parts.reduce((s, [, n]) => s + n, 0);
  const latest = after.filter((s) => EVENTS.includes(s.kind)).at(-1);
  const now = Boolean(latest && daysBetween(latest.at, today) <= LOOK_RECENT_DAYS && points >= LOOK_NOW);
  return { points, parts, event, now, latest };
}

/** Of the companies passed for each reason, how many later raised from someone else. */
export function missRate(companies: FlowCompany[]): { reason: PassReason; passes: number; raised: number; rate: number }[] {
  const by = new Map<PassReason, { passes: number; raised: number }>();
  for (const c of companies) {
    if (c.outcome !== "Passed" || !c.decision) continue;
    const row = by.get(c.decision.reason) ?? { passes: 0, raised: 0 };
    row.passes++;
    if (c.signals.some((s) => s.kind === "Raised elsewhere" && s.at >= c.decision!.at)) row.raised++;
    by.set(c.decision.reason, row);
  }
  return [...by.entries()].map(([reason, x]) => ({ reason, ...x, rate: x.passes ? x.raised / x.passes : 0 })).sort((a, b) => b.rate - a.rate);
}

/** Decks per sector per month (counting every deck, re-pitches too), over MONTHS. */
export function deckCounts(items: { sector: string; dates: string[] }[]): Record<string, number[]> {
  const out: Record<string, number[]> = Object.fromEntries(MARKET.map((m) => [m.sector, MONTHS.map(() => 0)]));
  for (const it of items)
    for (const d of it.dates) {
      const i = MONTHS.indexOf(d.slice(0, 7));
      if (i >= 0) (out[it.sector] ??= MONTHS.map(() => 0))[i]++;
    }
  return out;
}

export const VIA_HELP: Record<Via, string> = {
  "Pitch email": "Emailed to the fund's pitch address",
  "Partner email": "Emailed to a partner's own inbox",
  "Website link": "Sent through the pitch link on the website",
  "Analyst link": "Sent through an analyst's own pitch link",
  Intro: "Introduced by someone the fund knows",
};
