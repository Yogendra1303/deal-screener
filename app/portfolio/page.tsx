"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CompanyCard } from "@/components/cards";
import { PortfolioHeader } from "@/components/portfolio-header";
import { useScope } from "@/components/scope";
import { usePortfolio } from "@/components/portfolio-store";
import { Card, cx } from "@/components/ui";
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
        <input
          id="portfolio-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies or owners"
          className="w-64 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
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
