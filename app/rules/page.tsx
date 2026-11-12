"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/store";
import { Button, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { useLinks } from "@/components/links-store";
import { DEFAULT_RULES, fitScore, usd } from "@/lib/rules";
import { DEFAULT_THESIS, type Thesis } from "@/lib/thesis";
import { COUNTRIES, SECTORS, STAGES, type Band } from "@/lib/types";

const KEY = "ds.thesis.v1";

export default function RulesPage() {
  const { rules, setRules, deals, bandOf } = useStore();
  const w = useWorkspace();
  const canEdit = w.role === "Partner";
  const [thesis, setThesisState] = useState<Thesis>(DEFAULT_THESIS);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setThesisState({ ...DEFAULT_THESIS, ...(JSON.parse(raw) as Thesis) });
    } catch {
      // Use the sample thesis.
    }
  }, []);
  const setThesis = (t: Thesis) => {
    setThesisState(t);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      // Kept until reload.
    }
  };
  const toggle = (key: "stages" | "countries" | "sectors", value: string) => {
    if (!canEdit) return;
    const list = rules[key];
    setRules({ ...rules, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] });
  };
  const outside = deals.filter((d) => bandOf(d) === "Outside focus").length;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Fund rules</h1>
        <p className="mt-1 text-slate-600">
          The fund&apos;s investment thesis in one place: what it invests in, what good looks like at each stage, what it never does, and how
          a decision gets made. New analysts should read this first.
        </p>
        {!canEdit && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            Read only. Only partners can change the fund rules. Ask Kabir Shah if a rule looks wrong.
          </p>
        )}
      </div>

      <Block n="1" title="The fund" hint="Sample fund">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Fund size", thesis.fundSize],
              ["Vintage", thesis.vintage],
              ["Fund life", thesis.fundLife],
              ["Investment period", thesis.investmentPeriod],
              ["Portfolio size", thesis.companies],
              ["Reserves", thesis.reserves],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">{k}</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block n="2" title="Where we invest" hint={`Used by code to sort pitches. ${outside} of ${deals.length} screened pitches are outside focus right now`} tag="Sorts pitches">
        <div className="space-y-4">
          <Chips title="Stages" options={STAGES} selected={rules.stages} onToggle={(v) => toggle("stages", v)} canEdit={canEdit} />
          <Chips title="Countries" options={COUNTRIES} selected={rules.countries} onToggle={(v) => toggle("countries", v)} canEdit={canEdit} />
          <Chips title="Sectors" options={SECTORS} selected={rules.sectors} onToggle={(v) => toggle("sectors", v)} canEdit={canEdit} />
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Round size the founder is raising</p>
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <Money label="Minimum" value={rules.minRoundUsd} onChange={(v) => setRules({ ...rules, minRoundUsd: v })} canEdit={canEdit} />
              <Money label="Maximum" value={rules.maxRoundUsd} onChange={(v) => setRules({ ...rules, maxRoundUsd: v })} canEdit={canEdit} />
            </div>
          </div>
          <Effect />
        </div>
      </Block>

      <Block n="3" title="What good looks like at each stage" hint="Guidance for the first call and the memo">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium" />
                {thesis.stageBars.map((s) => (
                  <th key={s.stage} className="py-2 pr-3 font-semibold text-slate-900">
                    {s.stage}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {(
                [
                  ["Our cheque", "cheque"],
                  ["Ownership we aim for", "ownership"],
                  ["Highest post-money valuation", "maxPostMoney"],
                  ["Revenue", "revenue"],
                  ["Growth", "growth"],
                  ["Also look for", "other"],
                ] as const
              ).map(([label, k]) => (
                <tr key={k}>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-500">{label}</th>
                  {thesis.stageBars.map((s) => (
                    <td key={s.stage} className="py-2.5 pr-3 text-slate-800">
                      {s[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <div className="grid gap-8 lg:grid-cols-2">
        <Block n="4" title="Quality bars" hint="Checked in diligence and in monthly reports">
          <ul className="divide-y divide-slate-100">
            {thesis.quality.map((q) => (
              <li key={q.label} className="flex items-start justify-between gap-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{q.label}</p>
                  <p className="text-xs text-slate-500">{q.why}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{q.value}</span>
              </li>
            ))}
          </ul>
        </Block>
        <Block n="5" title="We never invest in" hint="A pitch here is passed politely, whatever the numbers">
          <ul className="grid gap-2">
            {thesis.exclusions.map((x) => (
              <li key={x} className="flex items-center gap-2 rounded-lg bg-red-50/60 px-3 py-2 text-sm text-slate-800 ring-1 ring-inset ring-red-100">
                <span aria-hidden className="font-bold text-red-600">×</span>
                {x}
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <Block n="6" title="How a decision gets made" hint="From first deck to money sent, about 10 to 14 weeks">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {thesis.process.map((s, i) => (
            <li key={s.step} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <span className="text-[11px] font-semibold text-slate-400">Step {i + 1}</span>
              <p className="font-semibold text-slate-900">{s.step}</p>
              <p className="text-xs font-medium text-indigo-700">{s.days}</p>
              <p className="mt-1 text-xs text-slate-600">{s.who}</p>
              <p className="mt-1 text-xs text-slate-500">{s.output}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <p className="text-sm font-semibold text-indigo-950">Before investment committee, all of these must be true</p>
          <ul className="mt-2 grid gap-1.5 text-sm text-slate-800 sm:grid-cols-2">
            {thesis.beforeIC.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className="text-indigo-600">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block n="7" title="After we invest" hint="What founders agree to, and what the fund promises back">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {thesis.portfolio.map((r) => (
            <div key={r.label} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setRules(DEFAULT_RULES);
              setThesis(DEFAULT_THESIS);
            }}
          >
            Reset to sample settings
          </Button>
          <span className="text-xs text-slate-500">Saved in this browser only. Sections 1 and 3 to 7 are sample text; editing them comes later.</span>
        </div>
      )}
    </div>
  );
}

function Block({ n, title, hint, tag, children }: { n: string; title: string; hint?: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-semibold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">
            {title}
            {tag && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{tag}</span>}
          </h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Chips({ title, options, selected, onToggle, canEdit }: { title: string; options: string[]; selected: string[]; onToggle: (v: string) => void; canEdit: boolean }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              disabled={!canEdit}
              className={cx(
                "rounded-full px-3 py-1 text-sm ring-1 ring-inset disabled:cursor-default",
                on ? "bg-slate-900 text-white ring-indigo-600" : "bg-white text-slate-500 ring-slate-300",
                canEdit && !on && "hover:bg-slate-50",
              )}
            >
              {on ? "✓ " : ""}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Money({ label, value, onChange, canEdit }: { label: string; value: number; onChange: (v: number) => void; canEdit: boolean }) {
  if (!canEdit)
    return (
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-semibold text-slate-900">{usd(value)}</p>
      </div>
    );
  return (
    <label className="space-y-1 text-sm">
      <span className="text-slate-700">
        {label} <span className="text-slate-400">({usd(value)})</span>
      </span>
      <input type="number" min={0} step={100000} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );
}

const BAND_TONE: Record<Band, string> = {
  Priority: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Review: "bg-amber-50 text-amber-800 ring-amber-200",
  "Outside focus": "bg-slate-100 text-slate-600 ring-slate-200",
};

/** What the rules do to the pitches right now, and what changed since this page was opened. */
function Effect() {
  const { deals, bandOf, overrules } = useStore();
  const [base, setBase] = useState<Record<string, Band> | null>(null);
  const [open, setOpen] = useState<Band | null>(null);
  useEffect(() => {
    // Remember each pitch's band when the page opened, to show what an edit moves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!base && deals.length) setBase(Object.fromEntries(deals.map((d) => [d.id, bandOf(d)])));
  }, [base, deals, bandOf]);
  const bands: Band[] = ["Priority", "Review", "Outside focus"];
  const moved = base ? deals.filter((d) => base[d.id] && base[d.id] !== bandOf(d)) : [];
  const fitWhy = (id: string) => deals.find((d) => d.id === id)?.scores.find((x) => x.key === "fit")?.reason ?? "";
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-900">What these rules do right now</p>
      <p className="text-xs text-slate-500">
        Outside focus only when a rule above fails. Priority needs strong traction and a strong or mixed team (read by the AI, with reasons).
        Everything else is Review. Click a band to see the pitches in it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {bands.map((b) => {
          const n = deals.filter((d) => bandOf(d) === b).length;
          return (
            <button key={b} onClick={() => setOpen(open === b ? null : b)} className={cx("rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset", BAND_TONE[b], open === b && "ring-2")}>
              {b} <span className="font-semibold tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <ul className="mt-3 divide-y divide-slate-200 text-sm">
          {deals
            .filter((d) => bandOf(d) === open)
            .map((d) => (
              <li key={d.id} className="py-2">
                <Link href={`/deals/${d.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                  {d.form.companyName}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {d.form.stage}, {d.form.country}, {d.form.sector}
                  {overrules[d.id]?.band ? " · overruled by a person" : ""}
                </span>
                <span className="block text-xs text-slate-500">{open === "Outside focus" ? fitWhy(d.id) : d.bandReasons.join(", ")}</span>
              </li>
            ))}
        </ul>
      )}
      <UnreadFit />
      {moved.length > 0 && (
        <div className="mt-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold text-indigo-900">Moved since you opened this page</p>
          <ul className="mt-1 space-y-1 text-sm">
            {moved.map((d) => (
              <li key={d.id}>
                <span className="font-medium text-slate-900">{d.form.companyName}</span>: {base![d.id]} → {bandOf(d)}
                <span className="block text-xs text-slate-500">{bandOf(d) === "Outside focus" ? fitWhy(d.id) : "Now fits every rule above."}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Pitches the AI hasn't read yet have no band, but their form answers can already be checked against the rules. */
function UnreadFit() {
  const { unprocessed, deals, rules } = useStore();
  const links = useLinks();
  const [open, setOpen] = useState(false);
  const forms = [
    ...unprocessed.map((u) => ({ id: u.id, form: u.form })),
    ...links.inbound.filter((i) => !deals.some((d) => d.id === i.id) && !unprocessed.some((u) => u.id === i.id)).map((i) => ({ id: i.id, form: i.form })),
  ];
  if (!forms.length) return null;
  const rows = forms.map((x) => ({ ...x, fit: fitScore(x.form, rules) }));
  const outside = rows.filter((r) => r.fit.level === "Weak");
  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <button onClick={() => setOpen((o) => !o)} className="text-left text-sm text-slate-700">
        <span className="font-medium text-slate-900">{forms.length} pitches not read by the AI yet.</span> By the founder&apos;s form alone,{" "}
        {rows.length - outside.length} fit these rules and {outside.length} {outside.length === 1 ? "doesn't" : "don't"}.{" "}
        <span className="font-medium text-indigo-700">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-slate-200 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <Link href={`/deals/${r.id}`} className="font-medium text-slate-900 hover:text-indigo-700">
                {r.form.companyName}
              </Link>
              <span className={cx("ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", r.fit.level === "Weak" ? BAND_TONE["Outside focus"] : "bg-white text-slate-700 ring-slate-200")}>
                {r.fit.level === "Weak" ? "Outside focus" : "Fits"}
              </span>
              <span className="block text-xs text-slate-500">{r.fit.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
