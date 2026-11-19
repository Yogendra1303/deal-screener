/**
 * Fund-Level Analytics, Deployment Pacing, TVPI/RVPI/DPI & Sector Conversion Engine.
 * Derived deterministically from live Portfolio + Deal Flow records (zero hardcoded results).
 */

import type { PortfolioCompany } from "@/lib/portfolio/types";
import { companyHealth } from "@/lib/portfolio/health";
import { latestRunway } from "@/lib/portfolio/attention";

export interface FundConfig {
  fundName: string;
  committedUsd: number;
  reserveTargetPct: number;
  arrMultiple?: number;
  realizedDistributionsUsd?: number;
}

export interface PipelineSlice {
  sector: string;
  status: string;
  fits: boolean;
  askUsd: number | null;
}

export interface FundAnalytics {
  committedUsd: number;
  deployedUsd: number;
  reserveAllocatedUsd: number;
  remainingInitialDryPowderUsd: number;
  overAllocatedUsd: number;
  deploymentPct: number;
  arrMultiple: number;
  impliedFairValueUsd: number;
  realizedDpiUsd: number;
  grossTvpi: number;
  rvpi: number;
  dpi: number;
  portfolioCount: number;
  avgCheckUsd: number;
  avgRunwayMonths: number | null;
  onTrackRatePct: number;
  funnel: {
    inbound: number;
    mandateFit: number;
    meetings: number;
    portfolio: number;
    fitRatePct: number;
    meetingRatePct: number;
  };
  sectorBreakdown: {
    sector: string;
    inbound: number;
    meetings: number;
    deployedUsd: number;
    companies: number;
    hitRatePct: number;
  }[];
  companyValuations: {
    id: string;
    name: string;
    sector: string;
    currency: string;
    investedUsd: number;
    ownershipPct: number;
    latestArrUsd: number | null;
    impliedValueUsd: number;
    valuationBasis: "ARR Markup" | "1.0x Cost Floor";
    moic: number;
    runwayMonths: number | null;
    health: string;
  }[];
}

export const DEFAULT_FUND_CONFIG: FundConfig = {
  fundName: "Aarka Fund I",
  committedUsd: 25_000_000,
  reserveTargetPct: 40,
  arrMultiple: 8,
  realizedDistributionsUsd: 0,
};

/**
 * Deterministic multi-currency FX conversion to USD for fund-level aggregation.
 * Uses the same canonical reference rates as Compare (lib/compare.ts) and Evidence Matrix.
 */
export function toUsd(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) return 0;
  const code = (currency || "USD").trim().toUpperCase();
  if (code === "INR" || code === "₹") return amount / 84;
  if (code === "AED") return amount / 3.6725;
  if (code === "SAR") return amount / 3.75;
  if (code === "EUR" || code === "€") return amount / 0.92;
  if (code === "GBP" || code === "£") return amount / 0.79;
  return amount;
}

