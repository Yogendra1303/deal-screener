"use client";

// Pitches: clean Linear/Stripe-grade deal pipeline with live inbound tab, compact unified filters,
// working Sort/Facet dropdowns, List/Kanban toggle, and dedicated AI Reading Queue modal.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AIReadQueueModal } from "@/components/ai-read-queue-modal";
import { Delta } from "@/components/charts";
import { DeckList, TempPill, slugOf as sectorSlug, triageOrder, useDealFlow, type FlowRow, type SectorStat } from "@/components/flow";
import { useLinks } from "@/components/links-store";
import { ZeroState } from "@/components/mode";
import { PipelineKanban } from "@/components/pipeline-kanban";
import { useStore } from "@/components/store";
import { DropdownSelect, LABEL, Notice, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { windowCounts } from "@/lib/change";
import { triggerDealSync } from "@/lib/deal-sync";
import { downloadCsv } from "@/lib/export";
import { FLOW_NOTE } from "@/lib/flow";
import { MARKET, PITCH_ADDRESS } from "@/lib/funnel";
import { daysBetween } from "@/lib/portfolio/health";

const OPEN = new Set(["New", "Never opened", "Reviewing"]);

const TABS: { key: string; label: string; liveAccent?: boolean; test: (r: FlowRow) => boolean }[] = [
  { key: "read", label: "To read", test: (r) => OPEN.has(r.label) },
  { key: "live", label: "Live inbound", liveAccent: true, test: (r) => Boolean(r.isLiveSubmission) },
  { key: "meet", label: "Meetings", test: (r) => r.status === "Meeting set" },
  { key: "hold", label: "On hold", test: (r) => r.status === "On hold" },
  { key: "look", label: "Look again", test: (r) => Boolean(r.look.event) },
  { key: "passed", label: "Passed", test: (r) => r.status === "Passed" },
  { key: "all", label: "All", test: () => true },
];

type SortKey = "newest" | "oldest" | "triage" | "sector" | "ask_desc" | "ask_asc" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "triage", label: "Priority triage" },
  { value: "sector", label: "Sector (A → Z)" },
  { value: "ask_desc", label: "Ask: High → Low" },
  { value: "ask_asc", label: "Ask: Low → High" },
  { value: "name", label: "Company (A → Z)" },
];

