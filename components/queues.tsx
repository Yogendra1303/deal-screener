"use client";

// The analyst's working queue and the per-analyst numbers a partner checks on the Team page.
import Link from "next/link";
import { useMemo } from "react";
import { QuestionItem, StatusLabel, useEvidence } from "./evidence";
import { ReminderButton } from "./portfolio-actions";
import { usePortfolio } from "./portfolio-store";
import { useStore } from "./store";
import { Button, Card, cx } from "./ui";
import { useWorkspace } from "./workspace";
import { fmtDay } from "@/lib/dates";
import { fmtMonth } from "@/lib/format";
import { attentionFor, type Attention } from "@/lib/portfolio/attention";
import { daysBetween, missingItems } from "@/lib/portfolio/health";
import { dealFacts, portfolioFacts, type KeyFact } from "@/lib/provenance";
import { stateOf, type Question } from "@/lib/questions";
import { useLinks } from "./links-store";
import type { DealResult } from "@/lib/types";

export function byUrgency(today: string) {
  const rank = { Overdue: 0, Open: 1, Answered: 2 };
  return (a: Question, b: Question) => rank[stateOf(a, today)] - rank[stateOf(b, today)] || a.due.localeCompare(b.due);
}

// ---------------- Analyst ----------------

/** One analyst's queue. Their own home page, and what a partner sees on the Team page (read only). */
export function AnalystQueue({ who, readOnly }: { who: string; readOnly?: boolean }) {
  const w = useWorkspace();
  const p = usePortfolio();
  const store = useStore();
  const links = useLinks();
  const own = links.ownerOf;
  const me = who;
  const first = who.split(" ")[0];
  const mine = p.companies.filter((c) => c.owner === me);
  const questions = w.questions.filter((q) => q.owner === me && !q.answer).sort(byUrgency(p.today));
  const asked = w.questions.filter((q) => q.askedBy === me && !q.answer).sort(byUrgency(p.today));
  const toRead = mine.flatMap((c) => c.reports.filter((r) => r.receivedAt && !r.acknowledgedAt && r.receivedAt.slice(0, 10) <= p.today).map((r) => ({ c, r })));
  const chase = mine.flatMap((c) => missingItems(c, p.today).map((m) => ({ c, m })));
  const asks = mine.flatMap((c) => c.asks.filter((a) => !a.answeredAt).map((a) => ({ c, a })));
  const myDeals = store.deals.filter((d) => own(d.id) === me && store.statusOf(d.id) === "New");
  const myWaiting = store.unprocessed.filter((s) => own(s.id) === me);
  const unassigned = store.unprocessed.filter((s) => !own(s.id)).length + links.inbound.filter((i) => !i.owner).length;

  return (
    <>
      <p className="rounded-lg bg-white px-4 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
        {me} looks after {mine.map((c) => c.name).join(", ")}
        {(() => {
          const n = [...store.deals.map((d) => d.id), ...store.unprocessed.map((u) => u.id), ...links.inbound.map((i) => i.id)].filter((id) => own(id) === me).length;
          return n ? `, and owns ${n} ${n === 1 ? "pitch" : "pitches"}` : "";
        })()}
        .
      </p>
      <DataToFix who={who} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHead title={readOnly ? `Questions for ${first}` : "Questions for you"} hint="From the partner. Answer with a source" count={questions.length} />
          {questions.length ? (
            <ul className="space-y-2">
              {questions.map((q) => (
                <QuestionItem key={q.id} q={q} showCompany />
              ))}
            </ul>
          ) : (
            <Empty text="No questions waiting on you." />
          )}
        </section>

        <div className="space-y-6">
          <section>
            <SectionHead title="Reports to read" hint="Received, not marked read" count={toRead.length} />
            {toRead.length ? (
              <Card className="divide-y divide-slate-100">
                {toRead.map(({ c, r }) => {
                  const waited = daysBetween(r.receivedAt!, p.today);
                  return (
                    <div key={`${c.id}-${r.month}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/portfolio/${c.id}?tab=reporting`} className="font-medium text-slate-900 hover:text-indigo-700">
                          {c.name}, {fmtMonth(r.month)}
                        </Link>
                        <p className={cx("text-xs", waited > 7 ? "text-amber-800" : "text-slate-500")}>
                          Arrived {fmtDay(r.receivedAt!)}, waiting {waited} days{waited > 7 ? " (the aim is 7)" : ""}
                        </p>
                      </div>
                      {!readOnly && (
                        <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={() => p.acknowledge(c.id, r.month)}>
                          Mark as read
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>
            ) : (
              <Empty text="All reports read." />
            )}
          </section>

          <section>
            <SectionHead title="Chase founders" hint="Owed to the fund" count={chase.length} />
            {chase.length ? (
              <Card className="divide-y divide-slate-100">
                {chase.map(({ c, m }) => (
                  <div key={m.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/portfolio/${c.id}?tab=reporting`} className="font-medium text-slate-900 hover:text-indigo-700">
                        {c.name}: {m.what}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {m.overdueDays > 0 ? `${m.overdueDays} days overdue` : "Due"} · {m.reminders.length ? `reminded ${m.reminders.map(fmtDay).join(", ")}` : "no reminder yet"}
                      </p>
                    </div>
                    {!readOnly && !m.key.endsWith(":question") && <ReminderButton itemKey={m.key} sentToday={m.reminders.includes(p.today)} />}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty text="Nothing owed." />
            )}
          </section>
        </div>

        <section>
          <SectionHead title="Founder asks" hint="Founders asking the fund for help" count={asks.length} />
          {asks.length ? (
            <Card className="divide-y divide-slate-100">
              {asks.map(({ c, a }) => {
                const days = daysBetween(a.openedAt, p.today);
                return (
                  <Link key={a.id} href={`/portfolio/${c.id}?tab=activity`} className="block px-4 py-3 hover:bg-slate-50">
                    <span className="font-medium text-slate-900">
                      {c.name}: {a.topic.toLowerCase()}
                    </span>
                    <p className="line-clamp-2 text-sm text-slate-600">“{a.text}”</p>
                    <p className={cx("text-xs", days > 14 ? "font-medium text-amber-800" : "text-slate-500")}>Open {days} days{days > 14 ? " (the aim is 14)" : ""}</p>
                  </Link>
                );
              })}
            </Card>
          ) : (
            <Empty text="No founder asks open." />
          )}
        </section>

        <section>
          <SectionHead title="Pitches" hint="Yours, and decks no one has picked up" count={myDeals.length + myWaiting.length} />
          <Card className="divide-y divide-slate-100">
            {myDeals.map((d: DealResult) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="block px-4 py-3 hover:bg-slate-50">
                <span className="font-medium text-slate-900">{d.form.companyName}</span>
                <p className="text-sm text-slate-600">Screened, suggested {store.bandOf(d)}. Status still New: review it and prepare the partner&apos;s questions.</p>
              </Link>
            ))}
            {myWaiting.map((s) => (
              <Link key={s.id} href="/deals" className="block px-4 py-3 hover:bg-slate-50">
                <span className="font-medium text-slate-900">{s.form.companyName}</span>
                <p className="text-sm text-slate-600">Deck received {fmtDay(s.receivedAt)}. Not screened yet.</p>
              </Link>
            ))}
            <Link href="/deals" className="block px-4 py-3 text-sm text-slate-600 hover:bg-slate-50">
              {unassigned} more {unassigned === 1 ? "deck has" : "decks have"} no owner yet. <span className="font-medium text-indigo-700">Open deals →</span>
            </Link>
          </Card>
        </section>

        {asked.length > 0 && (
          <section className="lg:col-span-2">
            <SectionHead title={readOnly ? `Questions ${first} asked` : "Questions you asked"} hint="Waiting on someone else" count={asked.length} />
            <ul className="grid gap-2 lg:grid-cols-2">
              {asked.map((q) => (
                <QuestionItem key={q.id} q={q} showCompany />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}


interface FixItem {
  key: string;
  company: { id: string; name: string; side: "deal" | "portfolio" };
  fact: KeyFact;
}

/** Every number on the analyst's companies and pitches that is in conflict or missing. */
export function useDataToFix(who: string): FixItem[] {
  const store = useStore();
  const p = usePortfolio();
  const links = useLinks();
  return useMemo(() => {
    const out: FixItem[] = [];
    for (const c of p.companies.filter((x) => x.owner === who))
      for (const f of portfolioFacts(c, p.today))
        if (f.status === "Conflict" || f.status === "Missing") out.push({ key: `${c.id}:${f.key}`, company: { id: c.id, name: c.name, side: "portfolio" }, fact: f });
    for (const d of store.deals.filter((x) => links.ownerOf(x.id) === who))
      for (const f of dealFacts(d))
        if (f.status === "Conflict" || (f.status === "Missing" && f.headline))
          out.push({ key: `${d.id}:${f.key}`, company: { id: d.id, name: d.form.companyName, side: "deal" }, fact: f });
    return out.sort((a, b) => (a.fact.status === b.fact.status ? 0 : a.fact.status === "Conflict" ? -1 : 1));
  }, [store.deals, p.companies, p.today, who, links]);
}

function DataToFix({ who }: { who: string }) {
  const ev = useEvidence();
  const items = useDataToFix(who);
  return (
    <section>
      <SectionHead title="Numbers to fix" hint="Conflicts and gaps on these companies. Click one for its sources" count={items.length} />
      {items.length ? (
        <Card className="overflow-hidden">
          <ul className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
            {items.map((i) => (
              <li key={i.key} className="md:border-b md:border-slate-100 md:odd:border-r">
                <button onClick={() => ev.open({ fact: i.fact, company: i.company })} className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-slate-900">{i.company.name}</span>
                    <span className="text-slate-500"> · {i.fact.label}</span>
                    <span className="block truncate text-xs text-slate-500">{i.fact.why}</span>
                  </span>
                  <StatusLabel status={i.fact.status} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty text="Every number on these companies is checked or reported." />
      )}
    </section>
  );
}

export interface AnalystLoad {
  name: string;
  companies: { id: string; name: string; head?: Attention }[];
  pitches: number;
  pitchesNew: number;
  owed: Question[];
  overdue: number;
  toRead: number;
  oldestUnreadDays: number;
  chase: number;
  asksOld: number;
  fixes: number;
  conflicts: number;
}

/** What one analyst is carrying, for the partner's Team page. Worked out by code from the records. */
export function useAnalystLoad(who: string): AnalystLoad {
  const store = useStore();
  const p = usePortfolio();
  const w = useWorkspace();
  const links = useLinks();
  const fixes = useDataToFix(who);
  return useMemo(() => {
    const mine = p.companies.filter((c) => c.owner === who);
    const unread = mine.flatMap((c) => c.reports.filter((r) => r.receivedAt && !r.acknowledgedAt && r.receivedAt.slice(0, 10) <= p.today));
    const owed = w.questions.filter((q) => q.owner === who && !q.answer);
    const pitches = store.deals.filter((d) => links.ownerOf(d.id) === who);
    return {
      name: who,
      companies: mine.map((c) => ({ id: c.id, name: c.name, head: attentionFor(c, p.today)[0] })),
      pitches: pitches.length + store.unprocessed.filter((s) => links.ownerOf(s.id) === who).length + links.inbound.filter((i) => i.owner === who && !store.deals.some((d) => d.id === i.id)).length,
      pitchesNew: pitches.filter((d) => store.statusOf(d.id) === "New").length,
      owed,
      overdue: owed.filter((q) => stateOf(q, p.today) === "Overdue").length,
      toRead: unread.length,
      oldestUnreadDays: unread.reduce((m, r) => Math.max(m, daysBetween(r.receivedAt!, p.today)), 0),
      chase: mine.flatMap((c) => missingItems(c, p.today)).length,
      asksOld: mine.flatMap((c) => c.asks.filter((a) => !a.answeredAt && daysBetween(a.openedAt, p.today) > 14)).length,
      fixes: fixes.length,
      conflicts: fixes.filter((f) => f.fact.status === "Conflict").length,
    };
  }, [store, p, w.questions, who, fixes, links]);
}

// ---------------- Small pieces ----------------

export function Stat({ href, n, label, note }: { href: string; n: number; label: string; note?: string }) {
  return (
    <a href={href} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 sm:px-4 sm:py-3">
      <span className="block text-2xl font-semibold tabular-nums text-slate-900">{n}</span>
      <span className="block text-xs text-slate-600 sm:text-sm">{label}</span>
      {note && <span className="block text-xs font-medium text-red-700">{note}</span>}
    </a>
  );
}

export function SectionHead({ title, hint, count }: { title: string; hint?: string; count?: number }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900">
        {title}
        {count != null && <span className="ml-1.5 text-sm font-normal text-slate-500">{count}</span>}
      </h2>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-center text-sm text-slate-500">{text}</p>;
}

export const DOT: Record<Attention["level"], string> = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-slate-300", good: "bg-emerald-500" };

export function Dot({ level, small }: { level: Attention["level"]; small?: boolean }) {
  return <span aria-hidden className={cx("shrink-0 rounded-full", small ? "mt-2 h-1.5 w-1.5" : "mt-1.5 h-2.5 w-2.5", DOT[level])} />;
}
