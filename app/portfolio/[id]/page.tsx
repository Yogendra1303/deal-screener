"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { BackLink, type TabTone, Brief, FactsTable, KeyNumbers, MetaChips, People, QuestionsPanel, Tabs, WhoKnows, type CompanyRef } from "@/components/company";
import { ReminderButton } from "@/components/portfolio-actions";
import { usePortfolio } from "@/components/portfolio-store";
import { HealthChip, MonthStrip, StripLegend, monthDetail, CELL_LABEL } from "@/components/portfolio-ui";
import { RevenueChart } from "@/components/revenue-chart";
import { Button, Card, DropdownSelect, SectionTitle, cx } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { portfolioBrief } from "@/lib/brief";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { companyEvents, type PortfolioEvent } from "@/lib/portfolio/events";
import {
  companyHealth,
  daysBetween,
  fmtShort,
  fundHealth,
  missingItems,
  nextReportMonth,
  portfolioFlags,
  reportStatus,
  runwayMonths,
  stripMonths,
  type PortfolioFlag,
} from "@/lib/portfolio/health";
import { parseSheet } from "@/lib/sheet";
import { portfolioFacts } from "@/lib/provenance";
import { usd } from "@/lib/rules";
import { portfolioContacts } from "@/lib/team";
import { METRICS, type MetricKey, type PortfolioCompany } from "@/lib/portfolio/types";

type Tab = "overview" | "numbers" | "reporting" | "documents" | "activity";
const TABS: Tab[] = ["overview", "numbers", "reporting", "documents", "activity"];
/** Links from before the redesign still land on the right tab. */
const OLD: Record<string, Tab> = { metrics: "numbers", requests: "reporting", timeline: "activity", support: "activity" };

