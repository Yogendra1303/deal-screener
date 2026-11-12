"use client";

import { EvidenceMatrix } from "@/components/evidence-matrix";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { DiligenceChecklist, useDiligenceView } from "@/components/diligence";
import { useLinks } from "@/components/links-store";
import { UnreadPitch } from "@/components/unread-pitch";
import { DecisionCard, FounderFitCard } from "@/components/funnel";
import { FlowRecord } from "@/components/flow-record";
import { flowById } from "@/lib/flow";
import { CheckSummary } from "@/components/checks-ui";
import { DealDocs } from "@/components/docs";
import { coverage } from "@/lib/coverage";
import { BackLink, type TabTone, Brief, FactsTable, KeyNumbers, QuestionsPanel, Tabs, WhoKnows, type CompanyRef } from "@/components/company";
import { useStore } from "@/components/store";
import { useWorkspace } from "@/components/workspace";
import {
  BAND_ACCENT,
  BAND_MEANING,
  BandBadge,
  Button,
  Card,
  IssuesChip,
  KeyStrip,
  LevelChip,
  PageLink,
  SectionTitle,
  StatusSelect,
  Tag,
  cx,
} from "@/components/ui";
import { dealBrief } from "@/lib/brief";
import { loadDeck } from "@/lib/deckstore";
import { AIWorkbenchModal, type WorkbenchJob } from "@/components/ai-workbench";
import { SignalsPanel } from "@/components/signals-panel";
import { fmtDate, fmtMoney, fmtMonth, fmtNum } from "@/lib/format";
import { dealFacts } from "@/lib/provenance";
import { usd } from "@/lib/rules";
import type { MoneyFactT, NumberFactT, TextFactT } from "@/lib/schema";
import { DEAL_CONTACTS } from "@/lib/team";
import type { Band, DealResult, Flag, Level, ScoreKey } from "@/lib/types";

type Tab = "overview" | "diligence" | "numbers" | "team" | "market" | "assessment" | "activity";
const TABS: Tab[] = ["overview", "diligence", "numbers", "team", "market", "assessment", "activity"];

