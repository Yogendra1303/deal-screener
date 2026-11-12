"use client";

// The portfolio ships as fictional data. What people do in the demo (a founder sending a report or
// asking for help, the fund marking a report read, sending a reminder, writing a note) is saved in
// this browser and on the server, laid over the shipped data. Every action is dated on the demo date.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PORTFOLIO } from "@/lib/portfolio/data";
import { addDays as addDaysIso } from "@/lib/dates";
import { DEMO_DATE, addMonths, dueDateFor, lastDueMonth } from "@/lib/portfolio/health";
import { hydrate, persist } from "@/lib/db/client";
import type { AskTopic, FounderAsk, FundNote, MetricKey, MonthlyReport, PortfolioCompany, ReportedNumber } from "@/lib/portfolio/types";

const KEY = "ds.portfolio.v1";

interface Local {
  submitted: Record<string, Record<string, { receivedAt: string; fileName: string; numbers: Partial<Record<MetricKey, ReportedNumber>> }>>;
  acks: Record<string, Record<string, string>>;
  asks: Record<string, FounderAsk[]>;
  answered: Record<string, { answeredAt: string; outcome: string }>;
  reminders: Record<string, string[]>;
  notes: Record<string, FundNote[]>;
  /** Company id -> document request id -> when a file that answers it was filed in the data room. */
  docs: Record<string, Record<string, { receivedAt: string; fileName: string }>>;
  plays: Record<string, RunningPlay>;
}

/** A support play the fund started on a company, tracked until it is closed with an outcome. */
export interface RunningPlay {
  id: string;
  play: string;
  companyId: string;
  owner: string;
  startedAt: string;
  checkOn: string;
  done: number[];
  closedAt?: string;
  outcome?: string;
}

const EMPTY: Local = { submitted: {}, acks: {}, asks: {}, answered: {}, reminders: {}, notes: {}, docs: {}, plays: {} };

function merge(c: PortfolioCompany, local: Local, today: string): PortfolioCompany {
  const byMonth = new Map<string, MonthlyReport>(c.reports.map((r) => [r.month, { ...r }]));
  // Months with no row yet are owed (or not due); give them an empty row so every view agrees.
  const first = c.reports[0]?.month ?? addMonths(c.investment.date.slice(0, 7), 1);
  for (let month = first; month <= lastDueMonth(today); month = addMonths(month, 1))
    if (!byMonth.has(month)) byMonth.set(month, { month, dueDate: dueDateFor(month), receivedAt: null, numbers: {}, acknowledgedAt: null });

  for (const [month, s] of Object.entries(local.submitted[c.id] ?? {})) {
    const r = byMonth.get(month) ?? { month, dueDate: dueDateFor(month), receivedAt: null, numbers: {}, acknowledgedAt: null };
    byMonth.set(month, { ...r, receivedAt: s.receivedAt, fileName: s.fileName || undefined, pages: s.fileName ? 6 : undefined, numbers: s.numbers });
  }
  for (const [month, date] of Object.entries(local.acks[c.id] ?? {})) {
    const r = byMonth.get(month);
    if (r && !r.acknowledgedAt) byMonth.set(month, { ...r, acknowledgedAt: date });
  }
  for (const [month, r] of byMonth) {
    const extra = local.reminders[`${c.id}:${month}`];
    if (extra) byMonth.set(month, { ...r, reminders: [...(r.reminders ?? []), ...extra] });
  }

  return {
    ...c,
    reports: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    requests: c.requests.map((q) => {
      const extra = local.reminders[`${c.id}:${q.id}`];
      const got = local.docs?.[c.id]?.[q.id];
      const withGot = got && !q.receivedAt ? { ...q, receivedAt: got.receivedAt, fileName: got.fileName } : q;
      return extra ? { ...withGot, reminders: [...(q.reminders ?? []), ...extra] } : withGot;
    }),
    asks: [...c.asks, ...(local.asks[c.id] ?? [])].map((a) => {
      const done = local.answered[a.id];
      return done && !a.answeredAt ? { ...a, answeredAt: done.answeredAt, outcome: done.outcome } : a;
    }),
    notes: [...c.notes, ...(local.notes[c.id] ?? [])],
  };
}

