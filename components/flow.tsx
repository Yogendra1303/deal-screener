"use client";

// The deal-flow terminal: every deck the fund has ever received as one list of rows (the live pitches
// plus 6 months of sample history), the market map, the news list, the look-again list and the deck list.
// Counts, ranks and readings are worked out here by code from those rows.
import { windowCounts } from "@/lib/change";
import { DocDrawer, useDocs } from "./docs";
import type { SourceDoc } from "@/lib/docs";
import { checkUploadCached } from "@/lib/upload";
import { useMode } from "./mode";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Panel, usePitches, type IconKey, type TileSpec, type Tone } from "./cards";
import { Delta, GradeKey, MarketMap, Sparkline } from "./charts";
import { useLinks } from "./links-store";
import { Avatar } from "./shell";
import { useStore } from "./store";
import { toFlowKind } from "@/lib/signals";
import { Tag, cx, type ToneKey } from "./ui";
import { sampleById } from "@/lib/data";
import { fmtDay } from "@/lib/dates";
import { fmtMonth } from "@/lib/format";
import { FLOW, FLOW_NOTE, LOOK_NOW, LOOK_RECENT_DAYS, SUB_FOR, deckCounts, fitsRules, lookAgain, missRate, type FlowSignal } from "@/lib/flow";
import { FUNNEL, MARKET, MONTHS, TEMP_SHARE, founderFit, sampleChannel, temperature, type Decision, type FitLevel, type Temperature, TEMP_RULE_TEXT } from "@/lib/funnel";
import { daysBetween } from "@/lib/portfolio/health";
import { usd } from "@/lib/rules";
import type { DealStatus } from "@/lib/types";
import { archiveById } from "@/lib/archive";
import { coverage, type Coverage } from "@/lib/coverage";
import { ChecksCell, type SourceKey } from "./checks-ui";

export type FeedKind = FlowSignal["kind"] | "Rival raised";

export interface FlowRow {
  id: string;
  name: string;
  href: string;
  live: boolean;
  sector: string;
  sub: string;
  city: string;
  stage: string;
  askUsd: number | null;
  dates: string[];
  last: string;
  via: string;
  fit: FitLevel | null;
  repeat: boolean;
  tenPlus: boolean;
  warm?: string;
  owner?: string;
  status: DealStatus;
  /** New, Never opened, Reviewing, Meeting set, On hold or Passed. */
  label: string;
  decision?: Decision;
  signals: FlowSignal[];
  fits: boolean;
  look: ReturnType<typeof lookAgain>;
  line?: string;
  /** What the code checks found; null when the deck hasn't been read yet. */
  cover: Coverage | null;
  sources: SourceKey[];
}

export interface SectorStat {
  sector: string;
  counts: number[];
  temp: Temperature;
  inboundChange: number;
  moneyChange: number;
  raised: [number, number];
  rounds: [number, number];
}

export const NEVER_OPENED_DAYS = 7;
export const slugOf = (sector: string) => sector.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const sectorOfSlug = (slug: string) => MARKET.find((m) => slugOf(m.sector) === slug)?.sector;
const money = (n: number | null) => (n ? usd(n) : "");

const EVERYONE = () => true;

/** Every deck as a row: live pitches, then the history. The market is always the whole fund's; `scope` narrows the rows to one person's. */
/** Signals someone logged in the app, in the shape lookAgain() scores. */
function loggedFor(store: ReturnType<typeof useStore>, id: string, today: string): FlowSignal[] {
  return (store.signalsOf(id) ?? [])
    .filter((s) => s.at <= today)
    .map((s) => ({ kind: toFlowKind(s.kind), at: s.at, text: s.text, source: s.publisher ? `${s.publisher} (logged by ${s.by})` : `Logged by ${s.by}` }));
}

