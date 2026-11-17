"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LABEL, cx } from "@/components/ui";

interface TrafficEvent {
  ts: string;
  path: string;
  source: string;
  channel?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
  country: string;
  region?: string;
  city?: string;
  device: "mobile" | "tablet" | "desktop";
  os?: string;
  browser?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  visitor: string;
  isOwner?: boolean;
  ownerLabel?: string;
}

interface AuditLogEntry {
  id?: string;
  created_at?: string;
  event_type: string;
  actor_email: string;
  details: Record<string, unknown>;
}

interface AccessRequestEntry {
  id: string;
  name: string;
  email: string;
  background: string;
  firm?: string;
  intent: string;
  additionalContext?: string;
  createdAt: string;
  status: string;
}

interface BreakdownRow {
  label: string;
  count: number;
}

interface DailyPoint {
  date: string;
  label: string;
  views: number;
  unique: number;
  ownerViews: number;
}

interface TrafficTelemetry {
  ok: boolean;
  totalViews: number;
  views24h: number;
  unique24h: number;
  views7d: number;
  unique7d: number;
  views30d: number;
  unique30d: number;
  socialViews30d: number;
  funnel30d: {
    landingViews: number;
    pitchViews: number;
    submissions: number;
  };
  ownerStats: {
    totalViews: number;
    views24h: number;
    views30d: number;
    registeredNetworks: { label: string; location: string; registeredAt: string }[];
    currentWifiProtected: boolean;
    currentWifiLocation: string;
  };
  dailySeries: DailyPoint[];
  topSources: BreakdownRow[];
  topChannels: BreakdownRow[];
  topPages: BreakdownRow[];
  topCountries: BreakdownRow[];
  topCities: BreakdownRow[];
  topOS: BreakdownRow[];
  topBrowsers: BreakdownRow[];
  devices: { desktop: number; mobile: number; tablet: number };
  recent: TrafficEvent[];
  ownerRecent: TrafficEvent[];
  auditLogs: AuditLogEntry[];
  accessRequests: AccessRequestEntry[];
}

