// The code checks alone, run on all 10 test decks with the correct numbers from each deck (the answer key's
// reading) instead of the AI's. It shows whether the maths and cross-checks catch what was planted.
// It says nothing about how well the AI reads decks: that is the screener test.
import { runChecks } from "./checks";
import { ANSWER_KEY, SAMPLES } from "./data";
import { findRegistry } from "./fixtures";
import { recordFromGold } from "./gold";
import type { CheckId, SheetRow } from "./types";

export interface PreviewDeck {
  id: string;
  name: string;
  planted: string;
  expected: CheckId[];
  found: CheckId[];
  caught: CheckId[];
  missed: CheckId[];
  falseAlarms: CheckId[];
}

export function checksPreview(sheetFor: (file: string) => SheetRow[] | null = () => null) {
  const decks: PreviewDeck[] = SAMPLES.map((s) => {
    const key = ANSWER_KEY[s.id];
    const sheet = s.sheetFile ? sheetFor(s.sheetFile) : null;
    const record = recordFromGold(key.gold, s.form.companyName);
    const found = [...new Set(runChecks({ record, form: s.form, sheet, registry: findRegistry(s.form.companyName) }).map((f) => f.checkId))];
    return {
      id: s.id,
      name: s.form.companyName,
      planted: key.planted,
      expected: key.issues,
      found,
      caught: key.issues.filter((i) => found.includes(i)),
      missed: key.issues.filter((i) => !found.includes(i)),
      falseAlarms: found.filter((f) => !key.issues.includes(f)),
    };
  });
  const planted = decks.reduce((n, d) => n + d.expected.length, 0);
  const caught = decks.reduce((n, d) => n + d.caught.length, 0);
  const aiOnly = decks.reduce((n, d) => n + d.missed.filter((m) => m === "founder_vs_profile").length, 0);
  return { decks, planted, caught, aiOnly, falseAlarms: decks.reduce((n, d) => n + d.falseAlarms.length, 0) };
}