export function useDealFlow(scope: (owner?: string) => boolean = EVERYONE) {
  const store = useStore();
  const links = useLinks();
  const cards = usePitches(EVERYONE);
  const mode = useMode();
  const all = useMemo(() => {
    const today = links.today;
    const base: Omit<FlowRow, "look">[] = [];
    for (const c of cards) {
      const d = store.getDeal(c.id);
      const s = sampleById(c.id);
      const inb = links.getInbound(c.id);
      const form = d?.form ?? s?.form ?? inb?.form;
      if (!form) continue;
      const f = FUNNEL[c.id];
      const status = store.statusOf(c.id);
      const at = c.receivedAt.slice(0, 10);
      const unread = status === "New" && !c.owner && daysBetween(at, today) >= NEVER_OPENED_DAYS;
      const up = inb?.manual ? checkUploadCached(c.id, inb.form, inb.manual) : null;
      const fit = f ? founderFit(f.founders) : (up?.fit ?? null);
      base.push({
        id: c.id,
        name: c.name,
        href: c.href,
        live: true,
        sector: form.sector,
        sub: SUB_FOR[c.id] ?? f?.category ?? inb?.manual?.sub ?? form.sector,
        city: f?.city ?? (inb?.manual?.city || form.country),
        stage: form.stage,
        askUsd: form.amountUsd,
        dates: [at],
        last: at,
        via: inb ? inb.via : sampleChannel(c.id),
        fit: fit?.level ?? null,
        repeat: Boolean(fit?.repeat),
        tenPlus: Boolean(fit?.tenPlus),
        warm: f?.warm?.who,
        owner: c.owner,
        status,
        label: unread ? "Never opened" : status,
        decision: store.decisionOf(c.id),
        signals: loggedFor(store, c.id, today),
        fits: fitsRules({ stage: form.stage, askUsd: form.amountUsd }, form.sector, form.country, store.rules),
        line: c.line,
        cover: d ? coverage({ record: d.record, form: d.form, sheet: d.sheet, registry: d.registry, flags: d.flags }) : (up?.cover ?? null),
        sources: [
          "deck",
          ...(d?.sheet?.length || s?.sheetFile || inb?.manual?.sheet ? (["sheet"] as const) : []),
          (inb ? inb.via : sampleChannel(c.id)).includes("form") ? ("form" as const) : ("email" as const),
          ...(d?.registry ? (["registry"] as const) : []),
          ...(d?.profiles.length ? (["profile"] as const) : []),
        ],
      });
    }
    for (const h of mode === "FULL_90" ? FLOW : []) {
      const status = store.statusOf(h.id);
      const arch = archiveById(h.id);
      const last = h.decks[h.decks.length - 1];
      base.push({
        id: h.id,
        name: h.name,
        href: `/deals/${h.id}`,
        live: false,
        sector: h.sector,
        sub: h.sub,
        city: h.city,
        stage: last.stage,
        askUsd: last.askUsd,
        dates: h.decks.map((x) => x.at),
        last: last.at,
        via: last.via,
        fit: h.fit,
        repeat: h.repeat,
        tenPlus: h.tenPlus,
        warm: h.warm,
        owner: h.owner,
        status,
        label: status === "New" && h.outcome === "Never opened" && !store.statuses[h.id] ? "Never opened" : status,
        decision: store.decisionOf(h.id),
        signals: [...h.signals.filter((x) => x.at <= today), ...loggedFor(store, h.id, today)].sort((a, b) => a.at.localeCompare(b.at)),
        fits: fitsRules(last, h.sector, h.country, store.rules),
        cover: arch?.cover ?? null,
        sources: ["deck", ...(arch?.sheet ? (["sheet"] as const) : []), last.via === "Website link" || last.via === "Analyst link" ? ("form" as const) : ("email" as const)],
      });
    }
    const counts = deckCounts(base);
    const market: SectorStat[] = MARKET.map((m) => ({ sector: m.sector, counts: counts[m.sector], raised: m.raised, rounds: m.rounds, ...temperature({ inbound: counts[m.sector], raised: m.raised }) }));
    const heating = new Set(market.filter((m) => m.temp === "Heating up").map((m) => m.sector));
    const rows: FlowRow[] = base.map((r) => ({ ...r, look: lookAgain({ ...r, outcome: r.status === "Passed" || r.status === "On hold" ? r.status : "Waiting" }, heating, today) }));
    rows.sort((a, b) => b.last.localeCompare(a.last));
    return { rows, market, heating, today };
  }, [cards, store, links, mode]);
  return scope === EVERYONE ? all : { ...all, rows: all.rows.filter((r) => scope(r.owner)) };
}

/** Live decks first in the order code ranks them: fits the rules, founder-market fit, then waiting longest. */
export function triageOrder(a: FlowRow, b: FlowRow) {
  const fitRank = (r: FlowRow) => (r.fit === "Strong" ? 0 : r.fit === "Mixed" ? 1 : r.fit === "Weak" ? 2 : 3);
  return Number(b.fits) - Number(a.fits) || fitRank(a) - fitRank(b) || a.last.localeCompare(b.last);
}

export function lookOrder(a: FlowRow, b: FlowRow) {
  return Number(b.look.now) - Number(a.look.now) || b.look.points - a.look.points || (b.look.latest?.at ?? "").localeCompare(a.look.latest?.at ?? "");
}

export interface FeedItem {
  key: string;
  row: FlowRow;
  kind: FeedKind;
  at: string;
  text: string;
  source: string;
}

