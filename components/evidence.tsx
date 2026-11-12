"use client";

// The evidence panel: click any number to see every source behind it, the code's working,
// the questions already asked about it, and a box to ask a teammate. It never edits a number.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Disclosure } from "./disclosure";
import { Avatar } from "./shell";
import { Button, cx } from "./ui";
import { useWorkspace } from "./workspace";
import { addDays, fmtDay } from "@/lib/dates";
import { DEMO_DATE } from "@/lib/portfolio/health";
import { STATUS_MEANING, type Evidence, type FactStatus, type KeyFact } from "@/lib/provenance";
import { ageText, stateOf, type Question } from "@/lib/questions";
import { TEAM } from "@/lib/team";

// ---------- Status label ----------

const STATUS_STYLE: Record<FactStatus, { pill: string; dot: string; mark: string }> = {
  Checked: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", mark: "✓" },
  Reported: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-600", mark: "" },
  Claimed: { pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400", mark: "" },
  Conflict: { pill: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", mark: "!" },
  Missing: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400", mark: "" },
};

export function StatusLabel({ status, className }: { status: FactStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      title={STATUS_MEANING[status]}
      className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", s.pill, className)}
    >
      {s.mark ? <span aria-hidden className="font-bold">{s.mark}</span> : <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {status}
    </span>
  );
}

export function StatusDot({ status }: { status: FactStatus }) {
  return <span title={`${status}: ${STATUS_MEANING[status]}`} className={cx("inline-block h-2 w-2 shrink-0 rounded-full", STATUS_STYLE[status].dot)} />;
}

export function StatusKey({ statuses = ["Checked", "Reported", "Claimed", "Conflict", "Missing"] }: { statuses?: FactStatus[] }) {
  return (
    <Disclosure className="text-xs text-slate-500" buttonClassName="font-medium text-slate-600 hover:text-slate-900" summary="What the labels mean">
      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {statuses.map((s) => (
          <div key={s} className="flex items-start gap-2">
            <dt>
              <StatusLabel status={s} />
            </dt>
            <dd className="pt-0.5">{STATUS_MEANING[s]}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

// ---------- Drawer ----------

export interface EvidenceTarget {
  fact: KeyFact;
  company: { id: string; name: string; side: "deal" | "portfolio" };
}

interface Ctx {
  open: (t: EvidenceTarget) => void;
  close: () => void;
  current: EvidenceTarget | null;
}

const EvidenceCtx = createContext<Ctx | null>(null);

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<EvidenceTarget | null>(null);
  const open = useCallback((t: EvidenceTarget) => setCurrent(t), []);
  const close = useCallback(() => setCurrent(null), []);
  return (
    <EvidenceCtx.Provider value={{ open, close, current }}>
      {children}
      {current && <Drawer target={current} onClose={close} />}
    </EvidenceCtx.Provider>
  );
}

export function useEvidence(): Ctx {
  const v = useContext(EvidenceCtx);
  if (!v) throw new Error("useEvidence must be used inside EvidenceProvider");
  return v;
}

function Drawer({ target, onClose }: { target: EvidenceTarget; onClose: () => void }) {
  const { fact, company } = target;
  const w = useWorkspace();
  const closeRef = useRef<HTMLButtonElement>(null);
  const qs = w.questionsFor(company.id).filter((q) => q.about?.key === fact.key);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <button className="absolute inset-0 bg-slate-900/30" aria-label="Close the evidence panel" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{company.name} · evidence</p>
            <h2 id="evidence-title" className="text-lg font-semibold text-slate-900">
              {fact.label}
            </h2>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{fact.value}</span>
              <StatusLabel status={fact.status} />
            </div>
            {fact.sub && <p className="mt-0.5 text-sm text-slate-500">{fact.sub}</p>}
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{fact.why}</p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
            {fact.evidence.length ? (
              <ul className="mt-2 space-y-2">
                {fact.evidence.map((e, i) => (
                  <SourceCard key={i} e={e} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No source has this yet.</p>
            )}
          </section>

          {fact.working && fact.working.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">How the code worked it out</h3>
              <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-700">
                {fact.working.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-slate-500">Plain code, not AI: the same inputs always give the same answer.</p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Questions on this number</h3>
            {qs.length ? (
              <ul className="mt-2 space-y-2">
                {qs.map((q) => (
                  <QuestionItem key={q.id} q={q} compact />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">None yet.</p>
            )}
            <AskForm companyId={company.id} companyName={company.name} side={company.side} about={{ key: fact.key, label: fact.label }} />
          </section>
        </div>
        <p className="border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500">
          Nothing here changes the founder&apos;s numbers. A conflict stays open until a person answers it with a source.
        </p>
      </div>
    </div>
  );
}

function SourceCard({ e }: { e: Evidence }) {
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{e.source}</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">{e.value}</div>
        </div>
        {e.page ? (
          e.url ? (
            <a href={e.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
              Open p. {e.page}
            </a>
          ) : (
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">p. {e.page}</span>
          )
        ) : null}
      </div>
      {e.quote && <p className="mt-1.5 text-xs italic text-slate-600">“{e.quote}”</p>}
      {e.file && <p className="mt-1 truncate text-[11px] text-slate-400">{e.file}</p>}
    </li>
  );
}

// ---------- Questions ----------


export function QuestionItem({ q, compact, showCompany }: { q: Question; compact?: boolean; showCompany?: boolean }) {
  const w = useWorkspace();
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const state = stateOf(q, DEMO_DATE);
  const canAnswer = !q.answer && q.owner === w.me;
  return (
    <li className="border-b border-slate-100 py-3 first:pt-1 last:border-0 last:pb-1">
      <div className="flex items-start gap-3">
        <Avatar name={q.askedBy} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-[13px] text-slate-500">
              <span className="font-semibold text-slate-900">{q.askedBy.split(" ")[0]}</span> asked <span className="font-medium text-slate-700">{q.owner.split(" ")[0]}</span>
              {showCompany && (
                <>
                  {" "}
                  about <span className="font-medium text-slate-700">{q.companyName}</span>
                </>
              )}
              <span className="text-slate-400"> · {fmtDay(q.askedAt)}</span>
            </p>
            <span
              className={cx(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                state === "Overdue" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : state === "Answered" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
              )}
            >
              {ageText(q, DEMO_DATE)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">{q.text}</p>
          {q.about && !compact && (
            <span className="mt-1.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">On {q.about.label.toLowerCase()}</span>
          )}
          {q.answer && (
            <div className="mt-2.5 flex items-start gap-2.5 border-l-2 border-emerald-300 pl-3">
              <Avatar name={q.answer.by} size="xs" />
              <div className="min-w-0">
                <p className="text-[13px] text-slate-500">
                  <span className="font-semibold text-slate-900">{q.answer.by.split(" ")[0]}</span> answered<span className="text-slate-400"> · {fmtDay(q.answer.at)}</span>
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-800">{q.answer.text}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Source: {q.answer.source}</p>
              </div>
            </div>
          )}
          {canAnswer && !answering && (
            <button onClick={() => setAnswering(true)} className="mt-2 block rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
              Reply with an answer
            </button>
          )}
          {canAnswer && answering && (
            <form
              className="mt-2 space-y-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim() || !source.trim()) return;
                w.answer(q.id, { text: text.trim(), source: source.trim(), by: w.me });
              }}
            >
              <label className="sr-only" htmlFor={`ans-${q.id}`}>
                Answer
              </label>
              <textarea
                id={`ans-${q.id}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="The answer"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <label className="sr-only" htmlFor={`src-${q.id}`}>
                Source
              </label>
              <input
                id={`src-${q.id}`}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Source (required): file and page, call notes, email"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={!text.trim() || !source.trim()} className="px-2.5 py-1 text-xs">
                  Save answer
                </Button>
                <Button variant="ghost" onClick={() => setAnswering(false)} className="px-2.5 py-1 text-xs">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

export function AskForm({
  companyId,
  companyName,
  side,
  about,
  placeholder,
}: {
  companyId: string;
  companyName: string;
  side: "deal" | "portfolio";
  about?: { key: string; label: string };
  placeholder?: string;
}) {
  const w = useWorkspace();
  const others = TEAM.filter((m) => m.name !== w.me);
  const [text, setText] = useState("");
  const [owner, setOwner] = useState(others[0]?.name ?? "");
  const [sent, setSent] = useState(false);
  const ownerValue = others.some((m) => m.name === owner) ? owner : (others[0]?.name ?? "");
  const id = `ask-${companyId}-${about?.key ?? "general"}`;
  return (
    <form
      className="mt-3 flex items-start gap-3 border-t border-slate-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        w.ask({ companyId, companyName, side, about, text: text.trim(), askedBy: w.me, owner: ownerValue, due: addDays(DEMO_DATE, 7) });
        setText("");
        setSent(true);
      }}
    >
      <Avatar name={w.me} size="sm" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          {about ? "Ask a teammate about this number" : "Ask a teammate"}
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
          rows={2}
          placeholder={placeholder ?? "e.g. Which figure is right, and where does it come from?"}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Ask
            <select value={ownerValue} onChange={(e) => setOwner(e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs">
              {others.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.role.toLowerCase()})
                </option>
              ))}
            </select>
            <span className="text-slate-400">· due in 7 days</span>
          </label>
          <Button type="submit" disabled={!text.trim()} className="px-3 py-1 text-xs">
            Ask
          </Button>
        </div>
        {sent && <p className="mt-1.5 text-xs text-emerald-700">Asked. It now shows on {ownerValue.split(" ")[0]}&apos;s Home page.</p>}
      </div>
    </form>
  );
}
