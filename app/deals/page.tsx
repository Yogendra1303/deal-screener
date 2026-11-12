"use client";

// Pitches: every deck that reached the fund as one quiet list, with a few tabs. Live pitches carry a dot.
// An analyst sees their own and the ones nobody has picked up; the partner sees the whole team's.
import { windowCounts } from "@/lib/change";
import { ZeroState } from "@/components/mode";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeckList, PillTabs, TempPill, slugOf as sectorSlug, triageOrder, useDealFlow, type FlowRow, type SectorStat } from "@/components/flow";
import { Delta } from "@/components/charts";
import { useStore } from "@/components/store";
import { DropdownSelect, LABEL, Notice, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { FLOW_NOTE } from "@/lib/flow";
import { MARKET, PITCH_ADDRESS } from "@/lib/funnel";
import { daysBetween } from "@/lib/portfolio/health";
import { slugOf } from "@/lib/links";
import { TEAM } from "@/lib/team";

const OPEN = new Set(["New", "Never opened", "Reviewing"]);
const TABS: { key: string; label: string; test: (r: FlowRow) => boolean }[] = [
  { key: "read", label: "To read", test: (r) => OPEN.has(r.label) },
  { key: "look", label: "Look again", test: (r) => Boolean(r.look.event) },
  { key: "meet", label: "Meetings", test: (r) => r.status === "Meeting set" },
  { key: "passed", label: "Passed", test: (r) => r.status === "Passed" || r.status === "On hold" },
  { key: "all", label: "All", test: () => true },
];

/** Quick views that sit on top of any tab. Both are worked out by code from the same rows. */
const CHIPS: { key: string; dot: string; label: string; hint: string; on: string; test: (r: FlowRow) => boolean }[] = [
  {
    key: "strong",
    dot: "bg-emerald-600",
    label: "Strong Founder Fit",
    hint: "Founders who worked directly on this problem for years, or built a company in the same space before.",
    on: "border-emerald-300 bg-emerald-50 text-emerald-800",
    test: (r) => r.fit === "Strong",
  },
  {
    key: "gap",
    dot: "bg-rose-600",
    label: "Math Gap >10%",
    hint: "A number in the deck differs by more than 10% from the monthly sheet, the form, or the deck's own maths.",
    on: "border-red-300 bg-red-50 text-red-800",
    test: (r) => Boolean(r.cover?.flags.some((f) => f.kind === "conflict")),
  },
  {
    key: "missing",
    dot: "bg-amber-500",
    label: "Missing Facts",
    hint: "The submission leaves out at least one of the 8 core facts: revenue, growth, customers, team, round, founding year, burn, founders' past roles.",
    on: "border-amber-300 bg-amber-50 text-amber-800",
    test: (r) => Boolean(r.cover?.missing.length),
  },
  {
    key: "reengage",
    dot: "bg-sky-600",
    label: "Re-Engage Due",
    hint: "Passed or held deals whose re-engage trigger was met, or whose check date has passed.",
    on: "border-amber-300 bg-amber-50 text-amber-800",
    test: (r) => r.look.parts.some(([k]) => k === "Trigger met" || k === "Check date passed"),
  },
  {
    key: "never",
    dot: "bg-slate-500",
    label: "Never Opened",
    hint: "Decks that arrived 7+ days ago and have not been claimed by an owner yet.",
    on: "border-slate-300 bg-slate-100 text-slate-800",
    test: (r) => r.label === "Never opened",
  },
];

export default function DealsPage() {
  const store = useStore();
  const w = useWorkspace();
  const analyst = w.role === "Analyst";
  const [tab, setTab] = useState("read");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [who, setWho] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t && TABS.some((x) => x.key === t)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(t);
    }
    const s = params.get("sector");
    if (s && MARKET.some((m) => m.sector === s)) {
      setSector(s);
    }
    const f = params.get("filter");
    if (f && CHIPS.some((c) => c.key === f)) {
      setChips([f]);
    }
    const qParam = params.get("q");
    if (qParam) {
      setQuery(qParam);
      setTab("all");
    }
  }, []);
  const flow = useDealFlow((o) => (analyst ? !o || o === w.me : !who || o === who));

  const q = query.trim().toLowerCase();
  const searched = flow.rows.filter((r) => (!sector || r.sector === sector) && (!q || `${r.name} ${r.sector} ${r.sub} ${r.city} ${r.line ?? ""}`.toLowerCase().includes(q)));
  const active = CHIPS.filter((c) => chips.includes(c.key));
  const narrowed = searched.filter((r) => active.every((c) => c.test(r)));
  // Re-engage only makes sense on passed and held deals, so it jumps to that tab rather than showing an empty one.
  const toggle = (key: string) => {
    const on = !chips.includes(key);
    setChips((cur) => (on ? [...cur, key] : cur.filter((k) => k !== key)));
    if (on && key === "reengage" && tab !== "passed" && tab !== "look" && tab !== "all") setTab("passed");
  };
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const list = narrowed.filter(current.test);
  const sorted = tab === "read" ? [...list].sort(triageOrder) : list;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{analyst ? "My pitches" : "Pitches"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {analyst ? "Yours, and new ones nobody has picked up." : "Every deck that reached the fund, across the team."} A dark dot is a live pitch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm" role="group" aria-label="Demo Role">
            <span className="px-2 font-medium text-slate-600">Demo Role:</span>
            {(["Partner", "Analyst"] as const).map((r) => {
              const activeRole = w.role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => w.setDemoRole(r)}
                  aria-pressed={activeRole}
                  className={cx(
                    "rounded px-2.5 py-1 font-medium leading-tight transition-colors",
                    activeRole ? "bg-blue-600 text-white shadow-2xs" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <PitchLinkButton refSlug={analyst ? slugOf(w.me) : undefined} />
          {analyst && (
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium leading-tight text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              title="Add a pitch for the AI to read"
            >
              Add for AI reading
            </Link>
          )}
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium leading-tight text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
          <Pulse rows={searched} filtered={Boolean(q || sector || who)} market={flow.market} today={flow.today} onPick={setTab} />
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <PillTabs options={TABS.map((t) => ({ key: t.key, label: t.label, count: narrowed.filter(t.test).length }))} value={tab} onChange={setTab} />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="inbox-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, city…"
                  className="w-44 max-w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm leading-tight text-slate-900 placeholder:text-slate-500 shadow-sm focus:border-blue-600 focus:outline-none"
                />
                <DropdownSelect
                  ariaLabel="Sector"
                  value={sector}
                  onChange={setSector}
                  options={[{ value: "", label: "All sectors" }, ...MARKET.map((m) => ({ value: m.sector, label: m.sector }))]}
                  align="right"
                />
                {!analyst && (
                  <DropdownSelect
                    ariaLabel="Person"
                    value={who}
                    onChange={setWho}
                    options={[{ value: "", label: "Everyone" }, ...TEAM.map((m) => ({ value: m.name, label: m.name.split(" ")[0] }))]}
                    align="right"
                  />
                )}
              </div>
            </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick filters">
            <span className={cx(LABEL, "mr-1")}>Filter</span>
            {CHIPS.map((c) => {
              const on = chips.includes(c.key);
              const n = searched.filter((r) => c.test(r) && active.every((a) => a.key === c.key || a.test(r))).length;
              return (
                <button
                  key={c.key}
                  onClick={() => toggle(c.key)}
                  aria-pressed={on}
                  title={c.hint}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    on ? c.on : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                                    {c.label}
                  <span className={cx("font-mono tabular-nums", on ? "" : "text-slate-400")}>{n}</span>
                  {on && <span aria-hidden className="-mr-1 text-[13px] leading-none opacity-60">×</span>}
                </button>
              );
            })}
            {active.length > 0 && (
              <button onClick={() => setChips([])} className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
                Clear
              </button>
            )}
          </div>

          </div>

          {sector && (
            <Link href={`/sectors/${sectorSlug(sector)}`} className="inline-flex text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline">
              What is happening in {sector} →
            </Link>
          )}

          <DeckList
            key={`${tab}-${sector}-${q}-${who}-${chips.join(",")}`}
            rows={sorted}
            sort={tab === "look" ? "look" : "date"}
            group={tab !== "read"}
            owners={!analyst}
            pageSize={50}
            empty="Nothing here."
          />
          <p className="text-xs text-slate-400">{FLOW_NOTE}</p>
        </>
      )}
    </div>
  );
}

function PitchLinkButton({ refSlug }: { refSlug?: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/founder/pitch${refSlug ? `?ref=${refSlug}` : ""}`;
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white text-sm font-medium leading-tight shadow-sm">
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(`${window.location.origin}${path}`).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
        title={refSlug ? "Your personal pitch link. Pitches sent through it come straight to you." : "The public link on the fund's website"}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50"
      >
        {copied ? "Copied" : refSlug ? "Copy my pitch link" : "Copy pitch link"}
      </button>
      <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center border-l border-slate-200 px-2.5 py-1.5 text-slate-500 transition-colors hover:bg-slate-50" title="Open it as a founder">
        ↗
      </a>
    </span>
  );
}

/** The top strip: the inbox connection, four counts and the sectors moving most. Plain cells on a white panel. */
function Pulse({ rows, filtered, market, today, onPick }: { rows: FlowRow[]; filtered: boolean; market: SectorStat[]; today: string; onPick: (tab: string) => void }) {
  const recent = rows.filter((r) => r.dates.some((d) => daysBetween(d, today) <= 5 && d <= today)).length;
  const toRead = rows.filter((r) => OPEN.has(r.label)).length;
  const fitOpen = rows.filter((r) => OPEN.has(r.label) && r.fits && r.fit === "Strong").length;
  const lookNow = rows.filter((r) => r.look.now).length;
  const movers = [...market].sort((a, b) => Math.abs(b.inboundChange) - Math.abs(a.inboundChange)).slice(0, 4);
  // Each count is taken from the same rows as the list below (search, sector and person applied), so an empty search shows 0.
  const cells: [string, number, string, string, string][] = [
    ["Inbound, last 5 days", recent, recent === 1 ? "company" : "companies", "bg-slate-900", "all"],
    ["To read", toRead, "open decks", "bg-slate-400", "read"],
    ["Strong fit, open", fitOpen, "fit our rules too", "bg-emerald-500", "read"],
    ["Look again now", lookNow, "passed, news since", "bg-amber-500", "look"],
  ];
  return (
    <section className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold tracking-tight text-slate-900">
          Deal flow pulse{filtered && <span className="ml-2 text-xs font-normal text-slate-500">for your search and filters</span>}
        </h2>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Inbox: <span className="rounded bg-slate-100 px-1 font-mono text-slate-700">{PITCH_ADDRESS}</span>
          <span className="text-slate-400">· active</span>
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 xl:grid-cols-6">
        {cells.map(([label, n, unit, bar, tab]) => (
          <button
            key={label}
            onClick={() => onPick(tab)}
            title="Show these in the list below"
            className="relative overflow-hidden rounded-lg bg-slate-50 px-3 pt-3.5 pb-2.5 text-left transition-colors hover:bg-slate-100"
          >
            <span className={cx("absolute inset-x-0 top-0 h-0.5", bar)} />
            <p className={LABEL}>{label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{n}</span>
              <span className="text-xs text-slate-500">{unit}</span>
            </p>
          </button>
        ))}
        <div className="relative col-span-2 md:col-span-4 xl:col-span-2 overflow-hidden rounded-lg bg-slate-50 px-3 pt-3.5 pb-2">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-slate-300" />
          <p className={LABEL}>Sectors moving most · 3 months</p>
          <ul className="mt-1.5 space-y-1">
            {movers.map((m) => (
              <li key={m.sector} className="flex items-center justify-between gap-2 text-sm">
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