const STAGE_OPTIONS = [
  { value: "", label: "All stages" },
  { value: "Pre-seed", label: "Pre-seed" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B+", label: "Series B+" },
];

type AskBand = "" | "under_1m" | "1m_2m" | "2m_4m" | "over_4m";

const ASK_OPTIONS: { value: AskBand; label: string }[] = [
  { value: "", label: "Any ask" },
  { value: "under_1m", label: "Under $1M" },
  { value: "1m_2m", label: "$1M – $2M" },
  { value: "2m_4m", label: "$2M – $4M" },
  { value: "over_4m", label: "Over $4M" },
];

function matchesAskBand(askUsd: number | null, band: AskBand): boolean {
  if (!band) return true;
  if (askUsd == null) return false;
  if (band === "under_1m") return askUsd < 1_000_000;
  if (band === "1m_2m") return askUsd >= 1_000_000 && askUsd <= 2_000_000;
  if (band === "2m_4m") return askUsd > 2_000_000 && askUsd <= 4_000_000;
  return askUsd > 4_000_000;
}

/** High-signal, non-conflicting VC quality filters tucked cleanly inside the Signals popover. */
const SIGNAL_FILTERS: { key: string; dot: string; label: string; hint: string; test: (r: FlowRow) => boolean }[] = [
  {
    key: "mandate",
    dot: "bg-indigo-600",
    label: "Fits Mandate",
    hint: "Matches the fund's sector, stage, geography, and check-size rules.",
    test: (r) => r.fits,
  },
  {
    key: "strong",
    dot: "bg-emerald-600",
    label: "Strong Founder Fit",
    hint: "Founders who worked directly on this problem for years, or built in the same space before.",
    test: (r) => r.fit === "Strong",
  },
  {
    key: "repeat",
    dot: "bg-teal-600",
    label: "Repeat Founder",
    hint: "Founder has previously founded or scaled a venture-backed startup.",
    test: (r) => r.repeat,
  },
  {
    key: "warm",
    dot: "bg-violet-600",
    label: "Warm Intro",
    hint: "Referred through a known founder, co-investor, or partner contact.",
    test: (r) => Boolean(r.warm),
  },
  {
    key: "gap",
    dot: "bg-rose-600",
    label: "Math Gap >10%",
    hint: "A number in the deck differs by more than 10% from the monthly sheet or form.",
    test: (r) => Boolean(r.cover?.flags.some((f) => f.kind === "conflict")),
  },
  {
    key: "missing",
    dot: "bg-amber-500",
    label: "Missing Facts",
    hint: "Submission omits at least one of the 8 core diligence facts.",
    test: (r) => Boolean(r.cover?.missing.length),
  },
  {
    key: "never",
    dot: "bg-slate-500",
    label: "Never Opened (7d+)",
    hint: "Decks that arrived 7+ days ago with no owner yet.",
    test: (r) => r.label === "Never opened",
  },
];

function sortTimestamp(r: FlowRow): string {
  return r.receivedAtIso || r.last || "";
}

function sortRows(rows: FlowRow[], sortBy: SortKey): FlowRow[] {
  const copy = [...rows];
  switch (sortBy) {
    case "newest":
      return copy.sort((a, b) => sortTimestamp(b).localeCompare(sortTimestamp(a)) || a.name.localeCompare(b.name));
    case "oldest":
      return copy.sort((a, b) => sortTimestamp(a).localeCompare(sortTimestamp(b)) || a.name.localeCompare(b.name));
    case "triage":
      return copy.sort(triageOrder);
    case "sector":
      return copy.sort((a, b) => a.sector.localeCompare(b.sector) || sortTimestamp(b).localeCompare(sortTimestamp(a)));
    case "ask_desc":
      return copy.sort((a, b) => (b.askUsd ?? -1) - (a.askUsd ?? -1) || sortTimestamp(b).localeCompare(sortTimestamp(a)));
    case "ask_asc":
      return copy.sort((a, b) => (a.askUsd ?? Number.MAX_SAFE_INTEGER) - (b.askUsd ?? Number.MAX_SAFE_INTEGER) || sortTimestamp(b).localeCompare(sortTimestamp(a)));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

export default function DealsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading pitches…</p>}>
      <DealsContent />
    </Suspense>
  );
}