interface PortfolioStore {
  ready: boolean;
  today: string;
  companies: PortfolioCompany[];
  get: (id: string) => PortfolioCompany | undefined;
  changed: boolean;
  submitReport: (id: string, month: string, numbers: Partial<Record<MetricKey, number>>, fileName: string) => void;
  acknowledge: (id: string, month: string) => void;
  remind: (key: string) => void;
  addAsk: (id: string, topic: AskTopic, text: string) => void;
  answerAsk: (askId: string, outcome: string) => void;
  addNote: (id: string, author: string, text: string) => void;
  receiveDoc: (id: string, requestId: string, fileName: string | null) => void;
  plays: RunningPlay[];
  startPlay: (companyId: string, play: string, owner: string) => void;
  togglePlayStep: (id: string, step: number) => void;
  closePlay: (id: string, outcome: string) => void;
  reset: () => void;
}

const Ctx = createContext<PortfolioStore | null>(null);
const PAGES: Record<MetricKey, number> = { revenue: 2, burn: 3, cash: 3, customers: 4 };

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<Local>(EMPTY);
  const today = DEMO_DATE;

  useEffect(() => {
    // Load this browser's demo changes once, after the first render.
    let saved: Local | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<Local>) };
    } catch {
      // Storage blocked: the demo still works, it just won't remember changes.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setLocal(saved);
    setReady(true);
    hydrate<Partial<Local>>(KEY, (v) => setLocal({ ...EMPTY, ...v }), saved);
  }, []);

  const update = useCallback((fn: (l: Local) => Local) => {
    setLocal((prev) => {
      const next = fn(prev);
      persist(KEY, next);
      return next;
    });
  }, []);

  const companies = useMemo(() => PORTFOLIO.map((c) => merge(c, local, today)), [local, today]);

  const value = useMemo<PortfolioStore>(
    () => ({
      ready,
      today,
      companies,
      get: (id) => companies.find((c) => c.id === id),
      changed: JSON.stringify(local) !== JSON.stringify(EMPTY),
      submitReport: (id, month, numbers, fileName) =>
        update((l) => {
          const nums: Partial<Record<MetricKey, ReportedNumber>> = {};
          for (const [k, v] of Object.entries(numbers) as [MetricKey, number][]) nums[k] = { value: v, page: PAGES[k] };
          return { ...l, submitted: { ...l.submitted, [id]: { ...l.submitted[id], [month]: { receivedAt: today, fileName, numbers: nums } } } };
        }),
      acknowledge: (id, month) => update((l) => ({ ...l, acks: { ...l.acks, [id]: { ...l.acks[id], [month]: today } } })),
      remind: (key) => update((l) => ({ ...l, reminders: { ...l.reminders, [key]: [...(l.reminders[key] ?? []), today] } })),
      addAsk: (id, topic, text) =>
        update((l) => {
          const mine = l.asks[id] ?? [];
          const ask: FounderAsk = { id: `${id}-local-${mine.length + 1}`, openedAt: today, topic, text, answeredAt: null };
          return { ...l, asks: { ...l.asks, [id]: [...mine, ask] } };
        }),
      answerAsk: (askId, outcome) => update((l) => ({ ...l, answered: { ...l.answered, [askId]: { answeredAt: today, outcome } } })),
      addNote: (id, author, text) =>
        update((l) => ({ ...l, notes: { ...l.notes, [id]: [...(l.notes[id] ?? []), { date: today, author, text }] } })),
      receiveDoc: (id, requestId, fileName) =>
        update((l) => {
          const mine = { ...(l.docs?.[id] ?? {}) };
          if (fileName) mine[requestId] = { receivedAt: today, fileName };
          else delete mine[requestId];
          return { ...l, docs: { ...(l.docs ?? {}), [id]: mine } };
        }),
      plays: Object.values(local.plays ?? {}).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      startPlay: (companyId, play, owner) =>
        update((l) => {
          const id = `${companyId}:${play}:${Date.now().toString(36)}`;
          return { ...l, plays: { ...(l.plays ?? {}), [id]: { id, play, companyId, owner, startedAt: today, checkOn: addDaysIso(today, 30), done: [] } } };
        }),
      togglePlayStep: (id, step) =>
        update((l) => {
          const pl = l.plays?.[id];
          if (!pl) return l;
          const done = pl.done.includes(step) ? pl.done.filter((x) => x !== step) : [...pl.done, step];
          return { ...l, plays: { ...l.plays, [id]: { ...pl, done } } };
        }),
      closePlay: (id, outcome) =>
        update((l) => {
          const pl = l.plays?.[id];
          return pl ? { ...l, plays: { ...l.plays, [id]: { ...pl, closedAt: today, outcome } } } : l;
        }),
      reset: () => update(() => EMPTY),
    }),
    [ready, today, companies, local, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortfolio(): PortfolioStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return v;
}
