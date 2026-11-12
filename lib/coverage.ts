// What the code checks covered for one deal: which checks ran, which passed, which flagged, and which facts
// are missing. Plain code over the same inputs runChecks uses; it adds no new judgement.
import type { DealRecord } from "./schema";
import { rowFor, sheetGrowth } from "./sheet";
import { missingCoreFacts } from "./rules";
import type { CheckId, Flag, FormInput, RegistryRecord, SheetRow } from "./types";

export interface CheckLine {
  id: CheckId;
  /** Short plain name, e.g. "Revenue: deck vs sheet". */
  label: string;
  ran: boolean;
  passed: boolean;
  /** Why it could not run, when it didn't. */
  why?: string;
}

export interface Coverage {
  lines: CheckLine[];
  ran: number;
  passed: number;
  flags: Flag[];
  missing: string[];
}

const NAMES: Partial<Record<CheckId, string>> = {
  revenue_deck_vs_sheet: "Revenue: deck vs sheet",
  growth_deck_vs_sheet: "Growth: deck vs sheet",
  customers_deck_vs_sheet: "Customers: deck vs sheet",
  team_deck_vs_sheet: "Team size: deck vs sheet",
  arr_vs_mrr_maths: "Annual vs monthly revenue maths",
  runway_maths: "Runway vs cash and burn",
  round_deck_vs_form: "Round size: deck vs form",
  founded_vs_registry: "Founding year vs registry",
};

export function coverage(a: { record: DealRecord; form: FormInput; sheet: SheetRow[] | null; registry: RegistryRecord | null; flags: Flag[] }): Coverage {
  const t = a.record.traction;
  const sheet = a.sheet && a.sheet.length ? a.sheet : null;
  const noSheet = "No monthly sheet on file";
  const line = (id: CheckId, ran: boolean, why: string): CheckLine => ({
    id,
    label: NAMES[id]!,
    ran,
    passed: ran && !a.flags.some((f) => f.checkId === id),
    why: ran ? undefined : why,
  });
  const revenue = t.mrr.amount != null ? t.mrr : t.arr.amount != null ? t.arr : null;
  const lines: CheckLine[] = [
    line("revenue_deck_vs_sheet", Boolean(sheet && revenue && rowFor(sheet, "revenue", revenue.asOf)), !sheet ? noSheet : "Revenue not stated"),
    line("growth_deck_vs_sheet", Boolean(sheet && t.monthlyGrowthPct.value != null && sheetGrowth(sheet)), !sheet ? noSheet : "Growth not stated"),
    line("customers_deck_vs_sheet", Boolean(sheet && t.customers.value != null && rowFor(sheet, "customers", t.customers.asOf)), !sheet ? noSheet : "Customers not stated"),
    line("team_deck_vs_sheet", Boolean(sheet && t.teamSize.value != null && rowFor(sheet, "headcount", t.teamSize.asOf)), !sheet ? noSheet : "Team size not stated"),
    line("arr_vs_mrr_maths", Boolean(t.mrr.amount && t.arr.amount), "Deck gives only one revenue figure"),
    line("runway_maths", Boolean(t.cash.amount && t.monthlyBurn.amount && t.runwayMonths.value != null), "Cash, burn or runway not stated"),
    line("round_deck_vs_form", Boolean(a.record.round.amount.amount && a.form.amountUsd), "Round size missing from deck or form"),
    line("founded_vs_registry", Boolean(a.registry && a.record.company.foundedYear.value != null), !a.registry ? "No registry record on file" : "Founding year not stated"),
  ];
  const ran = lines.filter((l) => l.ran);
  return { lines, ran: ran.length, passed: ran.filter((l) => l.passed).length, flags: a.flags, missing: missingCoreFacts(a.record) };
}
