"use client";

import Link from "next/link";
import { useState } from "react";
import { usePortfolio } from "@/components/portfolio-store";
import { useMyCompanies } from "@/components/scope";
import { Avatar } from "@/components/shell";
import { Card, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { fmtDay } from "@/lib/dates";
import type { RunningPlay } from "@/components/portfolio-store";
import { RESOURCES } from "@/lib/portfolio/data";
import { daysBetween, fmtShort } from "@/lib/portfolio/health";
import type { PortfolioCompany, Resource } from "@/lib/portfolio/types";
import { latestRunway } from "@/lib/portfolio/attention";
import { missingItems } from "@/lib/portfolio/health";
import { portfolioFacts } from "@/lib/provenance";

interface Play {
  name: string;
  when: string;
  steps: string[];
  who: string;
  doneWhen: string;
  match: (c: PortfolioCompany, today: string) => string | null;
}

/** Standard ways the fund helps, each tied to a signal the code can see. */
const PLAYS: Play[] = [
  {
    name: "Cash plan",
    when: "Less than 9 months of cash left",
    steps: ["Model three cases: raise, cut, or both", "Introduce 5 investors who do bridge rounds", "Agree a date to decide"],
    who: "Partner and analyst",
    doneWhen: "A bridge is signed, or the next MIS shows lower burn",
    match: (c, t) => {
      const rw = latestRunway(c, t);
      return rw && rw.months < 9 ? `${rw.months.toFixed(1)} months of cash` : null;
    },
  },
  {
    name: "Revenue review",
    when: "Revenue 20% or more below the deck's plan",
    steps: ["Go through the sales pipeline with the founder", "Check pricing and the reasons customers leave", "Introduce 3 possible customers"],
    who: "Analyst, with the platform team",
    doneWhen: "Revenue is back within 10% of plan",
    match: (c, t) => {
      const f = portfolioFacts(c, t).find((x) => x.key === "plan");
      const v = f ? parseFloat(f.value.replace("−", "-")) : NaN;
      return !isNaN(v) && v <= -20 ? `${f!.value} against plan` : null;
    },
  },
  {
    name: "Reporting reset",
    when: "A report more than 30 days late",
    steps: ["Call the founder; don't just email", "Offer a shorter template", "Agree a fixed day each month"],
    who: "Analyst",
    doneWhen: "Two reports in a row arrive on time",
    match: (c, t) => {
      const late = missingItems(c, t).filter((m) => !m.key.endsWith(":question") && m.overdueDays > 30);
      return late.length ? `${late.length} ${late.length === 1 ? "item" : "items"} over 30 days late` : null;
    },
  },
  {
    name: "Fundraise prep",
    when: "The company plans to raise in the next 6 months",
    steps: ["Check the data room against the diligence checklist", "Build a target investor list", "Practise the pitch with a partner"],
    who: "Partner",
    doneWhen: "A term sheet is signed",
    match: (c) => (c.nextRound ? `${c.nextRound.round} in ${c.nextRound.when}` : null),
  },
  {
    name: "Founder ask",
    when: "A founder asked for help over 14 days ago",
    steps: ["Reply with a first step within 48 hours", "Route it to the right person in the network", "Close it with the outcome"],
    who: "Analyst routes it",
    doneWhen: "The founder marks it resolved",
    match: (c, t) => {
      const old = c.asks.filter((a) => !a.answeredAt && daysBetween(a.openedAt, t) > 14);
      return old.length ? `${old.length} ask open over 14 days` : null;
    },
  },
];

const REPORT_TEMPLATE = {
  numbers: [
    ["Revenue for the month", "What was invoiced or recognised. Not GMV or bookings"],
    ["Net burn", "Cash out minus cash in for the month"],
    ["Cash in the bank", "On the last day of the month"],
    ["Paying customers", "Customers who paid this month"],
    ["Customers lost", "Paying customers who stopped this month"],
  ],
  words: [
    "Highlights: the best thing that happened this month",
    "Lowlights: what went wrong, and what you are doing about it",
    "Customers won and lost, and why",
    "How the fund can help this month (one specific ask)",
  ],
};

const KINDS: Resource["kind"][] = ["Template", "Playbook", "Office hours", "Partner perk"];
const KIND_STYLE: Record<Resource["kind"], string> = {
  Template: "bg-slate-100 text-slate-800",
  Playbook: "bg-emerald-50 text-emerald-800",
  "Office hours": "bg-slate-100 text-slate-700",
  "Partner perk": "bg-amber-50 text-amber-800",
};

export default function ResourcesPage() {
  const p = usePortfolio();
  const w = useWorkspace();
  const cos = useMyCompanies();
  const running = p.plays.filter((pl) => cos.some((c) => c.id === pl.companyId));
  const isRunning = (companyId: string, play: string) => running.some((pl) => pl.companyId === companyId && pl.play === play && !pl.closedAt);
  const [kind, setKind] = useState<Resource["kind"] | "all">("all");
  const shown = RESOURCES.filter((r) => kind === "all" || r.kind === kind);
  const asks = cos
    .flatMap((c) => c.asks.map((a) => ({ c, a })))
    .sort((x, y) => Number(Boolean(x.a.answeredAt)) - Number(Boolean(y.a.answeredAt)) || y.a.openedAt.localeCompare(x.a.openedAt));

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Founder support</h1>
        <p className="mt-1 text-slate-600">
          How the fund helps the companies it backs: standard plays matched to what the reports show, the monthly report founders send,
          and the library every founder can use. The fund helps; it doesn&apos;t run the company.
        </p>
      </div>

      <RunningPlays plays={running} />

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Support plays</h2>
        <p className="text-sm text-slate-500">Each play starts from a signal in the reports. Companies that match today are listed on the play.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLAYS.map((play) => {
            const hits = cos.map((c) => ({ c, why: play.match(c, p.today) })).filter((x) => x.why);
            return (
              <article key={play.name} className={cx("flex flex-col rounded-2xl bg-white p-5 ring-1", hits.length ? "ring-amber-200" : "ring-slate-200")}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{play.name}</h3>
                  {hits.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{hits.length} now</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">When: {play.when}</p>
                <ol className="mt-3 space-y-1 text-sm text-slate-700">
                  {play.steps.map((st, i) => (
                    <li key={st} className="flex gap-2">
                      <span className="w-4 shrink-0 text-xs font-semibold text-slate-400">{i + 1}</span>
                      {st}
                    </li>
                  ))}
                </ol>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Who</dt>
                    <dd className="font-medium text-slate-800">{play.who}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Done when</dt>
                    <dd className="font-medium text-slate-800">{play.doneWhen}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-3">
                  {hits.length ? (
                    <ul className="space-y-1 border-t border-slate-100 pt-3">
                      {hits.map(({ c, why }) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0">
                            <Link href={`/portfolio/${c.id}`} className="font-medium text-indigo-700 hover:text-indigo-900">
                              {c.name}
                            </Link>
                            <span className="block text-xs text-slate-500">{why}</span>
                          </span>
                          {isRunning(c.id, play.name) ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Running</span>
                          ) : w.role === "Analyst" && c.owner === w.me ? (
                            <button onClick={() => p.startPlay(c.id, play.name, w.me)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800">
                              Start play
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Not started</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">No company needs this today.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">Matched by code from the reports. The analyst who looks after the company starts a play; the partner sees every play running.</p>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">The monthly report founders send</h2>
        <p className="text-sm text-slate-500">Short on purpose: five numbers and four lines, by the 15th. The MIS file goes with it.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Five numbers</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {REPORT_TEMPLATE.numbers.map(([n, d]) => (
                <li key={n} className="py-2">
                  <p className="text-sm font-medium text-slate-900">{n}</p>
                  <p className="text-xs text-slate-500">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Four lines in words</p>
            <ul className="mt-2 space-y-2">
              {REPORT_TEMPLATE.words.map((x) => (
                <li key={x} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {x}
                </li>
              ))}
            </ul>
            <Link href="/founder/kitebay" className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900">
              See what a founder sees →
            </Link>
          </div>
        </div>
      </section>

      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Library and founder asks</h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind">
            {(["all", ...KINDS] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={cx(
                  "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
                  kind === k ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
                )}
              >
                {k === "all" ? "Everything" : k === "Office hours" ? k : `${k}s`}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((r) => (
              <Card key={r.id} className="flex flex-col p-4">
                <span className={cx("self-start rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide", KIND_STYLE[r.kind])}>
                  {r.kind}
                </span>
                <h2 className="mt-2 text-sm font-semibold text-slate-900">{r.title}</h2>
                <p className="mt-1 flex-1 text-sm text-slate-600">{r.description}</p>
                <p className="mt-3 text-xs text-slate-500">{r.format}</p>
              </Card>
            ))}
          </div>
          <p className="text-xs text-slate-500">Sample library. Nothing here is a real offer or a real document.</p>
        </section>

        <aside>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">Asks from founders</h2>
            <p className="mt-0.5 text-xs text-slate-500">Every request for help across the portfolio, open ones first.</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {asks.map(({ c, a }) => {
                const days = daysBetween(a.openedAt, a.answeredAt ?? p.today);
                return (
                  <li key={a.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link href={`/portfolio/${c.id}?tab=activity`} className="font-medium text-slate-900 hover:text-indigo-700">
                        {c.name}
                      </Link>
                      <span className={cx("text-xs", a.answeredAt ? "text-emerald-700" : days > 14 ? "font-medium text-amber-800" : "text-slate-500")}>
                        {a.answeredAt ? `Answered in ${days} days` : `Open ${days} days`}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-600">{a.topic}</p>
                    <p className="text-sm text-slate-600">“{a.text}”</p>
                    {a.outcome && <p className="mt-1 text-xs text-emerald-800">{a.outcome}</p>}
                    <p className="text-[11px] text-slate-400">Asked {fmtShort(a.openedAt)}</p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** Plays the fund has started, each with its steps, its check date, and whether the signal that started it is still there. */
function RunningPlays({ plays }: { plays: RunningPlay[] }) {
  const p = usePortfolio();
  const w = useWorkspace();
  const [closing, setClosing] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const open = plays.filter((pl) => !pl.closedAt);
  const closed = plays.filter((pl) => pl.closedAt);
  if (!plays.length)
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
        No plays running yet. When a company matches a play below, the analyst who looks after it can start it here; it is then tracked until
        it is closed with an outcome.
      </section>
    );
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Plays running ({open.length})</h2>
      <p className="text-sm text-slate-500">Each play is checked against the latest reports, so you can see whether the problem that started it is still there.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {open.map((pl) => {
          const c = p.get(pl.companyId);
          const def = PLAYS.find((x) => x.name === pl.play);
          if (!c || !def) return null;
          const signal = def.match(c, p.today);
          const mine = w.role === "Analyst" && pl.owner === w.me;
          const due = p.today >= pl.checkOn;
          return (
            <article key={pl.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {def.name}:{" "}
                    <Link href={`/portfolio/${c.id}`} className="text-indigo-700 hover:text-indigo-900">
                      {c.name}
                    </Link>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Avatar name={pl.owner} size="xs" /> {pl.owner.split(" ")[0]} · started {fmtDay(pl.startedAt)} · check on {fmtDay(pl.checkOn)}
                    {due && <span className="font-semibold text-red-700"> · check due</span>}
                  </p>
                </div>
                <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", signal ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200")}>
                  {signal ? `Still: ${signal}` : "Signal gone"}
                </span>
              </div>
              <ol className="mt-3 space-y-1.5">
                {def.steps.map((st, i) => (
                  <li key={st}>
                    <label className={cx("flex items-start gap-2 text-sm", mine ? "cursor-pointer" : "")}>
                      <input type="checkbox" disabled={!mine} checked={pl.done.includes(i)} onChange={() => p.togglePlayStep(pl.id, i)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                      <span className={pl.done.includes(i) ? "text-slate-400 line-through" : "text-slate-800"}>{st}</span>
                    </label>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-500">Done when: {def.doneWhen}.</p>
              {mine &&
                (closing === pl.id ? (
                  <form
                    className="mt-3 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!outcome.trim()) return;
                      p.closePlay(pl.id, outcome.trim());
                      setClosing(null);
                      setOutcome("");
                    }}
                  >
                    <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome, e.g. Bridge of $400K signed 20 Nov" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                    <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">Close play</button>
                  </form>
                ) : (
                  <button onClick={() => setClosing(pl.id)} className="mt-3 text-sm font-medium text-indigo-700 hover:text-indigo-900">
                    Close with an outcome
                  </button>
                ))}
            </article>
          );
        })}
      </div>
      {closed.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {closed.map((pl) => (
            <li key={pl.id}>
              <span className="font-medium text-slate-900">{pl.play}</span> on {p.get(pl.companyId)?.name}, closed {fmtDay(pl.closedAt!)}: {pl.outcome}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
