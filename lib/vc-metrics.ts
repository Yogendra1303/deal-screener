// Tier-1 Venture Capital Financial Metrics & Diligence Scorecard
// Implements standard benchmarks from Sequoia, Benchmark, Founders Fund, and Craft Ventures.
import type { SheetRow } from "./types";
import type { DealRecord } from "./schema";

export interface VCMetricsResult {
  // 1. Capital Efficiency & Burn Multiple
  burnMultiple: {
    value: number | null;
    formatted: string;
    tier: "Exceptional" | "Good" | "Elevated" | "High Burn Alarm" | "N/A";
    explanation: string;
    netBurn: number | null;
    netNewArr: number | null;
  };

  // 2. Runway & Zero Cash Date
  runway: {
    months: number | null;
    formatted: string;
    zeroCashDate: string | null;
    status: "Healthy" | "Adequate" | "Low" | "Critical";
    explanation: string;
  };

  // 3. Sales Efficiency / SaaS Magic Number
  magicNumber: {
    value: number | null;
    formatted: string;
    rating: "High Scaling Efficiency" | "Solid Expansion" | "CAC Friction" | "N/A";
    explanation: string;
  };

  // 4. Rule of 40 (Growth + FCF/EBITDA Margin)
  ruleOf40: {
    score: number | null;
    formatted: string;
    passes: boolean;
    explanation: string;
  };

  // 5. Implied Valuation, Check Size & Ownership
  ownership: {
    askAmount: number | null;
    impliedPostMoney: number | null;
    targetOwnershipPct: number | null;
    formattedOwnership: string;
    status: "Within Mandate (10-20%)" | "Sub-target (<10%)" | "High Dilution (>20%)" | "N/A";
  };

  // 6. ARR per Employee (Productivity)
  arrPerHeadcount: {
    value: number | null;
    formatted: string;
    tier: "High Productivity" | "Standard" | "Early Stage" | "N/A";
  };

  // 7. Overall VC Diligence Score (0 to 100)
  overallScore: number;
  verdict: "Strong Conviction" | "Investigate Further" | "Capital Efficiency Concern" | "Outside Mandate";
}

/**
 * Computes institutional venture capital metrics from financial sheet data and deal parameters.
 */
