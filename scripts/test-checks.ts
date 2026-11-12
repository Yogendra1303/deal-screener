// Tests the code-only parts without calling the AI: sheet parsing, the cross-checks,
// fund rules and bands. Each sample deck is fed in as a perfect reading (the gold values),
// so every planted issue except the founder-profile one (an AI check) must be caught,
// and nothing else may be flagged.  Run with `npm test`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { SAMPLES, ANSWER_KEY } from "../lib/data";
import { recordFromGold } from "../lib/gold";
import { runChecks } from "../lib/checks";
import { parseSheet, sheetGrowth } from "../lib/sheet";
import { findProfiles, findRegistry } from "../lib/fixtures";
import { DEFAULT_RULES, bandFor, fitScore } from "../lib/rules";
import { fmtMoney } from "../lib/format";
import type { Score } from "../lib/types";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

// Formatting
check("₹ crore format", fmtMoney(75000000, "INR") === "₹7.5 Cr", fmtMoney(75000000, "INR"));
check("₹ lakh format", fmtMoney(4800000, "INR") === "₹48 L", fmtMoney(4800000, "INR"));
check("$ thousands format", fmtMoney(85000, "USD") === "$85K", fmtMoney(85000, "USD"));

// Sheet parsing
const messy = parseSheet('﻿Month,Revenue,Customers\n2026-2,"1,000",5\n2026-01,900,4\n');
check("sheet sorts months and strips commas", messy[0].month === "2026-01" && messy[1].revenue === 1000);
let threw = false;
try {
  parseSheet("date,amount\n2026-01,5\n");
} catch {
  threw = true;
}
check("sheet without month/revenue columns is refused", threw);

// Cross-checks on perfect readings
for (const s of SAMPLES) {
  const key = ANSWER_KEY[s.id];
  const sheet = s.sheetFile ? parseSheet(readFileSync(path.join("public", "samples", s.sheetFile), "utf8")) : null;
  const record = recordFromGold(key.gold, s.form.companyName);
  const flags = runChecks({ record, form: s.form, sheet, registry: findRegistry(s.form.companyName) });
  const found = [...new Set(flags.map((f) => f.checkId))].sort();
  const expected = key.issues.filter((c) => c !== "founder_vs_profile").sort();
  check(`checks: ${s.id}`, JSON.stringify(found) === JSON.stringify(expected), `found [${found}] expected [${expected}]`);
  if (sheet) {
    const g = sheetGrowth(sheet);
    check(`sheet growth computed: ${s.id}`, g != null && g.pct > 0, g ? `${g.pct.toFixed(1)}%` : "none");
  }
}

// Sample fixtures are found for every company and founder
for (const s of SAMPLES) {
  check(`registry record: ${s.id}`, findRegistry(s.form.companyName) != null);
  check(`profiles: ${s.id}`, findProfiles(s.form.founders.map((f) => f.name)).length === s.form.founders.length);
}

// Fund rules and bands
const fitOf = (id: string) => fitScore(SAMPLES.find((x) => x.id === id)!.form, DEFAULT_RULES).level;
check("Tutorbridge is outside focus (edtech)", fitOf("tutorbridge") === "Weak");
check("Clinicall is outside focus", fitOf("clinicall") === "Weak");
check("Parkwise fits", fitOf("parkwise") === "Strong");
const mk = (key: Score["key"], level: Score["level"]): Score => ({ key, label: key, level, reason: "", evidence: [], by: "Code" });
check("band: strong traction + mixed team = Priority", bandFor([mk("fit", "Strong"), mk("traction", "Strong"), mk("team", "Mixed")]).band === "Priority");
check("band: mixed traction = Review", bandFor([mk("fit", "Strong"), mk("traction", "Mixed"), mk("team", "Strong")]).band === "Review");
check("band: failed fit = Outside focus", bandFor([mk("fit", "Weak"), mk("traction", "Strong"), mk("team", "Strong")]).band === "Outside focus");

console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
