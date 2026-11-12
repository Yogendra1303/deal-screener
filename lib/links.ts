// Founder links: the only way founders reach the fund. Founders never sign in. The fund sends a link,
// the founder uploads what was asked (or says they don't have it), and the files land in the data room.
// One link is public: "Send us your pitch". Every other link is sent by an analyst.
// Files are kept as received and never edited. Fictional sample data; saved in this browser only.
import { addDays } from "./dates";
import { daysBetween } from "./portfolio/health";
import type { FormInput } from "./types";
import type { ManualReading } from "./upload";

export const FUND_NAME = "Sample Fund";
export const REPLY_PROMISE_DAYS = 14;

export interface LinkFile {
  name: string;
  size?: number;
  at: string; // YYYY-MM-DD
  /** Key of the file in this browser's storage. Missing on sample files that ship without a file. */
  key?: string;
  /** Where the server serves the file from, when a database holds it. Works from any browser. */
  url?: string;
  /** Set when the file came in by email and someone filed it against this line. */
  viaEmail?: string;
}

export interface RequestItem {
  id: string;
  label: string; // what the founder is asked for
  why?: string; // one line the founder sees
  /** The diligence line this answers (lib/diligence.ts item id), if any. */
  dd?: string;
}

export type FounderAnswer = "Sent" | "Don't have" | "Later";

export interface ItemAnswer {
  state: FounderAnswer;
  files: LinkFile[];
  note?: string;
  by?: string; // "Later": the date the founder promised
  at: string;
}

export interface FounderRequest {
  id: string; // the link token
  companyId: string;
  companyName: string;
  side: "pitch" | "portfolio";
  founder: string;
  from: string; // analyst who sent it
  sentAt: string;
  due: string;
  note: string;
  items: RequestItem[];
  answers: Record<string, ItemAnswer>;
  /** Item id -> who at the fund checked the file, and when. */
  checked: Record<string, { by: string; at: string }>;
  sample?: boolean;
}

export type PitchVia = "Website" | "Referral" | "Analyst" | "Email";

/** A pitch that came in through a link or an analyst, before the AI has read it. */
export interface Inbound {
  id: string;
  via: PitchVia;
  referrer?: string; // analyst whose personal link the founder used
  owner?: string;
  receivedAt: string; // ISO
  form: FormInput;
  oneLiner?: string;
  files: LinkFile[];
  /** Uploaded without the AI: deck numbers typed by the analyst, CSV parsed, checked by code. */
  manual?: ManualReading;
}

/** Files a founder emailed to the company's fund address, or added on the founder portal outside any request. */
export interface EmailIn {
  id: string;
  companyId: string;
  companyName: string;
  side: "pitch" | "portfolio";
  from: string; // email address
  subject: string;
  body?: string;
  at: string; // YYYY-MM-DD
  via: "Email" | "Founder portal";
  files: LinkFile[];
  /** File name -> where someone at the fund filed it. Until then the file sits in "To file". */
  filed: Record<string, { folder: string; answers?: string; answersLabel?: string; by: string; at: string }>;
  sample?: boolean;
}

/** Fictional addresses: each company gets one address that drops files straight into its data room. */
export const INBOX_DOMAIN = "in.samplefund.example";
export const PITCH_INBOX = `pitches@${INBOX_DOMAIN}`;

export function inboxAddress(companyName: string) {
  return `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}@${INBOX_DOMAIN}`;
}

/** The address the fund has on file for a founder. Fictional: first name at the company's sample domain. */
export function founderEmail(founder: string, companyName: string) {
  return `${founder.split(" ")[0].toLowerCase()}@${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`;
}

/** How a pitch reached the fund, in words. */
export function viaText(i: Inbound): string {
  if (i.via === "Website") return "Website pitch link";
  if (i.via === "Referral") return `${i.referrer?.split(" ")[0] ?? "An analyst"}'s pitch link`;
  if (i.via === "Email") return `Email to ${PITCH_INBOX}`;
  return "Added by an analyst";
}

export type ItemStatus = "Waiting" | "Overdue" | "Sent" | "Don't have" | "Later";

export function itemStatus(r: FounderRequest, itemId: string, today: string): ItemStatus {
  const a = r.answers[itemId];
  if (a) return a.state;
  return today > r.due ? "Overdue" : "Waiting";
}

export function requestSummary(r: FounderRequest, today: string) {
  const st = r.items.map((i) => itemStatus(r, i.id, today));
  const sent = st.filter((s) => s === "Sent").length;
  const answered = st.filter((s) => s === "Sent" || s === "Don't have" || s === "Later").length;
  const waiting = st.filter((s) => s === "Waiting" || s === "Overdue").length;
  const unchecked = r.items.filter((i) => r.answers[i.id]?.state === "Sent" && !r.checked[i.id]).length;
  return {
    asked: r.items.length,
    sent,
    answered,
    waiting,
    unchecked,
    overdueDays: waiting && today > r.due ? daysBetween(r.due, today) : 0,
    daysOpen: daysBetween(r.sentAt, today),
  };
}

