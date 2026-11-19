"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { slugOf, useDealFlow } from "@/components/flow";
import { usePortfolio } from "@/components/portfolio-store";
import { Card, LABEL, SectionTitle, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { hydrate, persist } from "@/lib/db/client";
import { downloadCsv, escapeHtml, openPrintableReport } from "@/lib/export";
import { computeFundAnalytics, DEFAULT_FUND_CONFIG, type FundConfig } from "@/lib/fund-analytics";
import { usd } from "@/lib/rules";

const CONFIG_KEY = "ds.fund.config.v1";

function fmtM(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return usd(n);
}

export default function FundAnalyticsPage() {
  const w = useWorkspace();
  const portfolio = usePortfolio();
  const flow = useDealFlow(() => true);
  const [config, setConfig] = useState<FundConfig>(DEFAULT_FUND_CONFIG);
  const [saved, setSaved] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    let local: FundConfig | null = null;
    try {
      const raw = window.localStorage.getItem(CONFIG_KEY);
      if (raw) {
        local = JSON.parse(raw) as FundConfig;
        setConfig({ ...DEFAULT_FUND_CONFIG, ...local });
      }
    } catch {
      // ignore
    }
    void hydrate<FundConfig>(
      CONFIG_KEY,
      (remote) => {
        if (remote) setConfig((prev) => ({ ...DEFAULT_FUND_CONFIG, ...prev, ...remote }));
      },
      local,
    );
  }, []);

  const analytics = useMemo(
    () =>
      computeFundAnalytics(
        portfolio.companies,
        flow.rows.map((r) => ({
          sector: r.sector,
          status: r.status,
          fits: r.fits,
          askUsd: r.askUsd,
        })),
        portfolio.today,
        config,
      ),
    [portfolio.companies, portfolio.today, flow.rows, config],
  );

  function saveConfig(next: FundConfig) {
    setConfig(next);
    try {
      window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      persist(CONFIG_KEY, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      // ignore
    }
  }

  function showNotice(msg: string) {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 3000);
  }

  function exportLpCsv() {
    const slug = (config.fundName || "aarka-fund").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadCsv(
      `${slug}-lp-quarterly-pack.csv`,
      [
        "Company",
        "Sector",
        "Reporting Currency",
        "Cost Basis (USD)",
        "Ownership (%)",
        "Latest ARR (USD Est.)",
        "Implied Holding Value (USD)",
        "Valuation Basis",
        "MOIC",
        "Cash Runway (Months)",
        "MIS Health",
      ],
      analytics.companyValuations.map((c) => [
        c.name,
        c.sector,
        c.currency,
        c.investedUsd,
        c.ownershipPct.toFixed(1),
        c.latestArrUsd ?? "",
        c.impliedValueUsd,
        c.valuationBasis,
        `${c.moic.toFixed(2)}x`,
        c.runwayMonths ?? "",
        c.health,
      ]),
    );
    showNotice("LP Quarterly CSV downloaded.");
  }

  function exportLpPackPdf() {
    const companyRows = analytics.companyValuations
      .map(
        (c) =>
          `<tr>
            <td><strong>${escapeHtml(c.name)}</strong><br/><span style="color:#64748b">${escapeHtml(c.sector)} (${escapeHtml(c.currency)})</span></td>
            <td>${escapeHtml(fmtM(c.investedUsd))}</td>
            <td>${c.ownershipPct.toFixed(1)}%</td>
            <td>${c.latestArrUsd != null ? escapeHtml(fmtM(c.latestArrUsd)) : "-"}</td>
            <td><strong>${escapeHtml(fmtM(c.impliedValueUsd))}</strong><br/><span style="color:#64748b;font-size:10px">${escapeHtml(c.valuationBasis)}</span></td>
            <td>${c.moic.toFixed(2)}x</td>
            <td>${c.runwayMonths != null ? `${c.runwayMonths.toFixed(1)} mo` : "-"}</td>
          </tr>`,
      )
      .join("");

    const sectorRows = analytics.sectorBreakdown
      .slice(0, 10)
      .map(
        (s) =>
          `<tr>
            <td><strong>${escapeHtml(s.sector)}</strong></td>
            <td>${s.inbound}</td>
            <td>${s.meetings}</td>
            <td>${s.hitRatePct}%</td>
            <td>${s.companies}</td>
            <td>${escapeHtml(fmtM(s.deployedUsd))}</td>
          </tr>`,
      )
      .join("");

    const body = `
      <div class="grid">
        <div class="kpi"><div class="kpi-label">Committed Capital</div><div class="kpi-val">${escapeHtml(fmtM(analytics.committedUsd))}</div></div>
        <div class="kpi"><div class="kpi-label">Deployed Capital</div><div class="kpi-val">${escapeHtml(fmtM(analytics.deployedUsd))} (${analytics.deploymentPct}%)</div></div>
        <div class="kpi"><div class="kpi-label">Gross TVPI (DPI + RVPI)</div><div class="kpi-val">${analytics.grossTvpi.toFixed(2)}x</div></div>
        <div class="kpi"><div class="kpi-label">Implied NAV (RVPI ${analytics.rvpi.toFixed(2)}x)</div><div class="kpi-val">${escapeHtml(fmtM(analytics.impliedFairValueUsd))}</div></div>
      </div>
      <h2>Portfolio Valuation &amp; MOIC Schedule (${analytics.arrMultiple}x ARR Floor at 1.0x Cost)</h2>
      <table>
        <thead><tr><th>Company</th><th>Cost</th><th>Ownership</th><th>Latest ARR (USD)</th><th>Implied Value</th><th>MOIC</th><th>Runway</th></tr></thead>
        <tbody>${companyRows}</tbody>
      </table>
      <h2>Deal Flow Conversion &amp; Sector Allocation</h2>
      <table>
        <thead><tr><th>Sector</th><th>Inbound Decks</th><th>Meetings</th><th>Hit Rate</th><th>Portfolio Cos</th><th>Deployed</th></tr></thead>
        <tbody>${sectorRows}</tbody>
      </table>
    `;

    openPrintableReport(
      `${config.fundName}: Quarterly LP Analytics Pack`,
      `Committed: ${fmtM(analytics.committedUsd)} · Reserve Target: ${config.reserveTargetPct}% · Gross TVPI: ${analytics.grossTvpi.toFixed(2)}x (DPI ${analytics.dpi.toFixed(2)}x + RVPI ${analytics.rvpi.toFixed(2)}x)`,
      body,
    );
    showNotice("Printable LP Pack PDF opened.");
  }

  if (w.ready && w.role !== "Partner") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Partner-only Fund Analytics</h1>
        <p className="mt-2 text-sm text-slate-600">
          Switch to Partner view or sign in with a Partner account to inspect Fund I deployment pacing, reserves, and LP valuation schedules.
        </p>
      </Card>
    );
  }

  const funnelSteps = [
    { label: "Total Inbound Pitches", count: analytics.funnel.inbound, pct: 100, color: "bg-slate-800" },
    {
      label: "Fits Fund Mandate",
      count: analytics.funnel.mandateFit,
      pct: analytics.funnel.fitRatePct,
      color: "bg-blue-600",
    },
    {
      label: "Partner Meetings Set",
      count: analytics.funnel.meetings,
      pct: analytics.funnel.meetingRatePct,
      color: "bg-indigo-600",
    },
    {
      label: "Active Portfolio Investments",
      count: analytics.funnel.portfolio,
      pct: analytics.funnel.inbound > 0 ? Math.max(4, Math.round((analytics.funnel.portfolio / analytics.funnel.inbound) * 100)) : 0,
      color: "bg-emerald-600",
    },
  ];

  // Normalize pacing bar widths so segments never overflow 100% even if reserves + deployed exceed committed
  const pacingDenominator = Math.max(
    analytics.committedUsd,
    analytics.deployedUsd + analytics.remainingInitialDryPowderUsd + analytics.reserveAllocatedUsd,
  );
  const deployedWidth = (analytics.deployedUsd / pacingDenominator) * 100;
  const dryPowderWidth = (analytics.remainingInitialDryPowderUsd / pacingDenominator) * 100;
  const reserveWidth = (analytics.reserveAllocatedUsd / pacingDenominator) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={LABEL}>Partner Intelligence · LP Reporting</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{config.fundName} Analytics &amp; Pacing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track fund deployment pacing, follow-on reserves, unrealized NAV (RVPI), realized returns (DPI), and sector conversion from live portfolio and deal records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/portfolio"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Portfolio View →
          </Link>
          <button
            type="button"
            onClick={exportLpCsv}
            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50"
          >
            Export LP CSV
          </button>
          <button
            type="button"
            onClick={exportLpPackPdf}
            className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
          >
            Export LP Pack PDF
          </button>
        </div>
      </div>

      {exportNotice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
          {exportNotice}
        </div>
      )}

      {/* Editable Fund Parameters (Partner-only edit, Analyst read-only) */}
      <Card className="p-4">
        {w.role !== "Partner" && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Analyst view: Fund capital parameters are read-only. Switch to Partner view to modify committed capital, reserves, or valuation multiples.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <label className="block lg:col-span-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fund Name</span>
            <input
              type="text"
              disabled={w.role !== "Partner"}
              value={config.fundName}
              onChange={(e) => setConfig((c) => ({ ...c, fundName: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Committed ($) · {fmtM(config.committedUsd)}
            </span>
            <input
              type="number"
              step={1_000_000}
              min={1_000_000}
              disabled={w.role !== "Partner"}
              value={config.committedUsd}
              onChange={(e) => setConfig((c) => ({ ...c, committedUsd: Math.max(1_000_000, Number(e.target.value) || 0) }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Follow-On Reserve (%)</span>
            <input
              type="number"
              step={5}
              min={0}
              max={75}
              disabled={w.role !== "Partner"}
              value={config.reserveTargetPct}
              onChange={(e) => setConfig((c) => ({ ...c, reserveTargetPct: Math.min(75, Math.max(0, Number(e.target.value) || 0)) }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">ARR Multiple (x)</span>
            <input
              type="number"
              step={1}
              min={1}
              max={25}
              disabled={w.role !== "Partner"}
              value={config.arrMultiple ?? 8}
              onChange={(e) => setConfig((c) => ({ ...c, arrMultiple: Math.min(25, Math.max(1, Number(e.target.value) || 8)) }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <button
            type="button"
            disabled={w.role !== "Partner"}
            onClick={() => w.role === "Partner" && saveConfig(config)}
            className="h-[34px] cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            {saved ? "Saved ✓" : "Save Parameters"}
          </button>
        </div>

        {/* Clear Formula Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
          <span>
            <strong className="font-semibold text-slate-700">Implied NAV:</strong> max(Cost Basis, {analytics.arrMultiple}x Latest USD ARR × Ownership %)
          </span>
          <span>
            <strong className="font-semibold text-slate-700">FX Normalized:</strong> INR, AED &amp; SAR converted to USD
          </span>
          <span>
            <strong className="font-semibold text-slate-700">Gross TVPI:</strong> DPI ({analytics.dpi.toFixed(2)}x) + RVPI ({analytics.rvpi.toFixed(2)}x)
          </span>
        </div>
      </Card>

      {analytics.overAllocatedUsd > 0 && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          Reserve target exceeds remaining fund capacity by {fmtM(analytics.overAllocatedUsd)}. Lower your Follow-On Reserve % or increase Committed Capital to rebalance pacing.
        </div>
      )}

      {/* Top Institutional KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Committed Fund" value={fmtM(analytics.committedUsd)} sub={`${config.reserveTargetPct}% reserved for follow-ons`} />
        <KpiCard
          label="Capital Deployed"
          value={fmtM(analytics.deployedUsd)}
          sub={`${analytics.deploymentPct}% of fund · ${analytics.portfolioCount} cos`}
          accent="text-blue-700"
        />
        <KpiCard
          label="Follow-On Reserves"
          value={fmtM(analytics.reserveAllocatedUsd)}
          sub={`Initial dry powder: ${fmtM(analytics.remainingInitialDryPowderUsd)}`}
        />
        <KpiCard
          label="Gross TVPI"
          value={`${analytics.grossTvpi.toFixed(2)}x`}
          sub={`RVPI ${analytics.rvpi.toFixed(2)}x · DPI ${analytics.dpi.toFixed(2)}x`}
          accent="text-emerald-700"
        />
        <KpiCard label="Implied NAV" value={fmtM(analytics.impliedFairValueUsd)} sub={`Avg check: ${fmtM(analytics.avgCheckUsd)}`} />
        <KpiCard
          label="Portfolio Runway"
          value={analytics.avgRunwayMonths != null ? `${analytics.avgRunwayMonths} mo` : "-"}
          sub={`${analytics.onTrackRatePct}% MIS on track`}
        />
      </div>

      {/* Capital Deployment Pacing Bar + Conversion Funnel */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Capital Allocation &amp; Pacing</SectionTitle>
          <p className="mb-4 text-xs text-slate-500">
            Visual split between deployed capital, remaining initial check dry powder, and locked Series A/B follow-on reserves.
          </p>
          <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              style={{ width: `${deployedWidth}%` }}
              className="bg-blue-600"
              title={`Deployed: ${fmtM(analytics.deployedUsd)}`}
            />
            <div
              style={{ width: `${dryPowderWidth}%` }}
              className="bg-sky-300"
              title={`Initial Dry Powder: ${fmtM(analytics.remainingInitialDryPowderUsd)}`}
            />
            <div
              style={{ width: `${reserveWidth}%` }}
              className="bg-slate-800"
              title={`Follow-On Reserves: ${fmtM(analytics.reserveAllocatedUsd)}`}
            />
          </div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-600" /> Deployed
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{fmtM(analytics.deployedUsd)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2 w-2 rounded-full bg-sky-300" /> Initial Dry Powder
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{fmtM(analytics.remainingInitialDryPowderUsd)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-800" /> Follow-On Reserves
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{fmtM(analytics.reserveAllocatedUsd)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Deal Flow Conversion Funnel</SectionTitle>
          <p className="mb-4 text-xs text-slate-500">
            End-to-end selectivity from raw inbound pitch decks to mandate fit, partner meetings, and active investments.
          </p>
          <div className="space-y-3">
            {funnelSteps.map((st) => (
              <div key={st.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{st.label}</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {st.count} <span className="text-slate-400">({st.pct}%)</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div style={{ width: `${Math.min(100, Math.max(3, st.pct))}%` }} className={cx("h-full rounded-full", st.color)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Portfolio Fair Value & MOIC Schedule */}
      <Card className="overflow-hidden p-5">
        <SectionTitle right={<span className="text-xs text-slate-500">Conservative {analytics.arrMultiple}x ARR valuation floor at 1.0x cost</span>}>
          Portfolio Valuation &amp; MOIC Schedule
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5 text-right">Cost Basis</th>
                <th className="px-4 py-2.5 text-right">Ownership</th>
                <th className="px-4 py-2.5 text-right">Latest ARR (USD)</th>
                <th className="px-4 py-2.5 text-right">Implied Value</th>
                <th className="px-4 py-2.5 text-right">Basis</th>
                <th className="px-4 py-2.5 text-right">MOIC</th>
                <th className="px-4 py-2.5 text-right">Runway</th>
                <th className="px-4 py-2.5 text-right">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.companyValuations.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Link href={`/portfolio/${c.id}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {c.sector} · {c.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{fmtM(c.investedUsd)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">{c.ownershipPct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {c.latestArrUsd != null ? fmtM(c.latestArrUsd) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {fmtM(c.impliedValueUsd)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cx(
                        "inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
                        c.valuationBasis === "ARR Markup"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {c.valuationBasis === "ARR Markup" ? `${analytics.arrMultiple}x ARR` : "Cost Floor"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-emerald-700">
                    {c.moic.toFixed(2)}x
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {c.runwayMonths != null ? `${c.runwayMonths} mo` : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cx(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                        c.health === "On track"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : c.health === "Too early"
                            ? "bg-slate-100 text-slate-600 ring-slate-200"
                            : c.health === "Slipping"
                              ? "bg-amber-50 text-amber-800 ring-amber-200"
                              : "bg-rose-50 text-rose-700 ring-rose-200",
                      )}
                    >
                      {c.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sector Hit-Rate & Deployment Table */}
      <Card className="overflow-hidden p-5">
        <SectionTitle>Sector Hit-Rate &amp; Deployment Breakdown</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-4 py-2.5">Sector</th>
                <th className="px-4 py-2.5 text-right">Inbound Decks</th>
                <th className="px-4 py-2.5 text-right">Partner Meetings</th>
                <th className="px-4 py-2.5 text-right">Meeting Hit Rate</th>
                <th className="px-4 py-2.5 text-right">Portfolio Cos</th>
                <th className="px-4 py-2.5 text-right">Capital Deployed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.sectorBreakdown.map((s) => (
                <tr key={s.sector} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    <Link href={`/sectors/${slugOf(s.sector)}`} className="hover:text-indigo-700 hover:underline">
                      {s.sector}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.inbound}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.meetings}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.hitRatePct}%</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{s.companies}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {s.deployedUsd > 0 ? fmtM(s.deployedUsd) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <Card className="p-4">
      <p className={LABEL}>{label}</p>
      <p className={cx("mt-1.5 font-mono text-xl font-bold tracking-tight tabular-nums text-slate-900", accent)}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
}