export function computeFundAnalytics(
  companies: PortfolioCompany[],
  pipeline: PipelineSlice[],
  today: string,
  config: FundConfig = DEFAULT_FUND_CONFIG,
): FundAnalytics {
  const committedUsd = Math.max(1_000_000, Number(config.committedUsd) || DEFAULT_FUND_CONFIG.committedUsd);
  const reserveTargetPct = Math.min(75, Math.max(0, Number(config.reserveTargetPct) || 0));
  const arrMultiple = Math.min(25, Math.max(1, Number(config.arrMultiple ?? DEFAULT_FUND_CONFIG.arrMultiple) || 8));
  const realizedDpiUsd = Math.max(0, Number(config.realizedDistributionsUsd ?? 0) || 0);

  const reserveAllocatedUsd = Math.round(committedUsd * (reserveTargetPct / 100));
  const initialPoolUsd = committedUsd - reserveAllocatedUsd;

  let deployedUsd = 0;
  let impliedFairValueUsd = 0;
  let onTrackCount = 0;
  const runways: number[] = [];

  const companyValuations = companies.map((c) => {
    const investedUsd = Math.max(0, Number(c.investment.amountUsd) || 0);
    const ownershipPct = Math.max(0, Number(c.investment.ownershipPct) || 0);
    deployedUsd += investedUsd;

    const latestRep = [...c.reports]
      .filter((r) => r.receivedAt && r.receivedAt.slice(0, 10) <= today && r.numbers.revenue?.value != null)
      .sort((a, b) => b.month.localeCompare(a.month))[0];

    const latestMrrUsd =
      latestRep?.numbers.revenue?.value != null
        ? toUsd(latestRep.numbers.revenue.value, c.currency)
        : null;
    const latestArrUsd = latestMrrUsd != null ? Math.round(latestMrrUsd * 12) : null;

    // Conservative ARR valuation benchmark floored at 1.0x cost basis for early-stage holdings
    const arrImpliedHoldingUsd =
      latestArrUsd && latestArrUsd > 0 && ownershipPct > 0
        ? Math.round(latestArrUsd * arrMultiple * (ownershipPct / 100))
        : 0;
    const isMarkedUp = arrImpliedHoldingUsd > investedUsd;
    const impliedValueUsd = isMarkedUp ? arrImpliedHoldingUsd : investedUsd;
    const valuationBasis: "ARR Markup" | "1.0x Cost Floor" = isMarkedUp ? "ARR Markup" : "1.0x Cost Floor";

    impliedFairValueUsd += impliedValueUsd;
    const moic = investedUsd > 0 ? Math.round((impliedValueUsd / investedUsd) * 100) / 100 : 1;

    const rw = latestRunway(c, today);
    if (rw) runways.push(rw.months);

    const h = companyHealth(c, today).band;
    if (h === "On track" || h === "Too early") onTrackCount++;

    return {
      id: c.id,
      name: c.name,
      sector: c.sector,
      currency: c.currency,
      investedUsd,
      ownershipPct,
      latestArrUsd,
      impliedValueUsd,
      valuationBasis,
      moic,
      runwayMonths: rw ? Math.round(rw.months * 10) / 10 : null,
      health: h,
    };
  });

  const rvpi = deployedUsd > 0 ? Math.round((impliedFairValueUsd / deployedUsd) * 100) / 100 : 0;
  const dpi = deployedUsd > 0 ? Math.round((realizedDpiUsd / deployedUsd) * 100) / 100 : 0;
  const grossTvpi = deployedUsd > 0 ? Math.round(((impliedFairValueUsd + realizedDpiUsd) / deployedUsd) * 100) / 100 : 1;
  const deploymentPct = Math.round((deployedUsd / committedUsd) * 1000) / 10;
  const remainingInitialDryPowderUsd = Math.max(0, initialPoolUsd - deployedUsd);
  const overAllocatedUsd = Math.max(0, deployedUsd + reserveAllocatedUsd - committedUsd);
  const avgCheckUsd = companies.length > 0 ? Math.round(deployedUsd / companies.length) : 0;
  const avgRunwayMonths =
    runways.length > 0 ? Math.round((runways.reduce((a, b) => a + b, 0) / runways.length) * 10) / 10 : null;
  const onTrackRatePct = companies.length > 0 ? Math.round((onTrackCount / companies.length) * 100) : 100;

  // Pipeline conversion funnel
  const inbound = pipeline.length;
  const mandateFit = pipeline.filter((p) => p.fits).length;
  const meetings = pipeline.filter((p) => p.status === "Meeting set").length;

  // Sector breakdown combining pipeline + portfolio
  const sectorMap = new Map<string, { inbound: number; meetings: number; deployedUsd: number; companies: number }>();
  for (const p of pipeline) {
    const s = p.sector || "Other";
    const cur = sectorMap.get(s) ?? { inbound: 0, meetings: 0, deployedUsd: 0, companies: 0 };
    cur.inbound++;
    if (p.status === "Meeting set") cur.meetings++;
    sectorMap.set(s, cur);
  }
  for (const c of companyValuations) {
    const s = c.sector || "Other";
    const cur = sectorMap.get(s) ?? { inbound: 0, meetings: 0, deployedUsd: 0, companies: 0 };
    cur.deployedUsd += c.investedUsd;
    cur.companies++;
    sectorMap.set(s, cur);
  }

  const sectorBreakdown = [...sectorMap.entries()]
    .map(([sector, v]) => ({
      sector,
      ...v,
      hitRatePct: v.inbound > 0 ? Math.round((v.meetings / v.inbound) * 100) : 0,
    }))
    .sort((a, b) => b.deployedUsd - a.deployedUsd || b.inbound - a.inbound);

  return {
    committedUsd,
    deployedUsd,
    reserveAllocatedUsd,
    remainingInitialDryPowderUsd,
    overAllocatedUsd,
    deploymentPct,
    arrMultiple,
    impliedFairValueUsd,
    realizedDpiUsd,
    grossTvpi,
    rvpi,
    dpi,
    portfolioCount: companies.length,
    avgCheckUsd,
    avgRunwayMonths,
    onTrackRatePct,
    funnel: {
      inbound,
      mandateFit,
      meetings,
      portfolio: companies.length,
      fitRatePct: inbound > 0 ? Math.round((mandateFit / inbound) * 100) : 0,
      meetingRatePct: inbound > 0 ? Math.round((meetings / inbound) * 100) : 0,
    },
    sectorBreakdown,
    companyValuations,
  };
}
