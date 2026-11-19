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
  return (a: Question, b: Question) => rank[stateOf(a, today)] - rank[stateOf(b, today)] || (a.due ?? "").localeCompare(b.due ?? "");
}

// ---------------- Analyst ----------------

/** One analyst's queue. Their own home page, and what a partner sees on the Team page. */
export function AnalystQueue({ who, readOnly }: { who: string; readOnly?: boolean }) {
  const w = useWorkspace();
  const p = usePortfolio();
  const store = useStore();
  const links = useLinks();
  const own = links.ownerOf;
  const me = who;
  const isSelf = w.me === who;
  const first = who.split(" ")[0];
  const mine = p.companies.filter((c) => c.owner === me);
  const questions = w.questions.filter((q) => q.owner === me && !q.answer).sort(byUrgency(p.today));
  const asked = w.questions.filter((q) => q.askedBy === me && !q.answer).sort(byUrgency(p.today));
  const toRead = mine.flatMap((c) => c.reports.filter((r) => r.receivedAt && !r.acknowledgedAt && r.receivedAt.slice(0, 10) <= p.today).map((r) => ({ c, r })));
  const chase = mine.flatMap((c) => missingItems(c, p.today).map((m) => ({ c, m })));
  const asks = mine.flatMap((c) => c.asks.filter((a) => !a.answeredAt).map((a) => ({ c, a })));
  const myDeals = store.deals.filter((d) => own(d.id) === me && store.statusOf(d.id) === "New");
  const myWaiting = store.unprocessed.filter((s) => own(s.id) === me);
  const unassigned = new Set(
    [
      ...store.deals.map((d) => d.id),
      ...store.unprocessed.map((s) => s.id),
      ...links.inbound.map((i) => i.id),
    ].filter((id) => !own(id)),
  ).size;

  return (
    <>
      <p className="rounded-lg bg-white px-4 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
        {me} looks after {mine.length ? mine.map((c) => c.name).join(", ") : "no portfolio companies yet"}
        {(() => {
          const n = new Set([
            ...store.deals.map((d) => d.id),
            ...store.unprocessed.map((u) => u.id),
            ...links.inbound.map((i) => i.id),
          ]);
          const count = [...n].filter((id) => own(id) === me).length;
          return count ? `, and owns ${count} ${count === 1 ? "pitch" : "pitches"}` : "";
        })()}
        .
      </p>
      <DataToFix who={who} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="questions" className="scroll-mt-6">
          <SectionHead
            title={isSelf ? "Questions for you" : `Questions for ${first}`}
            hint={isSelf ? "Answer with a source" : `Assigned to ${first} · Click to reply or open company`}
            count={questions.length}
          />
          {questions.length ? (
            <ul className="space-y-2.5">
              {questions.map((q) => (
                <QuestionItem key={q.id} q={q} showCompany />
              ))}
            </ul>
          ) : (
            <Empty text={isSelf ? "No questions waiting on you." : `No questions waiting on ${first}.`} />
          )}
        </section>

        <div className="space-y-6">
          <section id="reports" className="scroll-mt-6">
            <SectionHead title="Reports to read" hint="Received, not marked read" count={toRead.length} />
            {toRead.length ? (
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {toRead.map(({ c, r }) => {
                  const waited = daysBetween(r.receivedAt!, p.today);
                  return (
                    <div key={`${c.id}-${r.month}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                      <Link href={`/portfolio/${c.id}?tab=reporting`} className="group min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900 group-hover:text-indigo-700">
                          <span className="truncate">
                            {c.name}, {fmtMonth(r.month)}
                          </span>
                          <span aria-hidden className="text-xs text-slate-300 group-hover:text-indigo-600">
                            →
                          </span>
                        </div>
                        <p className={cx("text-xs", waited > 7 ? "text-amber-800" : "text-slate-500")}>
                          Arrived {fmtDay(r.receivedAt!)}, waiting {waited} days{waited > 7 ? " (the aim is 7)" : ""}
                        </p>
                      </Link>
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

          <section id="chase" className="scroll-mt-6">
            <SectionHead title="Chase founders" hint="Owed to the fund" count={chase.length} />
            {chase.length ? (
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {chase.map(({ c, m }) => (
                  <div key={m.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                    <Link href={`/portfolio/${c.id}?tab=reporting`} className="group min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900 group-hover:text-indigo-700">
                        <span className="truncate">
                          {c.name}: {m.what}
                        </span>
                        <span aria-hidden className="text-xs text-slate-300 group-hover:text-indigo-600">
                          →
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {m.overdueDays > 0 ? `${m.overdueDays} days overdue` : "Due"} · {m.reminders.length ? `reminded ${m.reminders.map(fmtDay).join(", ")}` : "no reminder yet"}
                      </p>
                    </Link>
                    {!readOnly && !m.key.endsWith(":question") && <ReminderButton itemKey={m.key} sentToday={m.reminders.includes(p.today)} />}
                  </div>
                ))}
              </Card>
            ) : (
              <Empty text="Nothing owed." />
            )}
          </section>
        </div>

        <section id="asks" className="scroll-mt-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Founder asks <span className="ml-1 text-sm font-normal text-slate-500">{asks.length}</span>
            </h2>
            <Link href="/resources" className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
              Founder Support Desk →
            </Link>
          </div>
          {asks.length ? (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {asks.map(({ c, a }) => {
                const days = daysBetween(a.openedAt, p.today);
                return (
                  <Link key={a.id} href={`/portfolio/${c.id}?tab=activity`} className="group flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900 group-hover:text-indigo-700">
                        {c.name}: {a.topic.toLowerCase()}
                      </span>
                      <p className="line-clamp-2 text-sm text-slate-600">“{a.text}”</p>
                      <p className={cx("text-xs", days > 14 ? "font-medium text-amber-800" : "text-slate-500")}>Open {days} days{days > 14 ? " (the aim is 14)" : ""}</p>
                    </div>
                    <span aria-hidden className="mt-1 shrink-0 text-xs text-slate-300 group-hover:text-indigo-600">
                      →
                    </span>
                  </Link>
                );
              })}
            </Card>
          ) : (
            <Empty text="No founder asks open." />
          )}
        </section>

        <section id="pitches" className="scroll-mt-6">
          <SectionHead title="Pitches" hint="Assigned to team member" count={myDeals.length + myWaiting.length} />
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {myDeals.map((d: DealResult) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="group flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900 group-hover:text-indigo-700">{d.form.companyName}</span>
                  <p className="text-sm text-slate-600">Screened, suggested {store.bandOf(d)}. Status still New: review it and prepare the partner&apos;s questions.</p>
                </div>
                <span aria-hidden className="mt-1 shrink-0 text-xs text-slate-300 group-hover:text-indigo-600">
                  →
                </span>
              </Link>
            ))}
            {myWaiting.map((s) => (
              <Link key={s.id} href={`/deals/${s.id}`} className="group flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900 group-hover:text-indigo-700">{s.form.companyName}</span>
                  <p className="text-sm text-slate-600">Deck received {fmtDay(s.receivedAt)}. Not screened yet.</p>
                </div>
                <span aria-hidden className="mt-1 shrink-0 text-xs text-slate-300 group-hover:text-indigo-600">
                  →
                </span>
              </Link>
            ))}
            <Link href="/dataroom?filter=unassigned" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-50">
              <span>{unassigned} more {unassigned === 1 ? "deck has" : "decks have"} no owner yet.</span>
              <span className="shrink-0 font-medium text-indigo-700">Assign in Data Room →</span>
            </Link>
          </Card>
        </section>

        {asked.length > 0 && (
          <section id="asked-by" className="scroll-mt-6 lg:col-span-2">
            <SectionHead
              title={isSelf ? "Questions you asked" : `Questions ${first} asked`}
              hint="Click to reply with a source or open company"
              count={asked.length}
            />
            <ul className="grid gap-2.5 lg:grid-cols-2">
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
    <section id="fixes" className="scroll-mt-6">
      <SectionHead title="Numbers to fix" hint="Conflicts and gaps on these companies. Click one for its sources" count={items.length} />
      {items.length ? (
        <Card className="overflow-hidden">
          <ul className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
            {items.map((i) => (
              <li key={i.key} className="md:border-b md:border-slate-100 md:odd:border-r">
                <button
                  type="button"
                  onClick={() => ev.open({ fact: i.fact, company: i.company })}
                  className="group flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-slate-900 group-hover:text-indigo-700">{i.company.name}</span>
                    <span className="text-slate-500"> · {i.fact.label}</span>
                    <span className="block truncate text-xs text-slate-500">{i.fact.why}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusLabel status={i.fact.status} />
                    <span aria-hidden className="text-xs text-slate-300 group-hover:text-indigo-600">
                      →
                    </span>
                  </span>
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
      pitches: new Set([
        ...pitches.map((d) => d.id),
        ...store.unprocessed.filter((s) => links.ownerOf(s.id) === who).map((s) => s.id),
        ...links.inbound.filter((i) => links.ownerOf(i.id) === who).map((i) => i.id),
      ]).size,
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
