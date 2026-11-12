// A pitch uploaded in this browser without the AI: the analyst types the numbers the deck states,
// the monthly CSV is parsed, and the same check code runs. Nothing here guesses a number.
import { runChecks } from "./checks";
import { coverage, type Coverage } from "./coverage";
import { founderFit, type FitResult, type FounderProfile, type Relation } from "./funnel";
import { recordFromGold, type Gold } from "./gold";
import type { DealRecord } from "./schema";
import type { Flag, FormInput, SheetRow } from "./types";

export interface ManualReading {
  /** Numbers as the deck states them, typed by the analyst. Blank stays null. */
  gold: Gold;
  /** Month the deck's numbers are for (YYYY-MM). */
  asOf: string | null;
  sub: string;
  city: string;
  founders: FounderProfile[];
  sheet: SheetRow[] | null;
  sheetFile: string | null;
  deckFile: string | null;
  /** Who typed it. */
  by: string;
}

export interface UploadCheck {
  record: DealRecord;
  flags: Flag[];
  cover: Coverage;
  fit: FitResult | null;
}

export function checkUpload(form: FormInput, m: ManualReading): UploadCheck {
  const record = recordFromGold(m.gold, form.companyName);
  record.oneLiner = `${m.sub} in ${m.city || form.country}.`;
  if (m.asOf) for (const f of [record.traction.mrr, record.traction.arr]) if (f.amount != null) f.asOf = m.asOf;
  const flags = runChecks({ record, form, sheet: m.sheet, registry: null });
  return { record, flags, cover: coverage({ record, form, sheet: m.sheet, registry: null, flags }), fit: m.founders.length ? founderFit(m.founders) : null };
}

/** One founder from the upload form: years on this problem, how close it is, and whether they built a company before. */
export function founderFromInput(f: { name: string; past: string; years: number; relation: Relation; builtBefore: boolean }, year: number): FounderProfile {
  return {
    name: f.name,
    role: "Founder",
    past: f.past || "not stated",
    from: year - Math.max(0, f.years),
    to: year,
    relation: f.relation,
    why: "Typed from the deck's team page by the analyst.",
    ...(f.builtBefore ? { priorCompany: { what: "a company", sameSpace: f.relation === "direct" } } : {}),
  };
}

const CACHE = new Map<string, UploadCheck>();
export function checkUploadCached(id: string, form: FormInput, m: ManualReading): UploadCheck {
  const hit = CACHE.get(id);
  if (hit) return hit;
  const r = checkUpload(form, m);
  CACHE.set(id, r);
  return r;
}
