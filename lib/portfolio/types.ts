// The portfolio side of the hub: companies the fund has backed, what they report each month,
// what the fund asked for, and how both sides keep in touch. Only two sides: fund and company.

export type MetricKey = "revenue" | "burn" | "cash" | "customers";

export const METRICS: { key: MetricKey; label: string; money: boolean }[] = [
  { key: "revenue", label: "Revenue (month)", money: true },
  { key: "burn", label: "Net burn (month)", money: true },
  { key: "cash", label: "Cash in bank", money: true },
  { key: "customers", label: "Paying customers", money: false },
];

/** A number the founder entered, the MIS page it sits on, and what that page shows if it differs. */
export interface ReportedNumber {
  value: number;
  page: number;
  /** What the MIS file shows on that page, when it differs from what the founder typed. */
  inFile?: number;
}

export interface MonthlyReport {
  month: string; // "2026-08": the month the report covers
  dueDate: string; // ISO date
  receivedAt: string | null;
  /** The founder told the fund in advance; the month doesn't count against them. */
  excused?: string;
  fileName?: string;
  pages?: number;
  numbers: Partial<Record<MetricKey, ReportedNumber>>;
  /** When someone at the fund marked it read or replied. */
  acknowledgedAt: string | null;
  /** A follow-up question from the fund about this report. */
  question?: { askedAt: string; text: string; answeredAt: string | null; answer?: string };
  reminders?: string[];
}

export type RequestKind = "Board deck" | "Financials" | "Cap table" | "Other";

/** Something the fund asked for outside the monthly report. */
export interface DocRequest {
  id: string;
  title: string;
  kind: RequestKind;
  askedAt: string;
  dueDate: string;
  receivedAt: string | null;
  fileName?: string;
  pages?: number;
  reminders?: string[];
}

export type AskTopic = "Intro to a customer" | "Intro to an investor" | "Advice" | "Template or playbook";
export const ASK_TOPICS: AskTopic[] = ["Intro to a customer", "Intro to an investor", "Advice", "Template or playbook"];

/** A founder asking the fund for help. */
export interface FounderAsk {
  id: string;
  openedAt: string;
  topic: AskTopic;
  text: string;
  answeredAt: string | null;
  outcome?: string;
}

export interface FundNote {
  date: string;
  author: string;
  text: string;
}

export interface PitchSnapshot {
  receivedAt: string;
  deckFile: string;
  band: "Priority" | "Review";
  meetingAt: string;
  /** What the deck said at the time, with its page. Monthly figures. */
  claims: Partial<Record<MetricKey, { value: number; page: number }>>;
  /** The deck's own revenue plan for a later month. */
  plan: { month: string; revenue: number; page: number };
}

export interface PortfolioCompany {
  id: string;
  name: string;
  oneLiner: string;
  sector: string;
  country: string;
  currency: string;
  website: string;
  founders: { name: string; role: string }[];
  owner: string; // analyst who looks after the company
  partner: string;
  investment: { date: string; round: string; amountUsd: number; ownershipPct: number };
  pitch: PitchSnapshot;
  reports: MonthlyReport[];
  requests: DocRequest[];
  asks: FounderAsk[];
  notes: FundNote[];
  /** A raise the founders have told the fund about, which needs a follow-on decision. */
  nextRound?: { round: string; when: string; source: string };
}

export interface Resource {
  id: string;
  kind: "Template" | "Playbook" | "Partner perk" | "Office hours";
  title: string;
  description: string;
  format: string;
}
