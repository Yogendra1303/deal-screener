/**
 * Deterministic Institutional Cap Table, SAFE & Series A Pro-Rata Dilution Engine.
 * Guarantees finite numbers (never NaN or Infinity) for any valid user input.
 */

export type RoundInstrument = "priced" | "post_safe" | "pre_safe";

export interface CapTableInput {
  instrument: RoundInstrument;
  /** Pre-money valuation for priced round, OR valuation cap for post-money SAFE (USD). */
  valuationUsd: number;
  /** Total round size being raised (USD). */
  roundSizeUsd: number;
  /** Fund's investment check (USD). */
  fundCheckUsd: number;
  /** Target post-round option pool % (e.g. 10 for 10%). Applied on priced rounds. */
  optionPoolPct: number;
  /** SAFE discount % (0-35). */
  discountPct: number;
  /** Existing founder ownership % prior to this round (default 100%). */
  existingFoundersPct: number;
  /** Hypothetical next-round (Series A) pre-money valuation (USD). */
  nextRoundPreMoneyUsd: number;
  /** Hypothetical next-round (Series A) raise size (USD). */
  nextRoundSizeUsd: number;
}

export interface CapTableOutput {
  postMoneyUsd: number;
  fundOwnershipPct: number;
  totalNewInvestorPct: number;
  optionPoolPct: number;
  foundersPostRoundPct: number;
  otherExistingPct: number;
  /** Series A Pro-Rata simulation */
  nextRoundPostMoneyUsd: number;
  proRataCheckRequiredUsd: number;
  ownershipWithoutProRataPct: number;
  ownershipWithProRataPct: number;
  impliedStepUpMultiple: number;
  fundStakeValueAtNextRoundUsd: number;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function calculateCapTable(input: CapTableInput): CapTableOutput {
  const valuation = Math.max(100_000, Number(input.valuationUsd) || 0);
  const roundSize = Math.max(0, Number(input.roundSizeUsd) || 0);
  const fundCheck = clamp(Number(input.fundCheckUsd) || 0, 0, Math.max(roundSize, Number(input.fundCheckUsd) || 0));
  const optionPoolTarget = clamp(Number(input.optionPoolPct) || 0, 0, 30);
  const discount = clamp(Number(input.discountPct) || 0, 0, 50);
  const existingFounders = clamp(Number(input.existingFoundersPct) || 100, 10, 100);

  let postMoneyUsd: number;
  let totalNewInvestorPct: number;
  let fundOwnershipPct: number;
  let optionPoolPct: number;

  if (input.instrument === "post_safe") {
    // YC Post-Money SAFE: investor ownership = check / effective post-money cap
    const effectiveCap = valuation * (1 - discount / 100);
    postMoneyUsd = Math.max(effectiveCap, roundSize);
    totalNewInvestorPct = clamp((roundSize / postMoneyUsd) * 100, 0, 80);
    fundOwnershipPct = clamp((fundCheck / postMoneyUsd) * 100, 0, totalNewInvestorPct);
    optionPoolPct = optionPoolTarget;
  } else if (input.instrument === "pre_safe") {
    // Classic Pre-Money SAFE: Pre-money cap + Round Size = Implied Post-Money Valuation
    const effectivePreCap = valuation * (1 - discount / 100);
    postMoneyUsd = effectivePreCap + roundSize;
    totalNewInvestorPct = postMoneyUsd > 0 ? clamp((roundSize / postMoneyUsd) * 100, 0, 80) : 0;
    fundOwnershipPct = postMoneyUsd > 0 ? clamp((fundCheck / postMoneyUsd) * 100, 0, totalNewInvestorPct) : 0;
    optionPoolPct = optionPoolTarget;
  } else {
    // Priced equity round: Post-money = Pre-money + Round size
    postMoneyUsd = valuation + roundSize;
    totalNewInvestorPct = postMoneyUsd > 0 ? clamp((roundSize / postMoneyUsd) * 100, 0, 80) : 0;
    fundOwnershipPct = postMoneyUsd > 0 ? clamp((fundCheck / postMoneyUsd) * 100, 0, totalNewInvestorPct) : 0;
    optionPoolPct = optionPoolTarget;
  }

  const remainingForExisting = Math.max(0, 100 - totalNewInvestorPct - optionPoolPct);
  const foundersPostRoundPct = remainingForExisting * (existingFounders / 100);
  const otherExistingPct = Math.max(0, remainingForExisting - foundersPostRoundPct);

  // Series A Pro-Rata Simulator
  const nextPre = Math.max(postMoneyUsd, Number(input.nextRoundPreMoneyUsd) || postMoneyUsd * 2.5);
  const nextRaise = Math.max(0, Number(input.nextRoundSizeUsd) || roundSize * 3);
  const nextPost = nextPre + nextRaise;
  const nextDilutionFactor = nextPost > 0 ? nextPre / nextPost : 1;

  const ownershipWithoutProRataPct = fundOwnershipPct * nextDilutionFactor;
  const proRataCheckRequiredUsd = nextRaise * (fundOwnershipPct / 100);
  const ownershipWithProRataPct = fundOwnershipPct;
  const impliedStepUpMultiple = postMoneyUsd > 0 ? nextPre / postMoneyUsd : 1;
  const fundStakeValueAtNextRoundUsd = (ownershipWithoutProRataPct / 100) * nextPost;

  const r1 = (v: number) => Math.round(v * 10) / 10;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    postMoneyUsd: Math.round(postMoneyUsd),
    fundOwnershipPct: r2(fundOwnershipPct),
    totalNewInvestorPct: r2(totalNewInvestorPct),
    optionPoolPct: r2(optionPoolPct),
    foundersPostRoundPct: r2(foundersPostRoundPct),
    otherExistingPct: r2(otherExistingPct),
    nextRoundPostMoneyUsd: Math.round(nextPost),
    proRataCheckRequiredUsd: Math.round(proRataCheckRequiredUsd),
    ownershipWithoutProRataPct: r2(ownershipWithoutProRataPct),
    ownershipWithProRataPct: r2(ownershipWithProRataPct),
    impliedStepUpMultiple: r1(impliedStepUpMultiple),
    fundStakeValueAtNextRoundUsd: Math.round(fundStakeValueAtNextRoundUsd),
  };
}
