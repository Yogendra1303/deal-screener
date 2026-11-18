"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePortfolio } from "@/components/portfolio-store";
import { Avatar } from "@/components/shell";
import { useLinks } from "@/components/links-store";
import { useStore } from "@/components/store";
import { Card, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import {
  AGENTS,
  SOURCES,
  activityLog,
  type Agent,
  type AgentStatus,
  type DataSource,
  type FlowTrack,
  type LogEntry,
  type SourceCategory,
  type SourceStatus,
} from "@/lib/agents";
import { fmtDay } from "@/lib/dates";
import { TEAM } from "@/lib/team";

type HubTab = "sources" | "engines" | "activity";
type TrackFilter = "all" | "deal" | "portfolio";

interface WorkspaceSurface {
  id: string;
  title: string;
  desc: string;
  href: string;
  stat: string;
  track: FlowTrack;
}

interface EdgeGeom {
  key: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone: "indigo" | "emerald";
  active: boolean;
  dim: boolean;
}

const SOURCE_TONE: Record<SourceStatus, { pill: string; dot: string; label: string }> = {
  Connected: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", label: "Connected" },
  "Needs an API key": { pill: "bg-blue-50 text-blue-800 ring-blue-200", dot: "bg-blue-600", label: "API Key Optional" },
  Assisted: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400", label: "Assisted" },
  Planned: { pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-300", label: "Roadmap" },
};

const AGENT_TONE: Record<AgentStatus, string> = {
  "Live · Hybrid AI + Code": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  "Live · Deterministic Code": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Live · Needs API Key": "bg-blue-50 text-blue-800 ring-blue-200",
  Planned: "bg-slate-100 text-slate-600 ring-slate-200",
};

const CATEGORIES: ("All" | SourceCategory)[] = [
  "All",
  "Founder Intake",
  "Financials & MIS",
  "External Intelligence",
  "Enterprise Connectors",
];

type InspectorState =
  | { type: "source"; item: DataSource }
  | { type: "engine"; item: Agent }
  | { type: "event"; item: LogEntry }
  | null;

const PAGE_SIZE = 12;

export default function SourcesPage() {
  const store = useStore();
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();

  const [hubTab, setHubTab] = useState<HubTab>("sources");
  const [flowTrack, setFlowTrack] = useState<TrackFilter>("all");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [category, setCategory] = useState<"All" | SourceCategory>("All");
  const [onlyLiveSources, setOnlyLiveSources] = useState(false);
  const [activityKind, setActivityKind] = useState<"all" | LogEntry["kind"]>("all");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [inspector, setInspector] = useState<InspectorState>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [edges, setEdges] = useState<EdgeGeom[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const registerNode = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  const effectiveToday = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 10);
    return nowIso > p.today ? nowIso : p.today;
  }, [p.today]);

  const effectiveStatus = (src: DataSource): SourceStatus => {
    if (src.status === "Needs an API key" && store.server?.hasKey) return "Connected";
    return src.status;
  };

  // Live workspace metrics mapped to sources for real telemetry
  const telemetry = useMemo(() => {
    const deals = store.deals;
    const withSheet = deals.filter((d) => d.sheet && d.sheet.length > 0).length;
    const totalConflicts = deals.reduce((acc, d) => acc + d.flags.filter((f) => f.kind === "conflict").length, 0);
    const totalMis = p.companies.reduce((acc, c) => acc + c.reports.filter((r) => r.receivedAt).length, 0);
    const connectedSources = SOURCES.filter((s) => effectiveStatus(s) === "Connected").length;
    const liveEngines = AGENTS.filter((a) => a.status !== "Planned").length;
    return {
      dealsCount: deals.length,
      portfolioCount: p.companies.length,
      withSheet,
      totalConflicts,
      totalMis,
      connectedSources,
      liveEngines,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.deals, p.companies, store.server?.hasKey]);

  const liveBadgeForSource = (id: string): string => {
    switch (id) {
      case "pitch_decks":
        return `${telemetry.dealsCount} deck${telemetry.dealsCount === 1 ? "" : "s"} indexed`;
      case "founder_links":
        return `${links.inbound.length + Object.keys(links.requests).length} active links`;
      case "application_form":
        return `${telemetry.dealsCount} form${telemetry.dealsCount === 1 ? "" : "s"} checked`;
      case "numbers_sheet":
        return `${telemetry.withSheet} CSV ${telemetry.withSheet === 1 ? "sheet" : "sheets"} verified`;
      case "monthly_mis":
        return `${telemetry.totalMis} MIS reports · ${telemetry.portfolioCount} cos`;
      case "web_research":
        return store.server?.hasKey ? "Live web search ready" : "Requires API key";
      case "entity_enrichment":
        return "Live SSL + HN + MCA links";
      case "founder_profiles":
        return "Pillar 3 rubric active";
      default:
        return "Phase 2 connector";
    }
  };

  const compactBadgeForSource = (id: string): string => {
    switch (id) {
      case "pitch_decks":
        return `${telemetry.dealsCount} PDF${telemetry.dealsCount === 1 ? "" : "s"}`;
      case "founder_links":
        return `${links.inbound.length + Object.keys(links.requests).length} links`;
      case "application_form":
        return `${telemetry.dealsCount} forms`;
      case "numbers_sheet":
        return `${telemetry.withSheet} CSV${telemetry.withSheet === 1 ? "" : "s"}`;
      case "monthly_mis":
        return `${telemetry.totalMis} MIS`;
      case "web_research":
        return store.server?.hasKey ? "Live API" : "API opt";
      case "entity_enrichment":
        return "SSL + MCA";
      case "founder_profiles":
        return "Pillar 3";
      default:
        return "Phase 2";
    }
  };

  const flowSources = useMemo(() => SOURCES.slice(0, 8), []);

  const surfaces = useMemo<WorkspaceSurface[]>(
    () => [
      {
        id: "deals",
        title: "Pipeline & Deals",
        desc: "Kanban triage, Grade A-G pills & IC Memo PDF",
        href: "/deals",
        stat: `${telemetry.dealsCount} screened`,
        track: "deal",
      },
      {
        id: "dataroom",
        title: "Data Room",
        desc: "Signed vault, missing checklist & founder links",
        href: "/dataroom",
        stat: "Encrypted",
        track: "deal",
      },
      {
        id: "compare",
        title: "Compare Matrix",
        desc: "Rank deals & portfolio on Grade, Burn & ARR",
        href: "/compare",
        stat: "FX-ready",
        track: "both",
      },
      {
        id: "portfolio",
        title: "Portfolio Oversight",
        desc: "Partner MIS CSV upload & <9 mo Runway Radar",
        href: "/portfolio",
        stat: `${telemetry.portfolioCount} cos`,
        track: "portfolio",
      },
      {
        id: "fund",
        title: "Fund Analytics",
        desc: "Deployed capital, TVPI, dry powder & LP Pack",
        href: "/fund",
        stat: "Real-time",
        track: "portfolio",
      },
      {
        id: "method",
        title: "Conviction Rule Book",
        desc: "Master equations, >10% math & Grade A-G tiers",
        href: "/method",
        stat: "Auditable",
        track: "deal",
      },
    ],
    [telemetry.dealsCount, telemetry.portfolioCount],
  );

  const trackMatches = useCallback(
    (track: FlowTrack) => flowTrack === "all" || track === "both" || track === flowTrack,
    [flowTrack],
  );

  const connectedNodeIds = useMemo<Set<string> | null>(() => {
    if (!hoveredNode) return null;
    const set = new Set<string>([hoveredNode]);

    const src = flowSources.find((s) => `src:${s.id}` === hoveredNode);
    if (src) {
      for (const eid of src.feedsEngines) {
        set.add(`eng:${eid}`);
        const eng = AGENTS.find((a) => a.id === eid);
        if (eng) {
          for (const oid of eng.outputs) set.add(`out:${oid}`);
        }
      }
      return set;
    }

    const eng = AGENTS.find((a) => `eng:${a.id}` === hoveredNode);
    if (eng) {
      for (const s of flowSources) {
        if (s.feedsEngines.includes(eng.id)) set.add(`src:${s.id}`);
      }
      for (const oid of eng.outputs) set.add(`out:${oid}`);
      return set;
    }

    const out = surfaces.find((o) => `out:${o.id}` === hoveredNode);
    if (out) {
      for (const a of AGENTS) {
        if (a.outputs.includes(out.id)) {
          set.add(`eng:${a.id}`);
          for (const s of flowSources) {
            if (s.feedsEngines.includes(a.id)) set.add(`src:${s.id}`);
          }
        }
      }
      return set;
    }

    return null;
  }, [hoveredNode, flowSources, surfaces]);

  const computeEdges = useCallback(() => {
    const wrap = canvasRef.current;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    setCanvasSize({ w: box.width, h: box.height });

    if (box.width < 900) {
      setEdges([]);
      return;
    }

    const next: EdgeGeom[] = [];
    const buildCurve = (
      fromKey: string,
      toKey: string,
      tone: "indigo" | "emerald",
      trackOk: boolean,
    ) => {
      const a = nodeRefs.current.get(fromKey);
      const b = nodeRefs.current.get(toKey);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - box.left;
      const y1 = ra.top + ra.height / 2 - box.top;
      const x2 = rb.left - box.left;
      const y2 = rb.top + rb.height / 2 - box.top;
      if (x2 <= x1 + 6) return;
      const dx = Math.max(24, (x2 - x1) * 0.48);
      const active = Boolean(connectedNodeIds && connectedNodeIds.has(fromKey) && connectedNodeIds.has(toKey));
      const dim = connectedNodeIds ? !active : !trackOk;
      next.push({
        key: `${fromKey}->${toKey}`,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
        x1,
        y1,
        x2,
        y2,
        tone,
        active,
        dim,
      });
    };

    for (const s of flowSources) {
      for (const eid of s.feedsEngines) {
        const eng = AGENTS.find((a) => a.id === eid);
        if (!eng) continue;
        buildCurve(`src:${s.id}`, `eng:${eid}`, "indigo", trackMatches(s.track) && trackMatches(eng.track));
      }
    }
    for (const eng of AGENTS) {
      for (const oid of eng.outputs) {
        const surf = surfaces.find((o) => o.id === oid);
        if (!surf) continue;
        buildCurve(`eng:${eng.id}`, `out:${oid}`, "emerald", trackMatches(eng.track) && trackMatches(surf.track));
      }
    }

    setEdges(next);
  }, [connectedNodeIds, flowSources, surfaces, trackMatches]);

  useEffect(() => {
    const raf = requestAnimationFrame(computeEdges);
    const wrap = canvasRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(() => requestAnimationFrame(computeEdges));
    ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [computeEdges]);

  const hoveredSummary = useMemo(() => {
    if (!hoveredNode) return null;
    const src = flowSources.find((s) => `src:${s.id}` === hoveredNode);
    if (src) {
      const targetEngines = src.feedsEngines
        .map((id) => AGENTS.find((a) => a.id === id)?.shortName)
        .filter(Boolean)
        .join(", ");
      return {
        role: "INGESTION",
        title: src.shortName,
        detail: `Feeds ${targetEngines}. Click to inspect ingestion rules & security boundary.`,
      };
    }
    const eng = AGENTS.find((a) => `eng:${a.id}` === hoveredNode);
    if (eng) {
      const targetSurfaces = eng.outputs
        .map((id) => surfaces.find((o) => o.id === id)?.title)
        .filter(Boolean)
        .join(", ");
      return {
        role: "VERIFICATION ENGINE",
        title: eng.name,
        detail: `Powers ${targetSurfaces}. Click to audit exact inputs & zero-hallucination guardrails.`,
      };
    }
    const out = surfaces.find((o) => `out:${o.id}` === hoveredNode);
    if (out) {
      const feeding = AGENTS.filter((a) => a.outputs.includes(out.id))
        .map((a) => a.shortName)
        .join(", ");
      return {
        role: "WORKSPACE SURFACE",
        title: out.title,
        detail: `Powered live by ${feeding}. Click card to open ${out.href}.`,
      };
    }
    return null;
  }, [hoveredNode, flowSources, surfaces]);

  const log = useMemo(() => {
    const mine = (owner?: string) => w.role === "Partner" || owner === w.me;
    return activityLog(
      store.deals.filter((d) => mine(links.ownerOf(d.id))),
      p.companies.filter((c) => mine(c.owner)),
      w.questions.filter((q) => w.role === "Partner" || q.owner === w.me || q.askedBy === w.me),
      effectiveToday,
    );
  }, [store.deals, p.companies, w.questions, w.role, w.me, effectiveToday, links]);

  const filteredSources = useMemo(
    () =>
      SOURCES.filter((s) => {
        if (category !== "All" && s.category !== category) return false;
        if (onlyLiveSources && effectiveStatus(s) !== "Connected") return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, onlyLiveSources, store.server?.hasKey],
  );

  const filteredLog = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    return log.filter((e) => {
      if (activityKind !== "all" && e.kind !== activityKind) return false;
      if (q && !`${e.actor} ${e.company} ${e.text}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [log, activityKind, activityQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLog.length / PAGE_SIZE));
  const safePage = Math.min(activityPage, totalPages);
  const pagedLog = filteredLog.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openHubSection = (tab: HubTab) => {
    setHubTab(tab);
    const el = document.getElementById("lineage-hub");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Data Lineage &amp; Verification Architecture
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            Where data comes from
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Every metric in Aarka traces back to a founder document, monthly CSV, or live verification probe. Click any tile below to inspect its ingestion rules, security boundary, and live audit trail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Deterministic Core Active
          </span>
          <Link
            href="/method"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Open Conviction Rule Book →
          </Link>
        </div>
      </div>

      {/* 4 Live Interactive Telemetry KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setCategory("All");
            setOnlyLiveSources(true);
            openHubSection("sources");
          }}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Live Pipelines</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {telemetry.connectedSources}
            <span className="text-sm font-normal text-slate-400"> / {SOURCES.length}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-emerald-700">
            Active ingestion channels →
          </p>
        </button>

        <button
          type="button"
          onClick={() => openHubSection("engines")}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Intelligence Engines</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">AI + Code</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {telemetry.liveEngines}
            <span className="text-sm font-normal text-slate-400"> active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Inspect scoring &amp; checks →
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategory("Financials & MIS");
            setOnlyLiveSources(false);
            openHubSection("sources");
          }}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Verified Records</span>
            <span className="font-mono text-[10px] font-semibold text-blue-700">
              {telemetry.totalConflicts} gap{telemetry.totalConflicts === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {telemetry.dealsCount + telemetry.portfolioCount}
            <span className="text-sm font-normal text-slate-400"> cos</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-blue-700">
            {telemetry.withSheet} {telemetry.withSheet === 1 ? "CSV" : "CSVs"} · {telemetry.totalMis} MIS reports →
          </p>
        </button>

        <button
          type="button"
          onClick={() => openHubSection("activity")}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-sm"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Audit Trail Events</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Grid View</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {log.length}
            <span className="text-sm font-normal text-slate-400"> logged</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-slate-900">
            Open live activity grid →
          </p>
        </button>
      </div>

      {/* Institutional Interactive 3-Stage Data Lineage Canvas */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Canvas Top Bar + Track Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              End-to-End Data Lineage
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Hover any node to trace live upstream and downstream paths. Click any source or engine to open its specification.
            </p>
          </div>

          <div
            className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold"
            role="tablist"
            aria-label="Filter data flow track"
          >
            {(
              [
                ["all", "Full System"],
                ["deal", "Deal Screening"],
                ["portfolio", "Portfolio & Fund"],
              ] as [TrackFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={flowTrack === k}
                onClick={() => {
                  setFlowTrack(k);
                  setHoveredNode(null);
                }}
                className={cx(
                  "cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 transition",
                  flowTrack === k
                    ? "bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Architectural Dot-Grid Canvas + Live SVG Bezier Connectors */}
        <div
          ref={canvasRef}
          onMouseLeave={() => setHoveredNode(null)}
          className="relative bg-slate-50/50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px] p-5 sm:p-6"
        >
          {/* SVG Bezier Edge Layer (Desktop) */}
          {canvasSize.w > 0 && edges.length > 0 && (
            <svg
              aria-hidden
              viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
            >
              {/* Render dimmed/idle curves underneath active curves */}
              {edges
                .filter((e) => !e.active)
                .map((e) => (
                  <path
                    key={e.key}
                    d={e.d}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.15}
                    strokeOpacity={e.dim ? 0.14 : 0.42}
                  />
                ))}
              {edges
                .filter((e) => e.active)
                .map((e) => {
                  const stroke = e.tone === "indigo" ? "#4f46e5" : "#059669";
                  return (
                    <g key={e.key}>
                      <path
                        d={e.d}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={2}
                        strokeOpacity={0.92}
                      />
                      <circle cx={e.x1} cy={e.y1} r={3} fill={stroke} />
                      <circle cx={e.x2} cy={e.y2} r={3} fill={stroke} />
                    </g>
                  );
                })}
            </svg>
          )}

          <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
            {/* Stage 1: Ingestion Channels */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  01 · Ingestion
                </span>
                <span className="font-mono text-[10px] font-medium text-slate-400">
                  8 live inputs
                </span>
              </div>
              <div className="space-y-2">
                {flowSources.map((src) => {
                  const st = effectiveStatus(src);
                  const nodeKey = `src:${src.id}`;
                  const isLit = connectedNodeIds ? connectedNodeIds.has(nodeKey) : trackMatches(src.track);
                  const isDirect = hoveredNode === nodeKey;
                  return (
                    <button
                      key={src.id}
                      ref={registerNode(nodeKey)}
                      type="button"
                      onMouseEnter={() => setHoveredNode(nodeKey)}
                      onFocus={() => setHoveredNode(nodeKey)}
                      onClick={() => setInspector({ type: "source", item: src })}
                      className={cx(
                        "group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-2xs transition",
                        isDirect
                          ? "border-indigo-500 ring-2 ring-indigo-500/15"
                          : isLit
                            ? "border-slate-200/90 hover:border-indigo-300"
                            : "border-slate-200/60 opacity-35",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cx("h-2 w-2 shrink-0 rounded-full", SOURCE_TONE[st].dot)}
                          title={SOURCE_TONE[st].label}
                        />
                        <span className="truncate text-xs font-medium text-slate-800 group-hover:text-indigo-700">
                          {src.shortName}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                        {compactBadgeForSource(src.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage 2: Aarka Verification Core (All 6 Active Engines + Closed-Loop Bridge) */}
            <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100">
                  02 · Aarka Verification Core
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                  Zero AI Math
                </span>
              </div>

              <div className="space-y-2 p-3">
                {AGENTS.slice(0, 5).map((eng) => {
                  const nodeKey = `eng:${eng.id}`;
                  const isLit = connectedNodeIds ? connectedNodeIds.has(nodeKey) : trackMatches(eng.track);
                  const isDirect = hoveredNode === nodeKey;
                  const badgeTone =
                    eng.badge === "Code"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                      : eng.badge === "AI + Code"
                        ? "bg-indigo-50 text-indigo-700 ring-indigo-200/80"
                        : "bg-blue-50 text-blue-700 ring-blue-200/80";
                  return (
                    <button
                      key={eng.id}
                      ref={registerNode(nodeKey)}
                      type="button"
                      onMouseEnter={() => setHoveredNode(nodeKey)}
                      onFocus={() => setHoveredNode(nodeKey)}
                      onClick={() => setInspector({ type: "engine", item: eng })}
                      className={cx(
                        "group block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition",
                        isDirect
                          ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/15"
                          : isLit
                            ? "border-slate-200/80 bg-slate-50/60 hover:border-indigo-300 hover:bg-white"
                            : "border-slate-200/50 bg-slate-50/40 opacity-35",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-indigo-700">
                          <span className="shrink-0 font-mono text-[10px] font-bold text-slate-400">{eng.step}</span>
                          <span className="truncate">{eng.shortName}</span>
                        </span>
                        <span className={cx("shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", badgeTone)}>
                          {eng.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{eng.job}</p>
                    </button>
                  );
                })}

                {/* Closed-Loop Promotion Bridge */}
                <div className="flex items-center gap-2 py-0.5">
                  <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-emerald-300 to-emerald-200" />
                  <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                    Mark Invested → Portfolio Loop
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 via-emerald-300 to-indigo-200" />
                </div>

                {/* Engine 06: Portfolio MIS & Runway Radar */}
                {AGENTS.slice(5).map((eng) => {
                  const nodeKey = `eng:${eng.id}`;
                  const isLit = connectedNodeIds ? connectedNodeIds.has(nodeKey) : trackMatches(eng.track);
                  const isDirect = hoveredNode === nodeKey;
                  return (
                    <button
                      key={eng.id}
                      ref={registerNode(nodeKey)}
                      type="button"
                      onMouseEnter={() => setHoveredNode(nodeKey)}
                      onFocus={() => setHoveredNode(nodeKey)}
                      onClick={() => setInspector({ type: "engine", item: eng })}
                      className={cx(
                        "group block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition",
                        isDirect
                          ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/15"
                          : isLit
                            ? "border-emerald-200/80 bg-emerald-50/30 hover:border-emerald-400 hover:bg-white"
                            : "border-slate-200/50 bg-slate-50/40 opacity-35",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-emerald-800">
                          <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-600">{eng.step}</span>
                          <span className="truncate">{eng.shortName}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/80">
                          {eng.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{eng.job}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage 3: Live Workspace Surfaces */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  03 · Workspace Surfaces
                </span>
                <span className="font-mono text-[10px] font-medium text-slate-400">
                  Open live
                </span>
              </div>
              <div className="space-y-2">
                {surfaces.map((out) => {
                  const nodeKey = `out:${out.id}`;
                  const isLit = connectedNodeIds ? connectedNodeIds.has(nodeKey) : trackMatches(out.track);
                  const isDirect = hoveredNode === nodeKey;
                  return (
                    <Link
                      key={out.id}
                      ref={registerNode(nodeKey)}
                      href={out.href}
                      onMouseEnter={() => setHoveredNode(nodeKey)}
                      onFocus={() => setHoveredNode(nodeKey)}
                      className={cx(
                        "group block rounded-xl border bg-white px-3.5 py-2.5 shadow-2xs transition",
                        isDirect
                          ? "border-emerald-500 ring-2 ring-emerald-500/15"
                          : isLit
                            ? "border-slate-200/90 hover:border-emerald-400"
                            : "border-slate-200/60 opacity-35",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-800">
                          {out.title}
                        </span>
                        <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
                          {out.stat}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{out.desc}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Trace Footer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-white px-5 py-3 text-xs sm:px-6">
          {hoveredSummary ? (
            <div className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
                {hoveredSummary.role}
              </span>
              <span className="font-semibold text-slate-900">{hoveredSummary.title}:</span>
              <span className="text-slate-600">{hoveredSummary.detail}</span>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                {(["Connected", "Needs an API key", "Assisted", "Planned"] as SourceStatus[]).map((st) => (
                  <span key={st} className="inline-flex items-center gap-1.5">
                    <span className={cx("h-2 w-2 rounded-full", SOURCE_TONE[st].dot)} />
                    {SOURCE_TONE[st].label}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                <strong className="font-semibold text-slate-700">Rule:</strong> AI extracts &amp; cites · TypeScript computes every ratio, &gt;10% gap &amp; Grade A-G · Partners decide.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Unified Dynamic Tile Hub (Sources | Engines | Activity Grid) */}
      <section id="lineage-hub" className="space-y-4">
        {/* Segmented Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold" role="tablist">
            {(
              [
                ["sources", `Data Sources (${SOURCES.length})`],
                ["engines", `Intelligence Engines (${AGENTS.length})`],
                ["activity", `Activity Audit Grid (${log.length})`],
              ] as [HubTab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={hubTab === k}
                onClick={() => setHubTab(k)}
                className={cx(
                  "cursor-pointer rounded-lg px-3.5 py-1.5 transition",
                  hubTab === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Contextual Controls per Tab */}
          {hubTab === "sources" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cx(
                      "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition",
                      category === cat
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOnlyLiveSources((v) => !v)}
                className={cx(
                  "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                  onlyLiveSources
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {onlyLiveSources ? "Showing Live Only" : "Filter: Live Only"}
              </button>
            </div>
          )}

          {hubTab === "activity" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={activityQuery}
                onChange={(e) => {
                  setActivityQuery(e.target.value);
                  setActivityPage(1);
                }}
                placeholder="Filter by company, engine, or partner..."
                className="h-8 w-56 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                {(
                  [
                    ["all", "All"],
                    ["agent", "Engines"],
                    ["code", "Code Checks"],
                    ["person", "Team"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setActivityKind(k);
                      setActivityPage(1);
                    }}
                    className={cx(
                      "cursor-pointer rounded-md px-2.5 py-1 font-medium",
                      activityKind === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: CLICKABLE DATA SOURCE TILES */}
        {hubTab === "sources" && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSources.map((src) => {
              const st = effectiveStatus(src);
              const tone = SOURCE_TONE[st];
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setInspector({ type: "source", item: src })}
                  className="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {src.category}
                    </span>
                    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", tone.pill)}>
                      <span className={cx("h-1.5 w-1.5 rounded-full", tone.dot)} />
                      {tone.label}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                    {src.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {src.gives}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-4 text-[11px]">
                    <span className="font-mono font-medium text-slate-500">
                      {liveBadgeForSource(src.id)}
                    </span>
                    <span className="font-semibold text-indigo-600 group-hover:underline">
                      Inspect details →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 2: CLICKABLE INTELLIGENCE ENGINE TILES */}
        {hubTab === "engines" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setInspector({ type: "engine", item: a })}
                className="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{a.name}</h3>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", AGENT_TONE[a.status])}>
                    {a.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{a.job}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.reads.map((r) => (
                    <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-4 text-[11px]">
                  <span className="truncate text-slate-500">{a.statusNote}</span>
                  <span className="shrink-0 font-semibold text-indigo-600 group-hover:underline">
                    Audit engine →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* TAB 3: COMPACT PAGINATED ACTIVITY AUDIT GRID */}
        {hubTab === "activity" && (
          <div className="space-y-3">
            {pagedLog.length === 0 ? (
              <Card className="p-8 text-center text-sm text-slate-500">
                No audit events match your current filter.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pagedLog.map((e, i) => (
                  <button
                    key={`${e.date}-${e.company}-${i}`}
                    type="button"
                    onClick={() => setInspector({ type: "event", item: e })}
                    className="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {TEAM.some((m) => m.name === e.actor) ? (
                          <Avatar name={e.actor} size="xs" />
                        ) : (
                          <span
                            aria-hidden
                            className={cx(
                              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                              e.kind === "agent" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700",
                            )}
                          >
                            {e.kind === "agent" ? "AI" : "{}"}
                          </span>
                        )}
                        <span className="truncate text-xs font-semibold text-slate-900">{e.actor}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">{fmtDay(e.date)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{e.text}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3 text-[11px]">
                      <span className="font-semibold text-indigo-700">{e.company}</span>
                      <span className="text-slate-400 group-hover:text-slate-700">Inspect →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Compact Pagination Bar */}
            {filteredLog.length > PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs">
                <span className="text-slate-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredLog.length)} of {filteredLog.length} events
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setActivityPage((n) => Math.max(1, n - 1))}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-slate-600">
                    Page {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setActivityPage((n) => Math.min(totalPages, n + 1))}
                    className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Compact Latest Activity Preview Strip (only when not on Activity tab) */}
      {hubTab !== "activity" && log.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Latest Verified Audit Events
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setHubTab("activity")}
              className="cursor-pointer text-xs font-semibold text-indigo-700 hover:underline"
            >
              View all {log.length} events in grid →
            </button>
          </div>
          <div className="mt-3 grid gap-2.5 md:grid-cols-3">
            {log.slice(0, 3).map((e, idx) => (
              <button
                key={`${e.date}-${idx}`}
                type="button"
                onClick={() => setInspector({ type: "event", item: e })}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-900">{e.company}</span>
                  <span className="font-mono text-[10px] text-slate-400">{fmtDay(e.date)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-slate-600">{e.text}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Tile Inspector Modal */}
      {inspector && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setInspector(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {inspector.type === "source" && (() => {
              const s = inspector.item;
              const st = effectiveStatus(s);
              const tone = SOURCE_TONE[st];
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{s.category}</span>
                        <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", tone.pill)}>
                          <span className={cx("h-1.5 w-1.5 rounded-full", tone.dot)} />
                          {tone.label}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900">{s.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspector(null)}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">What It Captures</span>
                      <p className="mt-1 text-slate-600 leading-relaxed">{s.gives}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <span className="font-semibold text-slate-800">How Aarka Parses &amp; Verifies It</span>
                      <p className="mt-1 text-slate-600 leading-relaxed">{s.howRead}</p>
                      <p className="mt-1.5 text-slate-500">{s.note}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                      <span className="font-semibold text-emerald-900">Security &amp; Provenance Boundary</span>
                      <p className="mt-1 text-emerald-800 leading-relaxed">{s.security}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        Workspace telemetry: {liveBadgeForSource(s.id)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {s.surfaces.map((surf) => (
                          <Link
                            key={surf.label}
                            href={surf.href}
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            Open {surf.label} →
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {inspector.type === "engine" && (() => {
              const a = inspector.item;
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", AGENT_TONE[a.status])}>
                        {a.status}
                      </span>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">{a.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{a.job}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspector(null)}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700">Data Inputs Read</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.reads.map((r) => (
                          <span key={r} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="font-semibold text-slate-800">What This Engine Produces</span>
                      <p className="mt-1 text-slate-600 leading-relaxed">{a.suggests}</p>
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                      <span className="font-semibold text-indigo-900">Human Approval &amp; Governance</span>
                      <p className="mt-1 text-indigo-900/80 leading-relaxed">{a.approval}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                      <span className="font-semibold text-emerald-900">Zero-Hallucination Guardrail</span>
                      <p className="mt-1 text-emerald-800 leading-relaxed">{a.guardrail}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-slate-500">{a.statusNote}</span>
                      <Link
                        href={a.href}
                        className="shrink-0 rounded-md bg-slate-900 px-3.5 py-1.5 font-semibold text-white hover:bg-slate-800"
                      >
                        Open Workspace →
                      </Link>
                    </div>
                  </div>
                </>
              );
            })()}

            {inspector.type === "event" && (() => {
              const e = inspector.item;
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Verified Audit Log Entry · {fmtDay(e.date)}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        {e.actor} · {e.company}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspector(null)}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {e.text}
                  </div>
                  <div className="flex items-center justify-between pt-2 text-xs">
                    <span className="text-slate-500">
                      Source class: <strong className="capitalize text-slate-700">{e.kind}</strong>
                    </span>
                    <Link
                      href={e.href}
                      className="rounded-md bg-slate-900 px-3.5 py-1.5 font-semibold text-white hover:bg-slate-800"
                    >
                      Open {e.company} →
                    </Link>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
