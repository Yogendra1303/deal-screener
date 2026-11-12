"use client";

import { ZeroState } from "@/components/mode";
import { useMemo } from "react";
import {
  healthOf,
  usePanels,
  usePitches,
  type Entry,
  type Group,
  type PitchCardData,
  type TileSpec,
} from "@/components/cards";
import { QuestionItem, useEvidence } from "@/components/evidence";
import { ReminderButton } from "@/components/portfolio-actions";
import { usePortfolio } from "@/components/portfolio-store";
import { useDataRoom } from "@/components/founder-links";
import { TO_FILE } from "@/lib/dataroom";
import { useLinks } from "@/components/links-store";
import { DeckList, HowItWorks, LookAgainList, MarketCard, MissRate, SectorHeatmap, NEVER_OPENED_DAYS, NewsList, listSpec, lookHow, triageOrder, useDealFlow, type FlowRow } from "@/components/flow";
import { Delta, Sparkline, StackBar } from "@/components/charts";
import { Avatar, RoleViewDropdown } from "@/components/shell";
import { useDataToFix } from "@/components/queues";
import { useStore } from "@/components/store";
import { Button, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { addDays, fmtDay } from "@/lib/dates";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { attentionFor, latestRunway, WATCH_RUNWAY_MONTHS, type Attention } from "@/lib/portfolio/attention";
import { companyEvents } from "@/lib/portfolio/events";
import { HEALTH_RULES, daysBetween, missingItems } from "@/lib/portfolio/health";
import { GAP_TOLERANCE } from "@/lib/checks";
import { PITCH_INBOX } from "@/lib/links";
import { MONTHS } from "@/lib/funnel";
import Link from "next/link";
import type { PortfolioCompany } from "@/lib/portfolio/types";
import { portfolioFacts } from "@/lib/provenance";
import { stateOf, type Question } from "@/lib/questions";
import { usd } from "@/lib/rules";
import { ANALYSTS, DEAL_OWNERS, PARTNER } from "@/lib/team";
import type { DealResult } from "@/lib/types";
import { LoginScreen } from "./login/page";

export default function HomePage() {
  const w = useWorkspace();
  const store = useStore();
  const p = usePortfolio();
  const ready = w.ready && store.ready && p.ready;
  if (!ready) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!w.session) return <LoginScreen callbackUrl="/" />;
  return w.role === "Partner" ? <PartnerHome /> : <AnalystHome />;
}

function Greeting({ name, line }: { name: string; line: string }) {
  const p = usePortfolio();
  const w = useWorkspace();
  const firstName = (w.userName || name).split(" ")[0];
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-slate-500">{fmtDay(p.today)} 2026 · demo date</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Good afternoon, {firstName}</h1>
        <p className="mt-1 text-slate-600">{line}</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <RoleViewDropdown />
      </div>
    </div>
  );
}

// ---------- Groups: which company an item belongs to ----------

function pg(c: PortfolioCompany, today: string, tab?: string): Group {
  return { id: c.id, name: c.name, kind: "Portfolio", href: `/portfolio/${c.id}${tab ? `?tab=${tab}` : ""}`, owner: c.owner, status: healthOf(c, today).health };
}

function dg(d: { id: string; name: string; band?: string; screened: boolean; owner?: string }): Group {
  return { id: d.id, name: d.name, kind: "Pitch", href: `/deals/${d.id}`, owner: d.owner ?? DEAL_OWNERS[d.id], status: d.screened ? d.band : "Not read yet" };
}

function dealGroup(d: DealResult, band: string): Group {
  return dg({ id: d.id, name: d.form.companyName, band, screened: true });
}

// ---------- Tiles shared by both homes ----------

function newPitchesTile(pitches: PitchCardData[], forAnalyst: boolean): TileSpec {
  const fresh = pitches.filter((x) => x.isNew);
  return {
    key: "pitches",
    title: "New pitches",
    count: fresh.length,
    tone: "info",
    icon: "pitch",
    explain: forAnalyst ? "Decks given to you, and new decks no one has picked up." : "Decks founders sent that no one at the fund has reviewed yet.",
    clear: "No new pitches.",
    next: "Open a pitch to read the deck, the AI's notes and the numbers check. Then set its status, or pass.",
    how: `Counts pitches whose status is still New${forAnalyst ? ", yours or not picked up by anyone" : ""}. A pitch arrives through the pitch form, the website or an analyst's pitch link, or an email to ${PITCH_INBOX}. Setting any other status clears it.`,
    entries: fresh.map((d) => ({
      key: d.id,
      group: dg(d),
      title: `${d.stage}${d.amountUsd ? `, raising ${usd(d.amountUsd)}` : ""} · ${d.sector}, ${d.country}`,
      detail: d.line,
      meta: `Received ${fmtDay(d.receivedAt.slice(0, 10))}${d.screened && d.conflicts ? ` · ${d.conflicts} ${d.conflicts === 1 ? "number doesn't" : "numbers don't"} match` : ""}`,
      tone: d.conflicts ? "watch" : "info",
      href: d.href,
      cta: d.screened ? "Open pitch" : "See deck",
    })),
  };
}

