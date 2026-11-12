// Pure rules in plain code: fund focus, the three code-made scores, and the band.
// Client-safe, so the browser can re-run them when an analyst edits the fund rules.
import type { Band, DealResult, Flag, FormInput, FundRules, Level, Score } from "./types";
import type { DealRecord } from "./schema";

export const DEFAULT_RULES: FundRules = {
  stages: ["Pre-seed", "Seed", "Series A"],
  countries: ["India", "UAE", "Saudi Arabia"],
  sectors: [
    "B2B software",
    "Fintech",
    "Mobility",
    "Logistics",
    "Climate",
    "Food supply",
    "Consumer brands",
  ],
  minRoundUsd: 500_000,
  maxRoundUsd: 6_000_000,
};

export function usd(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${+(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

/** Fit with the fund's written rules, applied to the founder's form answers. */
export function fitScore(form: FormInput, rules: FundRules): Score {
  const misses: string[] = [];
  if (!rules.stages.includes(form.stage)) misses.push(`Stage ${form.stage} is outside ${rules.stages.join(", ")}`);
  if (!rules.countries.includes(form.country))
    misses.push(`Country ${form.country} is outside ${rules.countries.join(", ")}`);
  if (!rules.sectors.includes(form.sector)) misses.push(`Sector ${form.sector} is not in the fund's focus`);
  if (form.amountUsd != null) {
    if (form.amountUsd < rules.minRoundUsd)
      misses.push(`Round ${usd(form.amountUsd)} is below the ${usd(rules.minRoundUsd)} minimum`);
    if (form.amountUsd > rules.maxRoundUsd)
      misses.push(`Round ${usd(form.amountUsd)} is above the ${usd(rules.maxRoundUsd)} limit`);
  }
  return {
    key: "fit",
    label: "Fit with fund focus",
    level: misses.length ? "Weak" : "Strong",
    reason: misses.length
      ? misses.join(". ") + "."
      : `Fits the written rules: ${form.stage}, ${form.country}, ${form.sector}${
          form.amountUsd != null ? `, ${usd(form.amountUsd)} round` : ""
        }.`,
    evidence: ["Form answers", "Fund rules"],
    by: "Code",
  };
}

/** Core facts an analyst needs before a first call. */
export function missingCoreFacts(record: DealRecord): string[] {
  const t = record.traction;
  const missing: string[] = [];
  if (t.mrr.amount == null && t.arr.amount == null) missing.push("revenue");
  if (t.monthlyGrowthPct.value == null) missing.push("growth rate");
  if (t.customers.value == null) missing.push("number of customers");
  if (t.teamSize.value == null) missing.push("team size");
  if (record.round.amount.amount == null) missing.push("round size");
  if (record.company.foundedYear.value == null) missing.push("year founded");
  if (t.monthlyBurn.amount == null) missing.push("monthly burn");
  if (!record.team.some((f) => f.pastRoles.length > 0)) missing.push("founders' past roles");
  return missing;
}

export const MISSING_FLAG_THRESHOLD = 3;

export function completenessScore(record: DealRecord): Score {
  const missing = missingCoreFacts(record);
  const level: Level =
    missing.length === 0 ? "Strong" : missing.length < MISSING_FLAG_THRESHOLD ? "Mixed" : "Weak";
  return {
    key: "completeness",
    label: "Completeness",
    level,
    reason: missing.length
      ? `The deck doesn't state: ${missing.join(", ")}. These become questions for the founder.`
      : "All eight core facts are in the deck.",
    evidence: [`${8 - missing.length} of 8 core facts found`],
    by: "Code",
  };
}

export function consistencyScore(flags: Flag[]): Score {
  const conflicts = flags.filter((f) => f.kind === "conflict");
  const level: Level = conflicts.length === 0 ? "Strong" : conflicts.length === 1 ? "Mixed" : "Weak";
  return {
    key: "consistency",
    label: "Claim consistency",
    level,
    reason: conflicts.length
      ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} between the deck and other sources. A person should look before the first call.`
      : "No conflicts found between the deck, the form, the sheet and the sample records.",
    evidence: conflicts.map((f) => f.title),
    by: "Code",
  };
}

/** The band. Only a failed fit rule can put a deck outside focus; conflicts never move a deck down. */
export function bandFor(scores: Score[]): { band: Band; reasons: string[] } {
  const get = (k: Score["key"]) => scores.find((s) => s.key === k);
  const fit = get("fit");
  const traction = get("traction");
  const team = get("team");
  if (fit && fit.level === "Weak") return { band: "Outside focus", reasons: [fit.reason] };
  if (traction?.level === "Strong" && (team?.level === "Strong" || team?.level === "Mixed")) {
    return {
      band: "Priority",
      reasons: ["Fits the fund's focus", "Traction is strong", `Team is ${team.level.toLowerCase()}`],
    };
  }
  const reasons = ["Fits the fund's focus"];
  if (traction && traction.level !== "Strong") reasons.push(`Traction is ${traction.level.toLowerCase()}`);
  if (team && team.level !== "Strong" && team.level !== "Mixed") reasons.push(`Team is ${team.level.toLowerCase()}`);
  return { band: "Review", reasons };
}

/** Re-run the code-made parts with the current fund rules (used in the browser). */
export function rescore(deal: DealResult, rules: FundRules): DealResult {
  const scores = deal.scores.map((s) => (s.key === "fit" ? fitScore(deal.form, rules) : s));
  const { band, reasons } = bandFor(scores);
  return { ...deal, scores, band, bandReasons: reasons };
}
