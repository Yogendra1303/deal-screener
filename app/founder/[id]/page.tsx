"use client";

import Link from "next/link";
import { use, useState } from "react";
import { usePortfolio } from "@/components/portfolio-store";
import { HealthChip, MonthStrip, StripLegend } from "@/components/portfolio-ui";
import { Button, Card, Notice, cx } from "@/components/ui";
import { fmtMoney, fmtMonth } from "@/lib/format";
import {
  companyHealth,
  daysBetween,
  dueDateFor,
  fmtShort,
  fundHealth,
  missingItems,
  nextReportMonth,
  stripMonths,
} from "@/lib/portfolio/health";
import { RESOURCES } from "@/lib/portfolio/data";
import { ASK_TOPICS, METRICS, type AskTopic, type MetricKey, type PortfolioCompany } from "@/lib/portfolio/types";

export default function FounderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const p = usePortfolio();
  const c = p.get(id);
  if (!c)
    return (
      <Card className="p-8 text-center text-sm text-slate-600">
        This link doesn&apos;t match a company. Ask the fund for a new one.
      </Card>
    );
  const ceo = c.founders[0];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-indigo-900 ring-1 ring-inset ring-slate-200">
        <span>
          This is what {ceo.name} sees at {c.name}&apos;s private link. There&apos;s no login in the prototype.
        </span>
        <Link href={`/portfolio/${c.id}`} className="font-medium text-indigo-700 hover:text-indigo-900">
          ← Back to the fund&apos;s view
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {ceo.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Everything between {c.name} and the fund in one place: what&apos;s due, what you&apos;ve sent, and help you can ask for.
          Your contact at the fund is {c.owner}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SendReport c={c} />
          <AskFund c={c} />
        </div>
        <aside className="space-y-6">
          <Record c={c} />
          <FromFund c={c} />
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">Resources from the fund</h2>
            <ul className="mt-3 space-y-2">
              {RESOURCES.filter((r) => r.kind !== "Partner perk").slice(0, 5).map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-medium text-slate-800">{r.title}</span>
                  <span className="block text-xs text-slate-500">
                    {r.kind} · {r.format}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/resources" className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900">
              See the full library →
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SendReport({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const month = nextReportMonth(c, p.today);
  const due = dueDateFor(month);
  const overdue = daysBetween(due, p.today);
  const others = missingItems(c, p.today).filter((m) => m.key !== `${c.id}:${month}`);
  const [fileName, setFileName] = useState("");
  const [values, setValues] = useState<Partial<Record<MetricKey, string>>>({});
  const [sent, setSent] = useState<string | null>(null);

  const parsed: Partial<Record<MetricKey, number>> = {};
  for (const [k, raw] of Object.entries(values) as [MetricKey, string][]) {
    const digits = raw.replace(/[,\s]/g, "");
    if (/^\d+(\.\d+)?$/.test(digits)) parsed[k] = Number(digits);
  }
  const filled = Object.keys(parsed).length;
  const canSend = Boolean(fileName) || filled > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    p.submitReport(c.id, month, parsed, fileName);
    setSent(month);
    setValues({});
    setFileName("");
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{fmtMonth(month)} report</h2>
          <p className={cx("text-sm", overdue > 0 ? "font-medium text-red-700" : "text-slate-600")}>
            {overdue > 0 ? `Was due ${fmtShort(due)}, ${overdue} days ago` : overdue === 0 ? "Due today" : `Due ${fmtShort(due)}, in ${-overdue} days`}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">About 5 minutes</span>
      </div>
      {others.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium text-slate-600">Also still owed to the fund</span>
          <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
            {others.map((o) => (
              <li key={o.key}>
                {o.what} <span className="text-xs text-slate-500">· {o.overdueDays} days overdue</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sent && (
        <div className="mt-3">
          <Notice>
            Sent. The fund can see your {fmtMonth(sent)} report now. In the prototype it&apos;s saved in this browser only.
          </Notice>
        </div>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="mis-file" className="text-sm font-medium text-slate-800">
            Your MIS for the month
          </label>
          <p className="text-xs text-slate-500">Any format you already use. The fund&apos;s template is in Resources if you want one.</p>
          <input
            id="mis-file"
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-[11px] text-slate-400">The prototype keeps only the file&apos;s name; the file stays on this computer.</p>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Four numbers for {fmtMonth(month)}</legend>
          <p className="text-xs text-slate-500">
            Money in {c.currency}, as whole numbers. Send what you have; anything left blank shows as not sent.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {METRICS.map((m) => {
              const v = values[m.key] ?? "";
              const n = parsed[m.key];
              return (
                <div key={m.key}>
                  <label htmlFor={`num-${m.key}`} className="text-xs font-medium text-slate-600">
                    {m.label}
                  </label>
                  <input
                    id={`num-${m.key}`}
                    inputMode="numeric"
                    value={v}
                    onChange={(e) => setValues((s) => ({ ...s, [m.key]: e.target.value }))}
                    placeholder={m.money ? "e.g. 3500000" : "e.g. 120"}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm tabular-nums"
                  />
                  {v && (
                    <span className={cx("text-[11px]", n == null ? "text-red-700" : "text-slate-500")}>
                      {n == null ? "Use digits only" : m.money ? fmtMoney(n, c.currency) : n.toLocaleString("en-US")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">The fund sees exactly what you type. Nobody edits your numbers.</span>
          <Button type="submit" disabled={!canSend}>
            Send report
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AskFund({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const [topic, setTopic] = useState<AskTopic>(ASK_TOPICS[0]);
  const [text, setText] = useState("");
  const asks = [...c.asks].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Ask the fund for help</h2>
      <p className="text-sm text-slate-600">Intros, advice or a template. {c.owner} sees it straight away.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          p.addAsk(c.id, topic, text.trim());
          setText("");
        }}
        className="mt-3 space-y-2"
      >
        <div className="flex flex-wrap gap-2">
          {ASK_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={cx(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                topic === t ? "bg-slate-900 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <label htmlFor="ask-text" className="sr-only">
          What do you need?
        </label>
        <textarea
          id="ask-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="What do you need, and by when?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!text.trim()}>
            Send ask
          </Button>
        </div>
      </form>
      {asks.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {asks.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{a.topic}</span>
                <span className={cx("text-xs", a.answeredAt ? "text-emerald-700" : "text-slate-500")}>
                  {a.answeredAt ? `Answered ${fmtShort(a.answeredAt)}` : `Asked ${fmtShort(a.openedAt)}, waiting`}
                </span>
              </div>
              <p className="text-sm text-slate-600">“{a.text}”</p>
              {a.outcome && <p className="mt-1 text-sm text-emerald-800">{a.outcome}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Record({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const ch = companyHealth(c, p.today);
  const fh = fundHealth(c, p.today);
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">Your reporting record</h2>
      <p className="text-xs text-slate-500">The same view the fund sees. It&apos;s about keeping in touch, not about how the business is doing.</p>
      <div className="mt-3">
        <MonthStrip company={c} months={stripMonths(p.today)} today={p.today} size="md" />
      </div>
      <div className="mt-2">
        <StripLegend />
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <HealthChip side="company" band={ch.band} />
          <p className="mt-1 text-sm text-slate-700">{ch.reasons[0]}</p>
        </div>
        <div>
          <HealthChip side="fund" band={fh.band} />
          <p className="mt-1 text-sm text-slate-700">{fh.reasons[0]}</p>
        </div>
      </div>
    </Card>
  );
}

function FromFund({ c }: { c: PortfolioCompany }) {
  const questions = c.reports.filter((r) => r.question).reverse();
  const notes = [...c.notes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (!questions.length && !notes.length) return null;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">From the fund</h2>
      <ul className="mt-3 space-y-3">
        {questions.map((r) => (
          <li key={r.month} className="text-sm">
            <span className="text-xs font-medium text-slate-500">Question on {fmtMonth(r.month)}</span>
            <p className="text-slate-800">“{r.question!.text}”</p>
            <p className={cx("text-xs", r.question!.answeredAt ? "text-emerald-700" : "text-amber-800")}>
              {r.question!.answeredAt ? `You answered ${fmtShort(r.question!.answeredAt)}` : "Waiting for your answer"}
            </p>
          </li>
        ))}
        {notes.map((n, i) => (
          <li key={`${n.date}-${i}`} className="text-sm">
            <span className="text-xs font-medium text-slate-500">
              Note from {n.author}, {fmtShort(n.date)}
            </span>
            <p className="text-slate-800">{n.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