function missingTile(companies: PortfolioCompany[], today: string, withActions: boolean): TileSpec {
  const items = companies.flatMap((c) => missingItems(c, today).filter((m) => !m.key.endsWith(":question")).map((m) => ({ c, m })));
  items.sort((a, b) => b.m.overdueDays - a.m.overdueDays);
  return {
    key: "missing",
    title: "Missing reports",
    count: items.length,
    tone: "urgent",
    icon: "report",
    explain: "Monthly MIS reports and documents founders owe the fund.",
    clear: "Every report that was due has arrived.",
    next: withActions
      ? "Send a reminder today. After two reminders, call the founder; a quiet founder is the earliest sign of trouble."
      : "Check the owner has reminded the founder. Over 30 days late, the partner should call.",
    how: `A month's report is owed from day ${HEALTH_RULES.dueDay} of the next month; the last ${HEALTH_RULES.windowMonths} months are checked. Documents the fund asked for count once past their due date. Red when over 30 days late. A report clears when the founder sends it on their report link; a document clears when its file is filed in the data room.`,
    entries: items.map(({ c, m }) => ({
      key: m.key,
      group: pg(c, today, "reporting"),
      title: m.what,
      detail: m.detail,
      meta: `${m.overdueDays > 0 ? `${m.overdueDays} days late` : "Due now"} · ${m.reminders.length ? `reminded ${m.reminders.map(fmtDay).join(", ")}` : "no reminder sent yet"}`,
      tone: m.overdueDays > 30 ? "urgent" : "watch",
      href: withActions ? undefined : `/portfolio/${c.id}?tab=reporting`,
      cta: withActions ? undefined : "See reports",
      action: withActions ? <ReminderButton itemKey={m.key} sentToday={m.reminders.includes(today)} /> : undefined,
    })),
  };
}

function cashTile(companies: PortfolioCompany[], today: string): TileSpec {
  const low = companies
    .map((c) => ({ c, rw: latestRunway(c, today) }))
    .filter((x) => x.rw && x.rw.months < WATCH_RUNWAY_MONTHS)
    .sort((a, b) => a.rw!.months - b.rw!.months);
  return {
    key: "cash",
    title: "Low on cash",
    count: low.length,
    tone: "urgent",
    icon: "cash",
    explain: `Less than ${WATCH_RUNWAY_MONTHS} months of cash at the latest monthly burn.`,
    clear: `Every company has at least ${WATCH_RUNWAY_MONTHS} months of cash.`,
    next: "A raise takes 6 months. Under 9 months, agree a plan with the founder now: bridge, cut burn, or sale.",
    how: `Months of cash = cash in the bank ÷ that month's net burn, from the latest monthly report that has both. Listed under ${WATCH_RUNWAY_MONTHS} months; red under ${HEALTH_RULES.runwayMonths}.`,
    entries: low.map(({ c, rw }) => ({
      key: c.id,
      group: pg(c, today, "numbers"),
      title: `About ${rw!.months.toFixed(1)} months of cash left`,
      detail: `${fmtMonth(rw!.report.month)} burn was ${fmtMoney(rw!.report.numbers.burn!.value, c.currency)} a month.`,
      meta: "Options: help raise a bridge, cut burn, or look for a buyer.",
      tone: rw!.months < 6 ? "urgent" : "watch",
      href: `/portfolio/${c.id}?tab=numbers`,
      cta: "See numbers",
    })),
  };
}

function questionsTile(key: string, title: string, qs: Question[], today: string, explain: string, clear: string): TileSpec {
  const overdue = qs.filter((q) => stateOf(q, today) === "Overdue").length;
  return {
    key,
    title,
    count: qs.length,
    tone: overdue ? "urgent" : "watch",
    icon: "question",
    explain: overdue ? `${explain} ${overdue} overdue.` : explain,
    clear,
    next: "Every answer needs a source: a file and page, or a call note.",
    how: "Counts questions with no answer yet where you asked or were asked. Overdue means past the due date set when it was asked. Answering with a source clears it.",
    body: () => (
      <ul className="space-y-2">
        {qs.map((q) => (
          <QuestionItem key={q.id} q={q} showCompany />
        ))}
      </ul>
    ),
  };
}