export default function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = use(params);
  const initial = use(searchParams).tab as Tab | undefined;
  const store = useStore();
  const deal = store.getDeal(id);
  const deckUrl = useDeckUrl(deal);
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : "overview");
  const facts = useMemo(() => (deal ? dealFacts(deal, deckUrl) : []), [deal, deckUrl]);
  const links = useLinks();
  const w = useWorkspace();
  const view = useDiligenceView(deal);

  if (!store.ready || !links.ready) return <p className="text-sm text-slate-500">Loading…</p>;
  // A company from the deal-flow history: the whole fund's memory, open to everyone at the fund.
  if (!deal && flowById(id)) return <FlowRecord id={id} />;
  // Analysts see their own pitches and new ones nobody has picked up; partners see all of them.
  const owner = links.ownerOf(id);
  if (w.role === "Analyst" && owner && owner !== w.me)
    return (
      <Card className="mx-auto max-w-lg p-6 text-center text-sm text-slate-600">
        This pitch is looked after by {owner}. Analysts see their own pitches and new ones nobody has picked up; partners see all of them.
        <div className="mt-3">
          <BackLink href="/deals" label="Back to pitches" />
        </div>
      </Card>
    );
  if (!deal && (store.unprocessed.some((s) => s.id === id) || links.getInbound(id))) return <UnreadPitch id={id} />;
  if (!deal || !view)
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-600">This pitch isn&apos;t in this browser. It may have been screened somewhere else.</p>
        <div className="mt-3">
          <BackLink href="/deals" label="Back to pitches" />
        </div>
      </Card>
    );

  const company: CompanyRef = { id: deal.id, name: deal.form.companyName, side: "deal" };
  const band = store.bandOf(deal);
  const overrule = store.overrules[deal.id];
  const conflicts = deal.flags.filter((f) => f.kind === "conflict").length;
  const dd = view.counts;
  const missingFacts = facts.filter((x) => x.headline && x.status === "Missing").length;
  const tabs: { key: Tab; label: string; hint: string; tone?: TabTone }[] = [
    { key: "overview", label: "Summary", hint: "Brief, numbers" },
    {
      key: "diligence",
      label: "Diligence",
      hint: dd.Received ? `${dd.Received} new files` : `${dd.Done} of ${view.open} answered`,
      tone: dd.Conflict ? "bad" : dd["Ask founder"] || dd.Received ? "warn" : "good",
    },
    {
      key: "numbers",
      label: "Numbers",
      hint: conflicts ? `${conflicts} don't match` : missingFacts ? `${missingFacts} missing` : "All checked",
      tone: conflicts ? "bad" : missingFacts ? "warn" : "good",
    },
    { key: "team", label: "Founders", hint: "Who they are" },
    { key: "market", label: "Market", hint: "Size and rivals" },
    { key: "assessment", label: "Assessment", hint: "Why this band" },
    { key: "activity", label: "AI steps", hint: "How it read it" },
  ];
  const f = deal.form;

  return (
    <div className="space-y-5">
      <BackLink href="/deals" label="Pitches" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{f.companyName}</h1>
            <Tag className="uppercase">Live pitch</Tag>
            <IssuesChip deal={deal} />
          </div>
          <p className="mt-1 text-slate-600">{deal.record.oneLiner}</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="deal-status" className="text-xs text-slate-500">
            Status
          </label>
          <StatusSelect
            id="deal-status"
            value={store.statusOf(deal.id)}
            onChange={(s) => {
              store.setStatus(deal.id, s);
              // A pass or hold needs a reason: open the Summary, where the decision card asks for one.
              if (s === "Passed" || s === "On hold") setTab("overview");
            }}
          />
          {deckUrl && (
            <a href={deckUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Open deck
            </a>
          )}
        </div>
      </div>

      <KeyStrip
        items={[
          ["Stage", f.stage],
          ["Round ask", <span key="a" className="font-mono">{f.amountUsd ? usd(f.amountUsd) : "—"}</span>],
          ["Sector", f.sector],
          ["Country", f.country],
          ["Received", <span key="r" className="font-mono">{fmtDate(deal.receivedAt)}</span>],
          ["Owner", links.ownerOf(deal.id) ?? "Nobody yet"],
        ]}
      />

      <section className="space-y-2.5 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <DealDocs id={deal.id} name={deal.form.companyName} className="" />
        <CheckSummary cover={coverage({ record: deal.record, form: deal.form, sheet: deal.sheet, registry: deal.registry, flags: deal.flags })} />
      </section>

      <EvidenceMatrix deal={deal} deckUrl={deckUrl} />

      <Verdict deal={deal} band={band} overruled={Boolean(overrule?.band)} />

      <Tabs label="Pitch details" tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <FounderFitCard id={deal.id} sector={f.sector} />
            <DecisionCard id={deal.id} name={f.companyName} sector={f.sector} />
          </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <Brief
              lines={dealBrief(deal, facts, deckUrl)}
              company={company}
              facts={facts}
              onTab={(t) => TABS.includes(t as Tab) && setTab(t as Tab)}
              note="Written by code from the record; lines marked AI are the model's reading"
            />
            <KeyNumbers facts={facts.filter((x) => x.headline)} company={company} />
            <QuestionsPanel company={company} />
          </div>
          <aside className="space-y-4">
            <OverrulePanel deal={deal} band={band} />
            <SignalsPanel id={deal.id} name={deal.form.companyName} className="rounded-xl p-5" />
            <WhoKnows contacts={DEAL_CONTACTS[deal.id] ?? []} note="Sample contacts. Email and calendar aren't connected, so these are made up to show how it would look." />
          </aside>
        </div>
        </div>
      )}
      {tab === "numbers" && (
        <div className="space-y-6">
          <FactsTable facts={facts} company={company} />
          {deal.flags.length > 0 && <Flags flags={deal.flags} deckUrl={deckUrl} />}
          {deal.sheet ? <Sheet deal={deal} /> : <Card className="p-5 text-sm text-slate-600">The founder didn&apos;t send a monthly numbers sheet.</Card>}
          <Record deal={deal} deckUrl={deckUrl} groups={["Traction", "Round", "Company"]} title="Everything the deck says" />
        </div>
      )}
      {tab === "diligence" && <DiligenceChecklist deal={deal} />}
      {tab === "team" && (
        <div className="space-y-6">
          <FounderFitCard id={deal.id} sector={f.sector} />
          <Founders deal={deal} deckUrl={deckUrl} />
        </div>
      )}
      {tab === "market" && (
        <div className="space-y-6">
          <ResearchPack deal={deal} />
          <Record deal={deal} deckUrl={deckUrl} groups={["Market"]} title="What the deck says about its market" />
        </div>
      )}
      {tab === "assessment" && (
        <div className="space-y-6">
          <Scores deal={deal} />
          <Summary deal={deal} />
          <Questions deal={deal} />
        </div>
      )}
      {tab === "activity" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <RunLog deal={deal} />
            <RerunCard deal={deal} />
          </div>
          <div className="space-y-4">
            {deal.registry && <RegistryCard deal={deal} />}
            <RemoveDeal deal={deal} />
          </div>
        </div>
      )}
    </div>
  );
}

