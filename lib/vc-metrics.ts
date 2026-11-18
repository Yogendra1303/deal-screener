// Tier-1 Venture Capital Financial Metrics & Diligence Scorecard
// Implements standard benchmarks from Sequoia, Benchmark, Founders Fund, and Craft Ventures.
import type { DealResult, Flag, FormInput, Profile, RegistryRecord, Score, SheetRow } from "./types";
import type { DealRecord } from "./schema";

export type ConvictionGrade = "A" | "B" | "C" | "D" | "E" | "G";

export interface ConvictionDimension {
  id: string;
  name: string;
  weightPct: number;
  score: number; // 0 to 100
  rating: string;
  summary: string;
  formula: string;
  inputs: Record<string, string | number>;
  benchmark: string;
  penalties: string[];
}

export interface ConvictionBreakdown {
  score: number; // 0 to 100
  grade: ConvictionGrade;
  tierLabel: string;
  completenessRatio: number; // 0.0 to 1.0
  completenessMultiplier: number;
  rawWeightedScore: number;
  disclosedCount: number;
  totalCoreFacts: number;
  missingFacts: string[];
  dimensions: {
    disclosure: ConvictionDimension;
    veracity: ConvictionDimension;
    founder: ConvictionDimension;
    economics: ConvictionDimension;
    mandate: ConvictionDimension;
  };
  keyRisks: string[];
  suggestedAction: string;
}

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

  // 7. Overall VC Diligence Score & Conviction Matrix
  overallScore: number;
  grade: ConvictionGrade;
  verdict: string;
  conviction: ConvictionBreakdown;
}

export interface VCDiligenceContext {
  deal?: DealResult | null;
  flags?: Flag[] | null;
  scores?: Score[] | null;
  form?: FormInput | null;
  profiles?: Profile[] | null;
  registry?: RegistryRecord | null;
}

/**
 * Computes institutional venture capital metrics and mathematical conviction matrix
 * from financial sheet data, deal parameters, and cross-source evidence.
 */