function byUrgency(today: string) {
  const rank = { Overdue: 0, Open: 1, Answered: 2 };
  return (a: Question, b: Question) => rank[stateOf(a, today)] - rank[stateOf(b, today)] || a.due.localeCompare(b.due);
}

// ---------- Partner data ----------

interface Decision {
  key: string;
  kind: "Pitch" | "Portfolio";
  company: string;
  href: string;
  question: string;
  detail: string;
  blockers: string[];
  owner?: string;
}

function usePartnerData() {
  const store = useStore();
  const p = usePortfolio();
  const w = useWorkspace();
  return useMemo(() => {
    const today = p.today;
    const decisions: Decision[] = [];
    for (const d of store.deals) {
      const status = store.statusOf(d.id);
      if (store.bandOf(d) !== "Priority" || !(status === "New" || status === "Reviewing")) continue;
      const conflicts = d.flags.filter((f) => f.kind === "conflict");
      decisions.push({
        key: `deal-${d.id}`,
        kind: "Pitch",
        company: d.form.companyName,
        href: `/deals/${d.id}`,
        question: "Take a first meeting?",
        detail: `${d.form.stage}, raising ${d.form.amountUsd ? usd(d.form.amountUsd) : "an amount not stated"}. Suggested Priority: ${d.bandReasons.join(", ").toLowerCase()}.`,
        blockers: conflicts.map((f) => f.title),
        owner: DEAL_OWNERS[d.id],
      });
    }
    const decided = new Set<string>();
    for (const c of p.companies) {
      const rw = latestRunway(c, today);
      const open = w.questionsFor(c.id).filter((q) => !q.answer);
      if (rw && rw.months < WATCH_RUNWAY_MONTHS) {
        decided.add(c.id);
        const q = open.find((x) => x.about?.key === "runway");
        const last = c.reports.filter((r) => r.receivedAt).at(-1);
        decisions.push({
          key: `runway-${c.id}`,
          kind: "Portfolio",
          company: c.name,
          href: `/portfolio/${c.id}`,
          question: `About ${rw.months.toFixed(1)} months of cash left. Step in?`,
          detail: `At ${fmtMonth(rw.report.month).split(" ")[0]}'s burn of ${fmtMoney(rw.report.numbers.burn!.value, c.currency)}.${last ? ` Last report arrived ${fmtDay(last.receivedAt!)}.` : ""} Options: help raise a bridge, cut burn, or look for a buyer.`,
          blockers: q ? [`Your question on ${q.about!.label.toLowerCase()} to ${q.owner.split(" ")[0]} is ${daysBetween(q.due, today) > 0 ? `${daysBetween(q.due, today)} days overdue` : "still open"}.`] : [],
          owner: c.owner,
        });
      }
      if (c.nextRound) {
        decided.add(c.id);
        const facts = portfolioFacts(c, today);
        const conflict = facts.find((f) => f.status === "Conflict");
        decisions.push({
          key: `round-${c.id}`,
          kind: "Portfolio",
          company: c.name,
          href: `/portfolio/${c.id}`,
          question: `${c.nextRound.round} in ${c.nextRound.when}. Take the fund's pro-rata?`,
          detail: `The fund owns ${c.investment.ownershipPct}% after a ${usd(c.investment.amountUsd)} ${c.investment.round}. Source: ${c.nextRound.source}.`,
          blockers: conflict ? [`Clear first: ${conflict.why.charAt(0).toLowerCase()}${conflict.why.slice(1)}`] : [],
          owner: c.owner,
        });
      }
    }
    const watch: { id: string; name: string; items: Attention[] }[] = [];
    const good: { id: string; name: string; item: Attention }[] = [];
    for (const c of p.companies) {
      const items = attentionFor(c, today).filter((a) => !(decided.has(c.id) && (a.fact === "runway" || a.text.startsWith("Raising"))));
      const serious = items.filter((a) => a.level !== "good");
      if (serious.length) watch.push({ id: c.id, name: c.name, items: serious });
      const g = items.find((a) => a.level === "good");
      if (g && !serious.some((a) => a.level === "high" || a.level === "medium")) good.push({ id: c.id, name: c.name, item: g });
    }
    const rank = { high: 0, medium: 1, low: 2, good: 3 };
    watch.sort((a, b) => rank[a.items[0].level] - rank[b.items[0].level] || a.name.localeCompare(b.name));

    // What changed in the last seven days.
    const since = addDays(today, -7);
    const changes: { date: string; company: string; href: string; text: string; who: "company" | "fund" | "pitch" }[] = [];
    for (const d of store.deals)
      if (d.receivedAt.slice(0, 10) > since) changes.push({ date: d.receivedAt.slice(0, 10), company: d.form.companyName, href: `/deals/${d.id}`, text: "New pitch received and screened", who: "pitch" });
    for (const s of store.unprocessed)
      if (s.receivedAt.slice(0, 10) > since) changes.push({ date: s.receivedAt.slice(0, 10), company: s.form.companyName, href: `/deals/${s.id}`, text: "New pitch received, not screened yet", who: "pitch" });
    for (const c of p.companies)
      for (const e of companyEvents(c, today))
        if (e.date.slice(0, 10) > since && e.who !== "screener") changes.push({ date: e.date.slice(0, 10), company: c.name, href: `/portfolio/${c.id}?tab=activity`, text: e.title, who: e.who === "company" ? "company" : "fund" });
    changes.sort((a, b) => b.date.localeCompare(a.date));
    return { decisions, watch, good, changes };
  }, [store, p, w]);
}