function useDeckUrl(deal: DealResult | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const needsBlob = Boolean(deal && !deal.deck.url);
  const id = deal?.id;
  useEffect(() => {
    if (!needsBlob || !id) return;
    let url: string | null = null;
    loadDeck(id).then(async (blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        return;
      }
      // Not in this browser: another browser may have uploaded it to the server.
      const served = `/api/files/${encodeURIComponent(id)}/deck_pdf`;
      const r = await fetch(served, { method: "HEAD" }).catch(() => null);
      if (r?.ok) setBlobUrl(served);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [needsBlob, id]);
  return deal?.deck.url ?? blobUrl;
}

function Verdict({ deal, band, overruled }: { deal: DealResult; band: Band; overruled: boolean }) {
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-1.5", BAND_ACCENT[band])} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 pl-6 pr-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Suggested next step</span>
        <BandBadge band={band} overruled={overruled} />
        <span className="font-medium text-slate-900">{BAND_MEANING[band]}</span>
        <span className="text-sm text-slate-500">Why: {deal.bandReasons.join("; ").toLowerCase()}. A conflict never moves a pitch down; a person decides.</span>
      </div>
    </Card>
  );
}

function Summary({ deal }: { deal: DealResult }) {
  return (
    <Card className="p-5">
      <SectionTitle>Strengths and concerns</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-emerald-800">Strengths</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {deal.ai.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-red-800">Concerns</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {deal.ai.concerns.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Flags({ flags, deckUrl }: { flags: Flag[]; deckUrl: string | null }) {
  return (
    <Card className="p-5">
      <SectionTitle>Issues to check</SectionTitle>
      {flags.length === 0 ? (
        <p className="text-sm text-slate-600">
          No conflicts found between the deck, the form, the monthly sheet and the sample records.
        </p>
      ) : (
        <ul className="space-y-4">
          {flags.map((f, i) => (
            <li key={i} className={cx("rounded-lg p-4 ring-1 ring-inset", f.kind === "conflict" ? "bg-red-50/60 ring-red-200" : "bg-slate-50 ring-slate-200")}>
              <div className="flex items-start gap-2">
                <span
                  className={cx(
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    f.kind === "conflict" ? "bg-red-600 text-white" : "bg-slate-500 text-white",
                  )}
                >
                  {f.kind === "conflict" ? "Conflict" : "Missing"}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{f.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{f.detail}</p>
                </div>
              </div>
              {f.sources.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {f.sources.map((s, j) => (
                    <div key={j} className="rounded-md bg-white p-2.5 text-sm ring-1 ring-slate-200">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{s.label}</span>
                        {s.page ? <PageLink url={deckUrl} page={s.page} quote={s.quote} /> : null}
                      </div>
                      <div className="mt-0.5 font-medium text-slate-900">{s.value}</div>
                      {s.quote && <div className="mt-1 text-xs italic text-slate-500">“{s.quote}”</div>}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Scores({ deal }: { deal: DealResult }) {
  const store = useStore();
  const over = store.overrules[deal.id]?.scores ?? {};
  const shown = store.scoresOf(deal);
  const [editing, setEditing] = useState(false);

  function setLevel(key: ScoreKey, level: Level | null) {
    const current = store.overrules[deal.id];
    const scores = { ...(current?.scores ?? {}) };
    if (level) scores[key] = level;
    else delete scores[key];
    const empty = Object.keys(scores).length === 0 && !current?.band;
    store.setOverrule(deal.id, empty ? null : { band: current?.band, scores, note: current?.note ?? "Scores set by hand.", by: current?.by ?? "Analyst", at: new Date().toISOString() });
  }

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <button onClick={() => setEditing(!editing)} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
            {editing ? "Done" : "Disagree with a score?"}
          </button>
        }
      >
        How it scored
      </SectionTitle>
      <p className="mb-3 text-xs text-slate-500">Fails a fund rule → Outside focus · strong traction and at least a mixed team → Priority · else Review. A score you set by hand changes the band the same way, and the original stays visible.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((s) => (
          <div key={s.key} className={cx("rounded-lg border p-4", over[s.key] ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{s.label}</span>
              <LevelChip score={s} />
            </div>
            {editing && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["Strong", "Mixed", "Weak", "Not enough info"] as Level[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(s.key, l === deal.scores.find((x) => x.key === s.key)?.level ? null : l)}
                    className={cx(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium",
                      s.level === l ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                    )}
                  >
                    {l}
                  </button>
                ))}
                {over[s.key] && (
                  <button onClick={() => setLevel(s.key, null)} className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 underline">
                    Undo
                  </button>
                )}
              </div>
            )}
            <p className="mt-2 text-sm text-slate-700">{s.reason}</p>
            {s.evidence.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                {s.evidence.map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">Scored by {s.by === "AI" ? "AI" : "plain code"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Row = { label: string; value: string | null; page: number | null; quote: string | null };

const text = (label: string, f: TextFactT): Row => ({ label, value: f.value, page: f.page, quote: f.quote });
const num = (label: string, f: NumberFactT, suffix = ""): Row => ({
  label,
  value: f.value == null ? null : `${fmtNum(f.value)}${suffix}${f.asOf ? ` (${fmtMonth(f.asOf)})` : ""}`,
  page: f.page,
  quote: f.quote,
});
const money = (label: string, f: MoneyFactT): Row => ({
  label,
  value: f.amount == null ? null : `${fmtMoney(f.amount, f.currency)}${f.asOf ? ` (${fmtMonth(f.asOf)})` : ""}`,
  page: f.page,
  quote: f.quote,
});

function Record({ deal, deckUrl, groups: only, title = "From the deck" }: { deal: DealResult; deckUrl: string | null; groups: string[]; title?: string }) {
  const r = deal.record;
  const groups: { name: string; rows: Row[] }[] = [
    {
      name: "Company",
      rows: [
        text("Name", r.company.name),
        text("Website", r.company.website),
        text("Country", r.company.country),
        text("City", r.company.city),
        text("Sector", r.company.sector),
        text("Business model", r.company.businessModel),
        text("Stage", r.company.stage),
        { label: "Founded", value: r.company.foundedYear.value?.toString() ?? null, page: r.company.foundedYear.page, quote: r.company.foundedYear.quote },
        text("Description", r.company.description),
      ],
    },
    {
      name: "Round",
      rows: [
        money("Amount raising", r.round.amount),
        text("Instrument", r.round.instrument),
        money("Valuation", r.round.valuation),
        text("Use of funds", r.round.useOfFunds),
        text("Earlier funding", r.round.priorFunding),
      ],
    },
    {
      name: "Traction",
      rows: [
        money("Monthly revenue", r.traction.mrr),
        money("Annual revenue", r.traction.arr),
        num("Monthly growth", r.traction.monthlyGrowthPct, "%"),
        num("Customers", r.traction.customers),
        num("Users", r.traction.users),
        text("Retention", r.traction.retention),
        num("Gross margin", r.traction.grossMarginPct, "%"),
        money("Monthly burn", r.traction.monthlyBurn),
        money("Cash", r.traction.cash),
        num("Runway", r.traction.runwayMonths, " months"),
        num("Team size", r.traction.teamSize),
      ],
    },
    {
      name: "Market",
      rows: [
        money("Market size claimed", r.market.sizeClaim),
        text("How it was sized", r.market.sizeMethod),
        {
          label: "Competitors named",
          value: r.market.competitors.length ? r.market.competitors.map((c) => c.name).join(", ") : null,
          page: r.market.competitors[0]?.page ?? null,
          quote: null,
        },
      ],
    },
  ];
  const shown = only.map((name) => groups.find((g) => g.name === name)!).filter(Boolean);
  return (
    <Card className="p-5">
      <SectionTitle right={<span className="text-xs text-slate-500">Click a page number to open the deck there</span>}>{title}</SectionTitle>
      <div className="space-y-5">
        {shown.map((g) => (
          <div key={g.name}>
            <h3 className="mb-1 text-sm font-semibold text-slate-800">{g.name}</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {g.rows.map((row) => (
                  <tr key={row.label} className="align-top">
                    <td className="w-40 py-1.5 pr-3 text-slate-500">{row.label}</td>
                    <td className="py-1.5 pr-3">
                      {row.value ?? <span className="italic text-slate-400">Not stated</span>}
                    </td>
                    <td className="w-14 py-1.5 text-right">
                      <PageLink url={deckUrl} page={row.page} quote={row.quote} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Card>
  );
}

const VERDICT: Record<string, string> = {
  match: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  conflict: "bg-red-50 text-red-700 ring-red-200",
  not_found: "bg-slate-50 text-slate-600 ring-slate-200",
};

function Founders({ deal, deckUrl }: { deal: DealResult; deckUrl: string | null }) {
  return (
    <Card className="p-5">
      <SectionTitle right={<span className="text-xs text-slate-500">Profiles are fictional samples</span>}>Founders</SectionTitle>
      <div className="space-y-4">
        {deal.record.team.map((f) => (
          <div key={f.name}>
            <p className="font-medium">
              {f.name} <span className="font-normal text-slate-500">{f.role ? `· ${f.role}` : ""}</span>
            </p>
            {f.pastRoles.length ? (
              <ul className="mt-1 space-y-1 text-sm">
                {f.pastRoles.map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="text-slate-700">
                      {r.title}, {r.company}
                      {r.startYear || r.endYear ? ` (${r.startYear ?? "?"}–${r.endYear ?? "now"})` : ""}
                    </span>
                    <PageLink url={deckUrl} page={r.page} quote={r.quote} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm italic text-slate-400">No past roles stated in the deck</p>
            )}
          </div>
        ))}
      </div>
      {deal.ai.founderChecks.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Deck claims against profiles</h3>
          <ul className="space-y-2 text-sm">
            {deal.ai.founderChecks.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={cx("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", VERDICT[c.verdict])}>
                  {c.verdict === "not_found" ? "Not found" : c.verdict === "match" ? "Match" : "Conflict"}
                </span>
                <span>
                  <span className="font-medium">{c.founder}:</span> {c.claim}
                  <span className="block text-slate-500">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Sheet({ deal }: { deal: DealResult }) {
  const rows = deal.sheet!;
  const cur = rows[0]?.currency;
  return (
    <Card className="overflow-hidden p-5">
      <SectionTitle right={<span className="text-xs text-slate-500">From the founder&apos;s CSV</span>}>Monthly numbers sheet</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Month</th>
              <th className="py-1.5 pr-3 text-right font-medium">Revenue</th>
              <th className="py-1.5 pr-3 text-right font-medium">Customers</th>
              <th className="py-1.5 pr-3 text-right font-medium">Headcount</th>
              <th className="py-1.5 pr-3 text-right font-medium">Net burn</th>
              <th className="py-1.5 text-right font-medium">Cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="py-1.5 pr-3">{fmtMonth(r.month)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMoney(r.revenue, r.currency || cur)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(r.customers)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(r.headcount)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMoney(r.netBurn, r.currency || cur)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtMoney(r.cash, r.currency || cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Reads the deck again, through the account bridge or an API key, and replaces the record, scores and band. */
function RerunCard({ deal }: { deal: DealResult }) {
  const [open, setOpen] = useState(false);
  const job: WorkbenchJob = {
    kind: "extract",
    id: deal.id,
    source: deal.source,
    receivedAt: deal.receivedAt,
    form: deal.form,
    fileName: deal.deck.fileName,
    deckUrl: deal.deck.url,
    deckKey: deal.id,
    sheet: deal.sheet,
    existing: deal,
  };
  return (
    <Card className="p-5 text-sm">
      <SectionTitle right={<Button variant="secondary" onClick={() => setOpen(true)}>Run / re-run AI deck extraction</Button>}>Read the deck again</SectionTitle>
      <p className="text-slate-600">
        Replaces the standard record and the AI judgement, then re-runs every code check, score and band. The research pack is kept. Use it after a corrected deck, or to read it
        on your own Claude or ChatGPT account instead of an API key.
      </p>
      {open && <AIWorkbenchModal job={job} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function ResearchPack({ deal }: { deal: DealResult }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const r = store.researchOf(deal.id) ?? deal.research;

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <Button variant={r ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {r ? "Run again" : "Generate live research pack"}
          </Button>
        }
      >
        Top companies in this space
      </SectionTitle>
      {open && (
        <AIWorkbenchModal
          job={{ kind: "research", id: deal.id, form: deal.form, record: deal.record, deal }}
          onClose={() => setOpen(false)}
        />
      )}
      {!r && (
        <p className="text-sm text-slate-600">
          Live web search for competitors, a bottom-up market size range and public red flags, each with links. Runs on your own
          Claude or ChatGPT account, or on the server when an API key is set.
        </p>
      )}
      {r && (
        <div className="space-y-5 text-sm">
          <div>
            <h3 className="mb-2 font-semibold text-slate-800">Who else does this</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Name</th>
                    <th className="py-1.5 pr-3 font-medium">What they do</th>
                    <th className="py-1.5 pr-3 font-medium">How they differ</th>
                    <th className="py-1.5 font-medium">Named in deck</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {r.competitors.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-medium">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                            {c.name}
                          </a>
                        ) : (
                          c.name
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{c.whatTheyDo}</td>
                      <td className="py-2 pr-3 text-slate-700">{c.howDifferent}</td>
                      <td className="py-2">{c.namedInDeck ? "Yes" : <span className="font-medium text-red-700">No</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-slate-800">Market size, bottom-up</h3>
            <p className="text-lg font-semibold">
              {fmtMoney(r.marketSize.low, r.marketSize.currency)} to {fmtMoney(r.marketSize.high, r.marketSize.currency)}
              <span className="ml-2 text-sm font-normal text-slate-500">a year · {r.marketSize.whatItCounts}</span>
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              {r.marketSize.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-slate-700">{r.marketSize.deckClaimComment}</p>
          </div>
          <div>
            <h3 className="mb-1 font-semibold text-slate-800">Red flags in public sources</h3>
            {r.redFlags.length ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-700">
                {r.redFlags.map((f, i) => (
                  <li key={i}>
                    {f.text}{" "}
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                        source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600">None found.</p>
            )}
          </div>
          {r.sources.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold text-slate-800">Sources</h3>
              <ul className="space-y-0.5 text-slate-600">
                {r.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-500">
            The sample companies are fictional, so competitors and market figures describe the real market for that kind of
            business, not the company itself.
          </p>
        </div>
      )}
    </Card>
  );
}

function OverrulePanel({ deal, band }: { deal: DealResult; band: Band }) {
  const store = useStore();
  const current = store.overrules[deal.id];
  const [choice, setChoice] = useState<Band>(band);
  const [note, setNote] = useState("");
  return (
    <Card className="p-5">
      <SectionTitle>Change the suggestion</SectionTitle>
      {current ? (
        <div className="space-y-2 text-sm">
          <p>
            Overruled to <BandBadge band={current.band ?? deal.band} /> on {fmtDate(current.at)}.
          </p>
          <p className="rounded-md bg-slate-50 p-2.5 text-slate-700">“{current.note}”</p>
          <p className="text-xs text-slate-500">The rules said {deal.band}. Both are kept.</p>
          <Button variant="secondary" onClick={() => store.setOverrule(deal.id, null)}>
            Undo overrule
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">
            The rules suggest <strong>{deal.band}</strong>. If the team disagrees, pick another and say why. Both are kept.
          </p>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value as Band)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {(["Priority", "Review", "Outside focus"] as Band[]).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Why? (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <Button
            disabled={!note.trim() || choice === deal.band}
            onClick={() => store.setOverrule(deal.id, { band: choice, note: note.trim(), by: "Analyst", at: new Date().toISOString() })}
          >
            Save decision
          </Button>
        </div>
      )}
    </Card>
  );
}

function Questions({ deal }: { deal: DealResult }) {
  const [copied, setCopied] = useState(false);
  const qs = deal.ai.founderQuestions;
  const textToCopy = `Hi,\n\nThanks for sending ${deal.form.companyName}'s deck. Before a first call, could you help us with a few questions?\n\n${qs
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n")}\n\nThank you.`;
  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <button
            onClick={() => navigator.clipboard.writeText(textToCopy).then(() => setCopied(true))}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
          >
            {copied ? "Copied" : "Copy as email"}
          </button>
        }
      >
        Questions for the founder
      </SectionTitle>
      {qs.length ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-800">
          {qs.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-600">No open questions.</p>
      )}
    </Card>
  );
}

function RunLog({ deal }: { deal: DealResult }) {
  if (deal.processedBy === "chat")
    return (
      <Card className="p-5 text-sm">
        <SectionTitle>How this was made</SectionTitle>
        <p className="text-slate-700">
          Claude read the deck and wrote the judgement in a chat on this account, without an API key. The number checks,
          scores and band were then worked out by the app&apos;s own code, the same as a live run.
        </p>
        <p className="mt-2 text-xs text-slate-500">No time or cost was measured for this run. Screened {fmtDate(deal.processedAt)}.</p>
      </Card>
    );
  const totalMs = deal.runLog.reduce((a, s) => a + s.ms, 0);
  const totalCost = deal.runLog.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  return (
    <Card className="p-5">
      <SectionTitle>How this was made</SectionTitle>
      <ul className="space-y-1.5 text-sm">
        {deal.runLog.map((s, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-slate-700">{s.step}</span>
            <span className="text-right tabular-nums text-slate-500">
              {(s.ms / 1000).toFixed(1)}s{s.costUsd != null ? ` · $${s.costUsd.toFixed(3)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-medium">
        <span>Total</span>
        <span className="tabular-nums">
          {(totalMs / 1000).toFixed(0)}s · ${totalCost.toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Model {deal.model}. Cost is an estimate at list prices. Screened {fmtDate(deal.processedAt)}.
      </p>
    </Card>
  );
}

function RegistryCard({ deal }: { deal: DealResult }) {
  const r = deal.registry!;
  return (
    <Card className="p-5 text-sm">
      <SectionTitle>Registry record</SectionTitle>
      <p className="font-medium">{r.legalName}</p>
      <p className="text-slate-600">
        Incorporated {r.incorporated} · {r.country} · {r.status}
      </p>
      <p className="text-slate-600">Directors: {r.directors.join(", ")}</p>
      <p className="mt-2 text-xs text-amber-700">{r.source}. Real registry lookups aren&apos;t built yet.</p>
    </Card>
  );
}

function RemoveDeal({ deal }: { deal: DealResult }) {
  const store = useStore();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  if (deal.source === "sample") return null;
  return (
    <div className="text-sm">
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-slate-600">Remove from this browser?</span>
          <Button
            variant="secondary"
            onClick={() => {
              store.removeDeal(deal.id);
              router.push("/deals");
            }}
          >
            Remove
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-slate-500 hover:text-red-700">
          Remove this deal
        </button>
      )}
    </div>
  );
}
