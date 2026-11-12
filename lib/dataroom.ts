// The data room's filing plan: every file a founder sends goes into one of a few numbered folders, the
// way a diligence data room is laid out. Filing is done by code from what the file answers (a request
// line or a monthly report). Files that arrive by email are only suggested a folder from their name;
// a person at the fund files them. Nothing here reads the file itself.

export interface Folder {
  id: string;
  n: number;
  name: string;
  holds: string;
}

export const FOLDERS: Folder[] = [
  { id: "company", n: 1, name: "Pitch and company", holds: "Deck, plan, use of funds, the round" },
  { id: "financials", n: 2, name: "Financials", holds: "Revenue, profit and loss, bank statements, budgets, audits" },
  { id: "customers", n: 3, name: "Customers", holds: "Customer lists, cohorts, sales spend, references" },
  { id: "legal", n: 4, name: "Legal and ownership", holds: "Cap table, past rounds, incorporation, IP, licences" },
  { id: "reports", n: 5, name: "Monthly reports", holds: "MIS reports founders send each month" },
  { id: "board", n: 6, name: "Board and updates", holds: "Board decks and quarterly updates" },
];

export const TO_FILE = "to-file";

/** Diligence line or request item id -> folder. */
const BY_ID: Record<string, string> = {
  what: "company",
  size: "company",
  competition: "company",
  "why-now": "company",
  use: "company",
  round: "company",
  valuation: "company",
  founders: "company",
  "team-size": "company",
  revenue: "financials",
  growth: "financials",
  margin: "financials",
  burn: "financials",
  runway: "financials",
  "fy26-audit": "financials",
  "budget-27": "financials",
  "q3-accounts": "financials",
  customers: "customers",
  concentration: "customers",
  retention: "customers",
  unit: "customers",
  "customer-refs": "customers",
  equity: "legal",
  prior: "legal",
  incorporation: "legal",
  ip: "legal",
  licence: "legal",
  disputes: "legal",
  sha: "legal",
  "cap-table-now": "legal",
  "q3-cap": "legal",
  "founder-refs": "legal",
  "q3-board": "board",
  "q2-board": "board",
};

const BY_WORD: [RegExp, string][] = [
  [/board|quarter|\bq[1-4]\b/i, "board"],
  [/\bmis\b|monthly report/i, "reports"],
  [/cap[- ]?table|vesting|incorporat|sharehold|\bsha\b|esop|legal|\bip\b|licen[cs]e|litigation|director|safe|round/i, "legal"],
  [/customer|cohort|churn|retention|s&m|sales|marketing|reference/i, "customers"],
  [/bank|revenue|p&l|profit|loss|budget|audit|financ|burn|cash|accounts/i, "financials"],
  [/deck|pitch|plan|use of funds|one[- ]?pager/i, "company"],
];

/** Folder for a request line, from its diligence id first, then its words. */
export function folderFor(id: string | undefined, label: string): string {
  if (id && BY_ID[id]) return BY_ID[id];
  return guessFolder(label) ?? "company";
}

/** A suggestion from a file name or subject only. Shown as a suggestion; a person decides. */
export function guessFolder(text: string): string | undefined {
  for (const [re, f] of BY_WORD) if (re.test(text)) return f;
  return undefined;
}

export function folderName(id: string) {
  if (id === TO_FILE) return "To file";
  const f = FOLDERS.find((x) => x.id === id);
  return f ? `${f.n}. ${f.name}` : id;
}

/** Where a file came in. Shown next to every file so anyone can trace it back. */
export type Channel =
  | "Pitch form"
  | "Website pitch link"
  | "Analyst's pitch link"
  | "Pitch email"
  | "Partner email"
  | "Added by analyst"
  | "Request link"
  | "Email"
  | "Founder portal"
  | "Monthly report link"
  | "Asked by the fund";

export const CHANNEL_HELP: Record<Channel, string> = {
  "Pitch form": "The founder filled in the fund's pitch form",
  "Website pitch link": "The public 'Send us your pitch' link on the website",
  "Analyst's pitch link": "An analyst's personal pitch link",
  "Pitch email": "Emailed to the fund's pitch address",
  "Partner email": "Emailed to the partner's own inbox and picked up by the inbox sync",
  "Added by analyst": "An analyst uploaded it",
  "Request link": "The founder uploaded it on a request link the fund sent",
  Email: "The founder emailed it to the company's fund address",
  "Founder portal": "The founder added it after signing in to the founder portal",
  "Monthly report link": "Sent with the monthly report on the founder's report link",
  "Asked by the fund": "A document the fund asked for before this tool, recorded by hand",
};