// ---------- Partner ----------

function PartnerHome() {
  const w = useWorkspace();
  const p = usePortfolio();
  const store = useStore();
  const panels = usePanels();
  const { decisions } = usePartnerData();
  const { rows, market, today } = useDealFlow();
  const byId = (id: string) => p.companies.find((c) => c.id === id);

  const monthly = MONTHS.map((ym) => rows.reduce((n, r) => n + r.dates.filter((d) => d.startsWith(ym)).length, 0));
  const thisMonth = monthly.at(-1)!;
  const change = thisMonth / Math.max(1, monthly.at(-2)!) - 1;
  const toRead = rows.filter((r) => r.status === "New").sort(triageOrder);
  const meetings = rows.filter((r) => r.status === "Meeting set");
  const lookNow = rows.filter((r) => r.look.now);
  const never = rows.filter((r) => r.label === "Never opened");
  const missed = rows.filter((r) => r.decision && r.signals.some((s) => s.kind === "Raised elsewhere" && s.at >= r.decision!.at));

  const specs: TileSpec[] = [
    listSpec("read", { title: "To read", icon: "pitch", tone: "info", explain: "Decks nobody has decided on yet, best first: fits the rules, founder-market fit, then waiting longest.", clear: "Nothing waiting.", rows: toRead }),
    listSpec("meet", { title: "Meetings", icon: "decide", tone: "good", explain: "Companies the team is meeting.", clear: "No meetings set.", rows: meetings }),
    listSpec("look", { title: "Look again now", icon: "read", tone: "watch", explain: "Passed or held companies with fresh news that adds up to a second look.", clear: "Nothing right now.", how: lookHow, rows: lookNow, sort: "look" }),
    listSpec("never", { title: "Never opened", icon: "question", tone: "urgent", explain: `Founders who sent a deck ${NEVER_OPENED_DAYS}+ days ago and heard nothing.`, clear: "Every deck has been opened.", next: "Give each one an owner today.", rows: never }),
    listSpec("missed", { title: "Raised since we passed", icon: "cash", tone: "watch", explain: "Companies the fund passed on that later raised from another investor.", clear: "None.", rows: missed, extra: <MissRate /> }),
    {
      key: "decide",
      title: "Decisions for you",
      count: decisions.length,
      tone: "urgent",
      icon: "decide",
      explain: "Calls only a partner can make.",
      clear: "No decisions waiting.",
      entries: decisions.map((d) => {
        const c = byId(d.key.split("-").slice(1).join("-"));
        const deal = store.deals.find((x) => `deal-${x.id}` === d.key);
        return {
          key: d.key,
          group: c ? pg(c, p.today) : deal ? dealGroup(deal, store.bandOf(deal)) : { id: d.key, name: d.company, kind: d.kind, href: d.href, owner: d.owner },
          title: d.question,
          detail: d.detail,
          meta: d.blockers.length ? <span className="font-medium text-red-700">! {d.blockers.join(" ")}</span> : undefined,
          tone: d.blockers.length ? "urgent" : "info",
          href: d.href,
          cta: "Decide",
        } satisfies Entry;
      }),
    },
    missingTile(p.companies, p.today, false),
    cashTile(p.companies, p.today),
  ];
  const needHelp = p.companies.filter((c) => healthOf(c, p.today).health === "Needs help").length;
  const stat = (key: string, n: number, label: string, tone = "text-white") => (
    <button key={key} onClick={() => panels.open(key)} className="rounded-xl bg-white/[0.06] px-4 py-3 text-left ring-1 ring-inset ring-white/10 transition hover:bg-white/10">
      <span className={cx("block text-2xl font-semibold tabular-nums", tone)}>{n}</span>
      <span className="text-xs text-white/60">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Greeting name={w.me} line={`${thisMonth} decks this month, ${toRead.length} waiting to be read, ${lookNow.length} to look again now.`} />
        <HowItWorks />
      </div>
      {!rows.length && <ZeroState />}
      {decisions.length > 0 && (
        <button onClick={() => panels.open("decide")} className="flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-red-200 transition hover:ring-red-300">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-sm font-semibold text-red-700">{decisions.length}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900">{decisions.length === 1 ? "A decision needs you" : `${decisions.length} decisions need you`}</span>
            <span className="block truncate text-sm text-slate-500">{decisions.map((d) => d.company).join(", ")}</span>
          </span>
          <span className="text-sm font-medium text-indigo-700">Review →</span>
        </button>
      )}

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-5 text-white shadow-lg sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">Deal flow · {fmtMonth(today.slice(0, 7))}</p>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="text-5xl font-semibold tabular-nums tracking-tight">{thisMonth}</span>
              <Delta value={change} solid from={[monthly.at(-2)!, thisMonth]} />
            </p>
            <p className="mt-1 text-sm text-white/60">decks this month, against {monthly.at(-2)} last month</p>
            <Sparkline values={monthly} width={320} height={64} tone="white" fluid className="mt-4 h-16 w-full max-w-sm" />
            <p className="mt-1 flex max-w-sm justify-between text-[10px] uppercase tracking-wider text-white/40">
              {MONTHS.map((m) => (
                <span key={m}>{fmtMonth(m).slice(0, 3)}</span>
              ))}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {stat("read", toRead.length, "to read")}
            {stat("meet", meetings.length, "meetings", "text-emerald-300")}
            {stat("look", lookNow.length, "look again now", "text-amber-300")}
            {stat("never", never.length, "never opened", never.length ? "text-red-300" : "text-white")}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <MarketCard market={market} height={280} />
        <TeamPulse rows={rows} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LookAgainList rows={rows} limit={4} />
        <NewsList rows={rows} limit={4} />
      </div>

      <SectorHeatmap rows={rows} market={market} />

      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-semibold text-slate-900">Portfolio</h2>
          <p className="text-sm text-slate-500">{p.companies.length} companies. Reports, cash and health live on the Portfolio screen.</p>
        </div>
        <Link href="/portfolio" className="text-center">
          <span className={cx("block text-xl font-semibold tabular-nums", needHelp ? "text-red-700" : "text-slate-900")}>{needHelp}</span>
          <span className="text-[11px] text-slate-500">need help</span>
        </Link>
        {specs.slice(-2).map((t) => (
          <button key={t.key} onClick={() => panels.open(t.key)} className="text-center">
            <span className={cx("block text-xl font-semibold tabular-nums", t.count ? "text-amber-700" : "text-slate-900")}>{t.count}</span>
            <span className="text-[11px] text-slate-500">{t.title.toLowerCase()}</span>
          </button>
        ))}
        <button onClick={() => panels.open("missed")} className="text-center">
          <span className="block text-xl font-semibold tabular-nums text-slate-900">{missed.length}</span>
          <span className="text-[11px] text-slate-500">raised after our pass</span>
        </button>
        <Link href="/portfolio" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Open portfolio
        </Link>
      </section>
      {panels.render(specs)}
    </div>
  );
}