export function calculateVCMetrics(
  sheet: SheetRow[] | null,
  record?: Partial<DealRecord> | null,
  askAmount?: number | null
): VCMetricsResult {
  const rows = (sheet || []).filter((r) => r.revenue != null && r.revenue >= 0);
  const latestRow = rows.length ? rows[rows.length - 1] : null;
  const prevRow = rows.length >= 2 ? rows[rows.length - 2] : null;
  const firstRow = rows.length >= 4 ? rows[rows.length - 4] : rows[0]; // trailing 3-month or available window

  // Base numbers
  const currentRevenue = latestRow?.revenue ?? (record?.traction?.mrr?.amount ?? null);
  const currentARR = currentRevenue != null ? currentRevenue * 12 : null;
  const prevRevenue = prevRow?.revenue ?? null;
  const prevARR = prevRevenue != null ? prevRevenue * 12 : null;

  const currentBurn = latestRow?.netBurn != null ? Math.abs(latestRow.netBurn) : null;
  const currentCash = latestRow?.cash != null ? latestRow.cash : null;
  const headcount = latestRow?.headcount ?? null;

  // 1. Burn Multiple: Net Burn / Net New ARR
  // In VC: < 1.0x is elite, 1.0 - 1.5x is good, 1.5 - 2.0x is watch, > 2.0x is poor capital efficiency
  let burnMultipleVal: number | null = null;
  let netNewARR: number | null = null;

  if (currentARR != null && prevARR != null && currentBurn != null) {
    const periodMonths = 1; // month-on-month annualized
    netNewARR = (currentARR - prevARR);
    if (netNewARR > 0 && currentBurn > 0) {
      // Annualized burn / Annualized net new ARR (equivalent to monthly burn / monthly net new ARR)
      burnMultipleVal = Math.round(((currentBurn * 12) / netNewARR) * 10) / 10;
    }
  }

  let burnTier: VCMetricsResult["burnMultiple"]["tier"] = "N/A";
  let burnExplanation = "Insufficient revenue history to compute net new ARR vs burn.";

  if (burnMultipleVal !== null) {
    if (burnMultipleVal <= 1.0) {
      burnTier = "Exceptional";
      burnExplanation = `Burning $${burnMultipleVal.toFixed(1)} for every $1.00 of net new ARR (Top-quartile capital efficiency).`;
    } else if (burnMultipleVal <= 1.5) {
      burnTier = "Good";
      burnExplanation = `Burning $${burnMultipleVal.toFixed(1)} for every $1.00 of net new ARR (Healthy early-stage benchmark).`;
    } else if (burnMultipleVal <= 2.2) {
      burnTier = "Elevated";
      burnExplanation = `Burning $${burnMultipleVal.toFixed(1)} per $1.00 net new ARR. Monitor unit economics closely.`;
    } else {
      burnTier = "High Burn Alarm";
      burnExplanation = `High burn alert: Burning $${burnMultipleVal.toFixed(1)} per $1.00 net new ARR. Unsustainable without step-change growth.`;
    }
  }

  // 2. Runway & Zero Cash Date
  let runwayMonths: number | null = null;
  let zeroCashDate: string | null = null;
  let runwayStatus: VCMetricsResult["runway"]["status"] = "Adequate";
  let runwayExplanation = "No cash balance or burn provided.";

  if (currentCash != null && currentBurn != null && currentBurn > 0) {
    runwayMonths = Math.round((currentCash / currentBurn) * 10) / 10;
    
    // Compute Zero Cash Date
    const now = new Date();
    const zcd = new Date(now.getFullYear(), now.getMonth() + Math.floor(runwayMonths), 1);
    zeroCashDate = zcd.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    if (runwayMonths >= 18) {
      runwayStatus = "Healthy";
      runwayExplanation = `${runwayMonths.toFixed(1)} months remaining (${zeroCashDate}). Strong cushion for execution.`;
    } else if (runwayMonths >= 10) {
      runwayStatus = "Adequate";
      runwayExplanation = `${runwayMonths.toFixed(1)} months remaining (${zeroCashDate}). On-track for standard 12-month raise cycle.`;
    } else if (runwayMonths >= 6) {
      runwayStatus = "Low";
      runwayExplanation = `${runwayMonths.toFixed(1)} months remaining (${zeroCashDate}). Company must begin fundraising process immediately.`;
    } else {
      runwayStatus = "Critical";
      runwayExplanation = `CRITICAL: Only ${runwayMonths.toFixed(1)} months cash left (${zeroCashDate}). Imminent bridge or close needed.`;
    }
  }

  // 3. SaaS Magic Number: (Quarterly ARR Growth * 4) / S&M Spend (or Net Burn proxy)
  let magicNumVal: number | null = null;
  let magicRating: VCMetricsResult["magicNumber"]["rating"] = "N/A";
  let magicExplanation = "Requires quarterly revenue change to assess sales efficiency.";

  if (firstRow && latestRow && firstRow.revenue != null && latestRow.revenue != null && currentBurn != null) {
    const deltaARR = (latestRow.revenue - firstRow.revenue) * 12;
    if (deltaARR > 0 && currentBurn > 0) {
      magicNumVal = Math.round((deltaARR / (currentBurn * 3)) * 100) / 100;
      if (magicNumVal >= 1.0) {
        magicRating = "High Scaling Efficiency";
        magicExplanation = `Magic Number ${magicNumVal}x indicates top-tier go-to-market scaling efficiency (>1.0x).`;
      } else if (magicNumVal >= 0.7) {
        magicRating = "Solid Expansion";
        magicExplanation = `Magic Number ${magicNumVal}x shows good sales motion conversion (0.7x-1.0x benchmark).`;
      } else {
        magicRating = "CAC Friction";
        magicExplanation = `Magic Number ${magicNumVal}x reflects customer acquisition friction or long sales cycles.`;
      }
    }
  }

  // 4. Rule of 40: YoY Revenue Growth (%) + Operating Margin (%)
  let ruleOf40Score: number | null = null;
  let passesRuleOf40 = false;
  let ruleExplanation = "Requires YoY revenue history to calculate Rule of 40.";

  if (rows.length >= 4 && latestRow && firstRow && firstRow.revenue && latestRow.revenue) {
    const growthPct = ((latestRow.revenue - firstRow.revenue) / firstRow.revenue) * (12 / Math.max(1, rows.length - 1)) * 100;
    const marginPct = currentBurn && currentRevenue ? (-currentBurn / currentRevenue) * 100 : -20;
    ruleOf40Score = Math.round(growthPct + marginPct);
    passesRuleOf40 = ruleOf40Score >= 40;
    ruleExplanation = `Rule of 40 score: ${ruleOf40Score}% (YoY Growth ${Math.round(growthPct)}% + FCF Margin ${Math.round(marginPct)}%). ${passesRuleOf40 ? "Exceeds elite 40% benchmark." : "Below 40% growth-margin balance."}`;
  }

  // 5. Implied Valuation & Target Ownership
  const ask = askAmount || (record?.round?.amount?.amount ?? null);
  let impliedPost: number | null = null;
  let ownershipPct: number | null = null;
  let ownershipStatus: VCMetricsResult["ownership"]["status"] = "N/A";

  if (ask != null && ask > 0) {
    // Typical Seed / Pre-seed valuation heuristic based on ARR & Stage
    // Pre-seed/Seed standard post-money: $6M - $18M
    const baselinePost = currentARR && currentARR > 200_000 ? Math.max(ask * 4, currentARR * 15) : ask * 5;
    impliedPost = Math.round(baselinePost);
    ownershipPct = Math.round((ask / impliedPost) * 1000) / 10;

    if (ownershipPct >= 10 && ownershipPct <= 20) {
      ownershipStatus = "Within Mandate (10-20%)";
    } else if (ownershipPct < 10) {
      ownershipStatus = "Sub-target (<10%)";
    } else {
      ownershipStatus = "High Dilution (>20%)";
    }
  }

  // 6. ARR per Headcount
  let arrPerHead: number | null = null;
  let headTier: VCMetricsResult["arrPerHeadcount"]["tier"] = "N/A";
  if (currentARR != null && headcount != null && headcount > 0) {
    arrPerHead = Math.round(currentARR / headcount);
    if (arrPerHead >= 200_000) headTier = "High Productivity";
    else if (arrPerHead >= 100_000) headTier = "Standard";
    else headTier = "Early Stage";
  }

  // 7. Overall Diligence Score (0 to 100)
  let score = 50;
  if (runwayStatus === "Healthy") score += 15;
  else if (runwayStatus === "Low") score -= 10;
  else if (runwayStatus === "Critical") score -= 25;

  if (burnTier === "Exceptional") score += 20;
  else if (burnTier === "Good") score += 10;
  else if (burnTier === "High Burn Alarm") score -= 20;

  if (passesRuleOf40) score += 15;
  if (ownershipStatus === "Within Mandate (10-20%)") score += 10;

  score = Math.max(10, Math.min(95, score));

  let verdict: VCMetricsResult["verdict"] = "Investigate Further";
  if (score >= 75) verdict = "Strong Conviction";
  else if (runwayStatus === "Critical" || burnTier === "High Burn Alarm") verdict = "Capital Efficiency Concern";
  else if (ownershipStatus === "Sub-target (<10%)") verdict = "Outside Mandate";

  return {
    burnMultiple: {
      value: burnMultipleVal,
      formatted: burnMultipleVal != null ? `${burnMultipleVal.toFixed(1)}x` : "N/A",
      tier: burnTier,
      explanation: burnExplanation,
      netBurn: currentBurn,
      netNewArr: netNewARR,
    },
    runway: {
      months: runwayMonths,
      formatted: runwayMonths != null ? `${runwayMonths.toFixed(1)} mo` : "N/A",
      zeroCashDate,
      status: runwayStatus,
      explanation: runwayExplanation,
    },
    magicNumber: {
      value: magicNumVal,
      formatted: magicNumVal != null ? `${magicNumVal.toFixed(2)}x` : "N/A",
      rating: magicRating,
      explanation: magicExplanation,
    },
    ruleOf40: {
      score: ruleOf40Score,
      formatted: ruleOf40Score != null ? `${ruleOf40Score}%` : "N/A",
      passes: passesRuleOf40,
      explanation: ruleExplanation,
    },
    ownership: {
      askAmount: ask,
      impliedPostMoney: impliedPost,
      targetOwnershipPct: ownershipPct,
      formattedOwnership: ownershipPct != null ? `${ownershipPct.toFixed(1)}%` : "N/A",
      status: ownershipStatus,
    },
    arrPerHeadcount: {
      value: arrPerHead,
      formatted: arrPerHead != null ? `$${(arrPerHead / 1000).toFixed(0)}k / FTE` : "N/A",
      tier: headTier,
    },
    overallScore: score,
    verdict,
  };
}