/** Every signal across the history, plus rivals of live pitches raising, newest first. */
export function feedOf(rows: FlowRow[]): FeedItem[] {
  const out: FeedItem[] = [];
  for (const r of rows) {
    r.signals.forEach((s, i) => out.push({ key: `${r.id}-${i}`, row: r, kind: s.kind, at: s.at, text: s.text, source: s.source }));
    if (r.live)
      for (const c of FUNNEL[r.id]?.competitors ?? [])
        if (c.signal === "Raised") out.push({ key: `${r.id}-${c.name}`, row: r, kind: "Rival raised", at: `${c.when}-28`, text: `${c.name} (${c.what}): ${c.detail}`, source: "Funding news" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------- Small pieces ----------

const LABEL_TONE: Record<string, ToneKey> = {
  New: "neutral",
  // Unread is a workflow state, not a data problem: neutral slate with a dot. Red stays for evidence conflicts.
  "Never opened": "neutral",
  Reviewing: "neutral",
  "Meeting set": "clear",
  "On hold": "review",
  Passed: "neutral",
};

export function LabelPill({ label }: { label: string }) {
  if (label === "Never opened")
    return (
      <Tag tone="neutral" title="No one at the fund has opened this deck yet. This is not a data problem.">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Never opened
      </Tag>
    );
  return <Tag tone={LABEL_TONE[label] ?? "neutral"}>{label === "Meeting set" ? "Meeting" : label}</Tag>;
}

const SIGNAL_DOT: Record<FeedKind, string> = {
  "Raised elsewhere": "bg-red-500",
  "Rival raised": "bg-amber-500",
  "Pitched again": "bg-slate-500",
  "Trigger met": "bg-emerald-500",
  "Team grew": "bg-emerald-500",
  "Shut down": "bg-slate-400",
};

export function SignalBadge({ kind }: { kind: FeedKind }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium whitespace-nowrap text-slate-600">
      <span className={cx("h-1.5 w-1.5 rounded-full", SIGNAL_DOT[kind])} />
      {kind}
    </span>
  );
}

export const TEMP_TONE: Record<Temperature, ToneKey> = {
  "Heating up": "clear",
  Crowding: "review",
  Steady: "neutral",
  Cooling: "alert",
};

export function TempPill({ t }: { t: Temperature }) {
  return <Tag tone={TEMP_TONE[t]}>{t}</Tag>;
}

/** A rounded square with the company's initials, tinted by its sector. */
export function Monogram({ name, size = "md" }: { name: string; sector?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || name.slice(0, 2).toUpperCase();
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg bg-slate-100 font-semibold text-slate-600", size === "sm" ? "h-8 w-8 text-[11px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-xs")}>
      {initials.length === 1 ? name.slice(0, 2).toUpperCase() : initials}
    </span>
  );
}

/** A panel whose body is a list of companies: used by cards and the market map. */
export function listSpec(key: string, o: { title: string; icon: IconKey; tone: Tone; explain: string; clear: string; how?: string; next?: string; rows: FlowRow[]; sort?: "date" | "look"; extra?: React.ReactNode }): TileSpec {
  return {
    key,
    title: o.title,
    count: o.rows.length,
    tone: o.tone,
    icon: o.icon,
    explain: o.explain,
    clear: o.clear,
    how: o.how,
    next: o.next,
    body: () => (
      <div className="space-y-4">
        {o.extra}
        <DeckList rows={o.rows} sort={o.sort} pageSize={20} />
      </div>
    ),
  };
}

// ---------- The list (a watchlist of companies) ----------

type ColSort = { key: "fit" | "ask" | "in"; dir: 1 | -1 };

function SortButton({ k, col, onFlip, children, right }: { k: ColSort["key"]; col: ColSort | null; onFlip: (k: ColSort["key"]) => void; children: React.ReactNode; right?: boolean }) {
  const on = col?.key === k;
  return (
    <button onClick={() => onFlip(k)} className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900", on && "text-slate-900", right && "flex-row-reverse")} title="Sort">
      {children}
      <span aria-hidden className={cx("text-[9px]", on ? "" : "opacity-30")}>
        {on ? (col!.dir === -1 ? "▼" : "▲") : "↕"}
      </span>
    </button>
  );
}
const FIT_RANK: Record<string, number> = { Strong: 3, Mixed: 2, Weak: 1 };
const colValue = (r: FlowRow, k: ColSort["key"]) => (k === "fit" ? (r.fit ? FIT_RANK[r.fit] : 0) : k === "ask" ? (r.askUsd ?? 0) : Date.parse(r.last));

export function DeckList({ rows, sort = "date", pageSize = 20, empty = "Nothing here.", group = true, owners = false }: { rows: FlowRow[]; sort?: "date" | "look"; pageSize?: number; empty?: string; group?: boolean; owners?: boolean }) {
  const [shown, setShown] = useState(pageSize);
  const [col, setCol] = useState<ColSort | null>(null);
  const docsFor = useDocs();
  const [docs, setDocs] = useState<{ name: string; docs: SourceDoc[]; start: number } | null>(null);
  const closeDocs = useCallback(() => setDocs(null), []);
  const openDocs = (r: FlowRow, code: string) => {
    const d = docsFor(r.id);
    setDocs({ name: r.name, docs: d, start: Math.max(0, d.findIndex((x) => x.code === code)) });
  };
  const base = sort === "look" ? [...rows].sort(lookOrder) : rows;
  const list = col ? [...base].sort((a, b) => (colValue(a, col.key) - colValue(b, col.key)) * col.dir || b.last.localeCompare(a.last)) : base;
  if (!list.length) return <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">{empty}</p>;
  const page = list.slice(0, shown);
  const groups: { head: string; items: FlowRow[] }[] = [];
  for (const r of page) {
    const head = sort === "look" || !group || col ? "" : fmtMonth(r.last.slice(0, 7));
    if (!groups.length || groups[groups.length - 1].head !== head) groups.push({ head, items: [] });
    groups[groups.length - 1].items.push(r);
  }
  const th = "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-600";
  const cols = 9 + (owners ? 1 : 0) + (sort === "look" ? 1 : 0);
  const flip = (key: ColSort["key"]) => setCol((c) => (c?.key === key ? (c.dir === -1 ? { key, dir: 1 } : null) : { key, dir: -1 }));
  return (
    <div className="@container overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-left">
              {sort === "look" && <th className={cx(th, "w-12 text-right")}>Pts</th>}
              <th className={cx(th, "w-full min-w-[140px]")}>Company</th>
              <th className={cx(th, "hidden @3xl:table-cell")}>Sector · Stage</th>
              <th className={cx(th, "hidden text-right @md:table-cell")} aria-sort={col?.key === "ask" ? (col.dir === 1 ? "ascending" : "descending") : undefined}>
                <SortButton k="ask" col={col} onFlip={flip} right>
                  Ask
                </SortButton>
              </th>
              <th className={cx(th, "hidden @4xl:table-cell")} aria-sort={col?.key === "fit" ? (col.dir === 1 ? "ascending" : "descending") : undefined}>
                <SortButton k="fit" col={col} onFlip={flip}>Founder fit</SortButton>
              </th>
              <th className={cx(th, "hidden min-w-[140px] whitespace-nowrap @xl:table-cell")} title="What the code checks found: gaps over 10%, missing facts, or all matched. The badges are the files on record; click one to preview or download it.">
                Checks
              </th>
              <th className={cx(th, "min-w-[125px] whitespace-nowrap pr-4")}>Status</th>
              <th className={cx(th, "hidden @5xl:table-cell")}>Latest signal</th>
              {owners && <th className={cx(th, "hidden w-12 @2xl:table-cell")}>Owner</th>}
              <th className={cx(th, "hidden text-right whitespace-nowrap @2xl:table-cell")} aria-sort={col?.key === "in" ? (col.dir === 1 ? "ascending" : "descending") : undefined}>
                <SortButton k="in" col={col} onFlip={flip} right>
                  In
                </SortButton>
              </th>
              <th className={cx(th, "hidden w-8 px-2 @2xl:table-cell")} aria-hidden />
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.head || "all"}>
              {g.head && (
                <tr className="border-b border-slate-100">
                  <td colSpan={cols} className="bg-slate-50/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {g.head}
                  </td>
                </tr>
              )}
              {g.items.map((r) => (
                <DeckRow key={r.id} r={r} showPoints={sort === "look"} owner={owners} onOpen={openDocs} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {shown < list.length && (
        <div className="border-t border-slate-100 py-3 text-center">
          <button
            onClick={() => setShown((n) => n + pageSize)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Show {Math.min(pageSize, list.length - shown)} more · {list.length - shown} left
          </button>
        </div>
      )}
      {docs && <DocDrawer name={docs.name} docs={docs.docs} start={docs.start} onClose={closeDocs} />}
    </div>
  );
}

const FIT_TAG: Record<FitLevel, ToneKey> = { Strong: "clear", Mixed: "review", Weak: "alert" };

function DeckRow({ r, showPoints, owner, onOpen }: { r: FlowRow; showPoints: boolean; owner: boolean; onOpen: (r: FlowRow, code: string) => void }) {
  const router = useRouter();
  const sig = r.look.latest ?? r.signals.at(-1);
  const td = "px-3.5 py-3 align-middle";
  return (
    <tr onClick={() => router.push(r.href)} className="group cursor-pointer border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/80">
      {showPoints && <td className={cx(td, "text-right font-mono text-xs font-semibold tabular-nums text-slate-900")}>{r.look.points}</td>}
      <td className={cx(td, "w-full min-w-[140px]")}>
        <Link href={r.href} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 whitespace-nowrap font-medium leading-tight tracking-tight text-slate-900 hover:text-blue-600 hover:underline">
          {r.name}
          {r.live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" title="Live pitch" />}
        </Link>
        <span className="mt-0.5 block whitespace-nowrap text-xs leading-tight text-slate-500">
          {r.city}
          <span className="@3xl:hidden"> · {r.stage}</span>
        </span>
      </td>
      <td className={cx(td, "hidden @3xl:table-cell")}>
        <span className="block max-w-[14rem] truncate leading-tight text-slate-900">{r.sub}</span>
        <span className="mt-0.5 block whitespace-nowrap text-xs leading-tight text-slate-500">{r.stage}</span>
      </td>
      <td className={cx(td, "hidden whitespace-nowrap text-right font-mono text-xs font-medium tabular-nums text-slate-900 @md:table-cell")}>{r.askUsd ? money(r.askUsd) : "—"}</td>
      <td className={cx(td, "hidden whitespace-nowrap @4xl:table-cell")}>{r.fit ? <Tag tone={FIT_TAG[r.fit]}>{r.fit}</Tag> : <span className="text-xs text-slate-500">—</span>}</td>
      <td className={cx(td, "hidden min-w-[140px] whitespace-nowrap @xl:table-cell")}>
        <ChecksCell cover={r.cover} sources={r.sources} onOpen={(code) => onOpen(r, code)} />
      </td>
      <td className={cx(td, "min-w-[125px] whitespace-nowrap pr-4")}>
        <LabelPill label={r.label} />
      </td>
      <td className={cx(td, "hidden max-w-[12rem] whitespace-nowrap @5xl:table-cell")}>{sig ? <SignalBadge kind={sig.kind} /> : <span className="text-xs text-slate-500">—</span>}</td>
      {owner && <td className={cx(td, "hidden whitespace-nowrap @2xl:table-cell")}>{r.owner ? <Avatar name={r.owner} size="xs" /> : <span className="text-xs text-slate-500">—</span>}</td>}
      <td className={cx(td, "hidden text-right font-mono text-xs whitespace-nowrap tabular-nums text-slate-500 @2xl:table-cell")}>{fmtDay(r.last)}</td>
      <td className={cx(td, "hidden w-8 px-2 text-slate-400 transition-colors group-hover:text-slate-700 @2xl:table-cell")} aria-hidden>
        →
      </td>
    </tr>
  );
}

// ---------- Small tabs ----------

export function PillTabs({ options, value, onChange }: { options: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="inline-flex min-w-max gap-1.5" role="tablist">
        {options.map((o) => (
          <button
            key={o.key}
            role="tab"
            aria-selected={value === o.key}
            onClick={() => onChange(o.key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium leading-tight whitespace-nowrap shadow-sm transition-colors",
              value === o.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cx(
                  "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums leading-tight",
                  value === o.key ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Market ----------

export function sectorMap(market: SectorStat[]) {
  return market.map((m) => ({
    key: m.sector,
    label: m.sector,
    value: m.counts.reduce((a, b) => a + b, 0),
    change: m.inboundChange,
    href: `/sectors/${slugOf(m.sector)}`,
    trend: m.counts,
  }));
}

/** The market map in a dark card, with a one-line key. */
export function MarketCard({ market, title = "Market map", height = 300, link = true }: { market: SectorStat[]; title?: string; height?: number; link?: boolean }) {
  const total = market.reduce((s, m) => s + m.counts.reduce((a, b) => a + b, 0), 0);
  return (
    <section className="flex h-full flex-col justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.5)] ring-1 ring-slate-800 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-slate-400">{total} decks in 6 months. Bigger tile, more decks.</p>
        </div>
        {link ? (
          <Link href="/sectors" className="text-sm font-medium text-indigo-300 hover:text-white">
            Market →
          </Link>
        ) : (
          <GradeKey />
        )}
      </div>
      <div className="flex-1">
        <MarketMap items={sectorMap(market)} height={height} />
      </div>
      {link && <GradeKey className="mt-3 pt-0.5" />}
    </section>
  );
}

const HEAT = ["#eef2ff", "#c7d2fe", "#818cf8", "#4f46e5", "#3730a3", "#1e1b4b"];

type Pick = { sector?: string; ym?: string };

/** What a slice of the deck flow holds, in one line a partner can read: fit, outcome and the busiest sub-categories. */
function SliceSummary({ list }: { list: FlowRow[] }) {
  const fit = list.filter((r) => r.fits).length;
  const meet = list.filter((r) => r.status === "Meeting set").length;
  const passed = list.filter((r) => r.status === "Passed" || r.status === "On hold").length;
  const open = list.length - meet - passed;
  const subs = Object.entries(list.reduce<Record<string, number>>((acc, r) => ((acc[r.sub] = (acc[r.sub] ?? 0) + 1), acc), {}))
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3);
  const stages = Object.entries(list.reduce<Record<string, number>>((acc, r) => ((acc[r.stage] = (acc[r.stage] ?? 0) + 1), acc), {})).sort((x, y) => y[1] - x[1]);
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-slate-200/70">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          [list.length, "companies"],
          [fit, "fit our rules"],
          [meet, meet === 1 ? "meeting" : "meetings"],
          [passed, "passed / on hold"],
        ].map(([n, l]) => (
          <div key={l as string}>
            <p className="text-xl font-semibold tabular-nums text-slate-900">{n}</p>
            <p className="text-[11px] text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      {list.length > 0 && (
        <p className="text-slate-600">
          {open > 0 && `${open} still open. `}
          Busiest: {subs.map(([k, n]) => `${k} (${n})`).join(", ")}. Stages: {stages.map(([k, n]) => `${k} ${n}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

/**
 * The full heatmap: sectors down the side, the 6 months across, each square the decks that came in.
 * Click a square, a month or a sector total for the decks and a short read of them; the right-hand
 * columns compare the last 3 months with the 3 before (money raised outside the fund is sample data).
 */
export function SectorHeatmap({ rows, market, title = "Deal flow heatmap" }: { rows: FlowRow[]; market: SectorStat[]; title?: string }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const max = Math.max(1, ...market.flatMap((m) => m.counts));
  const sorted = [...market].sort((a, b) => b.counts.reduce((x, y) => x + y, 0) - a.counts.reduce((x, y) => x + y, 0));
  const level = (n: number) => (n === 0 ? 0 : Math.min(HEAT.length - 1, 1 + Math.floor((n / max) * (HEAT.length - 1.01))));
  const monthTotals = MONTHS.map((_, i) => market.reduce((s, m) => s + m.counts[i], 0));
  const total = monthTotals.reduce((a, b) => a + b, 0);
  const picked = pick ? rows.filter((r) => (!pick.sector || r.sector === pick.sector) && r.dates.some((d) => (pick.ym ? d.startsWith(pick.ym) : MONTHS.includes(d.slice(0, 7))))) : [];
  const label = pick ? [pick.sector ?? "Every sector", pick.ym ? fmtMonth(pick.ym) : "last 6 months"].join(", ") : "";
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            {total} decks in 6 months. Darker is busier. Click a square, a month or a total to see those decks and what they hold.
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Fewer
          <span className="flex overflow-hidden rounded-sm ring-1 ring-slate-200">
            {HEAT.map((c) => (
              <span key={c} className="h-2.5 w-4" style={{ background: c }} />
            ))}
          </span>
          More
        </span>
      </div>
      <div className="mt-4 overflow-x-auto px-3 sm:px-5">
        <table className="w-full min-w-[740px] table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5 text-xs">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-36 pb-1.5 text-left font-semibold">Sector</th>
              {MONTHS.map((ym, i) => (
                <th key={ym} className="pb-1.5 text-center font-semibold">
                  <button onClick={() => setPick({ ym })} className="w-full rounded py-1 uppercase hover:bg-slate-100 hover:text-slate-700" title={`Every deck in ${fmtMonth(ym)}: ${monthTotals[i]}`}>
                    {fmtMonth(ym).slice(0, 3)}
                  </button>
                </th>
              ))}
              <th className="w-16 pb-1.5 text-center font-semibold">Total</th>
              <th className="w-[120px] pl-6 pb-1.5 text-left font-semibold" title="Decks, last 3 months against the 3 before">Decks</th>
              <th className="w-28 pl-4 pb-1.5 text-left font-semibold" title="Early-stage capital raised in the sector, last 90 days against the 90 before">Money</th>
              <th className="w-32 pl-4 pb-1.5 text-left font-semibold">Reading</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const sum = m.counts.reduce((a, b) => a + b, 0);
              return (
                <tr key={m.sector}>
                  <td className="truncate pr-2">
                    <Link href={`/sectors/${slugOf(m.sector)}`} className="font-medium text-slate-800 hover:text-blue-600">
                      {m.sector}
                    </Link>
                  </td>
                  {m.counts.map((n, i) => (
                    <td key={MONTHS[i]}>
                      <button
                        onClick={() => setPick({ sector: m.sector, ym: MONTHS[i] })}
                        title={`${m.sector}, ${fmtMonth(MONTHS[i])}: ${n} decks`}
                        className={cx("block h-8 w-full rounded-md text-[11px] font-semibold tabular-nums transition hover:scale-105 hover:ring-2 hover:ring-indigo-300", level(n) >= 3 ? "text-white" : "text-indigo-950/70")}
                        style={{ background: HEAT[level(n)] }}
                      >
                        {n || ""}
                      </button>
                    </td>
                  ))}
                  <td>
                    <button onClick={() => setPick({ sector: m.sector })} className="block h-8 w-full rounded-md bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-800 hover:bg-slate-200">
                      {sum}
                    </button>
                  </td>
                  <td className="pl-6 text-left">
                    <Delta value={m.inboundChange} className="w-[72px] justify-center px-1.5 text-[11px]" from={windowCounts(m.counts)} />
                  </td>
                  <td className="pl-4 text-left" title={`$${m.raised[0]}M in ${m.rounds[0]} rounds, against $${m.raised[1]}M in ${m.rounds[1]}`}>
                    <Delta value={m.moneyChange} className="w-[72px] justify-center px-1.5 text-[11px]" />
                  </td>
                  <td className="pl-4 text-left">
                    <TempPill t={m.temp} />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="pt-1 text-xs font-semibold text-slate-600">All sectors</td>
              {monthTotals.map((n, i) => (
                <td key={MONTHS[i]} className="pt-1">
                  <button onClick={() => setPick({ ym: MONTHS[i] })} className="block h-8 w-full rounded-md bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-800 hover:bg-slate-200">
                    {n}
                  </button>
                </td>
              ))}
              <td className="pt-1">
                <button onClick={() => setPick({})} className="block h-8 w-full rounded-md bg-slate-900 text-[11px] font-semibold tabular-nums text-white hover:bg-slate-800">
                  {total}
                </button>
              </td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 px-5 pt-4 pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex flex-wrap items-center gap-8 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-slate-700">Decks</span>
            <span className="text-slate-500">Last 3m vs prior 3m</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-slate-700">Money</span>
            <span className="text-slate-500">90d sector seed/A volume</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-slate-700">Reading</span>
            <span className="text-slate-500">±15% momentum threshold</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          {TEMP_RULE_TEXT} {FLOW_NOTE}
        </p>
      </div>
      {pick && (
        <Panel
          t={listSpec("cell", {
            title: label,
            icon: "pitch",
            tone: "info",
            explain: `Every company that sent a deck${pick.sector ? ` in ${pick.sector}` : ""} ${pick.ym ? `in ${fmtMonth(pick.ym)}` : "in the last 6 months"}${pick.sector ? "" : ", across every sector"}.`,
            clear: "No decks here.",
            rows: picked,
            extra: (
              <div className="space-y-2">
                <SliceSummary list={picked} />
                {pick.sector && (
                  <Link href={`/sectors/${slugOf(pick.sector)}`} className="inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900">
                    Open the {pick.sector} page →
                  </Link>
                )}
              </div>
            ),
          })}
          onClose={() => setPick(null)}
        />
      )}
    </section>
  );
}

/** One row per sector, like a list of indices: trend, decks, change, reading. */
export function SectorRows({ market }: { market: SectorStat[] }) {
  const rows = [...market].sort((a, b) => b.inboundChange - a.inboundChange);
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {rows.map((m) => (
        <li key={m.sector}>
          <Link href={`/sectors/${slugOf(m.sector)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80">
            <Monogram name={m.sector} sector={m.sector} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-900">{m.sector}</span>
              <span className="block text-xs text-slate-500">{m.counts.reduce((a, b) => a + b, 0)} decks in 6 months</span>
            </span>
            <Sparkline values={m.counts} width={88} height={28} tone={m.inboundChange >= 0.05 ? "up" : m.inboundChange <= -0.05 ? "down" : "indigo"} className="hidden sm:block" />
            <span className="flex w-24 flex-col items-end gap-1">
              <Delta value={m.inboundChange} from={windowCounts(m.counts)} />
              <TempPill t={m.temp} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------- News ----------

export function NewsList({ rows, limit = 5, sector, title = "News", subtitle }: { rows: FlowRow[]; limit?: number; sector?: string; title?: string; subtitle?: string }) {
  const [all, setAll] = useState(false);
  const feed = useMemo(() => feedOf(sector ? rows.filter((r) => r.sector === sector) : rows), [rows, sector]);
  const spec: TileSpec = {
    key: "feed",
    title: "News",
    count: feed.length,
    tone: "info",
    icon: "read",
    explain: "What the monthly watch found about companies the fund has seen, newest first.",
    clear: "No news yet.",
    how: "Once a month a job checks every company the fund has seen against funding databases, company registry filings, profile data and the pitch inbox.",
    body: () => (
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
        <FeedList items={feed} />
      </div>
    ),
  };
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between gap-2 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle ?? "What changed at companies we have seen."}</p>
        </div>
        {feed.length > limit && (
          <button onClick={() => setAll(true)} className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900">
            All {feed.length}
          </button>
        )}
      </div>
      <div className="mt-2 flex-1">{feed.length ? <FeedList items={feed.slice(0, limit)} /> : <p className="px-5 py-6 text-sm text-slate-500">Nothing yet.</p>}</div>
      {all && <Panel t={spec} onClose={() => setAll(false)} />}
    </section>
  );
}

function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((f) => (
        <li key={f.key}>
          <Link href={f.row.href} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/80">
            <Monogram name={f.row.name} sector={f.row.sector} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium text-slate-900">{f.row.name}</span>
                <SignalBadge kind={f.kind} />
              </span>
              <span className="block text-sm text-slate-600">{f.text}</span>
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{f.kind === "Rival raised" ? fmtMonth(f.at.slice(0, 7)).slice(0, 3) : fmtDay(f.at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------- Look again ----------

export const lookHow = `Only passed or held companies with news since the decision count. Points: trigger met 3, raised elsewhere 3, pitched again 2, sector heating up 1, strong founder-market fit 1, check date passed 1. "Look again now" means ${LOOK_NOW}+ points with the news in the last ${LOOK_RECENT_DAYS} days.`;

export function LookAgainList({ rows, limit = 4, sector, owner }: { rows: FlowRow[]; limit?: number; sector?: string; owner?: string }) {
  const [open, setOpen] = useState(false);
  const list = rows.filter((r) => r.look.event && (!sector || r.sector === sector) && (!owner || r.owner === owner)).sort(lookOrder);
  const spec = listSpec("look", { title: "Look again", icon: "decide", tone: "watch", explain: "Passed or held companies with news since, highest points first.", clear: "Nothing to look at again.", how: lookHow, rows: list, sort: "look" });
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between gap-2 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Look again</h2>
          <p className="text-sm text-slate-500">We passed. Something has changed since.</p>
        </div>
        {list.length > limit && (
          <button onClick={() => setOpen(true)} className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900">
            All {list.length}
          </button>
        )}
      </div>
      <ul className="mt-2 flex-1 divide-y divide-slate-100">
        {list.slice(0, limit).map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/80">
              <Monogram name={r.name} sector={r.sector} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-slate-900">{r.name}</span>
                  {r.look.latest && <SignalBadge kind={r.look.latest.kind} />}
                </span>
                <span className="block text-sm text-slate-600">{r.look.latest?.text}</span>
                <span className="block text-[11px] text-slate-400">
                  {r.decision?.status === "On hold" ? "Held" : "Passed"} in {r.decision ? fmtMonth(r.decision.at.slice(0, 7)) : ""}: {r.decision?.reason.toLowerCase()}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white" title={r.look.parts.map(([k, n]) => `${k} +${n}`).join(", ")}>
                {r.look.points} pts
              </span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="px-5 py-6 text-sm text-slate-500">Nothing to look at again.</li>}
      </ul>
      {open && <Panel t={spec} onClose={() => setOpen(false)} />}
    </section>
  );
}

// ---------- Miss rate (kept for the method page and panels) ----------

export function MissRate({ sector }: { sector?: string }) {
  const rows = missRate(sector ? FLOW.filter((c) => c.sector === sector) : FLOW).filter((r) => r.passes >= 3);
  const max = Math.max(...rows.map((r) => r.rate), 0.01);
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
      <h3 className="font-semibold text-slate-900">Which pass reasons let winners go</h3>
      <p className="text-xs text-slate-500">Of the companies passed for each reason, the share that later raised from someone else.</p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.reason} className="grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-700">{r.reason}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-red-400" style={{ width: `${(r.rate / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-slate-600">
              {r.raised} of {r.passes}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">{FLOW_NOTE}</p>
    </div>
  );
}

/** How a deck reaches the fund, as one quiet line of steps. */
export function HowItWorks() {
  const steps = ["Founder emails a deck", "One record per company", "Code checks rules and numbers", "AI reads the deck", "You decide"];
  return (
    <Link href="/sources" className="group flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 hover:text-slate-700">
      {steps.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-slate-300">→</span>}
          <span className={i === steps.length - 1 ? "font-semibold text-slate-700" : ""}>{s}</span>
        </span>
      ))}
      <span className="ml-1 font-medium text-indigo-700 opacity-0 transition group-hover:opacity-100">Where data comes from</span>
    </Link>
  );
}
