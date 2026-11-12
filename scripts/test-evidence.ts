// The evidence matrix must agree with the engine, row for row, and must state edge cases honestly
// (audit section 9: 9.9 / 10 / 10.1% boundaries, zero and missing baselines, currency and period mismatch).
// Code only, no AI and no network. Run with `npm test`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { SAMPLES, ANSWER_KEY, SEED_RESULTS } from "../lib/data";
import { recordFromGold } from "../lib/gold";
import { runChecks } from "../lib/checks";
import { parseSheet } from "../lib/sheet";
import { findRegistry } from "../lib/fixtures";
import { evidenceMatrix } from "../lib/evidence-matrix";
import type { DealRecord } from "../lib/schema";
import type { FormInput, SheetRow } from "../lib/types";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failed++;
}

const conflictsOf = (args: Parameters<typeof runChecks>[0]) => {
  const engine = [...new Set(runChecks(args).filter((f) => f.kind === "conflict").map((f) => f.checkId))].sort();
  const matrix = evidenceMatrix(args).filter((r) => r.state === "conflict").map((r) => r.checkId).sort();
  return { engine, matrix };
};

// 1. Agreement with the engine on every test deck (perfect readings) and on the screened Ledgerly result.
for (const s of SAMPLES) {
  const sheet = s.sheetFile ? parseSheet(readFileSync(path.join("public", "samples", s.sheetFile), "utf8")) : null;
  const args = { record: recordFromGold(ANSWER_KEY[s.id].gold, s.form.companyName), form: s.form, sheet, registry: findRegistry(s.form.companyName) };
  const { engine, matrix } = conflictsOf(args);
  check(`evidence matrix agrees with engine: ${s.id}`, JSON.stringify(engine) === JSON.stringify(matrix), `engine [${engine}] matrix [${matrix}]`);
}
for (const [id, d] of Object.entries(SEED_RESULTS)) {
  const { engine, matrix } = conflictsOf({ record: d.record, form: d.form, sheet: d.sheet, registry: d.registry });
  check(`evidence matrix agrees with engine: ${id} (screened)`, JSON.stringify(engine) === JSON.stringify(matrix), `engine [${engine}] matrix [${matrix}]`);
}

// 2. Ledgerly: ₹7.5 Cr ARR against Sep 2026 × 12 = ₹5.76 Cr, +30.2%, labelled as a run-rate.
{
  const d = SEED_RESULTS.ledgerly;
  const rev = evidenceMatrix({ record: d.record, form: d.form, sheet: d.sheet, registry: d.registry }).find((r) => r.checkId === "revenue_deck_vs_sheet")!;
  check("ledgerly: revenue is a conflict", rev.state === "conflict");
  check("ledgerly: variance is (7.5 − 5.76) ÷ 5.76 = +30.2%", rev.variance != null && Math.abs(rev.variance - (7.5 - 5.76) / 5.76) < 1e-9 && rev.varianceText === "+30.2%", rev.varianceText);
  check("ledgerly: support is the annualised run-rate, not ARR", /× 12, an annualised run-rate, not recognised ARR/.test(rev.supportSource), rev.supportSource);
  check("ledgerly: formula is written out", rev.formula === "(₹7.5 Cr − ₹5.76 Cr) ÷ ₹5.76 Cr × 100 = +30.2%", rev.formula ?? "");
  check("ledgerly: the sheet is called corroboration, not verification", /not independent verification/.test(rev.note ?? ""));
}

