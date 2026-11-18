"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DropdownSelect, LABEL, cx } from "@/components/ui";

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
  durationSec?: number;
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
  reviewedBy?: string;
}

interface BreakdownRow {
  label: string;
  count: number;
  unique?: number;
  avgDurationSec?: number | null;
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
  avgDurationSec: number | null;
  funnel30d: {
    landingViews: number;
    landingUnique: number;
    landingAvgSec: number | null;
    pitchViews: number;
    pitchUnique: number;
    pitchAvgSec: number | null;
    submissions: number;
  };
  ownerStats: {
    uniqueEntity: number;
    totalHits: number;
    hits24h: number;
    hits30d: number;
    avgDurationSec: number | null;
    registeredNetworks: { label: string; location: string; registeredAt: string }[];
    currentWifiProtected: boolean;
    currentWifiLocation: string;
  };
  dailySeries: DailyPoint[];
  topSources: BreakdownRow[];
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

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function pageBadge(path: string): { label: string; cls: string } {
  if (path === "/") return { label: "Homepage (/)", cls: "bg-slate-100 text-slate-800 ring-slate-200" };
  if (path.startsWith("/pitch")) return { label: "Pitch Form (/pitch)", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (path.startsWith("/login")) return { label: "Sign In (/login)", cls: "bg-violet-50 text-violet-700 ring-violet-200" };
  if (path.startsWith("/pending") || path.startsWith("/unauthorized")) {
    return { label: "Invite Pending", cls: "bg-amber-50 text-amber-800 ring-amber-200" };
  }
  return { label: path, cls: "bg-slate-100 text-slate-700 ring-slate-200" };
}

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
  if (status === "BLOCKED_UNINVITED") return { label: "Blocked Login", cls: "bg-red-50 text-red-700 ring-red-200" };
  if (entry.event_type === "VC_LOGIN") return { label: "Partner Login", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (entry.event_type === "FOUNDER_SUBMIT") return { label: "Pitch Submitted", cls: "bg-blue-50 text-blue-700 ring-blue-200" };
  if (entry.event_type === "IC_VOTE") return { label: "IC Vote", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  if (entry.event_type === "PARTNER_APPROVAL") return { label: "Approved Partner", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (entry.event_type === "FOUNDER_OUTREACH") return { label: "Founder Follow-Up", cls: "bg-sky-50 text-sky-700 ring-sky-200" };
  return { label: entry.event_type.replace(/_/g, " "), cls: "bg-slate-100 text-slate-700 ring-slate-200" };
}

function BreakdownCard({
  title,
  rows,
  total,
  barColorFn,
  showAvgTime,
}: {
  title: string;
  rows: BreakdownRow[];
  total: number;
  barColorFn?: (label: string) => string;
  showAvgTime?: boolean;
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
            const pct = Math.max(3, Math.round((row.count / denom) * 100));
            return (
              <li key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-800">{row.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-600 tabular-nums">
                    {row.count}
                    {showAvgTime && row.avgDurationSec ? (
                      <span className="ml-1.5 text-slate-400">· avg {formatDuration(row.avgDurationSec)}</span>
                    ) : (
                      <span className="ml-1 text-slate-400">({Math.round((row.count / denom) * 100)}%)</span>
                    )}
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
  const [sourceFilter, setSourceFilter] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [linkTarget, setLinkTarget] = useState<"/pitch" | "/">("/pitch");
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    setBusyAction(ts);
    try {
      await fetch("/api/track", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_event_owner", ts }),
      });
      await load();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAccessDecision(email: string, action: "approve" | "revoke") {
    setBusyAction(email);
    setToast(null);
    try {
      const res = await fetch("/api/access-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setToast(json.error || "Could not update access request.");
        return;
      }
      setToast(
        action === "approve"
          ? `Approved & whitelisted ${email} — they can now sign in with Google.`
          : `Revoked dashboard access for ${email}.`,
      );
      await load();
    } finally {
      setBusyAction(null);
    }
  }

  const activeVisitList = tab === "owner" ? (data?.ownerRecent ?? []) : (data?.recent ?? []);

  const filteredVisits = useMemo(() => {
    return activeVisitList.filter(
      (ev) =>
        (!sourceFilter || ev.source === sourceFilter) &&
        (!pageFilter || ev.path === pageFilter) &&
        (!deviceFilter || ev.device === deviceFilter),
    );
  }, [activeVisitList, sourceFilter, pageFilter, deviceFilter]);

  const uniqueSources = useMemo(() => [...new Set(activeVisitList.map((e) => e.source))].sort(), [activeVisitList]);
  const uniquePages = useMemo(() => [...new Set(activeVisitList.map((e) => e.path))].sort(), [activeVisitList]);

  const pitchConversion =
    data && data.funnel30d.pitchViews > 0
      ? `${Math.round((data.funnel30d.submissions / data.funnel30d.pitchViews) * 100)}%`
      : "—";

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
            {data?.ownerStats.currentWifiProtected && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                ✓ Your IP Excluded ({data.ownerStats.currentWifiLocation})
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            External visitor analytics across Reddit, LinkedIn, X, Instagram, Search &amp; Direct—separated cleanly from your own Wi-Fi, with time on page, logins, and waitlist approvals.
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

      {toast && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <span>✓ {toast}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer text-emerald-700 hover:text-emerald-950">
            ✕
          </button>
        </div>
      )}

      {/* Clean Hero Analytics Card (Strictly External Visitors — 0 from Your IP) */}
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
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-md ring-1 ring-white/10">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    External Visitors · Last 30 Days
                  </p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                    0 hits from your IP
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                    {data.unique30d}
                  </span>
                  <span className="text-sm text-slate-300">
                    unique external visitors · <strong className="text-white">{data.views30d}</strong> views ({data.views24h} in last 24h)
                  </span>
                </div>
              </div>

              {/* Isolated Single-Entity Owner Badge */}
              <button
                type="button"
                onClick={() => setTab("owner")}
                className="cursor-pointer rounded-xl bg-white/[0.06] px-4 py-2.5 text-left ring-1 ring-white/15 transition-colors hover:bg-white/[0.11]"
                title="View your isolated internal hits separately"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Your Wi-Fi (YK · Isolated)
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white tabular-nums">
                  {data.ownerStats.uniqueEntity} entity{" "}
                  <span className="font-normal text-slate-400">({data.ownerStats.totalHits} internal hits)</span>
                </p>
              </button>
            </div>

            {/* Clean 4-Column KPI Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Homepage (/)</p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums">{data.funnel30d.landingViews}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {data.funnel30d.landingUnique} unique · avg {formatDuration(data.funnel30d.landingAvgSec)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">Pitch Form (/pitch)</p>
                <p className="mt-1.5 text-2xl font-semibold text-blue-300 tabular-nums">{data.funnel30d.pitchViews}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {data.funnel30d.submissions} sent ({pitchConversion}) · avg {formatDuration(data.funnel30d.pitchAvgSec)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Avg. Time on Site</p>
                <p className="mt-1.5 text-2xl font-semibold text-emerald-300 tabular-nums">
                  {formatDuration(data.avgDurationSec)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Active visible time per visit</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">Social Clicks</p>
                <p className="mt-1.5 text-2xl font-semibold text-sky-300 tabular-nums">{data.socialViews30d}</p>
                <p className="mt-0.5 text-xs text-slate-400">Reddit, LinkedIn, X, Instagram</p>
              </div>
            </div>

            {/* 14-Day Daily Bar Chart */}
            <div className="mt-5 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider">External Daily Visits · Last 14 Days</span>
                <span className="font-mono text-slate-300">Peak: {maxDailyViews} views/day</span>
              </div>
              <div className="mt-3 flex h-24 items-end gap-1.5">
                {data.dailySeries.map((day) => {
                  const heightPct = day.views > 0 ? Math.max(12, Math.round((day.views / maxDailyViews) * 100)) : 5;
                  return (
                    <div key={day.date} className="group flex flex-1 flex-col items-center gap-1">
                      <div className="relative flex h-20 w-full items-end">
                        <div
                          title={`${day.label}: ${day.views} external views (${day.unique} unique)`}
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
          </section>

          {/* Multi-Channel Tracked Share Link Builder */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-900">Tracked Share Links (Reddit, LinkedIn, X, Instagram, WhatsApp)</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose whether you&apos;re sharing the Pitch Form or Homepage—every external click &amp; time spent is attributed automatically.
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

          {/* 3 + 3 Balanced Analytics Breakdown Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <BreakdownCard
              title="Traffic Sources & Avg. Time"
              rows={data.topSources}
              total={data.views30d}
              barColorFn={sourceBarColor}
              showAvgTime
            />
            <BreakdownCard
              title="Pages Visited & Avg. Time"
              rows={data.topPages}
              total={data.views30d}
              showAvgTime
            />
            <BreakdownCard title="Top Cities & Countries" rows={data.topCities} total={data.views30d} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <BreakdownCard
              title="Device Split"
              rows={[
                { label: "Desktop", count: data.devices.desktop },
                { label: "Mobile", count: data.devices.mobile },
                { label: "Tablet", count: data.devices.tablet },
              ].filter((r) => r.count > 0)}
              total={data.views30d}
            />
            <BreakdownCard title="Operating Systems" rows={data.topOS} total={data.views30d} />
            <BreakdownCard title="Browsers & In-App Views" rows={data.topBrowsers} total={data.views30d} />
          </div>

          {/* Detailed Activity Tabs */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ["external", `External Visitors (${data.recent.length})`],
                    ["owner", `Your Wi-Fi (${data.ownerRecent.length})`],
                    ["logins", `Logins & Audit (${data.auditLogs.length})`],
                    ["requests", `Access Requests (${data.accessRequests.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTab(key);
                      setSourceFilter("");
                      setPageFilter("");
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
                  <DropdownSelect
                    ariaLabel="Filter by page"
                    size="sm"
                    prefix="Page:"
                    align="right"
                    value={pageFilter}
                    onChange={setPageFilter}
                    options={[
                      { value: "", label: "All pages" },
                      ...uniquePages.map((p) => ({ value: p, label: pageBadge(p).label })),
                    ]}
                  />
                  <DropdownSelect
                    ariaLabel="Filter by source"
                    size="sm"
                    prefix="Source:"
                    align="right"
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    options={[
                      { value: "", label: "All sources" },
                      ...uniqueSources.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                  <DropdownSelect
                    ariaLabel="Filter by device"
                    size="sm"
                    prefix="Device:"
                    align="right"
                    value={deviceFilter}
                    onChange={setDeviceFilter}
                    options={[
                      { value: "", label: "All devices" },
                      { value: "desktop", label: "Desktop" },
                      { value: "mobile", label: "Mobile" },
                      { value: "tablet", label: "Tablet" },
                    ]}
                  />
                  {(pageFilter || sourceFilter || deviceFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPageFilter("");
                        setSourceFilter("");
                        setDeviceFilter("");
                      }}
                      className="cursor-pointer px-1 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {(tab === "external" || tab === "owner") && (
              <div className="overflow-x-auto">
                {tab === "owner" && (
                  <div className="border-b border-slate-100 bg-amber-50/50 px-4 py-2.5 text-xs text-amber-900">
                    All visits from your registered Wi-Fi ({data.ownerStats.currentWifiLocation}) are grouped here as <strong>1 isolated internal entity</strong> and contribute <strong>0</strong> to External Visitors.
                  </div>
                )}
                {filteredVisits.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">
                    {tab === "external"
                      ? "0 external visits recorded so far. All hits from your own IP are strictly excluded—once outsiders click your shared links, they appear here in real time."
                      : "No internal visits recorded from your Wi-Fi yet."}
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Page</th>
                        <th className="px-4 py-2.5">Source / Channel</th>
                        <th className="px-4 py-2.5">Location</th>
                        <th className="px-4 py-2.5">Device · OS · Browser</th>
                        <th className="px-4 py-2.5">Time Spent</th>
                        <th className="px-4 py-2.5 text-right">When</th>
                        {tab === "external" && <th className="px-4 py-2.5 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredVisits.map((ev, i) => {
                        const pb = pageBadge(ev.path);
                        return (
                          <tr key={`${ev.ts}-${i}`} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={cx("inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", pb.cls)}>
                                {pb.label}
                              </span>
                            </td>
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
                              </div>
                              {ev.referrer && (
                                <span className="mt-0.5 block max-w-[210px] truncate text-[10px] text-slate-400" title={ev.referrer}>
                                  {ev.referrer}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {ev.city ? `${ev.city}${ev.region ? `, ${ev.region}` : ""}, ${ev.country}` : ev.country}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              <span className="capitalize font-medium text-slate-800">{ev.device}</span>
                              {ev.os && <span> · {ev.os}</span>}
                              {ev.browser && <span className="text-slate-500"> · {ev.browser}</span>}
                              {ev.screen && <span className="block text-[10px] text-slate-400">{ev.screen}</span>}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-700 tabular-nums">
                              {formatDuration(ev.durationSec)}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap text-slate-500 tabular-nums" title={formatExactTime(ev.ts)}>
                              {timeAgo(ev.ts)}
                            </td>
                            {tab === "external" && (
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={busyAction === ev.ts}
                                  onClick={() => void markVisitAsMine(ev.ts)}
                                  className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                                >
                                  Mark as mine
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "logins" && (
              <div className="overflow-x-auto">
                {data.auditLogs.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">No login, vote, or submission audit events recorded yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Event</th>
                        <th className="px-4 py-2.5">Actor / Email</th>
                        <th className="px-4 py-2.5">Details</th>
                        <th className="px-4 py-2.5 text-right">When</th>
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
                        <th className="px-4 py-2.5 text-right">Partner Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.accessRequests.map((req) => {
                        const isApproved = req.status.toUpperCase() === "APPROVED";
                        const isRevoked = req.status.toUpperCase() === "REVOKED";
                        return (
                          <tr key={req.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-slate-900">{req.name}</span>
                              <span className="block text-[11px] text-slate-500">{req.email}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">
                              <span>{req.background}</span>
                              {req.firm && <span className="block text-[11px] text-slate-500">{req.firm}</span>}
                            </td>
                            <td className="max-w-sm px-4 py-2.5 text-slate-600">
                              <span>{req.intent}</span>
                              {req.additionalContext && (
                                <span className="mt-0.5 block text-[11px] text-slate-500">{req.additionalContext}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span
                                className={cx(
                                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                                  isApproved
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                    : isRevoked
                                      ? "bg-red-50 text-red-700 ring-red-200"
                                      : "bg-amber-50 text-amber-800 ring-amber-200",
                                )}
                              >
                                {req.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {!isApproved ? (
                                  <button
                                    type="button"
                                    disabled={busyAction === req.email}
                                    onClick={() => void handleAccessDecision(req.email, "approve")}
                                    className="cursor-pointer rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {busyAction === req.email ? "Saving…" : "Approve & Whitelist"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={busyAction === req.email}
                                    onClick={() => void handleAccessDecision(req.email, "revoke")}
                                    className="cursor-pointer rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                                  >
                                    {busyAction === req.email ? "Saving…" : "Revoke"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
