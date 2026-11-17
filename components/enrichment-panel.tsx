"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, cx } from "@/components/ui";
import type { EnrichmentReport, VerificationLink } from "@/lib/enrichment";

interface Props {
  dealId: string;
  companyName: string;
  website?: string | null;
  country?: string | null;
  founderNames?: string[];
}

function buildFallbackLinks(companyName: string, country?: string | null, founderNames?: string[]): VerificationLink[] {
  const q = encodeURIComponent(companyName.trim());
  return [
    { label: "OpenCorporates Global Registry", category: "Registry", url: `https://opencorporates.com/companies?q=${q}` },
    country?.toLowerCase().includes("india")
      ? { label: "MCA India / ZaubaCorp Lookup", category: "Registry", url: `https://www.zaubacorp.com/companysearchresults/${q}` }
      : { label: "SEC EDGAR Form D Lookup", category: "Registry", url: `https://www.sec.gov/edgar/search/#/q=${q}&forms=D` },
    { label: "Crunchbase Company & Rounds", category: "Funding", url: `https://www.crunchbase.com/textsearch?q=${q}` },
    { label: "LinkedIn Company Profile", category: "Funding", url: `https://www.linkedin.com/search/results/companies/?keywords=${q}` },
    ...(founderNames ?? [])
      .filter((n) => n.trim().length > 1)
      .slice(0, 3)
      .map((name) => ({
        label: `LinkedIn: ${name.trim()}`,
        category: "Founder" as const,
        url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name.trim()} ${companyName.trim()}`)}`,
      })),
  ];
}

export function EnrichmentPanel({ dealId, companyName, website, country, founderNames }: Props) {
  const [report, setReport] = useState<EnrichmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/deals/${encodeURIComponent(dealId)}/enrich`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { report?: EnrichmentReport | null } | null) => {
        if (active && data?.report) setReport(data.report);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dealId]);

  async function runVerification() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, website, country, founderNames }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; report?: EnrichmentReport; error?: string } | null;
      if (!res.ok || !data?.report) {
        setError(data?.error || "Verification probe failed.");
      } else {
        setReport(data.report);
      }
    } catch {
      setError("Network error while running live verification.");
    } finally {
      setLoading(false);
    }
  }

  const links = useMemo(
    () => report?.links ?? buildFallbackLinks(companyName, country, founderNames),
    [report, companyName, country, founderNames],
  );

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <button
            type="button"
            disabled={loading}
            onClick={runVerification}
            className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Verifying…" : report ? "Refresh Live Check" : "Run Live Verification"}
          </button>
        }
      >
        Live Company &amp; Founder Registry Verification
      </SectionTitle>
      <p className="mb-4 text-xs text-slate-500">
        Live domain SSL &amp; metadata probe, public Hacker News mentions, and 1-click official registry / founder profile lookups.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      {report && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {/* Website Live Probe */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Live Website Probe</span>
              {report.website ? (
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    report.website.reachable ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800",
                  )}
                >
                  {report.website.reachable ? `Live · ${report.website.status ?? 200}` : "Unreachable"}
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">No URL</span>
              )}
            </div>
            {report.website ? (
              <div className="mt-2 space-y-1 text-xs">
                <a
                  href={report.website.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-medium text-blue-700 hover:underline"
                >
                  {report.website.url}
                </a>
                {report.website.title && <p className="font-medium text-slate-800">{report.website.title}</p>}
                {report.website.description && (
                  <p className="line-clamp-2 text-slate-600">{report.website.description}</p>
                )}
                <p className="text-[11px] text-slate-400">
                  {report.website.https ? "HTTPS verified" : "HTTP only"}
                  {report.website.latencyMs != null ? ` · ${report.website.latencyMs} ms` : ""}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No public website URL recorded on this pitch.</p>
            )}
          </div>

          {/* Public Mentions */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Public Mentions (HN)</span>
              <span className="font-mono text-xs font-semibold text-slate-700">{report.mentions.length} found</span>
            </div>
            {report.mentions.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs">
                {report.mentions.map((m, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-1 font-medium text-blue-700 hover:underline"
                    >
                      {m.title}
                    </a>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">
                      {m.points} pts · {m.date}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No exact public Hacker News threads matched “{companyName}”.</p>
            )}
          </div>
        </div>
      )}

      {/* Direct Registry & Founder Links */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Direct Registry, Funding &amp; Founder Lookups
        </p>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800"
            >
              <span
                className={cx(
                  "h-1.5 w-1.5 rounded-full",
                  l.category === "Registry"
                    ? "bg-emerald-500"
                    : l.category === "Funding"
                      ? "bg-blue-500"
                      : "bg-indigo-500",
                )}
              />
              {l.label}
              <span aria-hidden className="text-slate-400">
                ↗
              </span>
            </a>
          ))}
        </div>
        {report && (
          <p className="mt-2.5 text-[11px] text-slate-400">
            Last verified {new Date(report.checkedAt).toLocaleString()}
          </p>
        )}
      </div>
    </Card>
  );
}