const SHARE_CHANNELS = [
  { id: "reddit", label: "Reddit", utm: "reddit", color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
  { id: "linkedin", label: "LinkedIn", utm: "linkedin", color: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
  { id: "twitter", label: "X / Twitter", utm: "twitter", color: "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200" },
  { id: "instagram", label: "Instagram", utm: "instagram", color: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100" },
  { id: "whatsapp", label: "WhatsApp", utm: "whatsapp", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
] as const;

function sourceBadgeStyle(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("reddit")) return "bg-orange-50 text-orange-700 ring-orange-200";
  if (s.includes("linkedin")) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (s.includes("twitter") || s.includes("x /")) return "bg-slate-900 text-white ring-slate-800";
  if (s.includes("instagram")) return "bg-pink-50 text-pink-700 ring-pink-200";
  if (s.includes("whatsapp")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s.includes("google") || s.includes("perplexity") || s.includes("chatgpt")) return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function sourceBarColor(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("reddit")) return "bg-orange-500";
  if (s.includes("linkedin")) return "bg-sky-600";
  if (s.includes("twitter") || s.includes("x /")) return "bg-slate-900";
  if (s.includes("instagram")) return "bg-pink-500";
  if (s.includes("whatsapp")) return "bg-emerald-500";
  return "bg-blue-600";
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function formatExactTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function eventBadge(entry: AuditLogEntry) {
  const status = String(entry.details?.status ?? "");
  if (status === "BLOCKED_UNINVITED") {
    return { label: "Blocked Login", cls: "bg-red-50 text-red-700 ring-red-200" };
  }
  if (entry.event_type === "VC_LOGIN") {
    return { label: "Partner Login", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }
  if (entry.event_type === "FOUNDER_SUBMIT") {
    return { label: "Pitch Submitted", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  }
  return { label: entry.event_type.replace(/_/g, " "), cls: "bg-slate-100 text-slate-700 ring-slate-200" };
}

function BreakdownCard({
  title,
  rows,
  total,
  barColorFn,
  mono,
}: {
  title: string;
  rows: BreakdownRow[];
  total: number;
  barColorFn?: (label: string) => string;
  mono?: boolean;
}) {
  const denom = Math.max(1, total);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <p className={LABEL}>{title}</p>
        <span className="text-[10px] font-medium text-slate-400">External · 30d</span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">No external visits yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.slice(0, 6).map((row) => {
            const pct = Math.max(2, Math.round((row.count / denom) * 100));
            return (
              <li key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={cx("truncate font-medium text-slate-800", mono && "font-mono text-[11px]")}>
                    {row.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                    {row.count} <span className="text-slate-400">({Math.round((row.count / denom) * 100)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cx("h-full rounded-full transition-all duration-300", barColorFn ? barColorFn(row.label) : "bg-blue-600")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function LiveTrafficPage() {
  const [data, setData] = useState<TrafficTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"external" | "owner" | "logins" | "requests">("external");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [deviceFilter, setDeviceFilter] = useState<string>("");
  const [linkTarget, setLinkTarget] = useState<"/pitch" | "/">("/pitch");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/track", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as TrafficTelemetry;
      if (json.ok) setData(json);
    } catch {
      // ignore transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const copyChannelUrl = (utm: string) => {
    const base = `https://www.aarkavc.xyz${linkTarget}`;
    const url =
      linkTarget === "/pitch"
        ? `${base}?ref=${utm}&utm_source=${utm}&utm_medium=social&utm_campaign=launch`
        : `${base}?utm_source=${utm}&utm_medium=social&utm_campaign=launch`;
    void navigator.clipboard?.writeText(url);
    setCopiedChannel(utm);
    setTimeout(() => setCopiedChannel(null), 2200);
  };

  async function markVisitAsMine(ts: string) {
    setBusyAction(true);
    try {
      await fetch("/api/track", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_event_owner", ts }),
      });
      await load();
    } finally {
      setBusyAction(false);
    }
  }

  const activeVisitList = tab === "owner" ? (data?.ownerRecent ?? []) : (data?.recent ?? []);

  const filteredVisits = useMemo(() => {
    return activeVisitList.filter(
      (ev) =>
        (!sourceFilter || ev.source === sourceFilter) &&
        (!deviceFilter || ev.device === deviceFilter),
    );
  }, [activeVisitList, sourceFilter, deviceFilter]);

  const uniqueSources = useMemo(() => {
    return [...new Set(activeVisitList.map((e) => e.source))].sort();
  }, [activeVisitList]);

  const pitchConversion =
    data && data.funnel30d.pitchViews > 0
      ? `${Math.round((data.funnel30d.submissions / data.funnel30d.pitchViews) * 100)}%`
      : "—";

  const blockedCount =
    data?.auditLogs.filter((l) => String(l.details?.status ?? "") === "BLOCKED_UNINVITED").length ?? 0;

  const maxDailyViews = Math.max(1, ...(data?.dailySeries.map((d) => d.views) ?? [1]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Live site traffic</h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Partner Telemetry
            </span>
            {data?.ownerStats.currentWifiProtected && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                ✓ Your Wi-Fi Auto-Excluded ({data.ownerStats.currentWifiLocation})
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            External visitor analytics across Reddit, LinkedIn, X, Instagram, Search &amp; Direct. Your own Wi-Fi &amp; partner hits are counted strictly separately.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          Refresh live data
        </button>
      </div>

      {/* Multi-Channel Tracked Share Link Generator */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Tracked Share Links (Auto-Attributes Every Click)</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Copy a channel-tagged URL for any platform—clicks are tracked automatically even when apps strip referrers or block cookies.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLinkTarget("/pitch")}
              className={cx(
                "cursor-pointer rounded px-2.5 py-1 font-medium transition-colors",
                linkTarget === "/pitch" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800",
              )}
            >
              Pitch Form (/pitch)
            </button>
            <button
              type="button"
              onClick={() => setLinkTarget("/")}
              className={cx(
                "cursor-pointer rounded px-2.5 py-1 font-medium transition-colors",
                linkTarget === "/" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800",
              )}
            >
              Homepage (/)
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {SHARE_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => copyChannelUrl(ch.utm)}
              className={cx(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
                ch.color,
              )}
            >
              {copiedChannel === ch.utm ? `✓ Copied ${ch.label} Link` : `Copy ${ch.label} Link`}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Loading live analytics…
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Could not load traffic telemetry.
        </div>
      ) : (
        <>
          {/* Hero Dark Analytics Strip (STRICTLY EXTERNAL VISITORS) + Separate Owner Counter */}
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-md ring-1 ring-white/10 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-end">
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      External Visitors · Last 30 Days
                    </p>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      Excludes Your Wi-Fi
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-3">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                      {data.views30d}
                    </span>
                    <span className="text-sm text-slate-400">
                      external views · <strong className="font-semibold text-white">{data.unique30d}</strong> unique people
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">External 24h</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{data.views24h}</p>
                    <p className="text-[11px] text-slate-400">{data.unique24h} unique</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Social Clicks</p>
                    <p className="mt-1 text-xl font-semibold text-sky-300 tabular-nums">{data.socialViews30d}</p>
                    <p className="text-[11px] text-slate-400">Reddit, LI, X, IG</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pitch Funnel</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-300 tabular-nums">{data.funnel30d.pitchViews}</p>
                    <p className="text-[11px] text-slate-400">{data.funnel30d.submissions} sent ({pitchConversion})</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Waitlist / Auth</p>
                    <p className="mt-1 text-xl font-semibold text-amber-300 tabular-nums">{data.accessRequests.length}</p>
                    <p className="text-[11px] text-slate-400">{blockedCount} blocked</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("owner")}
                    className="cursor-pointer rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-dashed ring-white/20 transition-colors hover:bg-white/[0.09]"
                    title="Your own Wi-Fi / test visits counted strictly separately"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Your Visits (YK)</p>
                    <p className="mt-1 text-xl font-semibold text-slate-200 tabular-nums">{data.ownerStats.totalViews}</p>
                    <p className="text-[11px] text-slate-400">{data.ownerStats.views24h} in 24h · Isolated</p>
                  </button>
                </div>
              </div>

              {/* 14-day Daily Bar Chart (Strictly External Visitors) */}
              <div className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">External Daily Visits · Last 14 Days</span>
                  <span className="font-mono text-slate-300">Peak: {maxDailyViews}/day</span>
                </div>
                <div className="mt-4 flex h-28 items-end gap-1.5">
                  {data.dailySeries.map((day) => {
                    const heightPct = day.views > 0 ? Math.max(10, Math.round((day.views / maxDailyViews) * 100)) : 4;
                    return (
                      <div key={day.date} className="group flex flex-1 flex-col items-center gap-1.5">
                        <div className="relative flex h-24 w-full items-end">
                          <div
                            title={`${day.label}: ${day.views} external views (${day.unique} unique) · ${day.ownerViews} your Wi-Fi visits`}
                            className={cx(
                              "w-full rounded-t transition-all duration-200",
                              day.views > 0 ? "bg-blue-500 group-hover:bg-blue-400" : "bg-white/10",
                            )}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 tabular-nums">{day.date.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Rich Multi-Axis Breakdowns (Strictly External Visitors) */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <BreakdownCard
              title="Traffic Sources (Reddit, LinkedIn, X, IG...)"
              rows={data.topSources}
              total={data.views30d}
              barColorFn={sourceBarColor}
            />
            <BreakdownCard title="Top Cities & Countries" rows={data.topCities} total={data.views30d} />
            <BreakdownCard title="Operating Systems" rows={data.topOS} total={data.views30d} />
            <BreakdownCard title="Browsers & In-App Views" rows={data.topBrowsers} total={data.views30d} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <BreakdownCard title="Countries" rows={data.topCountries} total={data.views30d} />
            <BreakdownCard title="Pages Visited" rows={data.topPages} total={data.views30d} mono />
            <BreakdownCard
              title="Device Split"
              rows={[
                { label: "Desktop", count: data.devices.desktop },
                { label: "Mobile", count: data.devices.mobile },
                { label: "Tablet", count: data.devices.tablet },
              ].filter((r) => r.count > 0)}
              total={data.views30d}
            />
          </div>

          {/* Detailed Activity Tabs */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ["external", `External Visitors (${data.recent.length})`],
                    ["owner", `Your / Team Wi-Fi (${data.ownerRecent.length})`],
                    ["logins", `Logins & Security (${data.auditLogs.length})`],
                    ["requests", `Access Requests (${data.accessRequests.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTab(key);
                      setSourceFilter("");
                      setDeviceFilter("");
                    }}
                    className={cx(
                      "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      tab === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(tab === "external" || tab === "owner") && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by source"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All sources</option>
                    {uniqueSources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by device"
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All devices</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                </div>
              )}
            </div>

            {(tab === "external" || tab === "owner") && (
              <div className="overflow-x-auto">
                {tab === "owner" && (
                  <div className="border-b border-slate-100 bg-amber-50/50 px-4 py-2.5 text-xs text-amber-900">
                    These hits came from your own Wi-Fi / registered partner networks ({data.ownerStats.registeredNetworks.map((n) => `${n.label} · ${n.location}`).join(", ") || "Active Wi-Fi"}). They are <strong>100% excluded</strong> from all External Visitor charts and counts above.
                  </div>
                )}
                {filteredVisits.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">
                    {tab === "external"
                      ? "No external visits recorded yet. Once outsiders click your Reddit, LinkedIn, X, or Instagram link, they will appear here (while your own Wi-Fi tests stay isolated in 'Your / Team Wi-Fi')."
                      : "No visits logged from your Wi-Fi yet."}
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Source / Channel</th>
                        <th className="px-4 py-2.5">Page</th>
                        <th className="px-4 py-2.5">Location</th>
                        <th className="px-4 py-2.5">Device · OS · Browser</th>
                        <th className="px-4 py-2.5">Screen / TZ</th>
                        <th className="px-4 py-2.5 text-right">Time</th>
                        {tab === "external" && <th className="px-4 py-2.5 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredVisits.map((ev, i) => (
                        <tr key={`${ev.ts}-${i}`} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cx(
                                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                                  sourceBadgeStyle(ev.source),
                                )}
                              >
                                {ev.source}
                              </span>
                              {ev.utmCampaign && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  {ev.utmCampaign}
                                </span>
                              )}
                              {ev.ownerLabel && tab === "owner" && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                  {ev.ownerLabel}
                                </span>
                              )}
                            </div>
                            {ev.referrer && (
                              <span className="mt-0.5 block max-w-[220px] truncate text-[10px] text-slate-400" title={ev.referrer}>
                                {ev.referrer}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{ev.path}</td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {ev.city ? `${ev.city}${ev.region ? `, ${ev.region}` : ""}, ${ev.country}` : ev.country}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            <span className="capitalize font-medium text-slate-800">{ev.device}</span>
                            {ev.os && <span> · {ev.os}</span>}
                            {ev.browser && <span className="text-slate-500"> · {ev.browser}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-500">
                            {[ev.screen, ev.timezone].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap text-slate-500 tabular-nums" title={formatExactTime(ev.ts)}>
                            {timeAgo(ev.ts)}
                          </td>
                          {tab === "external" && (
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={busyAction}
                                onClick={() => void markVisitAsMine(ev.ts)}
                                className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                                title="Move this hit to Your / Team Wi-Fi"
                              >
                                Mark as mine
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "logins" && (
              <div className="overflow-x-auto">
                {data.auditLogs.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No login or submission audit events recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Event</th>
                        <th className="px-4 py-2.5">Email / Actor</th>
                        <th className="px-4 py-2.5">Details</th>
                        <th className="px-4 py-2.5 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.auditLogs.map((log, i) => {
                        const badge = eventBadge(log);
                        const detailText =
                          String(log.details?.message ?? "") ||
                          [log.details?.companyName, log.details?.sector, log.details?.stage].filter(Boolean).join(" · ") ||
                          "—";
                        return (
                          <tr key={log.id || `${log.created_at}-${i}`} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", badge.cls)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-slate-900">{log.actor_email}</span>
                              {typeof log.details?.name === "string" && (
                                <span className="block text-[11px] text-slate-500">{log.details.name}</span>
                              )}
                            </td>
                            <td className="max-w-md px-4 py-2.5 text-slate-600">{detailText}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap text-slate-500 tabular-nums" title={formatExactTime(log.created_at)}>
                              {timeAgo(log.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "requests" && (
              <div className="overflow-x-auto">
                {data.accessRequests.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No institutional access requests submitted yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Requester</th>
                        <th className="px-4 py-2.5">Role &amp; Firm</th>
                        <th className="px-4 py-2.5">Intent / Context</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.accessRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-slate-900">{req.name}</span>
                            <span className="block text-[11px] text-slate-500">{req.email}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            <span>{req.background}</span>
                            {req.firm && <span className="block text-[11px] text-slate-500">{req.firm}</span>}
                          </td>
                          <td className="max-w-md px-4 py-2.5 text-slate-600">
                            <span>{req.intent}</span>
                            {req.additionalContext && (
                              <span className="mt-0.5 block text-[11px] text-slate-500">{req.additionalContext}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap text-slate-500 tabular-nums" title={formatExactTime(req.createdAt)}>
                            {timeAgo(req.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
