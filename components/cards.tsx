"use client";

// The card language of the app: a tile is one job with one number; clicking it opens a panel with
// only the companies behind that number. Company and pitch cards show health at a glance.
import { useMode } from "./mode";
import { visibleIn } from "@/lib/mode";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import { cx } from "./ui";
import { fmtDay } from "@/lib/dates";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { sampleChannel } from "@/lib/funnel";
import { attentionFor, latestRunway, WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { missingItems } from "@/lib/portfolio/health";
import type { PortfolioCompany } from "@/lib/portfolio/types";
import { portfolioFacts } from "@/lib/provenance";
import { usd } from "@/lib/rules";
import { useLinks } from "./links-store";
import { viaText } from "@/lib/links";
import { Avatar } from "./shell";

export type Tone = "urgent" | "watch" | "info" | "good";

export const TONE: Record<Tone, { ring: string; soft: string; text: string; dot: string; bar: string }> = {
  urgent: { ring: "ring-red-200", soft: "bg-red-50", text: "text-red-700", dot: "bg-red-500", bar: "bg-red-500" },
  watch: { ring: "ring-amber-200", soft: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400", bar: "bg-amber-400" },
  info: { ring: "ring-slate-200", soft: "bg-slate-100", text: "text-indigo-700", dot: "bg-slate-600", bar: "bg-slate-600" },
  good: { ring: "ring-emerald-200", soft: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};

export type IconKey = "pitch" | "decide" | "report" | "conflict" | "cash" | "question" | "good" | "team" | "read" | "ask" | "files";

const ICON: Record<IconKey, string> = {
  pitch: "M4 5.5h16v11H4zM8 20h8M12 16.5V20M7.5 9.5h5M7.5 12.5h9",
  decide: "M5 12.5l4.5 4.5L19 7.5",
  report: "M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 13h5M10 16.5h5",
  conflict: "M12 4l9 16H3zM12 10v4.5M12 17.5v.5",
  cash: "M3.5 7h17v10h-17zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6.5 12h.5M17 12h.5",
  question: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  good: "M7 11l3-7c1.4 0 2.5 1.1 2.5 2.5V9.5h5.2a1.8 1.8 0 0 1 1.8 2.1l-1.2 7A1.8 1.8 0 0 1 16.5 20H7M3.5 11H7v9H3.5z",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c2 .8 3 2.6 3 5.3",
  read: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  ask: "M4 5.5h16v10H9l-5 4z",
  files: "M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.3H19a1.5 1.5 0 0 1 1.5 1.5v8.7A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18zM12 11v5m-2.5-2.5L12 11l2.5 2.5",
};

export function TileIcon({ name, className }: { name: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON[name]} />
    </svg>
  );
}

export interface Group {
  id: string;
  name: string;
  kind: "Portfolio" | "Pitch";
  href: string;
  owner?: string;
  /** A short status shown next to the name, like a health word or a band. */
  status?: string;
}

/** One thing to look at inside a card's panel. Entries are grouped by company. */
export interface Entry {
  key: string;
  group: Group;
  title: string;
  detail?: React.ReactNode;
  meta?: React.ReactNode;
  tone: Tone;
  href?: string;
  onClick?: () => void;
  cta?: string;
  action?: React.ReactNode;
}

export interface TileSpec {
  key: string;
  title: string;
  count: number;
  tone: Tone;
  icon: IconKey;
  /** One line a first-day analyst can understand. */
  explain: string;
  /** What shows when the count is zero. */
  clear: string;
  /** What to do with what's in the panel. */
  next?: string;
  entries?: Entry[];
  body?: () => React.ReactNode;
  /** How the number is worked out, in plain words, with the thresholds the code uses. */
  how?: string;
}

export function Tile({ t, onOpen }: { t: TileSpec; onOpen: () => void }) {
  const empty = t.count === 0;
  const tone = TONE[t.tone];
  return (
    <button
      onClick={onOpen}
      className={cx(
        "group relative flex min-h-[148px] flex-col overflow-hidden rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:p-5",
        empty ? "ring-slate-200" : tone.ring,
      )}
    >
      {!empty && <span aria-hidden className={cx("absolute inset-x-0 top-0 h-1", tone.bar)} />}
      <span className={cx("grid h-9 w-9 place-items-center rounded-xl", empty ? "bg-slate-100 text-slate-400" : cx(tone.soft, tone.text))}>
        <TileIcon name={t.icon} />
      </span>
      <span className={cx("mt-3 text-3xl font-semibold tabular-nums tracking-tight", empty ? "text-slate-300" : "text-slate-900")}>{t.count}</span>
      <span className="mt-0.5 text-sm font-semibold text-slate-900">{t.title}</span>
      <span className="mt-0.5 text-xs leading-snug text-slate-500">{empty ? t.clear : t.explain}</span>
      <span className={cx("mt-auto pt-3 text-xs font-medium", empty ? "text-slate-400" : "text-indigo-700 group-hover:text-indigo-900")}>{empty ? "Nothing to do" : "Open →"}</span>
    </button>
  );
}

function groupEntries(entries: Entry[]) {
  const map = new Map<string, { group: Group; items: Entry[] }>();
  for (const e of entries) {
    const k = `${e.group.kind}:${e.group.id}`;
    if (!map.has(k)) map.set(k, { group: e.group, items: [] });
    map.get(k)!.items.push(e);
  }
  const groups = [...map.values()];
  const rank: Record<Tone, number> = { urgent: 0, watch: 1, info: 2, good: 3 };
  const worst = (g: { items: Entry[] }) => Math.min(...g.items.map((i) => rank[i.tone]));
  return groups.sort((a, b) => (a.group.kind === b.group.kind ? 0 : a.group.kind === "Portfolio" ? -1 : 1) || worst(a) - worst(b));
}

const KIND_PILL = { Portfolio: "bg-slate-100 text-slate-700", Pitch: "bg-slate-100 text-slate-700" };

function GroupCard({ group, items }: { group: Group; items: Entry[] }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <Link href={group.href} className="text-base font-semibold text-slate-900 hover:text-indigo-700">
          {group.name}
        </Link>
        <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", KIND_PILL[group.kind])}>{group.kind}</span>
        {group.status && <span className="text-xs text-slate-500">{group.status}</span>}
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          {group.owner && (
            <>
              <Avatar name={group.owner} size="xs" /> {group.owner.split(" ")[0]}
            </>
          )}
          <Link href={group.href} className="font-medium text-indigo-700 hover:text-indigo-900">
            {group.kind === "Pitch" ? "Open pitch" : "Open company"} →
          </Link>
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((e) => {
          const body = (
            <>
              <span aria-hidden className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", TONE[e.tone].dot)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{e.title}</span>
                {e.detail && <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{e.detail}</span>}
                {e.meta && <span className="mt-1 block text-xs text-slate-500">{e.meta}</span>}
              </span>
            </>
          );
          const cta = e.cta && (
            <span className="shrink-0 self-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 group-hover:border-indigo-300 group-hover:text-indigo-700">
              {e.cta}
            </span>
          );
          return (
            <li key={e.key} className="flex items-start gap-3 px-4 py-3">
              {e.href ? (
                <Link href={e.href} className="group flex min-w-0 flex-1 items-start gap-3">
                  {body}
                  {cta}
                </Link>
              ) : e.onClick ? (
                <button onClick={e.onClick} className="group flex min-w-0 flex-1 items-start gap-3 text-left">
                  {body}
                  {cta}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
              )}
              {e.action && <span className="shrink-0 self-center">{e.action}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A focused window over a dimmed page: only this one job is in view, grouped by company. */
export function Panel({ t, onClose }: { t: TileSpec; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const tone = TONE[t.tone];
  const groups = t.entries ? groupEntries(t.entries) : [];
  const portfolio = groups.filter((g) => g.group.kind === "Portfolio");
  const pitches = groups.filter((g) => g.group.kind === "Pitch");
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <button className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:rounded-3xl">
        <div className={cx("h-1.5 shrink-0", tone.bar)} />
        <div className="flex items-start gap-4 bg-white px-5 pb-4 pt-5 sm:px-6">
          <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tone.soft, tone.text)}>
            <TileIcon name={t.icon} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="panel-title" className="text-xl font-semibold tracking-tight text-slate-900">
              {t.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">{t.explain}</p>
            <p className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={cx("rounded-full px-2 py-0.5 font-semibold", tone.soft, tone.text)}>
                {t.count} {t.count === 1 ? "item" : "items"}
              </span>
              {t.entries && portfolio.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {portfolio.length} portfolio {portfolio.length === 1 ? "company" : "companies"}
                </span>
              )}
              {t.entries && pitches.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {pitches.length} {pitches.length === 1 ? "pitch" : "pitches"}
                </span>
              )}
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {t.next && t.count > 0 && (
          <p className="border-y border-slate-200 bg-slate-50 px-5 py-2.5 text-sm text-indigo-900 sm:px-6">
            <span className="font-semibold">What to do: </span>
            {t.next}
          </p>
        )}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {t.count === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">{t.clear}</p>
          ) : t.entries ? (
            <>
              {portfolio.length > 0 && pitches.length > 0 && <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Portfolio companies</h3>}
              {portfolio.map((g) => (
                <GroupCard key={g.group.id} group={g.group} items={g.items} />
              ))}
              {portfolio.length > 0 && pitches.length > 0 && <h3 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pitches</h3>}
              {pitches.map((g) => (
                <GroupCard key={g.group.id} group={g.group} items={g.items} />
              ))}
            </>
          ) : (
            t.body?.()
          )}
        </div>
        {t.how && (
          <p className="border-t border-slate-200 bg-white px-5 py-3 text-xs leading-relaxed text-slate-500 sm:px-6">
            <span className="font-semibold text-slate-700">How this number is worked out: </span>
            {t.how}{" "}
            <Link href="/method" className="font-medium text-indigo-700 hover:text-indigo-900">
              All calculations →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/** Opens a panel for any number on a page. Specs are rebuilt on each render, so the panel stays live. */
export function usePanels() {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return {
    open: setOpen,
    render: (specs: TileSpec[]) => {
      const t = open ? specs.find((x) => x.key === open) : undefined;
      return t ? <Panel t={t} onClose={close} /> : null;
    },
  };
}

/** A number you can click to see what is behind it. */
export function NumButton({ n, onClick, tone, label, className }: { n: React.ReactNode; onClick: () => void; tone?: "bad" | "new" | "plain"; label: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex min-w-[2rem] items-center justify-center rounded-md px-1.5 py-0.5 tabular-nums underline-offset-4 transition hover:bg-slate-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        tone === "bad" ? "font-semibold text-red-700" : tone === "new" ? "font-semibold text-indigo-700" : "text-slate-900",
        className,
      )}
    >
      {n}
    </button>
  );
}

export function TileGrid({ tiles }: { tiles: TileSpec[] }) {
  const panels = usePanels();
  return (
    <>
      <div className={cx("grid grid-cols-2 gap-3", tiles.length % 4 === 0 ? "lg:grid-cols-4" : tiles.length % 3 === 0 ? "lg:grid-cols-3" : tiles.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {tiles.map((t) => (
          <Tile key={t.key} t={t} onOpen={() => panels.open(t.key)} />
        ))}
      </div>
      {panels.render(tiles)}
    </>
  );
}

// ---------- Health ----------

export type Health = "Needs help" | "Watch" | "Healthy" | "Too early";

export const HEALTH_TONE: Record<Health, string> = {
  "Needs help": "bg-red-50 text-red-700 ring-red-200",
  Watch: "bg-amber-50 text-amber-800 ring-amber-200",
  Healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Too early": "bg-slate-100 text-slate-600 ring-slate-200",
};

/** One plain word for a company, from the same code that writes the attention lines. */
export function healthOf(c: PortfolioCompany, today: string): { health: Health; why: string } {
  const items = attentionFor(c, today);
  const head = items[0];
  if (!head) return { health: "Too early", why: "No reports yet." };
  if (head.level === "high") return { health: "Needs help", why: head.text };
  if (head.level === "medium") return { health: "Watch", why: head.text };
  if (!c.reports.some((r) => r.receivedAt)) return { health: "Too early", why: head.text };
  return { health: "Healthy", why: items.find((a) => a.level === "good")?.text ?? head.text };
}

export function HealthPill({ health }: { health: Health }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", HEALTH_TONE[health])}>{health}</span>;
}

export function CompanyCard({ c, today }: { c: PortfolioCompany; today: string }) {
  const { health, why } = healthOf(c, today);
  const rw = latestRunway(c, today);
  const sent = c.reports.filter((r) => r.numbers.revenue && r.receivedAt && r.receivedAt.slice(0, 10) <= today);
  const last = sent.at(-1);
  const missing = missingItems(c, today).filter((m) => !m.key.endsWith(":question"));
  const reportMissing = missing.filter((m) => !m.what.includes("part missing")).length;
  const conflicts = portfolioFacts(c, today).filter((f) => f.status === "Conflict").length;
  return (
    <Link
      href={`/portfolio/${c.id}`}
      className="group flex flex-col rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{c.name}</p>
          <p className="truncate text-xs text-slate-500">
            {c.sector} · {c.country}
          </p>
        </div>
        <HealthPill health={health} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-slate-700">{why}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
        <div>
          <dt className="text-slate-500">Cash lasts</dt>
          <dd className={cx("mt-0.5 font-semibold tabular-nums", !rw ? "text-slate-400" : rw.months < 6 ? "text-red-700" : rw.months < WATCH_RUNWAY_MONTHS ? "text-amber-800" : "text-slate-900")}>
            {rw ? `${rw.months.toFixed(1)} mo` : "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Revenue</dt>
          <dd className="mt-0.5 truncate font-semibold tabular-nums text-slate-900" title={last ? fmtMonth(last.month) : undefined}>
            {last ? fmtMoney(last.numbers.revenue!.value, c.currency) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Reports</dt>
          <dd className={cx("mt-0.5 font-semibold", missing.length ? "text-red-700" : "text-emerald-700")}>{missing.length ? `${missing.length} owed` : "Up to date"}</dd>
        </div>
      </dl>
      {(reportMissing > 0 || conflicts > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {reportMissing > 0 && <Flag tone="urgent">{reportMissing === 1 ? "MIS report missing" : `${reportMissing} MIS reports missing`}</Flag>}
          {conflicts > 0 && <Flag tone="watch">{conflicts === 1 ? "A number doesn't match" : `${conflicts} numbers don't match`}</Flag>}
        </div>
      )}
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-slate-500">
        <Avatar name={c.owner} size="xs" /> {c.owner.split(" ")[0]} · {c.investment.round}, {usd(c.investment.amountUsd)}
      </div>
    </Link>
  );
}

export function Flag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONE[tone].soft, TONE[tone].text, TONE[tone].ring)}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />
      {children}
    </span>
  );
}

export interface PitchCardData {
  id: string;
  href: string;
  name: string;
  line: string;
  stage: string;
  amountUsd?: number | null;
  sector: string;
  country: string;
  receivedAt: string;
  isNew: boolean;
  screened: boolean;
  band?: string;
  conflicts: number;
  owner?: string;
}

/** Every pitch as a card, screened or not, newest first. */
export function usePitches(filter: (owner?: string) => boolean): PitchCardData[] {
  const store = useStore();
  const links = useLinks();
  const mode = useMode();
  return useMemo(() => {
    const out: PitchCardData[] = [];
    const own = links.ownerOf;
    for (const d of store.deals) {
      if (!filter(own(d.id))) continue;
      out.push({
        id: d.id,
        href: `/deals/${d.id}`,
        name: d.form.companyName,
        line: d.record.oneLiner,
        stage: d.form.stage,
        amountUsd: d.form.amountUsd,
        sector: d.form.sector,
        country: d.form.country,
        receivedAt: d.receivedAt,
        isNew: store.statusOf(d.id) === "New",
        screened: true,
        band: store.bandOf(d),
        conflicts: d.flags.filter((f) => f.kind === "conflict").length,
        owner: own(d.id),
      });
    }
    for (const s of store.unprocessed) {
      if (!filter(own(s.id))) continue;
      out.push({
        id: s.id,
        href: `/deals/${s.id}`,
        name: s.form.companyName,
        line: `Pitch deck${s.sheetFile ? " and a monthly numbers sheet" : ""} received ${sampleChannel(s.id) === "Pitch form" ? "through the form" : "by email"}. Waiting for the AI to read it.`,
        stage: s.form.stage,
        amountUsd: s.form.amountUsd,
        sector: s.form.sector,
        country: s.form.country,
        receivedAt: s.receivedAt,
        isNew: store.statusOf(s.id) === "New",
        screened: false,
        conflicts: 0,
        owner: own(s.id),
      });
    }
    for (const i of links.inbound) {
      if (store.deals.some((d) => d.id === i.id) || !filter(own(i.id))) continue;
      const how = viaText(i);
      out.push({
        id: i.id,
        href: `/deals/${i.id}`,
        name: i.form.companyName,
        line: i.manual ? `${i.oneLiner ? `${i.oneLiner}. ` : ""}Uploaded here; numbers typed from the deck and checked by code.` : `${i.oneLiner ? `${i.oneLiner}. ` : ""}Deck came in via ${how}. Waiting for the AI to read it.`,
        stage: i.form.stage,
        amountUsd: i.form.amountUsd,
        sector: i.form.sector,
        country: i.form.country,
        receivedAt: i.receivedAt,
        isNew: store.statusOf(i.id) === "New",
        screened: false,
        conflicts: 0,
        owner: own(i.id),
      });
    }
    return out.filter((c) => visibleIn(mode, c.id)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, links, mode]);
}


const BAND_PILL: Record<string, string> = {
  Priority: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Review: "bg-amber-50 text-amber-800 ring-amber-200",
  "Outside focus": "bg-slate-100 text-slate-600 ring-slate-200",
};

export function PitchCard({ d, signals }: { d: PitchCardData; signals?: React.ReactNode }) {
  return (
    <Link
      href={d.href}
      className="group relative flex flex-col rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-900 group-hover:text-indigo-700">{d.name}</p>
            {d.isNew && <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}
          </div>
          <p className="truncate text-xs text-slate-500">
            {d.stage}
            {d.amountUsd ? ` · raising ${usd(d.amountUsd)}` : ""} · {d.sector}
          </p>
        </div>
        {d.screened && d.band ? (
          <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", BAND_PILL[d.band])}>{d.band}</span>
        ) : (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">Not read yet</span>
        )}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-slate-700">{d.line}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {d.conflicts > 0 && <Flag tone="urgent">{d.conflicts === 1 ? "A number doesn't match" : `${d.conflicts} numbers don't match`}</Flag>}
        {!d.screened && <Flag tone="info">Deck received, AI hasn&apos;t read it</Flag>}
        {signals}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-slate-500">
        {d.owner ? (
          <>
            <Avatar name={d.owner} size="xs" /> {d.owner.split(" ")[0]}
          </>
        ) : (
          <span>No owner yet</span>
        )}
        <span>· received {fmtDay(d.receivedAt.slice(0, 10))}</span>
      </div>
    </Link>
  );
}

/** A short guide for someone on their first day. Hidden once dismissed. */
export function Guide({ role }: { role: "Partner" | "Analyst" }) {
  const KEY = "ds.guide.v1";
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(KEY) === "hidden");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white sm:p-6">
      <button
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(KEY, "hidden");
          } catch {
            // Hidden until reload.
          }
        }}
        className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        Got it
      </button>
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">How to read this page</p>
      <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <li>
          <span className="font-semibold">1. Each card is one job.</span>{" "}
          <span className="text-white/75">{role === "Partner" ? "What came in, what was never opened, what we missed, what to look at again." : "Things to read, check, chase or answer."}</span>
        </li>
        <li>
          <span className="font-semibold">2. Colour shows urgency.</span>{" "}
          <span className="text-white/75">
            <span className="text-red-300">Red</span> today, <span className="text-amber-300">amber</span> this week, <span className="text-emerald-300">green</span> fine.
          </span>
        </li>
        <li>
          <span className="font-semibold">3. Click a card.</span> <span className="text-white/75">{role === "Partner" ? "Only the companies behind it open. Below, click a square of the heatmap for that sector and month." : "Only the companies behind it open. Click one to see its deck, numbers and reports."}</span>
        </li>
      </ol>
    </div>
  );
}

export function SectionHeader({ title, hint, href, linkText }: { title: string; hint?: string; href?: string; linkText?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
      {href && (
        <Link href={href} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
          {linkText ?? "See all"} →
        </Link>
      )}
    </div>
  );
}
