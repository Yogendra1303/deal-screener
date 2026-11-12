import type { Assessment, DealRecord, Research } from "./schema";

export type Level = "Strong" | "Mixed" | "Weak" | "Not enough info";
export type Band = "Priority" | "Review" | "Outside focus";
export type ScoreKey = "fit" | "traction" | "consistency" | "team" | "completeness";

export type CheckId =
  | "revenue_deck_vs_sheet"
  | "growth_deck_vs_sheet"
  | "customers_deck_vs_sheet"
  | "team_deck_vs_sheet"
  | "arr_vs_mrr_maths"
  | "runway_maths"
  | "round_deck_vs_form"
  | "founded_vs_registry"
  | "founder_vs_profile"
  | "missing_core_facts";

export const CHECK_LABELS: Record<CheckId, string> = {
  revenue_deck_vs_sheet: "Revenue: deck vs monthly sheet",
  growth_deck_vs_sheet: "Growth: deck vs monthly sheet",
  customers_deck_vs_sheet: "Customers: deck vs monthly sheet",
  team_deck_vs_sheet: "Team size: deck vs monthly sheet",
  arr_vs_mrr_maths: "Deck maths: annual vs monthly revenue",
  runway_maths: "Deck maths: runway vs cash and burn",
  round_deck_vs_form: "Round size: deck vs form",
  founded_vs_registry: "Founding date: deck vs registry",
  founder_vs_profile: "Founder roles: deck vs profile",
  missing_core_facts: "Missing core facts",
};

export interface SourceRef {
  label: string; // "Deck", "Monthly sheet", "Form", "Registry (sample)", "Profile (sample)"
  value: string;
  page?: number | null;
  quote?: string | null;
}

export interface Flag {
  checkId: CheckId;
  kind: "conflict" | "missing";
  title: string;
  detail: string;
  sources: SourceRef[];
}

export interface FounderInput {
  name: string;
  profileUrl: string;
}

export interface FormInput {
  companyName: string;
  website: string;
  country: string;
  sector: string;
  stage: string;
  amountUsd: number | null;
  founders: FounderInput[];
  email: string;
}

export interface SheetRow {
  month: string; // YYYY-MM
  currency: string;
  revenue: number | null;
  customers: number | null;
  headcount: number | null;
  netBurn: number | null;
  cash: number | null;
}

export interface RegistryRecord {
  legalName: string;
  incorporated: string; // YYYY-MM-DD
  country: string;
  status: string;
  directors: string[];
  source: string;
}

export interface ProfileRole {
  company: string;
  title: string;
  start: string; // YYYY-MM
  end: string | null;
}

export interface Profile {
  name: string;
  headline: string;
  roles: ProfileRole[];
  source: string;
}

export interface Score {
  key: ScoreKey;
  label: string;
  level: Level;
  reason: string;
  evidence: string[];
  by: "Code" | "AI";
}

export interface RunStep {
  step: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  webSearches?: number;
  costUsd?: number;
}

export interface DealResult {
  id: string;
  source: "sample" | "upload";
  receivedAt: string; // ISO
  processedAt: string; // ISO
  model: string;
  /** "chat": screened in a Claude chat on the user's account instead of the API, so no time or cost was measured. */
  processedBy?: "api" | "chat";
  form: FormInput;
  deck: { fileName: string; url: string | null };
  record: DealRecord;
  sheet: SheetRow[] | null;
  registry: RegistryRecord | null;
  profiles: Profile[];
  flags: Flag[];
  ai: Assessment;
  scores: Score[];
  band: Band;
  bandReasons: string[];
  research: Research | null;
  runLog: RunStep[];
}

/** Where the team is with a request. Kept in this browser only. */
export type DealStatus = "New" | "Reviewing" | "Meeting set" | "On hold" | "Passed";
export const STATUSES: DealStatus[] = ["New", "Reviewing", "Meeting set", "On hold", "Passed"];

export interface FundRules {
  stages: string[];
  countries: string[];
  sectors: string[];
  minRoundUsd: number;
  maxRoundUsd: number;
}

export interface Overrule {
  band?: Band;
  /** Levels a person set by hand, over what the code or the AI scored. The original stays on the deal. */
  scores?: Partial<Record<ScoreKey, Level>>;
  note: string;
  by: string;
  at: string; // ISO
}

export const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Series C or later"];
export const COUNTRIES = ["India", "UAE", "Saudi Arabia", "Qatar", "Singapore", "UK", "USA", "Other"];
export const SECTORS = [
  "B2B software",
  "Fintech",
  "Mobility",
  "Logistics",
  "Climate",
  "Food supply",
  "Consumer brands",
  "Edtech",
  "Healthtech",
  "Other",
];