export default function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = use(params);
  const { tab: asked } = use(searchParams);
  const initial = asked ? (OLD[asked] ?? asked) : "overview";
  const p = usePortfolio();
  const w = useWorkspace();
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "overview");

  useEffect(() => {
    if (initial && TABS.includes(initial as Tab)) {
      setTab(initial as Tab);
    }
  }, [initial]);
  const c = p.get(id);
  const facts = useMemo(() => (c ? portfolioFacts(c, p.today) : []), [c, p.today]);

  if (!c)
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-600">There&apos;s no portfolio company with this link.</p>
        <div className="mt-3">
          <BackLink href="/portfolio" label="Back to the portfolio" />
        </div>
      </Card>
    );

  if (w.role === "Analyst" && c.owner !== w.me)
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-600">
          {c.name} is looked after by {c.owner}. Analysts see only their own companies; partners see the whole fund.
        </p>
        <div className="mt-3">
          <BackLink href="/portfolio" label="Back to my companies" />
        </div>
      </Card>
    );

  const company: CompanyRef = { id: c.id, name: c.name, side: "portfolio" };
  const flags = portfolioFlags(c, p.today);
  const missing = missingItems(c, p.today);
  const openAsks = c.asks.filter((a) => !a.answeredAt).length;
  const docs = c.reports.filter((r) => r.fileName).length;
  const tabs: { key: Tab; label: string; hint: string; tone?: TabTone }[] = [
    { key: "overview", label: "Summary", hint: "Brief, numbers" },
    { key: "numbers", label: "Numbers", hint: flags.length ? `${flags.length} to check` : "All checked", tone: flags.length ? "warn" : "good" },
    { key: "reporting", label: "Reports", hint: missing.length ? `${missing.length} missing` : "Up to date", tone: missing.length ? "bad" : "good" },
    { key: "documents", label: "Documents", hint: docs ? `${docs + 1} files` : "Pitch deck" },
    { key: "activity", label: "Activity", hint: openAsks ? `${openAsks} ${openAsks === 1 ? "ask" : "asks"} open` : "Timeline", tone: openAsks ? "warn" : undefined },
  ];

  return (
    <div className="space-y-5">
      <BackLink href="/portfolio" label="Portfolio" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Portfolio</span>
          </div>
          <p className="mt-1 text-slate-700">{c.oneLiner}</p>
          <MetaChips
            items={[
              c.sector,
              c.country,
              `${c.investment.round}: ${usd(c.investment.amountUsd)} for ${c.investment.ownershipPct}%`,
              `Invested ${fmtShort(c.investment.date)} ${c.investment.date.slice(0, 4)}`,
              `Reports in ${c.currency}`,
            ]}
          />
          <People owner={c.owner} partner={c.partner} />
        </div>
        <Link href={`/founder/${c.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Founder&apos;s page
        </Link>
      </div>

      <Tabs label="Company details" tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <Brief
              lines={portfolioBrief(c, facts, w.questionsFor(c.id), p.today)}
              company={company}
              facts={facts}
              onTab={(t) => TABS.includes(t as Tab) && setTab(t as Tab)}
              note="Written by code from the reports. No AI"
            />
            <KeyNumbers facts={facts.filter((x) => x.headline)} company={company} />
            <QuestionsPanel company={company} />
          </div>
          <aside className="space-y-4">
            <HealthSummary c={c} onMore={() => setTab("reporting")} />
            <WhoKnows contacts={portfolioContacts(c, p.today)} note="Worked out from notes, replies and questions in the hub. Email and calendar aren't connected." />
            <PitchToPortfolio c={c} />
          </aside>
        </div>
      )}
      {tab === "numbers" && <Metrics c={c} flags={flags} facts={<FactsTable facts={facts} company={company} />} />}
      {tab === "reporting" && (
        <div className="space-y-6">
          <HealthPanel c={c} />
          <Requests c={c} />
        </div>
      )}
      {tab === "documents" && <Documents c={c} />}
      {tab === "activity" && <Activity c={c} />}
    </div>
  );
}

function HealthSummary({ c, onMore }: { c: PortfolioCompany; onMore: () => void }) {
  const p = usePortfolio();
  const ch = companyHealth(c, p.today);
  const fh = fundHealth(c, p.today);
  const months = stripMonths(p.today);
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-900">Reporting, both ways</h3>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <HealthChip side="company" band={ch.band} />
          <p className="mt-1 text-slate-600">{ch.reasons[0]}</p>
          <div className="mt-2">
            <MonthStrip company={c} months={months} today={p.today} />
          </div>
        </div>
        <div>
          <HealthChip side="fund" band={fh.band} />
          <p className="mt-1 text-slate-600">{fh.reasons[0]}</p>
        </div>
      </div>
      <button onClick={onMore} className="mt-3 text-sm font-medium text-indigo-700 hover:text-indigo-900">
        Reporting detail →
      </button>
    </Card>
  );
}

function PitchToPortfolio({ c }: { c: PortfolioCompany }) {
  const note = [...c.notes].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-900">From pitch to portfolio</h3>
      <dl className="mt-2 space-y-1.5 text-sm">
        <Row label="Pitch received" value={`${fmtShort(c.pitch.receivedAt)} ${c.pitch.receivedAt.slice(0, 4)}`} />
        <Row label="Screener suggested" value={c.pitch.band} />
        <Row label="First meeting" value={`${fmtShort(c.pitch.meetingAt)} ${c.pitch.meetingAt.slice(0, 4)}`} />
        <Row label="Invested" value={`${fmtShort(c.investment.date)} ${c.investment.date.slice(0, 4)}`} />
      </dl>
      {note && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">Latest note to the founder</p>
          <p className="mt-1 text-sm text-slate-700">“{note.text}”</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {note.author}, {fmtShort(note.date)}
          </p>
        </div>
      )}
    </Card>
  );
}

function HealthPanel({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const ch = companyHealth(c, p.today);
  const fh = fundHealth(c, p.today);
  const months = stripMonths(p.today);
  return (
    <Card className="overflow-hidden">
      <div className="grid divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Is the company reporting?</h2>
            <HealthChip side="company" band={ch.band} />
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {ch.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-3">
            <MonthStrip company={c} months={months} today={p.today} size="md" />
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-500" style={{ width: months.length * 24 - 4 }}>
              <span>{fmtMonth(months[0]).split(" ")[0]}</span>
              <span>{fmtMonth(months.at(-1)).split(" ")[0]}</span>
            </div>
          </div>
          <Signals items={ch.signals} />
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Is the fund holding up its end?</h2>
            <HealthChip side="fund" band={fh.band} />
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {fh.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Signals items={fh.signals} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
        <StripLegend />
        <span className="text-xs text-slate-500">Worked out by code from dates and counts. It never changes the investment view.</span>
      </div>
    </Card>
  );
}

function Signals({ items }: { items: { label: string; value: string; ok: boolean }[] }) {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
      {items.map((s) => (
        <div key={s.label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-slate-200 pb-1">
          <dt className="text-xs text-slate-500">{s.label}</dt>
          <dd className={cx("whitespace-nowrap text-right text-sm font-medium tabular-nums", s.ok ? "text-slate-900" : "text-amber-800")}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function fmtValue(c: PortfolioCompany, key: MetricKey, v: number) {
  return METRICS.find((m) => m.key === key)!.money ? fmtMoney(v, c.currency) : v.toLocaleString("en-US");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

const FLAG_TAG: Record<PortfolioFlag["kind"], string> = {
  mismatch: "Form vs MIS",
  move: "Big change",
  runway: "Runway",
  plan: "Pitch vs reported",
};

function FlagList({ c, flags }: { c: PortfolioCompany; flags: PortfolioFlag[] }) {
  if (!flags.length)
    return <Card className="p-5 text-sm text-slate-600">Nothing to check. The reported numbers agree with each other and with the pitch.</Card>;
  return (
    <div className="space-y-3">
      {flags.map((f) => (
        <Card key={`${f.kind}-${f.month}-${f.metric}`} className="border-l-4 border-l-amber-400 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">{FLAG_TAG[f.kind]}</span>
            <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-700">{f.detail}</p>
          <p className="mt-1 text-xs text-slate-500">
            Source: {fmtMonth(f.month)} MIS{f.page ? `, page ${f.page}` : ""}
            {f.kind === "plan" ? `, and the pitch deck (${c.pitch.deckFile})` : ""}. For a person to check; nothing has been changed.
          </p>
        </Card>
      ))}
    </div>
  );
}

function Metrics({ c, flags, facts }: { c: PortfolioCompany; flags: PortfolioFlag[]; facts: React.ReactNode }) {
  const p = usePortfolio();
  const rows = [...c.reports].filter((r) => r.month <= p.today.slice(0, 7)).reverse();
  const mismatch = new Set(flags.filter((f) => f.kind === "mismatch").map((f) => `${f.month}:${f.metric}`));
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle>Revenue each month, against the pitch deck</SectionTitle>
        <RevenueChart c={c} />
      </Card>
      {facts}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Month by month</h2>
          <p className="text-xs text-slate-500">
            Each number is what the founder sent, with its page in that month&apos;s MIS. Runway is worked out by code. Nothing is
            edited.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Month</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="px-4 py-2 text-right font-medium">
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium">Runway</th>
                <th className="px-4 py-2 text-left font-medium">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const status = reportStatus(r, p.today);
                const runway = runwayMonths(r);
                return (
                  <tr key={r.month}>
                    <td className="px-4 py-2 font-medium text-slate-800">{fmtMonth(r.month)}</td>
                    {METRICS.map((m) => {
                      const n = r.numbers[m.key];
                      const bad = mismatch.has(`${r.month}:${m.key}`);
                      return (
                        <td key={m.key} className={cx("px-4 py-2 text-right tabular-nums", bad && "bg-amber-50")}>
                          {n ? (
                            <span title={bad ? `MIS page ${n.page} shows ${fmtValue(c, m.key, n.inFile!)}` : `MIS page ${n.page}`}>
                              {fmtValue(c, m.key, n.value)}
                              <span className="ml-1 text-[11px] text-slate-400">p.{n.page}</span>
                              {bad && <span className="block text-[11px] text-amber-800">MIS shows {fmtValue(c, m.key, n.inFile!)}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">{r.receivedAt ? "not sent" : "-"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cx("px-4 py-2 text-right tabular-nums", runway != null && runway < 6 && "font-medium text-red-700")}>
                      {runway != null ? `${runway.toFixed(1)} mo` : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{CELL_LABEL[status]}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50/70">
                <td className="px-4 py-2 font-medium text-slate-800">
                  At pitch
                  <span className="block text-[11px] font-normal text-slate-500">{fmtMonth(c.pitch.receivedAt.slice(0, 7))} deck</span>
                </td>
                {METRICS.map((m) => {
                  const claim = c.pitch.claims[m.key];
                  return (
                    <td key={m.key} className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {claim ? (
                        <>
                          {fmtValue(c, m.key, claim.value)}
                          <span className="ml-1 text-[11px] text-slate-400">p.{claim.page}</span>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                  {c.pitch.claims.cash && c.pitch.claims.burn ? `${(c.pitch.claims.cash.value / c.pitch.claims.burn.value).toFixed(1)} mo` : "-"}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">Pitch deck</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {flags.length > 0 && (
        <section>
          <SectionTitle>Flags to check</SectionTitle>
          <FlagList c={c} flags={flags} />
        </section>
      )}
    </div>
  );
}

function Documents({ c }: { c: PortfolioCompany }) {
  const ceo = c.founders[0]?.name ?? "Founder";
  const groups: { title: string; items: { name: string; when: string; detail: string; pages?: number }[] }[] = [
    {
      title: "Pitch",
      items: [{ name: c.pitch.deckFile, when: c.pitch.receivedAt, detail: `Read by the deal screener. Suggested band: ${c.pitch.band}.` }],
    },
    {
      title: "Monthly MIS",
      items: c.reports
        .filter((r) => r.fileName && r.receivedAt)
        .reverse()
        .map((r) => ({
          name: r.fileName!,
          when: r.receivedAt!,
          pages: r.pages,
          detail: `${fmtMonth(r.month)} · ${METRICS.filter((m) => r.numbers[m.key]).length} of ${METRICS.length} numbers, pages 2 to 4 · sent by ${ceo}`,
        })),
    },
    ...(["Board deck", "Financials", "Cap table", "Other"] as const)
      .map((kind) => ({
        title: kind === "Board deck" ? "Board decks" : kind,
        items: c.requests
          .filter((q) => q.kind === kind && q.fileName && q.receivedAt)
          .map((q) => ({ name: q.fileName!, when: q.receivedAt!, pages: q.pages, detail: `${q.title} · sent by ${ceo}` })),
      }))
      .filter((g) => g.items.length),
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Every file the company has sent, in one place. These are sample entries: the files themselves aren&apos;t included in the
        prototype.
      </p>
      {groups.map((g) => (
        <Card key={g.title} className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-800">
            {g.title} <span className="font-normal text-slate-500">{g.items.length}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.items.map((d) => (
              <li key={d.name} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="grid h-8 w-7 shrink-0 place-items-center rounded border border-slate-300 bg-white text-[9px] font-semibold text-slate-500">
                    PDF
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-500">{d.detail}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {fmtShort(d.when)} {d.when.slice(0, 4)}
                  {d.pages && <span className="block">{d.pages} pages</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function PartnerMisIngestion({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const nextMonth = nextReportMonth(c, p.today);
  const [selectedMonth, setSelectedMonth] = useState(nextMonth);
  const [fileName, setFileName] = useState("");
  const [values, setValues] = useState<Partial<Record<MetricKey, string>>>({});
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    const months = stripMonths(p.today, 12);
    return [...months].reverse();
  }, [p.today]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text) return;
        const parsed = parseSheet(text);
        if (parsed.length > 0) {
          const matched = parsed.find((r) => r.month === selectedMonth) || parsed.at(-1);
          if (matched) {
            if (matched.month) setSelectedMonth(matched.month);
            setValues({
              revenue: matched.revenue != null ? String(matched.revenue) : "",
              burn: matched.netBurn != null ? String(matched.netBurn) : "",
              cash: matched.cash != null ? String(matched.cash) : "",
              customers: matched.customers != null ? String(matched.customers) : "",
            });
            setStatusNotice(`Loaded CSV row for ${fmtMonth(matched.month)}: prefilled verified metrics.`);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Could not parse CSV. You can enter metrics manually.";
        setParseError(msg);
      }
    };
    reader.readAsText(file);
  }

  function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    const parsedNums: Partial<Record<MetricKey, number>> = {};
    for (const [k, raw] of Object.entries(values) as [MetricKey, string][]) {
      const clean = (raw || "").replace(/[,\s]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(clean)) {
        parsedNums[k] = Number(clean);
      }
    }

    if (Object.keys(parsedNums).length === 0 && !fileName) {
      setParseError("Please enter at least one metric or select a monthly CSV file.");
      return;
    }

    p.submitReport(c.id, selectedMonth, parsedNums, fileName || `MIS-${selectedMonth}.csv`);
    p.acknowledge(c.id, selectedMonth);
    setStatusNotice(`Recorded ${fmtMonth(selectedMonth)} MIS successfully. Runway, charts, and reporting health are now updated.`);
    setParseError(null);
  }

  return (
    <Card className="overflow-hidden border-indigo-100 bg-white shadow-2xs">
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Direct Monthly MIS Ingestion</h2>
            <p className="text-xs text-slate-600">
              Upload a monthly financial CSV received from {c.name} or enter verified figures to refresh portfolio metrics, runway, and health in real time.
            </p>
          </div>
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
            Self-Serve MIS Intake
          </span>
        </div>
      </div>

      <form onSubmit={handleRecord} className="p-5 space-y-4">
        {statusNotice && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
            <span>{statusNotice}</span>
            <button type="button" onClick={() => setStatusNotice(null)} className="cursor-pointer font-semibold text-emerald-700 underline">
              Dismiss
            </button>
          </div>
        )}
        {parseError && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800">
            <span>{parseError}</span>
            <button type="button" onClick={() => setParseError(null)} className="cursor-pointer font-semibold text-rose-700 underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Reporting Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {fmtMonth(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">CSV Sheet Upload (Optional auto-fill)</label>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="mt-1 block w-full text-xs text-slate-500 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Revenue ({c.currency})</label>
            <input
              type="text"
              placeholder="e.g. 85000"
              value={values.revenue ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, revenue: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs tabular-nums text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Net Burn ({c.currency})</label>
            <input
              type="text"
              placeholder="e.g. 42000"
              value={values.burn ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, burn: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs tabular-nums text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Cash in Bank ({c.currency})</label>
            <input
              type="text"
              placeholder="e.g. 650000"
              value={values.cash ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, cash: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs tabular-nums text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600">Active Customers</label>
            <input
              type="text"
              placeholder="e.g. 14"
              value={values.customers ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, customers: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs tabular-nums text-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-500">
            {fileName ? `File attached: ${fileName}` : "No file attached (manual entry)"}
          </span>
          <button
            type="submit"
            className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800"
          >
            Record MIS &amp; Update Health
          </button>
        </div>
      </form>
    </Card>
  );
}

function Requests({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const reports = [...c.reports].reverse();
  return (
    <div className="space-y-6">
      <PartnerMisIngestion c={c} />
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Monthly report</h2>
          <p className="text-xs text-slate-500">
            Asked every month: the MIS file plus {METRICS.map((m) => m.label.split(" (")[0].toLowerCase()).join(", ")}. Due on the 15th of
            the next month.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Month</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">What arrived</th>
                <th className="px-4 py-2 text-left font-medium">Read by the fund</th>
                <th className="px-4 py-2 text-left font-medium">Reminders</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((r) => {
                const status = reportStatus(r, p.today);
                const got = METRICS.filter((m) => r.numbers[m.key]).length;
                const owes = status === "missing" || (r.receivedAt && got < METRICS.length);
                return (
                  <tr key={r.month}>
                    <td className="px-4 py-2 font-medium text-slate-800">{fmtMonth(r.month)}</td>
                    <td className={cx("px-4 py-2", status === "missing" ? "text-red-700" : status === "late" ? "text-amber-800" : "text-slate-700")}>
                      {monthDetail(c, r.month, p.today)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.receivedAt ? `${r.fileName ? "MIS file" : "No file"} + ${got} of ${METRICS.length} numbers` : "Nothing yet"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.acknowledgedAt ? (
                        `${fmtShort(r.acknowledgedAt)} (${daysBetween(r.receivedAt!, r.acknowledgedAt)} days)`
                      ) : r.receivedAt ? (
                        <Button variant="ghost" className="px-2 py-0.5 text-xs text-indigo-700" onClick={() => p.acknowledge(c.id, r.month)}>
                          Mark as read
                        </Button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{(r.reminders ?? []).map(fmtShort).join(", ") || "-"}</td>
                    <td className="px-4 py-2 text-right">
                      {owes && <ReminderButton itemKey={`${c.id}:${r.month}`} sentToday={(r.reminders ?? []).includes(p.today)} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Other requests</h2>
          <p className="text-xs text-slate-500">Documents the fund asked for outside the monthly report.</p>
        </div>
        {c.requests.length ? (
          <ul className="divide-y divide-slate-100">
            {c.requests.map((q) => {
              const overdue = !q.receivedAt && q.dueDate <= p.today;
              return (
                <li key={q.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{q.title}</div>
                    <div className="text-xs text-slate-500">
                      {q.kind} · asked {fmtShort(q.askedAt)} · due {fmtShort(q.dueDate)}
                      {(q.reminders ?? []).length > 0 && ` · reminded ${q.reminders!.map(fmtShort).join(", ")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "text-sm",
                        q.receivedAt ? "text-emerald-700" : overdue ? "font-medium text-red-700" : "text-slate-500",
                      )}
                    >
                      {q.receivedAt
                        ? `Received ${fmtShort(q.receivedAt)}${q.receivedAt > q.dueDate ? ` (${daysBetween(q.dueDate, q.receivedAt)} days late)` : ""}`
                        : overdue
                          ? `${daysBetween(q.dueDate, p.today)} days overdue`
                          : "Not due yet"}
                    </span>
                    {overdue && <ReminderButton itemKey={`${c.id}:${q.id}`} sentToday={(q.reminders ?? []).includes(p.today)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-slate-500">No other requests.</p>
        )}
      </Card>
    </div>
  );
}