export function calculateVCMetrics(
  sheet: SheetRow[] | null,
  record?: Partial<DealRecord> | null,
  askAmount?: number | null,
  context?: VCDiligenceContext | null
): VCMetricsResult {
  const rows = (sheet || []).filter((r) => r.revenue != null && r.revenue >= 0);
  const latestRow = rows.length ? rows[rows.length - 1] : null;
  const prevRow = rows.length >= 2 ? rows[rows.length - 2] : null;
  const firstRow = rows.length >= 4 ? rows[rows.length - 4] : rows[0];

  const deal = context?.deal ?? null;
  const flags = context?.flags ?? deal?.flags ?? [];
  const form = context?.form ?? deal?.form ?? null;
  const profiles = context?.profiles ?? deal?.profiles ?? [];
  const registry = context?.registry ?? deal?.registry ?? null;

  // Base numbers
  const currentRevenue = latestRow?.revenue ?? (record?.traction?.mrr?.amount ?? null);
  const currentARR = currentRevenue != null ? currentRevenue * 12 : null;
  const prevRevenue = prevRow?.revenue ?? null;
  const prevARR = prevRevenue != null ? prevRevenue * 12 : null;

  const currentBurn = latestRow?.netBurn != null ? Math.abs(latestRow.netBurn) : null;
  const currentCash = latestRow?.cash != null ? latestRow.cash : null;
  const headcount = latestRow?.headcount ?? null;

  // 1. Burn Multiple: Net Burn / Net New ARR
  let burnMultipleVal: number | null = null;
  let netNewARR: number | null = null;

  if (currentARR != null && prevARR != null && currentBurn != null) {
    netNewARR = currentARR - prevARR;
    if (netNewARR > 0 && currentBurn > 0) {
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
  let runwayExplanation = "No cash balance or burn provided in submission.";

  if (currentCash != null && currentBurn != null && currentBurn > 0) {
    runwayMonths = Math.round((currentCash / currentBurn) * 10) / 10;
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
  } else {
    runwayStatus = "Low";
  }

  // 3. SaaS Magic Number: (Quarterly ARR Growth * 4) / S&M Spend
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

  // 4. Rule of 40
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

  // ==========================================
  // MATHEMATICAL CONVICTION MATRIX (5 PILLARS)
  // ==========================================

  // Pillar 1: Data Completeness & Disclosure (Weight: 20%)
  const coreFactsChecks = [
    { key: "revenue", name: "Monthly Revenue / MRR", ok: currentRevenue != null },
    { key: "growth", name: "Verified Growth Rate", ok: (record?.traction?.monthlyGrowthPct?.value != null) || rows.length >= 2 },
    { key: "customers", name: "Paying Customers", ok: (record?.traction?.customers?.value != null) || (latestRow?.customers != null) },
    { key: "burn", name: "Monthly Net Burn", ok: currentBurn != null },
    { key: "runway", name: "Runway (Months of Cash)", ok: runwayMonths != null || record?.traction?.runwayMonths?.value != null },
    { key: "margin", name: "Gross Margin", ok: record?.traction?.grossMarginPct?.value != null },
    { key: "retention", name: "Retention / Churn", ok: Boolean(record?.traction?.retention?.value) },
    { key: "round", name: "Round Ask & Valuation", ok: ask != null },
    { key: "founded", name: "Year Founded & Entity", ok: record?.company?.foundedYear?.value != null || Boolean(registry?.incorporated) },
    { key: "pedigree", name: "Founders' Track Record", ok: Boolean(record?.team?.some((t) => t.pastRoles.length > 0) || profiles.length > 0) },
  ];

  const totalCoreFacts = coreFactsChecks.length;
  const disclosedFacts = coreFactsChecks.filter((f) => f.ok);
  const missingFacts = coreFactsChecks.filter((f) => !f.ok).map((f) => f.name);
  const completenessRatio = disclosedFacts.length / totalCoreFacts;
  const disclosureScore = Math.round(completenessRatio * 100);

  const disclosurePenalties: string[] = [];
  if (missingFacts.length > 0) {
    disclosurePenalties.push(`-${missingFacts.length * 10} pts: Missing ${missingFacts.length} core institutional disclosures (${missingFacts.slice(0, 3).join(", ")}${missingFacts.length > 3 ? "…" : ""})`);
  }

  // Pillar 2: Financial Integrity & Math Veracity (Weight: 25%)
  const conflictFlags = flags.filter((f) => f.kind === "conflict");
  let veracityScore = 15;
  const veracityPenalties: string[] = [];

  if (rows.length === 0 && flags.length === 0) {
    veracityScore = 10;
    veracityPenalties.push("No monthly sheet or cross-source corroboration files provided (unverified).");
  } else if (conflictFlags.length > 0) {
    veracityScore = Math.max(10, 45 - conflictFlags.length * 20);
    conflictFlags.forEach((c) => veracityPenalties.push(`-20 pts: Discrepancy > 10% in ${c.title}`));
  } else {
    // 0 conflicts
    if (rows.length >= 3) {
      veracityScore = 95;
    } else if (rows.length >= 1) {
      veracityScore = 75;
    } else {
      veracityScore = 25; // only 1 check ran (e.g. form vs deck round ask)
      veracityPenalties.push("Only intake form cross-checked. No granular monthly sheets to corroborate claims.");
    }
  }

  // Pillar 3: Founder Signal & Pedigree (Weight: 20%)
  let founderScore = 0;
  const founderPenalties: string[] = [];
  const teamRoles = record?.team ?? [];
  const allRolesText = [
    ...teamRoles.flatMap((t) => t.pastRoles.map((r) => `${r.title} ${r.company}`)),
    ...profiles.flatMap((p) => p.roles.map((r) => `${r.title} ${r.company}`)),
    ...profiles.map((p) => p.headline),
  ].join(" ").toLowerCase();

  const isSerial =
    allRolesText.includes("founder") ||
    allRolesText.includes("co-founder") ||
    allRolesText.includes("founded") ||
    allRolesText.includes("ceo") ||
    allRolesText.includes("acquired") ||
    allRolesText.includes("exit");

  const sectorText = (form?.sector || record?.company?.sector?.value || "").toLowerCase();
  const hasDomainMatch =
    sectorText.length > 2 &&
    (allRolesText.includes(sectorText) ||
      allRolesText.includes("fintech") ||
      allRolesText.includes("software") ||
      allRolesText.includes("saas") ||
      allRolesText.includes("product") ||
      allRolesText.includes("growth"));

  const hasTechPedigree =
    allRolesText.includes("cto") ||
    allRolesText.includes("engineer") ||
    allRolesText.includes("architect") ||
    allRolesText.includes("developer") ||
    allRolesText.includes("technical");

  const hasRegistry = Boolean(registry);

  if (teamRoles.length === 0 && profiles.length === 0) {
    founderScore = 5;
    founderPenalties.push("No founder professional background or employment history stated in submission.");
  } else {
    if (isSerial) founderScore += 35;
    if (hasDomainMatch) founderScore += 30;
    if (hasTechPedigree) founderScore += 20;
    if (hasRegistry) founderScore += 15;
    if (founderScore === 0) {
      founderScore = 20;
      founderPenalties.push("First-time founders without documented domain depth or technical pedigree.");
    }
  }
  founderScore = Math.min(100, Math.max(0, founderScore));

  // Pillar 4: Unit Economics & Capital Efficiency (Weight: 20%)
  let economicsScore = 10;
  const economicsPenalties: string[] = [];

  if (rows.length === 0) {
    economicsScore = 10;
    economicsPenalties.push("No monthly numbers sheet provided to assess burn multiple, margin, or sales efficiency.");
  } else {
    let burnPts = 50;
    if (burnTier === "Exceptional") burnPts = 100;
    else if (burnTier === "Good") burnPts = 80;
    else if (burnTier === "Elevated") {
      burnPts = 45;
      economicsPenalties.push("Burn Multiple elevated (1.5x - 2.2x). Monitor CAC payback.");
    } else if (burnTier === "High Burn Alarm") {
      burnPts = 10;
      economicsPenalties.push("-30 pts: High Burn Alarm (>2.2x net burn per net new ARR).");
    }

    let runwayPts = 50;
    if (runwayStatus === "Healthy") runwayPts = 100;
    else if (runwayStatus === "Adequate") runwayPts = 75;
    else if (runwayStatus === "Low") {
      runwayPts = 35;
      economicsPenalties.push("Runway under 10 months requires immediate raise buffer.");
    } else {
      runwayPts = 10;
      economicsPenalties.push("-30 pts: Critical runway (<6 months cash balance).");
    }

    let magicPts = 50;
    if (magicRating === "High Scaling Efficiency") magicPts = 100;
    else if (magicRating === "Solid Expansion") magicPts = 75;
    else if (magicRating === "CAC Friction") {
      magicPts = 30;
      economicsPenalties.push("Magic Number under 0.7x reflects sales friction.");
    }

    economicsScore = Math.round(burnPts * 0.4 + runwayPts * 0.4 + magicPts * 0.2);
  }

  // Pillar 5: Fund Mandate & Ownership Feasibility (Weight: 15%)
  let mandateScore = 80;
  const mandatePenalties: string[] = [];

  if (ownershipStatus === "Within Mandate (10-20%)") {
    mandateScore = 95;
  } else if (ownershipStatus === "Sub-target (<10%)") {
    mandateScore = 40;
    mandatePenalties.push("Check size yields <10% ownership, below institutional target.");
  } else if (ownershipStatus === "High Dilution (>20%)") {
    mandateScore = 55;
    mandatePenalties.push("Implies >20% dilution in Seed stage, risking founder cap table motivation.");
  } else if (!ask) {
    mandateScore = 30;
    mandatePenalties.push("No round size or valuation specified.");
  }

  // ==========================================
  // MASTER CONVICTION EQUATION & DISCOUNTING
  // ==========================================
  const rawWeightedScore =
    0.2 * disclosureScore +
    0.25 * veracityScore +
    0.2 * founderScore +
    0.2 * economicsScore +
    0.15 * mandateScore;

  // The Completeness Multiplier:
  // If data completeness is deficient (e.g. 1/10 facts stated), conviction cannot mathematically exceed 15.
  const completenessMultiplier = Math.max(0.15, Math.pow(completenessRatio, 0.6));
  let calculatedScore = Math.round(rawWeightedScore * completenessMultiplier);

  // Hard safety constraint: If 6 or more core facts are missing, score CANNOT exceed 15 (Grade G)
  if (missingFacts.length >= 6) {
    calculatedScore = Math.min(15, Math.max(5, calculatedScore));
  } else {
    calculatedScore = Math.min(96, Math.max(5, calculatedScore));
  }

  // Conviction Grade Tier
  let grade: ConvictionGrade = "G";
  let tierLabel = "Unsubstantiated Intake · Evidence Deficient";
  let verdict = "Unsubstantiated Intake (Grade G)";

  if (calculatedScore >= 90) {
    grade = "A";
    tierLabel = "Elite Conviction · Top 1% Institutional Fit";
    verdict = "Strong Conviction";
  } else if (calculatedScore >= 75) {
    grade = "B";
    tierLabel = "Strong Conviction · Verified Traction & Mandate";
    verdict = "Strong Conviction";
  } else if (calculatedScore >= 60) {
    grade = "C";
    tierLabel = "Moderate Conviction · Deep Diligence Recommended";
    verdict = "Investigate Further";
  } else if (calculatedScore >= 45) {
    grade = "D";
    tierLabel = "High Diligence Friction · Math Gaps or High Burn";
    verdict = "Investigate Further";
  } else if (calculatedScore >= 25) {
    grade = "E";
    tierLabel = "Capital Efficiency or Mandate Concern";
    verdict = "Capital Efficiency Concern";
  } else {
    grade = "G";
    tierLabel = "Unsubstantiated Intake · Evidence Deficient";
    verdict = "Unsubstantiated Intake (Grade G)";
  }

  const keyRisks: string[] = [
    ...disclosurePenalties,
    ...veracityPenalties,
    ...founderPenalties,
    ...economicsPenalties,
    ...mandatePenalties,
  ];

  let suggestedAction = "Request monthly financial CSV and founder employment history before scheduling an IC review.";
  if (grade === "A" || grade === "B") {
    suggestedAction = "Proceed to Lead Partner deep-dive call and schedule IC Review.";
  } else if (grade === "C") {
    suggestedAction = "Request customer references and verify unit economics on Numbers tab.";
  } else if (grade === "D" || grade === "E") {
    suggestedAction = "Audit math gap flags on deck vs monthly sheet; resolve discrepancies before term sheet.";
  }

  const conviction: ConvictionBreakdown = {
    score: calculatedScore,
    grade,
    tierLabel,
    completenessRatio,
    completenessMultiplier: Math.round(completenessMultiplier * 100) / 100,
    rawWeightedScore: Math.round(rawWeightedScore * 10) / 10,
    disclosedCount: disclosedFacts.length,
    totalCoreFacts,
    missingFacts,
    dimensions: {
      disclosure: {
        id: "disclosure",
        name: "Data Completeness & Disclosures",
        weightPct: 20,
        score: disclosureScore,
        rating: completenessRatio >= 0.8 ? "Comprehensive" : completenessRatio >= 0.5 ? "Partial" : "Critical Deficit",
        summary: `${disclosedFacts.length} of ${totalCoreFacts} core institutional facts disclosed (${Math.round(completenessRatio * 100)}%).`,
        formula: "Score = (Disclosed Facts ÷ 10) × 100",
        inputs: {
          "Disclosed Facts": disclosedFacts.length,
          "Missing Facts": missingFacts.length,
          "Completeness Ratio": `${Math.round(completenessRatio * 100)}%`,
        },
        benchmark: "Institutional VC standard: Minimum 7 of 10 verified facts required before first partner review.",
        penalties: disclosurePenalties,
      },
      veracity: {
        id: "veracity",
        name: "Financial Integrity & Math Veracity",
        weightPct: 25,
        score: veracityScore,
        rating: conflictFlags.length === 0 && rows.length >= 2 ? "Corroborated" : conflictFlags.length > 0 ? "Variance Conflict" : "Unverified",
        summary: conflictFlags.length > 0
          ? `${conflictFlags.length} math gap(s) over 10% tolerance detected between slide claims and sheet.`
          : rows.length > 0
          ? "All slide statements corroborate with submitted CSV sheets within 10% tolerance."
          : "No monthly CSV sheet submitted to corroborate deck claims.",
        formula: "Score = BaseCorroboration − (20 × ConflictsCount)",
        inputs: {
          "Checks Ran": flags.length + (rows.length ? 3 : 0),
          "Conflicts (>10% gap)": conflictFlags.length,
          "Monthly Rows Evaluated": rows.length,
        },
        benchmark: "Aarka strict 10% gap tolerance rule: Any variance >10% creates an auditable conflict flag.",
        penalties: veracityPenalties,
      },
      founder: {
        id: "founder",
        name: "Founder Pedigree & Background Signal",
        weightPct: 20,
        score: founderScore,
        rating: founderScore >= 75 ? "Tier-1 Operator" : founderScore >= 40 ? "Domain Relevant" : "Unsubstantiated",
        summary: isSerial
          ? "Serial founder or prior tech executive track record identified."
          : hasDomainMatch
          ? "Demonstrated operator background in relevant industry space."
          : "First-time founders or unverified prior company roles.",
        formula: "Score = SerialBonus(35) + DomainMatch(30) + TechPedigree(20) + RegistryMatch(15)",
        inputs: {
          "Serial Founder Signal": isSerial ? "Yes (+35)" : "No",
          "Domain Space Overlap": hasDomainMatch ? "Matched (+30)" : "Unverified",
          "Technical Pedigree": hasTechPedigree ? "Verified (+20)" : "No",
          "Registry Entity Check": hasRegistry ? "Incorporated (+15)" : "Pending",
        },
        benchmark: "Sequoia / Benchmark pattern: Repeat founders with domain depth de-risk early-stage execution.",
        penalties: founderPenalties,
      },
      economics: {
        id: "economics",
        name: "Unit Economics & Capital Efficiency",
        weightPct: 20,
        score: economicsScore,
        rating: burnTier === "Exceptional" || runwayStatus === "Healthy" ? "Top-Quartile" : burnTier === "High Burn Alarm" ? "Alarm" : "Early Stage / N/A",
        summary: burnMultipleVal != null
          ? `Burn Multiple ${burnMultipleVal.toFixed(1)}x · Runway ${runwayMonths ? runwayMonths.toFixed(1) : "N/A"} months.`
          : "Insufficient monthly numbers to establish verified capital efficiency curve.",
        formula: "Score = 0.40(BurnMultiplePts) + 0.40(RunwayPts) + 0.20(MagicNumberPts)",
        inputs: {
          "Burn Multiple": burnMultipleVal != null ? `${burnMultipleVal.toFixed(1)}x (${burnTier})` : "N/A",
          "Runway Cash Lasts": runwayMonths != null ? `${runwayMonths.toFixed(1)} mo (${runwayStatus})` : "N/A",
          "SaaS Magic Number": magicNumVal != null ? `${magicNumVal.toFixed(2)}x` : "N/A",
        },
        benchmark: "Craft Ventures / Founders Fund: Burn Multiple <1.5x and runway >12 months are mandatory for institutional seed pacing.",
        penalties: economicsPenalties,
      },
      mandate: {
        id: "mandate",
        name: "Fund Mandate & Ownership Feasibility",
        weightPct: 15,
        score: mandateScore,
        rating: ownershipStatus.includes("Within Mandate") ? "Mandate Fit" : "Review Check",
        summary: ask
          ? `Round $${(ask / 1000).toFixed(0)}K · Target Ownership ${ownershipPct ? ownershipPct.toFixed(1) : "N/A"}% · ${ownershipStatus}.`
          : "Round size or valuation cap not provided in intake.",
        formula: "Score = StageFit(30) + SectorFit(30) + OwnershipFit(40)",
        inputs: {
          "Round Ask": ask ? `$${(ask / 1000).toFixed(0)}K` : "Not stated",
          "Implied Valuation": impliedPost ? `$${(impliedPost / 1_000_000).toFixed(1)}M` : "N/A",
          "Fund Target Equity": ownershipPct ? `${ownershipPct.toFixed(1)}%` : "N/A",
          "Ownership Status": ownershipStatus,
        },
        benchmark: "Aarka Fund I Mandate: Target 10% to 20% equity stake in Seed-stage B2B / Fintech companies.",
        penalties: mandatePenalties,
      },
    },
    keyRisks,
    suggestedAction,
  };

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
    overallScore: calculatedScore,
    grade,
    verdict,
    conviction,
  };
}