/** What to ask for when the AI hasn't read the deck yet: the usual first-look pack. */
export const FIRST_LOOK: RequestItem[] = [
  { id: "revenue", dd: "revenue", label: "Monthly revenue for the last 12 months", why: "Shows how real and steady the revenue is." },
  { id: "customers", dd: "customers", label: "Customer list with monthly revenue per customer", why: "Shows who pays and how much depends on a few customers." },
  { id: "burn", dd: "burn", label: "Monthly profit and loss, last 12 months", why: "Shows how much cash goes out each month." },
  { id: "equity", dd: "equity", label: "Cap table with every holder, and founder vesting", why: "Shows who owns what before the round." },
  { id: "use", dd: "use", label: "Use of funds and the 18 to 24 month plan", why: "Shows what the money buys and the next milestone." },
];

/** What the fund collects from portfolio companies once a year, beyond monthly reports. */
export const PORTFOLIO_YEARLY: RequestItem[] = [
  { id: "fy26-audit", label: "Audited FY26 financials", why: "Needed for the fund's own yearly accounts." },
  { id: "cap-table-now", label: "Current cap table", why: "Keeps the fund's ownership figure right after any new shares." },
  { id: "q3-board", label: "Q3 board deck", why: "The quarter's plan against actuals, in the founders' words." },
  { id: "budget-27", label: "Budget for the next 12 months", why: "Lets the fund see the plan before the year starts." },
];

/** Ready-made request lists. An analyst picks one, unticks what isn't needed, and the founder gets one link. */
export interface RequestTemplate {
  key: string;
  name: string;
  when: string;
  side: "pitch" | "portfolio";
  items: RequestItem[];
}

export const TEMPLATES: RequestTemplate[] = [
  { key: "first-look", name: "First look", when: "After the first call, before a partner meeting", side: "pitch", items: FIRST_LOOK },
  {
    key: "full-dd",
    name: "Full diligence",
    when: "Once the partner wants to go deeper",
    side: "pitch",
    items: [
      { id: "revenue", dd: "revenue", label: "Monthly revenue for the last 12 months, and 6 months of bank statements", why: "Deck revenue often includes one-offs." },
      { id: "concentration", dd: "concentration", label: "Revenue by customer for the last 6 months", why: "Shows how much rides on the top few customers." },
      { id: "retention", dd: "retention", label: "Cohort table: revenue by month of first purchase", why: "Shows whether customers stay and spend more." },
      { id: "margin", dd: "margin", label: "Profit and loss statement, monthly, last 12 months", why: "Shows gross margin after delivery costs." },
      { id: "unit", dd: "unit", label: "Sales and marketing spend by month, and new customers by month", why: "Shows what a customer costs to win." },
      { id: "runway", dd: "runway", label: "Latest bank balance and the burn plan", why: "Shows how long the money lasts without this round." },
      { id: "prior", dd: "prior", label: "List of past rounds with investors, amounts and instruments", why: "Earlier terms carry into this round." },
      { id: "customer-refs", dd: "customer-refs", label: "3 customers the fund can call, including one who nearly left", why: "The fastest check on whether the product is needed." },
    ],
  },
  {
    key: "term-sheet",
    name: "Before a term sheet",
    when: "Legal and ownership checks before money is committed",
    side: "pitch",
    items: [
      { id: "incorporation", dd: "incorporation", label: "Certificate of incorporation and list of directors", why: "Confirms the company the fund would invest in." },
      { id: "equity-fd", dd: "equity", label: "Fully diluted cap table, including the option pool and any notes or SAFEs", why: "The fund's ownership is worked out from this." },
      { id: "sha", label: "Current shareholders' agreement and articles", why: "Existing rights (vetoes, preferences) carry into this round." },
      { id: "ip", dd: "ip", label: "IP assignment agreements for founders and key contractors", why: "The company must own what it sells." },
      { id: "licence", dd: "licence", label: "Licences held or applied for, and any letters from regulators", why: "Regulated businesses can be stopped without them." },
      { id: "disputes", dd: "disputes", label: "Statement of pending litigation and tax filings for the last 2 years", why: "Surprises here can kill a deal after signing." },
    ],
  },
  {
    key: "quarterly",
    name: "Quarterly update",
    when: "Every quarter, on top of monthly reports",
    side: "portfolio",
    items: [
      { id: "q3-board", label: "Q3 board deck", why: "The quarter's plan against actuals, in the founders' words." },
      { id: "q3-accounts", label: "Management accounts for the quarter", why: "Lets the fund check the monthly numbers add up." },
      { id: "q3-cap", label: "Any change to the cap table this quarter", why: "Keeps the fund's ownership figure right." },
    ],
  },
  { key: "year-end", name: "Year end", when: "Once a year, for the fund's own accounts", side: "portfolio", items: PORTFOLIO_YEARLY },
];

