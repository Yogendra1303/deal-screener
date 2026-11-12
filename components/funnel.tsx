"use client";

// The pitch page's founder-market fit card and decision card (pass or hold with a reason, a trigger and a
// check date, plus a competitor watch). Scores and labels are worked out by code; the people decide.
import { useState } from "react";
import { Disclosure } from "./disclosure";
import { useLinks } from "./links-store";
import { Avatar } from "./shell";
import { useStore } from "./store";
import { Button, LABEL, TONE, Tag, cx, type ToneKey } from "./ui";
import { sampleById } from "@/lib/data";
import { useWorkspace } from "./workspace";
import { fmtDay } from "@/lib/dates";
import { fmtMonth } from "@/lib/format";
import {
  FIT_DEEP_YEARS,
  FUNNEL,
  MARKET,
  PASS_REASONS,
  TRIGGER_HINT,
  defaultCheckOn,
  founderFit,
  reengageState,
  sampleChannel,
  temperature,
  type Decision,
  type FitLevel,
  type PassReason,
  type Temperature,
} from "@/lib/funnel";
import { DEAL_CONTACTS, strengthOf } from "@/lib/team";

export function warmPath(id: string, today: string): string | undefined {
  const c = DEAL_CONTACTS[id]?.[0];
  if (c) return `${c.person.split(" ")[0]} knows ${c.knows.split(" ")[0]} (${strengthOf(c, today).toLowerCase()})`;
  const w = FUNNEL[id]?.warm;
  return w ? `${w.who.split(" ")[0]}: ${w.how.charAt(0).toLowerCase()}${w.how.slice(1)}` : undefined;
}
const FIT_TONE: Record<FitLevel, ToneKey> = { Strong: "clear", Mixed: "review", Weak: "alert" };

export function FitPill({ level }: { level: FitLevel }) {
  return <Tag tone={FIT_TONE[level]}>Fit: {level}</Tag>;
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition", on ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")}
    >
      {children}
    </button>
  );
}

const TEMP_TONE: Record<Temperature, ToneKey> = { "Heating up": "clear", Crowding: "review", Steady: "neutral", Cooling: "alert" };

// ---------- Pitch page: founder-market fit ----------

