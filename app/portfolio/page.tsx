"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompanyCard, HealthPill, healthOf } from "@/components/cards";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useScope } from "@/components/scope";
import { usePortfolio } from "@/components/portfolio-store";
import { Avatar } from "@/components/shell";
import { Card, DropdownSelect, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { downloadCsv, escapeHtml, openPrintableReport } from "@/lib/export";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { attentionFor, latestRunway, needsAttention, WATCH_RUNWAY_MONTHS, type Attention } from "@/lib/portfolio/attention";
import { missingItems } from "@/lib/portfolio/health";
import { portfolioFacts } from "@/lib/provenance";
import { usd } from "@/lib/rules";
import { ANALYSTS, PARTNER } from "@/lib/team";

type Filter = "all" | "attention" | "fine";
type SortCol = "default" | "name" | "revenue" | "runway" | "health";

const RANK: Record<Attention["level"], number> = { high: 0, medium: 1, low: 2, good: 3 };

export default function PortfolioPage() {
  const p = usePortfolio();
  const w = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [tableSort, setTableSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: "default", dir: "asc" });
  const [query, setQuery] = useState("");
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestResult, setDigestResult] = useState<{
    lowRunway: number;
    overdueReports: number;
    emailed: boolean;
    error?: string;
  } | null>(null);
  const sc = useScope();
  const currentUserName = w.userName || w.me || PARTNER.name;
  const ownerChoices = useMemo(
    () => [...new Set([currentUserName, ...ANALYSTS.map((a) => a.name), PARTNER.name].filter(Boolean))],
    [currentUserName],
  );

  async function runPortfolioDigest() {
    setDigestBusy(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/cron/portfolio-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: true }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        lowRunway?: unknown[];
        overdueReports?: unknown[];
        emailed?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setDigestResult({ lowRunway: 0, overdueReports: 0, emailed: false, error: data?.error || "Digest run failed." });
      } else {
        setDigestResult({
          lowRunway: data.lowRunway?.length ?? 0,
          overdueReports: data.overdueReports?.length ?? 0,
          emailed: Boolean(data.emailed),
        });
      }
    } catch {
      setDigestResult({ lowRunway: 0, overdueReports: 0, emailed: false, error: "Network error running digest." });
    } finally {
      setDigestBusy(false);
    }
  }

  const rows = useMemo(
    () =>
      p.companies
        .filter((c) => sc.inScope(c.owner))
        .map((c) => {
          const items = attentionFor(c, p.today);
          const sent = c.reports.filter((r) => r.numbers.revenue && r.receivedAt && r.receivedAt.slice(0, 10) <= p.today);
          const latestRev = sent.at(-1);
          const missing = missingItems(c, p.today).filter((m) => !m.key.endsWith(":question"));
          const conflicts = portfolioFacts(c, p.today).filter((f) => f.status === "Conflict").length;
          return {
            c,
            items,
            needs: needsAttention(items),
            runway: latestRunway(c, p.today),
            health: healthOf(c, p.today).health,
            latestRev,
            missingCount: missing.length,
            conflicts,
          };
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
  const tableRows = useMemo(() => {
    if (tableSort.col === "default") return shown;
    const sign = tableSort.dir === "asc" ? 1 : -1;
    const healthRank: Record<string, number> = { "Needs help": 0, Watch: 1, "Too early": 2, Healthy: 3 };
    return [...shown].sort((a, b) => {
      if (tableSort.col === "name") return sign * a.c.name.localeCompare(b.c.name);
      if (tableSort.col === "revenue") {
        const av = a.latestRev?.numbers.revenue?.value ?? -1;
        const bv = b.latestRev?.numbers.revenue?.value ?? -1;
        return sign * (av - bv);
      }
      if (tableSort.col === "runway") {
        const av = a.runway?.months ?? 9999;
        const bv = b.runway?.months ?? 9999;
        return sign * (av - bv);
      }
      return sign * ((healthRank[a.health] ?? 2) - (healthRank[b.health] ?? 2));
    });
  }, [shown, tableSort]);
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
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium" role="radiogroup" aria-label="View mode">
            {(
              [
                ["cards", "Cards"],
                ["table", "Table"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={viewMode === k}
                onClick={() => setViewMode(k)}
                className={cx("cursor-pointer rounded-md px-2.5 py-1 transition-colors", viewMode === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}
              >
                {label}
              </button>
            ))}
          </div>
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
            disabled={digestBusy}
            onClick={() => void runPortfolioDigest()}
            className="cursor-pointer rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-2xs hover:bg-indigo-100 disabled:opacity-50"
          >
            {digestBusy ? "Checking…" : "Run Digest Check"}
          </button>
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
                  runway ? runway.months.toFixed(1) : "-",
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
                      <td>${runway ? `${runway.months.toFixed(1)} mo` : "-"}</td>
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

      {digestResult && (
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs",
            digestResult.error
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          <span>
            {digestResult.error
              ? digestResult.error
              : `Portfolio Cron Check complete: ${digestResult.lowRunway} low-runway alert(s) · ${digestResult.overdueReports} overdue MIS item(s)${digestResult.emailed ? " · Weekly digest emailed to partner inbox." : " · Logged to audit trail."}`}
          </span>
          <button
            type="button"
            onClick={() => setDigestResult(null)}
            className="cursor-pointer font-semibold underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {!p.ready ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !shown.length ? (
        <Card className="p-8 text-center text-sm text-slate-600">Nothing here. Try another filter or search.</Card>
      ) : viewMode === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setTableSort((s) => ({
                          col: "name",
                          dir: s.col === "name" && s.dir === "asc" ? "desc" : "asc",
                        }))
                      }
                      className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider hover:text-slate-900"
                    >
                      Company {tableSort.col === "name" ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </button>
                  </th>
                  <th className="px-4 py-2.5">Owner</th>
                  <th className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setTableSort((s) => ({
                          col: "revenue",
                          dir: s.col === "revenue" && s.dir === "desc" ? "asc" : "desc",
                        }))
                      }
                      className="inline-flex w-full cursor-pointer items-center justify-end gap-1 uppercase tracking-wider hover:text-slate-900"
                    >
                      Monthly Rev {tableSort.col === "revenue" ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setTableSort((s) => ({
                          col: "runway",
                          dir: s.col === "runway" && s.dir === "asc" ? "desc" : "asc",
                        }))
                      }
                      className="inline-flex w-full cursor-pointer items-center justify-end gap-1 uppercase tracking-wider hover:text-slate-900"
                    >
                      Runway {tableSort.col === "runway" ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </button>
                  </th>
                  <th className="px-4 py-2.5">Reports</th>
                  <th className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setTableSort((s) => ({
                          col: "health",
                          dir: s.col === "health" && s.dir === "asc" ? "desc" : "asc",
                        }))
                      }
                      className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider hover:text-slate-900"
                    >
                      Health {tableSort.col === "health" ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map(({ c, runway, health, latestRev, missingCount, conflicts }) => (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3 align-middle">
                      <Link href={`/portfolio/${c.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {c.sector} · {c.country} · {c.investment.round}, {usd(c.investment.amountUsd)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      {w.role === "Partner" ? (
                        <DropdownSelect
                          ariaLabel={`Owner for ${c.name}`}
                          value={c.owner}
                          onChange={(next) => p.setOwner(c.id, next)}
                          options={ownerChoices}
                          size="xs"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <Avatar name={c.owner} size="xs" /> {c.owner.split(" ")[0]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-mono tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {latestRev ? fmtMoney(latestRev.numbers.revenue!.value, c.currency) : "-"}
                      </span>
                      {latestRev && (
                        <span className="block text-[11px] font-sans text-slate-500">{fmtMonth(latestRev.month)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-mono font-semibold tabular-nums">
                      <span
                        className={
                          !runway
                            ? "text-slate-400"
                            : runway.months < 6
                              ? "text-rose-700"
                              : runway.months < WATCH_RUNWAY_MONTHS
                                ? "text-amber-800"
                                : "text-slate-900"
                        }
                      >
                        {runway ? `${runway.months.toFixed(1)} mo` : "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-xs">
                      <span className={cx("font-semibold", missingCount ? "text-rose-700" : "text-emerald-700")}>
                        {missingCount ? `${missingCount} owed` : "Up to date"}
                      </span>
                      {conflicts > 0 && (
                        <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          {conflicts} conflict
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      <HealthPill health={health} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                      <Link href={`/portfolio/${c.id}`} className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
