"use client";

import { useCallback, useEffect, useState } from "react";
import { LABEL, cx } from "@/components/ui";

interface TrafficEvent {
  ts: string;
  path: string;
  source: string;
  utmCampaign?: string;
  country: string;
  city?: string;
  device: "mobile" | "tablet" | "desktop";
}

interface TrafficSummary {
  ok: boolean;
  totalViews: number;
  views24h: number;
  unique24h: number;
  views7d: number;
  unique7d: number;
  redditViews7d: number;
  funnel7d: {
    landingViews: number;
    pitchViews: number;
    submissions: number;
  };
  topSources: { label: string; count: number }[];
  topCountries: { label: string; count: number }[];
  devices: { desktop: number; mobile: number; tablet: number };
  recent: TrafficEvent[];
}

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export function TrafficPanel() {
  const [data, setData] = useState<TrafficSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/track", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as TrafficSummary;
      if (json.ok) setData(json);
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const redditLaunchLink = "https://www.aarkavc.xyz/pitch?ref=reddit&utm_source=reddit&utm_campaign=launch";

  const pitchRate =
    data && data.funnel7d.pitchViews > 0
      ? `${Math.round((data.funnel7d.submissions / data.funnel7d.pitchViews) * 100)}%`
      : "—";

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Live Site Traffic &amp; Reddit Funnel
            </h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">
              Partner Only
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Real-time public visits to <span className="font-mono text-slate-700">/</span> and{" "}
            <span className="font-mono text-slate-700">/pitch</span> (excludes your own partner sessions).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(redditLaunchLink);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2500);
            }}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            title={redditLaunchLink}
          >
            {copiedUrl ? "✓ Copied Reddit UTM Link" : "Copy Reddit Tracked Link"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="py-6 text-xs text-slate-400">Loading live traffic…</p>
      ) : !data ? (
        <p className="py-6 text-xs text-slate-400">Traffic telemetry unavailable.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {/* Top KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className={LABEL}>Visits · 24h</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-slate-900 tabular-nums">{data.views24h}</span>
                <span className="text-xs text-slate-500">{data.unique24h} unique</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className={LABEL}>Unique · 7 days</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-slate-900 tabular-nums">{data.unique7d}</span>
                <span className="text-xs text-slate-500">{data.views7d} views</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className={LABEL}>From Reddit · 7d</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-orange-600 tabular-nums">{data.redditViews7d}</span>
                <span className="text-xs text-slate-500">referrals</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className={LABEL}>Pitch Funnel · 7d</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-blue-600 tabular-nums">{data.funnel7d.pitchViews}</span>
                <span className="text-xs text-slate-500">
                  /pitch · {data.funnel7d.submissions} sent ({pitchRate})
                </span>
              </p>
            </div>
          </div>

          {/* Sources, Countries & Recent Visits */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3.5">
              <div>
                <p className={LABEL}>Top Sources (7d)</p>
                {data.topSources.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">No external visits recorded yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {data.topSources.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-2">
                        <span
                          className={cx(
                            "truncate font-medium",
                            s.label.includes("reddit") ? "text-orange-700" : "text-slate-700",
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-slate-200/70 pt-3">
                <p className={LABEL}>Countries &amp; Devices (7d)</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {data.topCountries.map((c) => (
                    <span key={c.label} className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700">
                      {c.label} <span className="font-mono text-slate-400">{c.count}</span>
                    </span>
                  ))}
                  {data.views7d > 0 && (
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                      Desktop {data.devices.desktop} · Mobile {data.devices.mobile}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3.5 lg:col-span-2">
              <p className={LABEL}>Recent Live Visits</p>
              {data.recent.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  Waiting for visitors. Share your tracked Reddit link above to see live hits appear here.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="pb-1.5 pr-3">Page</th>
                        <th className="pb-1.5 pr-3">Source</th>
                        <th className="pb-1.5 pr-3">Location</th>
                        <th className="pb-1.5 pr-3">Device</th>
                        <th className="pb-1.5 text-right">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recent.slice(0, 8).map((ev, idx) => (
                        <tr key={`${ev.ts}-${idx}`}>
                          <td className="py-1.5 pr-3 font-mono text-slate-800">{ev.path}</td>
                          <td className="py-1.5 pr-3">
                            <span
                              className={cx(
                                "font-medium",
                                ev.source.includes("reddit") ? "text-orange-700" : "text-slate-600",
                              )}
                            >
                              {ev.source}
                            </span>
                            {ev.utmCampaign && <span className="ml-1 text-[10px] text-slate-400">({ev.utmCampaign})</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-slate-500">
                            {ev.city ? `${ev.city}, ${ev.country}` : ev.country}
                          </td>
                          <td className="py-1.5 pr-3 capitalize text-slate-500">{ev.device}</td>
                          <td className="py-1.5 text-right text-slate-400 tabular-nums">{timeAgo(ev.ts)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