// 3. Edge cases on a synthetic deck, built from the Ledgerly record so the shape is real.
const base = SEED_RESULTS.ledgerly;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
function deckWithMrr(amount: number | null, currency = "USD", asOf: string | null = "2026-09"): DealRecord {
  const r = clone(base.record);
  r.traction.mrr = { amount, currency, asOf, page: 3, quote: "test" };
  r.traction.arr = { amount: null, currency: null, asOf: null, page: null, quote: null };
  return r;
}
const sheetOf = (revenue: number | null, currency = "USD", month = "2026-09"): SheetRow[] => [{ month, currency, revenue, customers: null, headcount: null, netBurn: null, cash: null }];
const form: FormInput = clone(base.form);
const revRow = (record: DealRecord, sheet: SheetRow[] | null) => evidenceMatrix({ record, form, sheet, registry: null }).find((r) => r.checkId === "revenue_deck_vs_sheet")!;
const engineFlags = (record: DealRecord, sheet: SheetRow[] | null) => runChecks({ record, form, sheet, registry: null }).some((f) => f.checkId === "revenue_deck_vs_sheet");

for (const [deck, label, expect] of [
  [109900, "9.9%", "match"],
  [110000, "10.0% exactly", "match"],
  [110100, "10.1%", "conflict"],
] as const) {
  const r = revRow(deckWithMrr(deck), sheetOf(100000));
  check(`threshold: ${label} over the sheet is ${expect} (strictly > 10%)`, r.state === expect && engineFlags(deckWithMrr(deck), sheetOf(100000)) === (expect === "conflict"), `${r.state} ${r.varianceText}`);
}
check("threshold: 10.1% under the sheet is a conflict too", revRow(deckWithMrr(89900), sheetOf(100000)).state === "conflict");
{
  const r = revRow(deckWithMrr(50000), sheetOf(0));
  check("zero baseline: sheet revenue 0 is N/A, never Infinity", r.state === "not_run" && r.varianceText === "N/A" && r.variance === null);
}
check("missing baseline: no sheet is N/A with a reason", revRow(deckWithMrr(50000), null).state === "not_run" && /No monthly sheet/.test(revRow(deckWithMrr(50000), null).note ?? ""));
check("missing claim: no deck revenue is N/A", revRow(deckWithMrr(null), sheetOf(100000)).state === "not_run");
{
  const r = revRow(deckWithMrr(50000, "USD"), sheetOf(4000000, "INR"));
  check("currency mismatch: does not run and says why", r.state === "not_run" && /Currency differs/.test(r.note ?? "") && !engineFlags(deckWithMrr(50000, "USD"), sheetOf(4000000, "INR")));
}
{
  const r = revRow(deckWithMrr(100000, "USD", "2026-06"), sheetOf(100000, "USD", "2026-09"));
  check("period mismatch: compared with the nearest row and the gap in dates is stated", r.state === "match" && /Period differs/.test(r.note ?? ""), r.note ?? "");
}
{
  const r = revRow(deckWithMrr(80000), sheetOf(100000));
  check("negative variance keeps its sign: −20.0%", r.varianceText === "−20.0%" && r.state === "conflict", r.varianceText);
}
{
  const rec = clone(base.record);
  rec.traction.cash = { amount: 1000000, currency: "USD", asOf: null, page: 1, quote: "" };
  rec.traction.monthlyBurn = { amount: 0, currency: "USD", asOf: null, page: 1, quote: "" };
  rec.traction.runwayMonths = { value: 12, asOf: null, page: 1, quote: "" };
  const r = evidenceMatrix({ record: rec, form, sheet: null, registry: null }).find((x) => x.checkId === "runway_maths")!;
  check("zero burn: runway check is N/A, never Infinity months", r.state === "not_run" && !/Infinity/.test(JSON.stringify(r)));
}
{
  const g = evidenceMatrix({ record: base.record, form, sheet: base.sheet, registry: base.registry }).find((r) => r.checkId === "growth_deck_vs_sheet")!;
  check("rounding: a near-zero difference reads 0.0, never −0.0", !/−0\.0(?!\d)/.test(g.varianceText), g.varianceText);
}
check("every row has a rule and a source", evidenceMatrix({ record: base.record, form, sheet: base.sheet, registry: base.registry }).every((r) => r.rule && r.supportSource));
check("never Infinity or NaN anywhere", !/Infinity|NaN/.test(JSON.stringify(evidenceMatrix({ record: deckWithMrr(5), form, sheet: sheetOf(0), registry: null }))));

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