const WHO: Record<PortfolioEvent["who"], { label: string; dot: string }> = {
  fund: { label: "Fund", dot: "bg-slate-600" },
  company: { label: "Company", dot: "bg-emerald-500" },
  screener: { label: "Screener", dot: "bg-slate-400" },
};

function Timeline({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const [who, setWho] = useState<"all" | PortfolioEvent["who"]>("all");
  const all = companyEvents(c, p.today);
  const list = all.filter((e) => who === "all" || e.who === who);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Everything that happened between the fund and {c.name}, newest first.</p>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs" role="tablist" aria-label="Show">
          {(["all", "company", "fund"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={who === k}
              onClick={() => setWho(k)}
              className={cx("rounded-md px-2.5 py-1 font-medium", who === k ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}
            >
              {k === "all" ? "Everything" : k === "company" ? "From the company" : "From the fund"}
            </button>
          ))}
        </div>
      </div>
      <ol className="mt-4 space-y-0">
        {list.map((e, i) => {
          const month = e.date.slice(0, 7);
          const header = i === 0 || list[i - 1].date.slice(0, 7) !== month;
          return (
            <li key={`${e.date}-${i}`}>
              {header && <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 first:mt-0">{fmtMonth(month)}</div>}
              <div className="flex gap-3 pb-3">
                <div className="flex flex-col items-center">
                  <span className={cx("mt-1.5 h-2 w-2 rounded-full", WHO[e.who].dot)} />
                  <span className="mt-1 w-px flex-1 bg-slate-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium text-slate-900">{e.title}</span>
                    <span className="text-xs text-slate-500">
                      {fmtShort(e.date)} · {WHO[e.who].label}
                    </span>
                  </div>
                  {e.detail && <p className="text-sm text-slate-600">{e.detail}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Activity({ c }: { c: PortfolioCompany }) {
  const p = usePortfolio();
  const asks = [...c.asks].sort((a, b) => Number(Boolean(a.answeredAt)) - Number(Boolean(b.answeredAt)) || b.openedAt.localeCompare(a.openedAt));
  const notes = [...c.notes].sort((a, b) => b.date.localeCompare(a.date));
  const [author, setAuthor] = useState(c.owner);
  const [text, setText] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Timeline c={c} />
      <div className="space-y-6">
        <section>
          <SectionTitle>Founder asks</SectionTitle>
          {asks.length ? (
            <div className="space-y-3">
              {asks.map((a) => (
                <AskCard key={a.id} ask={a} />
              ))}
            </div>
          ) : (
            <Card className="p-5 text-sm text-slate-600">No asks yet. Founders ask from their own page.</Card>
          )}
        </section>
        <section>
          <SectionTitle>Notes to the founder</SectionTitle>
          <Card className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                p.addNote(c.id, author, text.trim());
                setText("");
              }}
              className="space-y-2"
            >
              <label htmlFor="note-text" className="text-xs font-medium text-slate-600">
                Write a note the founder will see
              </label>
              <textarea
                id="note-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="What stood out in this month's numbers, or a suggestion"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <DropdownSelect
                  ariaLabel="From"
                  value={author}
                  onChange={setAuthor}
                  options={[c.owner, c.partner].map((n) => ({ value: n, label: n }))}
                />
                <Button type="submit" disabled={!text.trim()}>
                  Add note
                </Button>
              </div>
            </form>
            <ul className="mt-3 divide-y divide-slate-100">
              {notes.map((n, i) => (
                <li key={`${n.date}-${i}`} className="py-2.5">
                  <p className="text-sm text-slate-800">{n.text}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {n.author}, {fmtShort(n.date)} {n.date.slice(0, 4)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}

function AskCard({ ask }: { ask: PortfolioCompany["asks"][number] }) {
  const p = usePortfolio();
  const [outcome, setOutcome] = useState("");
  const open = !ask.answeredAt;
  const days = daysBetween(ask.openedAt, ask.answeredAt ?? p.today);
  return (
    <Card className={cx("p-4", open && days > 14 && "border-l-4 border-l-amber-400")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{ask.topic}</span>
        <span className={cx("text-xs", open ? (days > 14 ? "font-medium text-amber-800" : "text-slate-500") : "text-emerald-700")}>
          {open ? `Open ${days} days` : `Answered in ${days} days`}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-700">“{ask.text}”</p>
      <p className="text-xs text-slate-500">Asked {fmtShort(ask.openedAt)}</p>
      {ask.outcome && <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ask.outcome}</p>}
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (outcome.trim()) p.answerAsk(ask.id, outcome.trim());
          }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor={`outcome-${ask.id}`} className="sr-only">
            What the fund did
          </label>
          <input
            id={`outcome-${ask.id}`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What the fund did, e.g. intro made to…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <Button type="submit" variant="secondary" disabled={!outcome.trim()} className="py-1.5">
            Mark as answered
          </Button>
        </form>
      )}
    </Card>
  );
}