/** The partner's view adds up each analyst's pitch work. */
function TeamPulse({ rows }: { rows: FlowRow[] }) {
  const people = [...ANALYSTS.map((a) => a.name), PARTNER.name];
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Team</h2>
          <p className="text-sm text-slate-500">Each person&apos;s pitch work, last 6 months.</p>
        </div>
        <Link href="/team" className="shrink-0 whitespace-nowrap text-sm font-medium text-indigo-700 hover:text-indigo-900">
          Team →
        </Link>
      </div>
      <ul className="space-y-3">
        {people.map((name) => {
          const mine = rows.filter((r) => r.owner === name);
          const open = mine.filter((r) => r.status === "New" || r.status === "Reviewing").length;
          const meet = mine.filter((r) => r.status === "Meeting set").length;
          const passed = mine.filter((r) => r.status === "Passed" || r.status === "On hold").length;
          const look = mine.filter((r) => r.look.now).length;
          return (
            <li key={name}>
              <a href={`/team?who=${name.split(" ")[0].toLowerCase()}`} className="block rounded-xl p-2 hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      {name} {name === PARTNER.name && <span className="text-xs font-normal text-slate-400">partner</span>}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {mine.length} pitches · {open} open · {meet} meetings{look ? ` · ${look} to look again` : ""}
                    </span>
                  </span>
                </span>
                <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="bg-slate-600" style={{ width: `${(open / Math.max(1, mine.length)) * 100}%` }} />
                  <span className="bg-emerald-500" style={{ width: `${(meet / Math.max(1, mine.length)) * 100}%` }} />
                  <span className="bg-slate-300" style={{ width: `${(passed / Math.max(1, mine.length)) * 100}%` }} />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-600" />
          open
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          meeting
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
          passed or held
        </span>
      </p>
    </section>
  );
}

// ---------- Analyst ----------

function AnalystHome() {
  const w = useWorkspace();
  const p = usePortfolio();
  const ev = useEvidence();
  const panels = usePanels();
  const me = w.me;
  const flow = useDealFlow((o) => !o || o === me);
  const fund = useDealFlow();
  const mine = p.companies.filter((c) => c.owner === me);
  const pitches = usePitches((o) => o === me || !o);
  // Only the analyst's own portfolio companies; issues on pitches live with the pitch.
  const fixes = useDataToFix(me).filter((f) => f.company.side === "portfolio");
  const forMe = w.questions.filter((q) => q.owner === me && !q.answer).sort(byUrgency(p.today));
  const asked = w.questions.filter((q) => q.askedBy === me && !q.answer).sort(byUrgency(p.today));
  const toRead = mine.flatMap((c) => c.reports.filter((r) => r.receivedAt && !r.acknowledgedAt && r.receivedAt.slice(0, 10) <= p.today).map((r) => ({ c, r })));
  const asks = mine.flatMap((c) => c.asks.filter((a) => !a.answeredAt).map((a) => ({ c, a })));
  const byId = (id: string) => mine.find((c) => c.id === id)!;
  const links = useLinks();
  const room = useDataRoom().filter((r) => r.owner === me);
  const roomGroup = (r: (typeof room)[number]): Group =>
    r.side === "portfolio" ? pg(byId(r.id), p.today) : { id: r.id, name: r.name, kind: "Pitch", href: r.href, owner: r.owner, status: r.status };
  const fromFounders: Entry[] = [
    ...room.flatMap((r) =>
      r.shared
        .filter((f) => f.isNew)
        .map((f) => ({
          key: f.key,
          group: roomGroup(r),
          title: f.folder === TO_FILE ? `To file: ${f.name}` : `New: ${f.name}`,
          detail: f.folder === TO_FILE ? `Email “${f.email?.subject}” from ${f.sender}` : `Answers: ${f.what}`,
          meta: f.folder === TO_FILE ? `Arrived ${fmtDay(f.at)} by ${f.channel.toLowerCase()}. Put it in a folder and say what it answers.` : `Sent ${fmtDay(f.at)} on your request link. Check it against the deck, then mark it checked.`,
          tone: (f.folder === TO_FILE ? "watch" : "info") as Entry["tone"],
          href: f.check ? undefined : `/dataroom/${r.id}#to-file`,
          cta: f.check ? undefined : "File it",
          action: f.check ? (
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => links.markChecked(f.check!.reqId, f.check!.itemId, me)}>
              Mark as checked
            </Button>
          ) : undefined,
        })),
    ),
    ...room.flatMap((r) =>
      r.missing
        .filter((m) => m.linkId && (m.overdue || m.answer))
        .map((m) => ({
          key: m.key,
          group: roomGroup(r),
          title: m.label,
          detail: m.meta,
          tone: (m.overdue ? "urgent" : "watch") as Entry["tone"],
          href: `/dataroom/${r.id}`,
          cta: "Open room",
        })),
    ),
  ];

  const openQs = [...forMe, ...asked];
  const tiles: TileSpec[] = [
    {
      ...questionsTile("for-me", "Open questions", openQs, p.today, `${forMe.length} for you to answer, ${asked.length} you asked that wait on others.`, "No open questions."),
      body: () => (
        <div className="space-y-5">
          {[
            ["For you to answer", forMe],
            ["You asked, waiting on others", asked],
          ].map(([label, qs]) => (
            <div key={label as string}>
              <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label as string} ({(qs as Question[]).length})
              </h3>
              {(qs as Question[]).length ? (
                <ul className="space-y-2">
                  {(qs as Question[]).map((q) => (
                    <QuestionItem key={q.id} q={q} showCompany />
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-sm text-slate-500">None.</p>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "founders",
      title: "From founders",
      count: fromFounders.length,
      tone: fromFounders.some((e) => e.tone === "urgent") ? "urgent" : "info",
      icon: "files",
      explain: "Files founders sent through your links, and things they owe you or said they don't have.",
      clear: "Nothing new from founders.",
      next: "Check each new file against the deck and mark it checked. File emailed files. For a late item, send a short nudge with the same link.",
      how: "Counts files founders sent you that nobody has checked (request links) or filed (email, founder portal), plus request lines that are late or that the founder answered 'later' or 'don't have'.",
      entries: fromFounders,
    },
    missingTile(mine, p.today, true),
    {
      key: "read",
      title: "Reports to read",
      count: toRead.length,
      tone: toRead.some(({ r }) => daysBetween(r.receivedAt!, p.today) > 7) ? "urgent" : "watch",
      icon: "read",
      explain: "MIS reports that arrived and no one at the fund has read. The aim is 7 days.",
      clear: "All reports read.",
      next: "Read it, check the numbers tab for anything that doesn't match, then mark it read so the founder sees the fund replied.",
      how: `Counts monthly reports that arrived and nobody marked read. Red when one has waited more than ${HEALTH_RULES.ackDays} days.`,
      entries: toRead.map(({ c, r }) => {
        const waited = daysBetween(r.receivedAt!, p.today);
        return {
          key: `${c.id}-${r.month}`,
          group: pg(c, p.today, "reporting"),
          title: `${fmtMonth(r.month)} report`,
          detail: `Arrived ${fmtDay(r.receivedAt!)}, waiting ${waited} days.`,
          tone: waited > 7 ? "urgent" : "watch",
          action: (
            <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => p.acknowledge(c.id, r.month)}>
              Mark as read
            </Button>
          ),
        } satisfies Entry;
      }),
    },
    {
      key: "fix",
      title: "Numbers to fix",
      count: fixes.length,
      tone: fixes.some((f) => f.fact.status === "Conflict") ? "urgent" : "watch",
      icon: "conflict",
      explain: "On your portfolio companies: numbers that don't match between sources, or that the founder hasn't sent.",
      clear: "Every number on your companies is checked or reported.",
      next: "For a mismatch, ask the founder which source is right and answer with the file and page. For a gap, add it to the next reminder.",
      how: `Counts key numbers on your portfolio companies labelled Conflict (sources differ by more than ${GAP_TOLERANCE * 100}%) or Missing (no source has it).`,
      entries: fixes.map((i) => ({
        key: i.key,
        group: pg(byId(i.company.id), p.today, "numbers"),
        title: `${i.fact.label}: ${i.fact.status === "Conflict" ? "doesn't match" : "missing"}`,
        detail: i.fact.why,
        tone: i.fact.status === "Conflict" ? "urgent" : "watch",
        onClick: () => ev.open({ fact: i.fact, company: i.company }),
        cta: i.fact.status === "Conflict" ? "See both sources" : "See what's needed",
      })),
    },
    newPitchesTile(pitches, true),
    {
      key: "asks",
      title: "Founder asks",
      count: asks.length,
      tone: asks.some(({ a }) => daysBetween(a.openedAt, p.today) > 14) ? "urgent" : "watch",
      icon: "ask",
      explain: "Founders asking the fund for help. The aim is to answer within 14 days.",
      clear: "No founder asks open.",
      next: "Reply with a first step within 48 hours, even if the full answer takes longer.",
      how: `Counts founder asks with no reply. Red when one has been open more than ${HEALTH_RULES.askOpenDays} days.`,
      entries: asks.map(({ c, a }) => {
        const days = daysBetween(a.openedAt, p.today);
        return { key: a.id, group: pg(c, p.today, "activity"), title: `Asks for help with ${a.topic.toLowerCase()}`, detail: `“${a.text}”`, meta: `Open ${days} days`, tone: days > 14 ? "urgent" : "watch", href: `/portfolio/${c.id}?tab=activity`, cta: "Reply" } satisfies Entry;
      }),
    },
    cashTile(mine, p.today),
  ];

  const pitchRows = flow.rows;
  const toReadRows = pitchRows.filter((r) => r.status === "New" && (r.owner === me || (!r.owner && r.label !== "Never opened"))).sort(triageOrder);
  const unclaimed = pitchRows.filter((r) => r.label === "Never opened");
  const mineRows = pitchRows.filter((r) => r.owner === me);
  const active = pitchRows.filter((r) => (r.owner === me || (!r.owner && r.live)) && (r.status === "New" || r.status === "Reviewing" || r.status === "Meeting set")).sort(triageOrder);
  const lookMine = mineRows.filter((r) => r.look.event);
  const flowSpecs: TileSpec[] = [
    listSpec("a-read", { title: "To read", icon: "pitch", tone: "info", explain: "New decks given to you, and new ones nobody has taken yet. Best first.", clear: "Nothing to read.", next: "Open it, read the deck, then set a status: reviewing, meeting, hold or pass with a reason.", rows: toReadRows }),
    listSpec("a-never", { title: "Never opened", icon: "question", tone: "urgent", explain: `Decks that have sat ${NEVER_OPENED_DAYS}+ days with no owner.`, clear: "Every deck has been opened.", next: "Take one: open it and set a status. A quick no is better than silence.", rows: unclaimed }),
    listSpec("a-look", { title: "Look again", icon: "read", tone: "watch", explain: "Companies you passed on or held where something has changed.", clear: "Nothing to look at again.", how: lookHow, rows: lookMine, sort: "look" }),
  ];
  const allSpecs = [...flowSpecs, ...tiles];
  const today: { key: string; n: number; label: string; hint: string; dot: string }[] = [
    { key: "a-read", n: toReadRows.length, label: "To read", hint: "New decks for you", dot: "bg-slate-600" },
    { key: "founders", n: fromFounders.length, label: "From founders", hint: "Files to check or chase", dot: "bg-slate-600" },
    { key: "a-look", n: lookMine.length, label: "Look again", hint: "News since you passed", dot: "bg-amber-500" },
    { key: "a-never", n: unclaimed.length, label: "Never opened", hint: "No owner yet", dot: "bg-slate-500" },
  ];
  const stages: { label: string; value: number; color: string }[] = [
    { label: "New", value: mineRows.filter((r) => r.status === "New").length, color: "bg-slate-600" },
    { label: "Reviewing", value: mineRows.filter((r) => r.status === "Reviewing").length, color: "bg-slate-600" },
    { label: "Meeting", value: mineRows.filter((r) => r.status === "Meeting set").length, color: "bg-emerald-500" },
    { label: "On hold", value: mineRows.filter((r) => r.status === "On hold").length, color: "bg-amber-400" },
    { label: "Passed", value: mineRows.filter((r) => r.status === "Passed").length, color: "bg-slate-300" },
  ];
  const portfolioWork = tiles.filter((t) => t.key !== "founders" && t.key !== "pitches");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Greeting name={me} line={`${toReadRows.length} decks to read, ${fromFounders.length} things from founders, ${lookMine.length} to look again.`} />
        <HowItWorks />
      </div>
      {!fund.rows.length && <ZeroState />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {today.map((t) => (
          <button key={t.key} onClick={() => panels.open(t.key)} className="group rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className={cx("h-2 w-2 rounded-full", t.dot)} />
              {t.label}
            </span>
            <span className="mt-2 block text-3xl font-semibold tabular-nums text-slate-900">{t.n}</span>
            <span className="text-xs text-slate-500">{t.hint}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">My pitches</h2>
              <p className="text-sm text-slate-500">Open work, best first: fits the rules, founder-market fit, then waiting longest.</p>
            </div>
            <Link href="/deals" className="shrink-0 whitespace-nowrap text-sm font-medium text-indigo-700 hover:text-indigo-900">
              All pitches →
            </Link>
          </div>
          <DeckList rows={active} pageSize={8} group={false} empty="Nothing open. New decks will show here." />
        </section>
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <h2 className="text-base font-semibold text-slate-900">My pipeline</h2>
            <p className="mb-3 text-sm text-slate-500">{mineRows.length} pitches you have handled in 6 months.</p>
            <StackBar parts={stages} />
          </section>
          <LookAgainList rows={pitchRows} owner={me} limit={3} />
        </div>
      </div>

      <SectorHeatmap rows={fund.rows} market={fund.market} />

      <section className="rounded-2xl bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className="font-semibold text-slate-900">My portfolio companies</h2>
            <p className="text-sm text-slate-500">
              {mine.length} {mine.length === 1 ? "company" : "companies"}: {mine.map((c) => c.name).join(", ")}
            </p>
          </div>
          {portfolioWork.map((t) => (
            <button key={t.key} onClick={() => panels.open(t.key)} className="text-center">
              <span className={cx("block text-xl font-semibold tabular-nums", t.count ? (t.tone === "urgent" ? "text-red-700" : "text-amber-700") : "text-slate-900")}>{t.count}</span>
              <span className="text-[11px] text-slate-500">{t.title.toLowerCase()}</span>
            </button>
          ))}
          <Link href="/portfolio" className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Open portfolio
          </Link>
        </div>
      </section>
      {panels.render(allSpecs)}
    </div>
  );
}