export function newToken(companyId: string): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${companyId.slice(0, 12)}-${r}`;
}

export function slugOf(name: string) {
  return name.split(" ")[0].toLowerCase();
}

export function linkPath(r: FounderRequest | string) {
  return `/founder/request/${typeof r === "string" ? r : r.id}`;
}

/** Sample requests so the partner's view isn't empty on first load. Files are named but not included. */
export const SEED_REQUESTS: FounderRequest[] = [
  {
    id: "ledgerly-r1",
    companyId: "ledgerly",
    companyName: "Ledgerly",
    side: "pitch",
    founder: "Ananya Rao",
    from: "Riya Menon",
    sentAt: "2026-10-27",
    due: addDays("2026-10-27", 7),
    note: "Thanks for the deck. Before we meet, could you share these? Whatever you have is fine.",
    items: [
      { id: "revenue", dd: "revenue", label: "Monthly revenue for the last 12 months, and 6 months of bank statements", why: "Deck revenue often includes one-offs." },
      { id: "equity", dd: "equity", label: "Cap table with every holder, plus founder vesting terms", why: "Shows who owns what before the round." },
      { id: "retention", dd: "retention", label: "Cohort table: revenue by month of first purchase", why: "Shows whether customers stay and spend more." },
      { id: "unit", dd: "unit", label: "Sales and marketing spend by month, and new customers by month", why: "Shows what a customer costs to win." },
      { id: "prior", dd: "prior", label: "List of past rounds with investors, amounts and instruments", why: "Earlier terms carry into this round." },
    ],
    answers: {
      revenue: { state: "Sent", files: [{ name: "Ledgerly-revenue-Oct25-Sep26.xlsx", at: "2026-10-28" }, { name: "Ledgerly-bank-Apr-Sep26.pdf", at: "2026-10-28" }], at: "2026-10-28" },
      equity: { state: "Sent", files: [{ name: "Ledgerly-cap-table.pdf", at: "2026-10-28" }], at: "2026-10-28" },
      retention: { state: "Don't have", note: "We haven't built cohorts yet. Happy to walk through churn on the call.", files: [], at: "2026-10-28" },
    },
    checked: {},
    sample: true,
  },
  {
    id: "mandiflow-r1",
    companyId: "mandiflow",
    companyName: "Mandiflow",
    side: "pitch",
    founder: "Rahul Menon",
    from: "Arjun Bhat",
    sentAt: "2026-10-24",
    due: "2026-10-28",
    note: "Thanks for sending the deck. Could you share these before our call on 28 Oct?",
    items: [FIRST_LOOK[0], FIRST_LOOK[3], FIRST_LOOK[4]],
    answers: {},
    checked: {},
    sample: true,
  },
];

/** Sample files that arrived by email, so the "To file" step isn't empty on first load. */
export const SEED_EMAILS: EmailIn[] = [
  {
    id: "mail-sehatflow-1",
    companyId: "sehatflow",
    companyName: "Sehatflow",
    side: "portfolio",
    from: "omar@sehatflow.example",
    subject: "Q2 board deck, sorry for the delay",
    body: "Hi Riya, attaching the Q2 board deck. Apologies it took this long. Omar",
    at: "2026-10-28",
    via: "Email",
    files: [{ name: "Sehatflow-board-Q2-2026.pdf", at: "2026-10-28" }],
    filed: {},
    sample: true,
  },
  {
    id: "mail-ledgerly-1",
    companyId: "ledgerly",
    companyName: "Ledgerly",
    side: "pitch",
    from: "ananya@ledgerly.example",
    subject: "Sales and marketing numbers",
    body: "Hi Riya, ahead of the call, here is our sales and marketing spend and new customers by month.",
    at: "2026-10-29",
    via: "Email",
    files: [{ name: "Ledgerly-S&M-spend-and-new-customers.xlsx", at: "2026-10-29" }],
    filed: {},
    sample: true,
  },
];

/** A sample pitch that came in by email to the fund's pitch address. Nobody has picked it up yet. */
export const SEED_INBOUND: Inbound[] = [
  {
    id: "shelfsense-mail",
    via: "Email",
    receivedAt: "2026-10-28T09:40:00.000Z",
    form: {
      companyName: "Shelfsense",
      website: "shelfsense.example",
      country: "India",
      sector: "B2B software",
      stage: "Seed",
      amountUsd: 1500000,
      founders: [{ name: "Kunal Desai", profileUrl: "" }],
      email: "kunal@shelfsense.example",
    },
    oneLiner: "Shelf cameras that tell grocery brands when their products run out in a store",
    files: [{ name: "Shelfsense-seed-deck.pdf", at: "2026-10-28" }],
  },
];