export function FounderFitCard({ id, sector }: { id: string; sector: string }) {
  const links = useLinks();
  const f = FUNNEL[id];
  if (!f)
    return (
      <section className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <h2 className="font-semibold text-slate-900">Founder-market fit</h2>
        <p className="mt-2 text-sm text-slate-500">Worked out once the deck&apos;s team page has been read.</p>
      </section>
    );
  const fit = founderFit(f.founders);
  const warm = warmPath(id, links.today);
  const inb = links.getInbound(id);
  const sample = sampleById(id);
  const files = inb ? inb.files.map((x) => x.name) : [sample?.deckFile, sample?.sheetFile].filter(Boolean);
  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-bold tracking-tight text-slate-900">Founder credibility</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Source: {inb ? inb.via : sampleChannel(id)}
            {files.length ? ` (${files.join(", ")})` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={LABEL}>Founder-market fit</span>
        <FitPill level={fit.level} />
        <span className="text-xs text-slate-500">
          {f.category} · {f.city}
        </span>
      </div>
      <ul className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3">
        {f.founders.map((p) => (
          <li key={p.name} className="flex gap-3">
            <Avatar name={p.name} size="sm" />
            <div className="min-w-0 text-sm">
              <p>
                <span className="font-medium text-slate-900">{p.name}</span> <span className="text-slate-500">· {p.role}</span>
              </p>
              <p className="text-slate-700">
                {p.past.charAt(0).toUpperCase() + p.past.slice(1)}, {p.from}–{p.to} ({p.to - p.from} years)
              </p>
              <p className="text-xs text-slate-500">
                <Tag tone={p.relation === "direct" ? "clear" : p.relation === "adjacent" ? "review" : "alert"} className="mr-1">
                  {p.relation === "direct" ? "Same problem" : p.relation === "adjacent" ? "Nearby" : "Unrelated"}
                </Tag>
                {p.why}
                {p.priorCompany && ` Built ${p.priorCompany.what} before.`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {(
          [
            ["Most years in the problem", `${fit.domainYears}`],
            ["Repeat founder", fit.repeat ? "Yes" : "No"],
            ["Warm intro", warm ? "Yes" : "Cold inbound"],
            ["Company city", f.city],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="rounded-md bg-slate-50 px-2.5 py-2">
            <dt className={LABEL}>{k}</dt>
            <dd className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {warm && <p className="mt-2 text-xs text-slate-600">Network: {warm}.</p>}
      <Disclosure className="mt-3 text-xs" buttonClassName="font-medium text-slate-600 hover:text-slate-900" summary="How the fit is worked out">
        <ul className="mt-2 space-y-1 text-slate-600">
          {fit.working.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p className="mt-2 text-slate-500">
          Deep means {FIT_DEEP_YEARS}+ years directly in this problem, or a company built before in the same space. Whether past work is the same
          problem is read from the deck&apos;s team page (sample here); years and the level are counted by code. In {sector}, ask who on the team
          has sold to this buyer before. School, age, gender and home town are never used.
        </p>
      </Disclosure>
    </section>
  );
}

// ---------- Pitch page: decision, pass audit, competitor watch ----------

export function DecisionCard({ id, name, sector }: { id: string; name: string; sector: string }) {
  const store = useStore();
  const w = useWorkspace();
  const links = useLinks();
  const status = store.statusOf(id);
  const decided = status === "Passed" || status === "On hold" ? store.decisionOf(id) : undefined;
  const [form, setForm] = useState<null | "Passed" | "On hold">(null);
  const f = FUNNEL[id];
  const market = MARKET.find((m) => m.sector === sector);
  const t = market ? temperature(market) : null;
  const state = decided ? reengageState(decided, undefined, links.today) : null;
  const canDecide = w.role === "Partner" || links.ownerOf(id) === w.me || !links.ownerOf(id);

  const tone: ToneKey = decided ? "review" : status === "Meeting set" ? "clear" : "neutral";
  return (
    <section className={cx("rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset", decided ? "bg-amber-50/40 ring-amber-200" : status === "Meeting set" ? "bg-emerald-50/40 ring-emerald-200" : "bg-white ring-transparent")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-bold tracking-tight text-slate-900">Status and audit trail</h2>
        {t && (
          <Tag tone={TEMP_TONE[t.temp]} title="Sample market data">
            {sector}: {t.temp.toLowerCase()}
          </Tag>
        )}
      </div>
      <div className="mt-3">
        <p className={LABEL}>Current status</p>
        <Tag tone={tone} className="mt-1 font-mono text-xs">
          {decided ? `${decided.status === "Passed" ? "Pass" : "Hold"}: ${decided.reason}` : status}
        </Tag>
      </div>

      {decided ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-xs text-slate-500">
            {decided.by} · {fmtDay(decided.at)}
          </p>
          <p className="text-slate-700">{decided.note}</p>
          <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-bold text-slate-700">Monthly re-engage trigger</p>
            <p className="text-sm text-slate-800">{decided.trigger}</p>
            <p className="mt-1 text-xs text-slate-600">{state?.why}</p>
          </div>
          {canDecide && (
            <button onClick={() => store.setDecision(id, null)} className="text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
              Reopen: move back to Reviewing
            </button>
          )}
        </div>
      ) : form ? (
        <DecisionForm id={id} status={form} onDone={() => setForm(null)} />
      ) : canDecide ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(status === "Passed" || status === "On hold") && (
            <p className={cx("w-full rounded-md border px-3 py-2 text-xs", TONE.review)}>
              Marked {status.toLowerCase()} without a reason. Add one so the pass archive can count why the fund says no and when to look again.
            </p>
          )}
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setForm("On hold")}>
            Put on hold
          </Button>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setForm("Passed")}>
            Pass with a reason
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">The analyst on this pitch or the partner records the decision.</p>
      )}

      <div className="mt-4 border-t border-slate-200/70 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={LABEL}>Competitor signal</h3>
          <span className="text-[11px] text-slate-400">Fictional sample signals · checked monthly</span>
        </div>
        {f?.competitors.length ? (
          <ul className="mt-2 space-y-2">
            {f.competitors.map((c) => (
              <li key={c.name} className="flex items-start gap-2 text-sm">
                <Tag tone={c.signal === "Raised" || c.signal === "Expanded" ? "alert" : c.signal === "Stalled" || c.signal === "Shut down" ? "clear" : "neutral"} className="mt-0.5 uppercase">
                  {c.signal}
                </Tag>
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">{c.name}</span> <span className="text-slate-500">({c.what})</span>
                  <span className="block text-xs text-slate-600">
                    {c.detail} · {fmtMonth(c.when)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No competitors on file yet.</p>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Red means a rival got stronger (raised or expanded); green means one weakened. A rival raising is a reason to move faster on {name}, or
          a trigger to look again after a pass.
        </p>
      </div>
    </section>
  );
}

function DecisionForm({ id, status, onDone }: { id: string; status: "Passed" | "On hold"; onDone: () => void }) {
  const store = useStore();
  const w = useWorkspace();
  const links = useLinks();
  const [reason, setReason] = useState<PassReason | null>(null);
  const [note, setNote] = useState("");
  const [trigger, setTrigger] = useState("");
  const [checkOn, setCheckOn] = useState("");
  const pick = (r: PassReason) => {
    setReason(r);
    setTrigger(TRIGGER_HINT[r]);
    setCheckOn(defaultCheckOn(r, links.today) ?? "");
  };
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason || !note.trim()) return;
        const d: Decision = { status, reason, note: note.trim(), trigger: trigger.trim() || TRIGGER_HINT[reason], checkOn: checkOn || null, by: w.me, at: links.today };
        store.setDecision(id, d);
        onDone();
      }}
    >
      <div>
        <p className="text-xs font-medium text-slate-600">Main reason (one, from the fund&apos;s list)</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PASS_REASONS.map((r) => (
            <Chip key={r} on={reason === r} onClick={() => pick(r)}>
              {r}
            </Chip>
          ))}
        </div>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium text-slate-600">In one or two lines, why (required)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium text-slate-600">Look again when</span>
        <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="Pick a reason for a first draft" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
      </label>
      <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
        Check on
        <input type="date" value={checkOn} min={links.today} onChange={(e) => setCheckOn(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
        <span className="font-normal text-slate-400">Leave empty for no check (outside the mandate)</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button disabled={!reason || !note.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
          {status === "Passed" ? "Save pass" : "Save hold"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">Founders are told politely and never see the reason list. The record stays in the pass archive with its trigger.</p>
    </form>
  );
}