function DealsContent() {
  const searchParams = useSearchParams();
  const store = useStore();
  const links = useLinks();
  const w = useWorkspace();
  const analyst = w.role === "Analyst";

  const [tab, setTab] = useState("read");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [askBand, setAskBand] = useState<AskBand>("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [chips, setChips] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [aiQueueOpen, setAiQueueOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const signalsRef = useRef<HTMLDivElement>(null);

  // React cleanly to URL parameters (including repeated searches from the global top search bar)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) {
      setTab(t);
    }
    const s = searchParams.get("sector");
    if (s && MARKET.some((m) => m.sector === s)) {
      setSector(s);
    }
    const st = searchParams.get("stage");
    if (st && STAGE_OPTIONS.some((x) => x.value === st)) {
      setStage(st);
    }
    const f = searchParams.get("filter");
    if (f) {
      if (f === "live") {
        setTab("live");
      } else if (f === "hold") {
        setTab("hold");
      } else if (SIGNAL_FILTERS.some((c) => c.key === f)) {
        setChips([f]);
      }
    }
    const qParam = searchParams.get("q");
    if (qParam !== null) {
      setQuery(qParam);
      if (qParam.trim()) {
        setTab("all");
        setChips([]);
      }
    }
  }, [searchParams]);

  // Trigger a background live sync whenever opening /deals
  useEffect(() => {
    void triggerDealSync();
  }, []);

  // Close Signals popover on outside click / Escape
  useEffect(() => {
    if (!signalsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (signalsRef.current && !signalsRef.current.contains(e.target as Node)) {
        setSignalsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSignalsOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [signalsOpen]);

  // Analysts see their own, unclaimed, AND all live founder submissions
  const flow = useDealFlow((o) => (analyst ? !o || o === w.me : true));

  const unreadAiCount = useMemo(() => {
    const unreadInbound = links.inbound.filter((i) => {
      const d = store.getDeal(i.id);
      return !d || (d.model || "").includes("deterministic");
    }).length;
    return unreadInbound + store.unprocessed.length;
  }, [links.inbound, store]);

  const q = query.trim().toLowerCase();
  const searched = useMemo(
    () =>
      flow.rows.filter(
        (r) =>
          (!sector || r.sector === sector) &&
          (!stage ||
            (stage === "Series B+"
              ? /series\s*[b-z]|growth/i.test(r.stage)
              : r.stage.toLowerCase() === stage.toLowerCase())) &&
          matchesAskBand(r.askUsd, askBand) &&
          (!q || `${r.name} ${r.sector} ${r.sub} ${r.city} ${r.stage} ${r.founderName ?? ""} ${r.founderEmail ?? ""} ${r.line ?? ""}`.toLowerCase().includes(q)),
      ),
    [flow.rows, sector, stage, askBand, q],
  );

  const activeSignals = SIGNAL_FILTERS.filter((c) => chips.includes(c.key));
  const narrowed = useMemo(
    () => searched.filter((r) => activeSignals.every((c) => c.test(r))),
    [searched, activeSignals],
  );

  const toggleSignal = (key: string) => {
    setChips((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const hasAnyFilter = Boolean(q || sector || stage || askBand || activeSignals.length > 0 || sortBy !== "newest");
  const resetAllFilters = () => {
    setQuery("");
    setSector("");
    setStage("");
    setAskBand("");
    setSortBy("newest");
    setChips([]);
  };

  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const list = narrowed.filter(current.test);
  const sorted = useMemo(() => sortRows(list, sortBy), [list, sortBy]);
  const useMonthGroups = tab !== "read" && tab !== "live" && (sortBy === "newest" || sortBy === "oldest");

  async function manualSync() {
    setSyncing(true);
    try {
      await triggerDealSync();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{analyst ? "My pitches" : "Pitches"}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {analyst ? "Yours, unclaimed decks, and every live founder submission." : "Every deck that reached the fund, across the team."} Live submissions appear first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-2xs" role="group" aria-label="Pipeline view">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cx(
                "cursor-pointer rounded px-2.5 py-1 font-semibold transition-colors",
                viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={cx(
                "cursor-pointer rounded px-2.5 py-1 font-semibold transition-colors",
                viewMode === "board" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900",
              )}
            >
              Board
            </button>
          </div>
          <button
            type="button"
            onClick={() => setAiQueueOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-2xs transition-colors hover:bg-indigo-100"
            title="Select an already-submitted pitch from the list to run deep AI extraction"
          >
            <span>Run AI reading</span>
            {unreadAiCount > 0 && (
              <span className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {unreadAiCount}
              </span>
            )}
          </button>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-blue-700"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Upload Pitch
          </Link>
        </div>
      </div>

      {store.saveError && <Notice tone="error">{store.saveError}</Notice>}

      {!store.ready ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : !flow.rows.length && !analyst ? (
        <ZeroState />
      ) : (
        <>
          <Pulse rows={searched} filtered={Boolean(q || sector || stage || askBand)} market={flow.market} today={flow.today} onPick={setTab} />

          {/* Compact Linear-grade Unified Filter & Stage Bar */}
          <div className="rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {/* Row 1: Compact Stage Tabs + Utility Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1" role="tablist" aria-label="Pipeline stage">
                {TABS.map((t) => {
                  const count = narrowed.filter(t.test).length;
                  const on = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.key)}
                      className={cx(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                        on
                          ? "bg-slate-900 text-white shadow-2xs"
                          : t.liveAccent && count > 0
                            ? "bg-blue-50/90 text-blue-800 hover:bg-blue-100"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      {t.liveAccent && (
                        <span className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-blue-400" : "bg-blue-600 animate-pulse")} />
                      )}
                      <span>{t.label}</span>
                      <span
                        className={cx(
                          "font-mono text-[11px] tabular-nums",
                          on ? "text-slate-300" : t.liveAccent && count > 0 ? "font-bold text-blue-700" : "text-slate-400",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void manualSync()}
                  disabled={syncing}
                  title="Sync latest submitted pitches"
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "↻ Sync"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadCsv(
                      `aarka-pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Company", "Sector", "Stage", "City", "Ask (USD)", "Status", "Founder Fit", "Fits Mandate", "Owner", "Latest Date", "Founder"],
                      sorted.map((r) => [
                        r.name,
                        r.sector,
                        r.stage,
                        r.city,
                        r.askUsd ?? "",
                        r.status,
                        r.fit,
                        r.fits ? "Yes" : "No",
                        r.owner ?? "Unassigned",
                        r.last,
                        r.founderName ?? "",
                      ]),
                    );
                  }}
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Export CSV ({sorted.length})
                </button>
              </div>
            </div>

            {/* Row 2: Unified Search + 4 Compact Dropdowns + Collapsible Signals Popover */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="relative min-w-[200px] flex-1">
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  id="inbox-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, founder, sector, city…"
                  className="h-8 w-full rounded-md border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <DropdownSelect
                ariaLabel="Sector"
                size="sm"
                value={sector}
                onChange={setSector}
                options={[{ value: "", label: "All sectors" }, ...MARKET.map((m) => ({ value: m.sector, label: m.sector }))]}
                align="right"
              />
              <DropdownSelect
                ariaLabel="Stage"
                size="sm"
                value={stage}
                onChange={setStage}
                options={STAGE_OPTIONS}
                align="right"
              />
              <DropdownSelect<AskBand>
                ariaLabel="Check size"
                size="sm"
                value={askBand}
                onChange={setAskBand}
                options={ASK_OPTIONS}
                align="right"
              />
              <DropdownSelect<SortKey>
                ariaLabel="Sort order"
                size="sm"
                prefix="Sort:"
                value={sortBy}
                onChange={setSortBy}
                options={SORT_OPTIONS}
                align="right"
              />

              {/* Compact Collapsible Signal Filters Popover */}
              <div ref={signalsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSignalsOpen((v) => !v)}
                  aria-expanded={signalsOpen}
                  className={cx(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-2xs transition-colors",
                    activeSignals.length > 0 || signalsOpen
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 6h18M7 12h10M10 18h4" />
                  </svg>
                  <span>Filters</span>
                  {activeSignals.length > 0 && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                      {activeSignals.length}
                    </span>
                  )}
                </button>

                {signalsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15">
                    <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Signal Filters</span>
                      {activeSignals.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setChips([])}
                          className="cursor-pointer text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {SIGNAL_FILTERS.map((c) => {
                        const on = chips.includes(c.key);
                        const n = searched.filter((r) => c.test(r) && activeSignals.every((a) => a.key === c.key || a.test(r))).length;
                        return (
                          <li key={c.key}>
                            <button
                              type="button"
                              onClick={() => toggleSignal(c.key)}
                              title={c.hint}
                              className={cx(
                                "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                                on ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700 hover:bg-slate-50",
                              )}
                            >
                              <span className="inline-flex items-center gap-2 truncate">
                                <span className={cx("h-2 w-2 shrink-0 rounded-full", c.dot)} />
                                <span className="truncate">{c.label}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] tabular-nums text-slate-400">{n}</span>
                                <span
                                  className={cx(
                                    "grid h-4 w-4 place-items-center rounded border text-[10px]",
                                    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white",
                                  )}
                                >
                                  {on ? "✓" : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="cursor-pointer px-1.5 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Active Signal Pills Strip — ONLY shown when user has enabled a signal filter */}
            {activeSignals.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/60 px-3 py-1.5">
                <span className="text-[11px] font-medium text-slate-400">Active:</span>
                {activeSignals.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleSignal(c.key)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    <span className={cx("h-1.5 w-1.5 rounded-full", c.dot)} />
                    {c.label}
                    <span aria-hidden className="ml-0.5 text-xs opacity-60">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {sector && (
            <Link href={`/sectors/${sectorSlug(sector)}`} className="inline-flex text-xs font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline">
              What is happening in {sector} →
            </Link>
          )}

          {viewMode === "board" ? (
            <PipelineKanban rows={sortRows(narrowed, sortBy)} showOwners={!analyst} />
          ) : sorted.length === 0 && hasAnyFilter ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No pitches match your current filter combination.</p>
              <p className="mt-1 text-xs text-slate-500">
                Try switching to the “All” or “Live inbound” tab, or clearing active filters.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetAllFilters();
                    setTab("all");
                  }}
                  className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Clear all filters &amp; show all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAllFilters();
                    setTab("live");
                  }}
                  className="cursor-pointer rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                >
                  View live submissions
                </button>
              </div>
            </div>
          ) : (
            <DeckList
              key={`${tab}-${sector}-${stage}-${askBand}-${sortBy}-${q}-${chips.join(",")}`}
              rows={sorted}
              sort={tab === "look" && sortBy === "triage" ? "look" : "date"}
              group={useMonthGroups}
              owners={!analyst}
              pageSize={50}
              empty="No pitches in this view yet."
            />
          )}

          <p className="text-xs text-slate-400">{FLOW_NOTE}</p>
        </>
      )}

      <AIReadQueueModal isOpen={aiQueueOpen} onClose={() => setAiQueueOpen(false)} />
    </div>
  );
}

/** The top strip: the inbox connection, four counts and the sectors moving most. Plain cells on a white panel. */
function Pulse({ rows, filtered, market, today, onPick }: { rows: FlowRow[]; filtered: boolean; market: SectorStat[]; today: string; onPick: (tab: string) => void }) {
  const recent = rows.filter((r) => r.isLiveSubmission || r.dates.some((d) => daysBetween(d, today) <= 5 && d <= today)).length;
  const toRead = rows.filter((r) => OPEN.has(r.label)).length;
  const fitOpen = rows.filter((r) => OPEN.has(r.label) && r.fits && r.fit === "Strong").length;
  const lookNow = rows.filter((r) => r.look.now).length;
  const movers = [...market].sort((a, b) => Math.abs(b.inboundChange) - Math.abs(a.inboundChange)).slice(0, 4);
  const cells: [string, number, string, string, string][] = [
    ["Inbound, recent & live", recent, recent === 1 ? "company" : "companies", "bg-blue-600", "live"],
    ["To read", toRead, "open decks", "bg-slate-400", "read"],
    ["Strong fit, open", fitOpen, "fit our rules too", "bg-emerald-500", "read"],
    ["Look again now", lookNow, "passed, news since", "bg-amber-500", "look"],
  ];
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-tight text-slate-900">
          Deal flow pulse{filtered && <span className="ml-2 text-xs font-normal text-slate-500">for your search and filters</span>}
        </h2>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Inbox: <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{PITCH_ADDRESS}</span>
          <span className="text-slate-400">· active</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4 xl:grid-cols-6">
        {cells.map(([label, n, unit, bar, targetTab]) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(targetTab)}
            className="relative cursor-pointer overflow-hidden rounded-lg bg-slate-50 px-3 pt-3 pb-2 text-left transition-colors hover:bg-slate-100"
          >
            <span className={cx("absolute inset-x-0 top-0 h-0.5", bar)} />
            <p className={LABEL}>{label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{n}</span>
              <span className="text-xs text-slate-500">{unit}</span>
            </p>
          </button>
        ))}
        <div className="relative col-span-2 overflow-hidden rounded-lg bg-slate-50 px-3 pt-3 pb-2 md:col-span-4 xl:col-span-2">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-slate-300" />
          <p className={LABEL}>Sectors moving most · 3 months</p>
          <ul className="mt-1 space-y-0.5">
            {movers.map((m) => (
              <li key={m.sector} className="flex items-center justify-between gap-2 text-xs">
                <Link href={`/sectors/${sectorSlug(m.sector)}`} className="w-28 truncate font-medium text-slate-700 hover:text-slate-900">
                  {m.sector}
                </Link>
                <Delta value={m.inboundChange} className="px-1 text-[10px]" from={windowCounts(m.counts)} />
                <TempPill t={m.temp} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
