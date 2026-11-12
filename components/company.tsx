"use client";

// The building blocks of the one company page, shared by pitches and portfolio companies:
// header with who knows them, a cited brief, key numbers with labels, and open questions.
import Link from "next/link";
import { Disclosure } from "./disclosure";
import { AskForm, QuestionItem, StatusLabel, StatusKey, useEvidence } from "./evidence";
import { Avatar } from "./shell";
import { Card, cx } from "./ui";
import { useWorkspace } from "./workspace";
import type { BriefLine, Cite } from "@/lib/brief";
import { fmtDay } from "@/lib/dates";
import { DEMO_DATE } from "@/lib/portfolio/health";
import { statusCounts, type KeyFact } from "@/lib/provenance";
import { stateOf } from "@/lib/questions";
import { lastTouch, strengthOf, type Contact } from "@/lib/team";

export interface CompanyRef {
  id: string;
  name: string;
  side: "deal" | "portfolio";
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}

export type TabTone = "bad" | "warn" | "good";

const TAB_TONE: Record<TabTone, string> = { bad: "text-red-700", warn: "text-amber-800", good: "text-emerald-700" };

/** Section switcher. With hints it shows as a row of cards, each saying what's inside before you click. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { key: T; label: string; count?: number; hint?: string; tone?: TabTone }[];
  value: T;
  onChange: (t: T) => void;
  label: string;
}) {
  if (tabs.some((t) => t.hint))
    return (
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div role="tablist" aria-label={label} style={{ minWidth: tabs.length * 112 }} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-200">
          {tabs.map((t) => {
            const on = value === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => onChange(t.key)}
                title={t.hint ? `${t.label}: ${t.hint}` : t.label}
                className={cx(
                  "min-w-0 rounded-xl px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  on ? "bg-slate-900 text-white" : "hover:bg-slate-50",
                )}
              >
                <span className={cx("block truncate text-sm font-semibold", !on && "text-slate-900")}>{t.label}</span>
                <span className={cx("mt-0.5 block truncate text-xs", on ? "text-white/70" : t.tone ? cx("font-medium", TAB_TONE[t.tone]) : "text-slate-500")}>{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={value === t.key}
            onClick={() => onChange(t.key)}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              value === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{t.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

const STRENGTH_STYLE = { Close: "text-emerald-700", Known: "text-slate-700", Cold: "text-slate-400" };

export function WhoKnows({ contacts, note }: { contacts: Contact[]; note: string }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-900">Who knows them</h3>
      {contacts.length ? (
        <ul className="mt-3 space-y-3">
          {contacts.map((c) => {
            const s = strengthOf(c, DEMO_DATE);
            const last = lastTouch(c, DEMO_DATE);
            return (
              <li key={`${c.person}-${c.knows}`} className="flex items-start gap-2.5">
                <Avatar name={c.person} />
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-medium text-slate-900">{c.person}</span>
                    <span className="text-slate-400">knows</span>
                    <span className="text-slate-700">{c.knows}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className={cx("font-medium", STRENGTH_STYLE[s])}>{s}</span> · {c.how}
                  </div>
                  {last && (
                    <div className="text-xs text-slate-500">
                      Last: {last.kind.toLowerCase()}, {fmtDay(last.date)} · {c.touches.length} {c.touches.length === 1 ? "touch" : "touches"}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Nobody at the fund has been in touch yet.</p>
      )}
      <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-500">{note}</p>
    </Card>
  );
}

export function Brief({ lines, company, facts, onTab, note }: { lines: BriefLine[]; company: CompanyRef; facts: KeyFact[]; onTab: (t: string) => void; note: string }) {
  const ev = useEvidence();
  const cite = (c: Cite) => {
    const cls = "rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-indigo-700";
    if (c.fact) {
      const f = facts.find((x) => x.key === c.fact);
      if (f) return <button key={c.label} className={cls} onClick={() => ev.open({ fact: f, company })}>{c.label}</button>;
    }
    if (c.href)
      return (
        <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className={cls}>
          {c.label}
        </a>
      );
    if (c.tab)
      return (
        <button key={c.label} className={cls} onClick={() => onTab(c.tab!)}>
          {c.label}
        </button>
      );
    return (
      <span key={c.label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
        {c.label}
      </span>
    );
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Brief</h2>
        <span className="text-[11px] text-slate-500">{note}</span>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {lines.map((l) => (
          <li key={l.topic} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {l.topic}
              {l.by === "AI" && <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[10px] font-semibold normal-case tracking-normal text-slate-700">AI</span>}
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-slate-800">{l.text}</p>
              {l.cites.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{l.cites.map(cite)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function KeyNumbers({ facts, company, title = "Key numbers" }: { facts: KeyFact[]; company: CompanyRef; title?: string }) {
  const ev = useEvidence();
  const counts = statusCounts(facts);
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">
          {(["Checked", "Reported", "Claimed", "Conflict", "Missing"] as const)
            .filter((s) => counts[s])
            .map((s) => `${counts[s]} ${s.toLowerCase()}`)
            .join(" · ")}{" "}
          · click any number for its sources
        </span>
      </div>
      <div className={cx("grid grid-cols-2 gap-2.5 md:grid-cols-3", facts.length % 5 === 0 && facts.length % 3 !== 0 && "xl:grid-cols-5")}>
        {facts.map((f) => (
          <button
            key={f.key}
            onClick={() => ev.open({ fact: f, company })}
            className={cx(
              "group flex min-w-0 flex-col items-start rounded-xl border bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              f.status === "Conflict" ? "border-red-200" : f.status === "Missing" ? "border-dashed border-slate-300" : "border-slate-200",
            )}
          >
            <span className="text-xs text-slate-500">{f.label}</span>
            <span className={cx("mt-1 text-lg font-semibold leading-tight tabular-nums", f.status === "Missing" ? "text-slate-400" : "text-slate-900")}>{f.value}</span>
            {f.sub && <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{f.sub}</span>}
            <span className="mt-auto pt-2">
              <StatusLabel status={f.status} />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2">
        <StatusKey />
      </div>
    </section>
  );
}

export function FactsTable({ facts, company }: { facts: KeyFact[]; company: CompanyRef }) {
  const ev = useEvidence();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Every number, with where it came from</h2>
        <p className="text-xs text-slate-500">Click a row for the sources, quotes and the code&apos;s working.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {facts.map((f) => (
          <li key={f.key}>
            <button onClick={() => ev.open({ fact: f, company })} className="grid w-full gap-1 px-5 py-2.5 text-left hover:bg-slate-50 sm:grid-cols-[180px_minmax(0,1fr)_110px] sm:items-center sm:gap-4">
              <span className="text-sm text-slate-500">{f.label}</span>
              <span className="min-w-0">
                <span className="text-sm font-medium text-slate-900">{f.value}</span>
                {f.sub && <span className="ml-2 text-xs text-slate-500">{f.sub}</span>}
                <span className="block truncate text-xs text-slate-400">{f.evidence.map((e) => `${e.source}${e.page ? ` p. ${e.page}` : ""}`).join(" · ") || "No source yet"}</span>
              </span>
              <span className="sm:text-right">
                <StatusLabel status={f.status} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function QuestionsPanel({ company, title = "Open questions" }: { company: CompanyRef; title?: string }) {
  const w = useWorkspace();
  const qs = w.questionsFor(company.id);
  const open = qs.filter((q) => stateOf(q, DEMO_DATE) !== "Answered").sort((a, b) => a.due.localeCompare(b.due));
  const answered = qs.filter((q) => q.answer);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          {title} <span className="font-normal text-slate-500">{open.length}</span>
        </h2>
        <span className="text-xs text-slate-500">Team discussion. Every answer cites a source.</span>
      </div>
      {open.length ? (
        <ul className="mt-2">
          {open.map((q) => (
            <QuestionItem key={q.id} q={q} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No open questions.</p>
      )}
      {answered.length > 0 && (
        <Disclosure className="mt-3" buttonClassName="text-xs font-medium text-slate-600 hover:text-slate-900" summary={`Answered (${answered.length})`}>
          <ul className="mt-1">
            {answered.map((q) => (
              <QuestionItem key={q.id} q={q} />
            ))}
          </ul>
        </Disclosure>
      )}
      <AskForm companyId={company.id} companyName={company.name} side={company.side} placeholder="Ask about anything on this company. To ask about one number, click it." />
    </Card>
  );
}

export function MetaChips({ items }: { items: (string | null | false | undefined)[] }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs text-slate-600">
      {items.filter(Boolean).map((x) => (
        <span key={String(x)} className="rounded-md bg-white px-2 py-0.5 ring-1 ring-slate-200">
          {x}
        </span>
      ))}
    </div>
  );
}

export function People({ owner, partner }: { owner?: string; partner?: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {owner ? (
        <span className="flex items-center gap-1.5">
          <Avatar name={owner} size="xs" /> Owner: <span className="font-medium text-slate-800">{owner}</span>
        </span>
      ) : (
        <span className="text-slate-400">No owner yet</span>
      )}
      {partner && (
        <span className="flex items-center gap-1.5">
          <Avatar name={partner} size="xs" /> Partner: <span className="font-medium text-slate-800">{partner}</span>
        </span>
      )}
    </div>
  );
}
