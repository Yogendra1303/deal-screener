"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompanyCard } from "@/components/cards";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useScope } from "@/components/scope";
import { usePortfolio } from "@/components/portfolio-store";
import { Card, cx } from "@/components/ui";
import { downloadCsv, escapeHtml, openPrintableReport } from "@/lib/export";
import { attentionFor, latestRunway, needsAttention, WATCH_RUNWAY_MONTHS, type Attention } from "@/lib/portfolio/attention";

type Filter = "all" | "attention" | "fine";

const RANK: Record<Attention["level"], number> = { high: 0, medium: 1, low: 2, good: 3 };

export default function PortfolioPage() {
  const p = usePortfolio();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const sc = useScope();

  const rows = useMemo(
    () =>
      p.companies
        .filter((c) => sc.inScope(c.owner))
        .map((c) => {
          const items = attentionFor(c, p.today);
          return { c, items, needs: needsAttention(items), runway: latestRunway(c, p.today) };
        })
        .sort((a, b) => RANK[a.items[0]?.level ?? "good"] - RANK[b.items[0]?.level ?? "good"] || a.c.name.localeCompare(b.c.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.companies, p.today, sc.scope],
  );

  const q = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (filter === "all" || (filter === "attention" ? r.needs : !r.needs)) &&
      (!q || `${r.c.name} ${r.c.sector} ${r.c.country} ${r.c.owner}`.toLowerCase().includes(q)),
  );
  const counts = { all: rows.length, attention: rows.filter((r) => r.needs).length, fine: rows.filter((r) => !r.needs).length };

  return (
    <div className="space-y-5">
      <PortfolioHeader />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="radiogroup" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["attention", "Needs attention"],
              ["fine", "Going fine"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={filter === k}
              onClick={() => setFilter(k)}
              className={cx("rounded-md px-3 py-1 font-medium", filter === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}
            >
              {label} <span className={cx("ml-0.5 tabular-nums", filter === k ? "text-white/70" : "text-slate-400")}>{p.ready ? counts[k] : ""}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="portfolio-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies or owners"
            className="w-56 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              downloadCsv(
                `aarka-lp-portfolio-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Company", "Sector", "Country", "Owner", "Latest Runway (mo)", "Needs Attention", "Top Alert"],
                shown.map(({ c, items, needs, runway }) => [
                  c.name,
                  c.sector,
                  c.country,
                  c.owner,
                  runway ? runway.months.toFixed(1) : "—",
                  needs ? "Yes" : "No",
                  items[0]?.text ?? "On track",
                ]),
              );
            }}
            className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Export LP CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const tableRows = shown
                .map(
                  ({ c, items, needs, runway }) =>
                    `<tr>
                      <td><strong>${escapeHtml(c.name)}</strong><br/><span style="color:#64748b">${escapeHtml(c.sector)} · ${escapeHtml(c.country)}</span></td>
                      <td>${escapeHtml(c.owner)}</td>
                      <td>${runway ? `${runway.months.toFixed(1)} mo` : "—"}</td>
                      <td><span class="badge ${needs ? "badge-amber" : "badge-green"}">${needs ? "Needs Attention" : "On Track"}</span></td>
                      <td>${escapeHtml(items[0]?.text ?? "Reporting & runway healthy")}</td>
                    </tr>`,
                )
                .join("");
              const body = `
                <div class="grid">
                  <div class="kpi"><div class="kpi-label">Portfolio Companies</div><div class="kpi-val">${shown.length}</div></div>
                  <div class="kpi"><div class="kpi-label">Needs Attention</div><div class="kpi-val">${shown.filter((x) => x.needs).length}</div></div>
                  <div class="kpi"><div class="kpi-label">On Track</div><div class="kpi-val">${shown.filter((x) => !x.needs).length}</div></div>
                  <div class="kpi"><div class="kpi-label">Watch Threshold</div><div class="kpi-val">&lt; ${WATCH_RUNWAY_MONTHS} mo cash</div></div>
                </div>
                <h2>Quarterly Portfolio Summary</h2>
                <table><thead><tr><th>Company</th><th>Lead</th><th>Runway</th><th>Status</th><th>Latest Note</th></tr></thead><tbody>${tableRows}</tbody></table>
              `;
              openPrintableReport("Quarterly LP Portfolio Report", `Fund I · ${shown.length} active portfolio companies`, body);
            }}
            className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-slate-800"
          >
            LP Report PDF
          </button>
        </div>
      </div>

      {!p.ready ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !shown.length ? (
        <Card className="p-8 text-center text-sm text-slate-600">Nothing here. Try another filter or search.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ c }) => (
            <CompanyCard key={c.id} c={c} today={p.today} />
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Each line is worked out by code from the reports: runway under {WATCH_RUNWAY_MONTHS} months, reports gone quiet, the founder&apos;s form
        disagreeing with the MIS, revenue far from the deck&apos;s plan, and anything waiting on the fund. The full grid of reports is under{" "}
        <Link href="/portfolio/reporting" className="font-medium text-indigo-700 hover:text-indigo-900">
          What&apos;s missing
        </Link>
        .
      </p>
    </div>
  );
}
