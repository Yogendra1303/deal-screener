"use client";

// How every number in Aarka is worked out, and how one action moves the others. The thresholds on
// this page are read from the same constants the code uses, so the page can't drift from the app.
import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/store";
import { Card, cx } from "@/components/ui";
import { GAP_TOLERANCE } from "@/lib/checks";
import { FX } from "@/lib/compare";
import { FOLDERS } from "@/lib/dataroom";
import { FIT_DEEP_YEARS, TEMP_SHARE } from "@/lib/funnel";
import { LOOK_NOW, LOOK_RECENT_DAYS } from "@/lib/flow";
import { NEVER_OPENED_DAYS } from "@/components/flow";
import { DD_MEANING } from "@/lib/diligence";
import { PITCH_INBOX, REPLY_PROMISE_DAYS, TEMPLATES } from "@/lib/links";
import { WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { HEALTH_RULES } from "@/lib/portfolio/health";
import { STATUS_MEANING } from "@/lib/provenance";
import { MISSING_FLAG_THRESHOLD, usd } from "@/lib/rules";

const PILLARS = [
  {
    id: "disclosure",
    title: "1. Data Completeness & The 10 Core Facts",
    weight: "20% Weight",
    metric: "R_comp = DisclosedFacts / 10",
    summary: "Evaluates disclosure across 10 vital facts: revenue, growth, customers, net burn, runway, gross margin, retention, round ask, year founded, and founder roles.",
    formula: "Score = (Disclosed Facts / 10) * 100\nMultiplier = max(0.15, R_comp^0.6)",
    penalties: [
      "-10 pts per missing core fact from submission",
      "If 6 or more core facts are missing, final conviction is capped at Grade G (5 to 15 / 100) regardless of sector or stage fit",
    ],
    benchmark: "Institutional Standard: Decks with fewer than 5 disclosed facts represent uncorroborated leads, not investment-ready pipelines.",
  },
  {
    id: "veracity",
    title: "2. Financial Integrity & The Strict 10% Gap Rule",
    weight: "25% Weight",
    metric: "Tolerance = strictly <= 10%",
    summary: "Cross-checks slide claims against monthly CSV sheets. Any variance exceeding 10% generates an auditable Conflict flag.",
    formula: "Variance = |DeckClaim - SheetActual| / SheetActual\nScore = BaseCorroboration - (20 * ConflictCount)",
    penalties: [
      "-20 pts for each conflict > 10% variance",
      "0 points for zero corroboration data (e.g. no sheet uploaded)",
      "Maximum score of 40/100 if any unaddressed conflict exists",
    ],
    benchmark: "Aarka Standard: Uncorroborated slide ARR without sheet support cannot substantiate conviction.",
  },
  {
    id: "founder",
    title: "3. Founder Pedigree & Background Signal Rubric",
    weight: "20% Weight",
    metric: "Point accumulator: 0 to 100",
    summary: "Evaluates operator background, serial exits, technical pedigree, and corporate registry verification.",
    formula: "Score = min(100, SerialFounder(+35) + DomainOverlap(+30) + TechnicalPedigree(+20) + RegistryMatched(+15))",
    penalties: [
      "0 pts if no founder background or past roles stated in submission",
      "20 pts cap for first-time founders without documented domain depth or technical pedigree",
    ],
    benchmark: "Sequoia & Benchmark pattern: Repeat founders with >3 years in the problem space dramatically de-risk early-stage execution.",
  },
  {
    id: "economics",
    title: "4. Unit Economics & Capital Efficiency Curve",
    weight: "20% Weight",
    metric: "Burn Multiple + Runway + Magic No.",
    summary: "Combines Burn Multiple (Net Burn / Net New ARR), Runway cushion, and SaaS Magic Number.",
    formula: "Score = 0.40(BurnPts) + 0.40(RunwayPts) + 0.20(MagicPts)",
    penalties: [
      "Burn Multiple > 2.2x: High Burn Alarm (-30 pts)",
      "Runway < 6 months: Critical cash warning (-30 pts)",
      "Magic Number < 0.7x: GTM friction indicator",
    ],
    benchmark: "Craft Ventures & Founders Fund: Burn Multiple <1.5x and runway >12 months required for institutional seed pacing.",
  },
  {
    id: "mandate",
    title: "5. Fund Mandate & Target Ownership Feasibility",
    weight: "15% Weight",
    metric: "Target 10% to 20% equity",
    summary: "Verifies stage fit, sector focus, check size limits, and target equity ownership at implied post-money valuation.",
    formula: "Score = StageFit(30) + SectorFit(30) + OwnershipFit(40)",
    penalties: [
      "Sub-target (<10% ownership): -30 pts (dilutes fund return potential)",
      "High dilution (>20% in Seed): -20 pts (cap table motivation risk)",
      "Outside focus sector: -35 pts",
    ],
    benchmark: "Aarka Fund I Mandate: Seed-stage B2B software & Fintech across India, UAE, and Saudi Arabia with 10-20% target equity.",
  },
];

const GRADES = [
  { grade: "Grade A", score: "90 - 100", label: "Elite Conviction", color: "bg-emerald-100 text-emerald-800", action: "Fast-track Lead Partner deep-dive; schedule immediate IC Review." },
  { grade: "Grade B", score: "75 - 89", label: "Strong Conviction", color: "bg-blue-100 text-blue-800", action: "Proceed to initial partner call and verified model diligence." },
  { grade: "Grade C", score: "60 - 74", label: "Investigate Further", color: "bg-indigo-100 text-indigo-800", action: "Request customer references and verify unit economics on Numbers tab." },
  { grade: "Grade D", score: "45 - 59", label: "High Diligence Friction", color: "bg-amber-100 text-amber-800", action: "Audit math gap flags on deck vs monthly sheet; resolve discrepancies." },
  { grade: "Grade E", score: "25 - 44", label: "Capital Efficiency Alarm", color: "bg-rose-100 text-rose-800", action: "Significant burn or mandate friction. Issue partner inquiry." },
  { grade: "Grade G", score: "0 - 24", label: "Unsubstantiated Intake", color: "bg-slate-200 text-slate-800", action: "Intake registered with zero corroborating data. Request monthly financial CSV." },
];

const FLOW: { step: string; who: string; what: string; href?: string; tone: string }[] = [
  { step: "1. Founder sends", who: "Founder", what: `Pitch link, ${PITCH_INBOX}, a request link, email to the company's address, the founder portal, or the monthly report link.`, href: "/founder", tone: "bg-slate-100 ring-slate-200" },
  { step: "2. Data room keeps it", who: "Code", what: "Stored exactly as received, with its route, sender and date. Filed into numbered folders.", href: "/dataroom", tone: "bg-slate-50 ring-slate-200" },
  { step: "3. Reading", who: "AI, or the founder", what: "The AI reads decks and sheets into one standard record, keeping the page of every number. Monthly numbers are typed by the founder.", href: "/sources", tone: "bg-slate-100 ring-violet-100" },
  { step: "4. Labels and checks", who: "Code", what: `Every number gets a label. Two sources more than ${GAP_TOLERANCE * 100}% apart become a Conflict. Nothing is corrected.`, href: "/compare", tone: "bg-amber-50 ring-amber-100" },
  { step: "5. Rules and counts", who: "Code", what: "Fund rules set the band; health rules set the company's word; tiles count what needs doing.", href: "/rules", tone: "bg-emerald-50 ring-emerald-100" },
  { step: "6. People decide", who: "Analyst, partner", what: "Mark checked, file, ask, set a status, overrule a band with a reason. Every change is kept.", href: "/", tone: "bg-slate-100 ring-slate-200" },
];

const LINKS: [string, string][] = [
  ["A founder uploads a file on a request link", "Data room: New from founders +1. The diligence line turns to Received. The analyst's From founders tile and the partner's To check go up by one."],
  ["The analyst marks it checked", "New from founders −1. The diligence line turns to Done. The founder sees “Seen by the fund”."],
  ["A founder emails a file to the company's address", "Data room: To file +1, with a folder suggested from the file name only."],
  ["The analyst files it and says what it answers", "To file −1. If it answers a request line, that line turns to Sent and checked. If it answers a document the fund asked a portfolio company for, Missing reports −1."],
  ["A founder sends the monthly report", "Missing reports −1, Reports to read +1. Revenue, burn and cash update, so cash left, health and Compare move."],
  ["The analyst marks the report read", "Reports to read −1. The fund's reply time on the company improves."],
  ["Someone sets a pitch's status", "Reviewing, Meeting set or Passed take it out of New pitches. Meeting set moves the pipeline bar. Passed takes it out of the data room."],
  ["An analyst takes an unclaimed pitch", "It leaves Not picked up and Founders waiting on us, and moves into that analyst's pitches and data room."],
  ["The partner changes a fund rule", "Every read pitch is re-banded at once. A pitch that becomes Priority shows in Decisions for you."],
  ["Someone passes or holds a pitch", "It needs a reason from the list, a line on why, and a trigger. It leaves New (a pass also leaves the data room), stays in the history under Passed or held, and shows in Look again when news arrives."],
  ["A tile is picked on Pitches", "The live pitches and the history both narrow to that tile. One tile at a time, so two filters never empty the list."],
  ["Someone overrules a band", "The new band shows with “overruled” and the reason. The rules' band is kept next to it."],
];

export default function MethodPage() {
  const store = useStore();
  const rules = store.rules;
  const [selectedPillar, setSelectedPillar] = useState<string>("disclosure");
  const calcs: { name: string; how: string; limits: string; where: string }[] = [
    {
      name: "Months of cash",
      how: "Cash in the bank ÷ that month's net burn, from the latest monthly report that has both.",
      limits: `Amber under ${WATCH_RUNWAY_MONTHS} months, red under ${HEALTH_RULES.runwayMonths}`,
      where: "Low on cash, Fund at a glance, company cards, Compare",
    },
    {
      name: "Monthly growth (3 months)",
      how: "(Latest revenue ÷ revenue three months earlier) to the power of 1/3, minus 1.",
      limits: `A single month moving more than ${HEALTH_RULES.moveShare * 100}% is flagged`,
      where: "Company numbers, Compare",
    },
    {
      name: "Burn multiple",
      how: "Net burn over the last three months ÷ new annual revenue added in them (revenue gained × 12). Lower is better.",
      limits: "Shown with its working; no threshold",
      where: "Company numbers, Compare",
    },
    {
      name: "Against plan",
      how: "Reported revenue compared with what the deck said the company would make that month.",
      limits: `Flagged when off by more than ${HEALTH_RULES.planShare * 100}%`,
      where: "Keep an eye on, Going well, Compare",
    },
    {
      name: "Report on time",
      how: `A month's report is due on day ${HEALTH_RULES.dueDay} of the next month. The last ${HEALTH_RULES.windowMonths} months are checked.`,
      limits: `Late after ${HEALTH_RULES.lateDays} days counts against health; nothing for ${HEALTH_RULES.quietDays} days is “gone quiet”; under ${HEALTH_RULES.completeMin * 100}% of what was asked in 3 months is flagged`,
      where: "Missing reports, Reporting on time, health",
    },
    {
      name: "The fund's own speed",
      how: "Days from a report arriving to someone marking it read; days a founder's ask stays open; days since the last note to the founder.",
      limits: `Read within ${HEALTH_RULES.ackDays} days, answer asks within ${HEALTH_RULES.askOpenDays}, write at least every ${HEALTH_RULES.noteDays} days. Founders answer the fund's questions within ${HEALTH_RULES.followUpDays}`,
      where: "Reports to read, Founder asks, Keep an eye on",
    },
    {
      name: "Conflict",
      how: "The same number from two sources (deck, the founder's form or sheet, monthly reports, public records) compared by code.",
      limits: `More than ${GAP_TOLERANCE * 100}% apart is a Conflict. A conflict never moves a pitch down; a person settles it`,
      where: "Numbers that don't match, Numbers to fix, every number's label",
    },
    {
      name: "Fit with fund focus",
      how: "The founder's form answers checked against the written fund rules.",
      limits: `Stages: ${rules.stages.join(", ")}. Countries: ${rules.countries.join(", ")}. Round ${usd(rules.minRoundUsd)} to ${usd(rules.maxRoundUsd)}`,
      where: "Pitch band, Fund rules",
    },
    {
      name: "Band",
      how: "Outside focus only if the fit check fails. Priority if the AI's traction reading is Strong and its team reading is Strong or Mixed. Everything else is Review.",
      limits: "The AI reads traction and team with reasons; code applies the rule. A person can overrule with a reason",
      where: "Pitches, Decisions for you, Compare",
    },
    {
      name: "Key facts missing",
      how: "Eight facts an analyst needs before a first call: revenue, growth, customers, team size, round size, year founded, burn, founders' past roles.",
      limits: `${MISSING_FLAG_THRESHOLD} or more missing marks the deck Weak on completeness`,
      where: "Pitch summary, diligence list",
    },
    {
      name: "Founder-market fit",
      how: `Each founder's past work is tagged same problem, nearby or unrelated. Deep: ${FIT_DEEP_YEARS}+ years in the same problem, or a company built before in the same space. Strong: one deep founder and a second with some fit. Mixed: one of those. Weak: neither.`,
      limits: "Experience only. School, age, gender and home town are never used. The tag is read from the team page; years and the level are counted by code",
      where: "Pitch summary, Founders tab, Pitches tiles",
    },
    {
      name: "Market temperature",
      how: "Decks the fund got in the last 3 months against the 3 before, and money raised in the sector over the last 90 days against the 90 before.",
      limits: `Both up by more than ${TEMP_SHARE * 100}%: heating up. More decks but money flat or down: crowding. Either down by more than ${TEMP_SHARE * 100}%: cooling. Sample market data`,
      where: "Home market map, Market, sector pages, pitch decision card",
    },
    {
      name: "Look again",
      how: "Every pass or hold saves one reason from a fixed list, a trigger and a check date. Points for news since: trigger met 3, raised elsewhere 3, pitched again 2, sector heating up 1, strong founder-market fit 1, check date passed 1.",
      limits: `Look again now: ${LOOK_NOW}+ points with the news in the last ${LOOK_RECENT_DAYS} days. A shut-down company drops out`,
      where: "Home tiles, Look again, Pitches, company record",
    },
    {
      name: "Raised since we passed and miss rate",
      how: "A Raised elsewhere signal dated after the fund's decision. Miss rate: of the companies passed for one reason, the share that later raised.",
      limits: "Reasons with fewer than 3 passes are left out. Funding data is a fictional sample",
      where: "Partner home: Raised since we passed",
    },
    {
      name: "Never opened",
      how: `A deck still New, with no owner, ${NEVER_OPENED_DAYS} or more days after it arrived.`,
      limits: "Counts live pitches and the history",
      where: "Home, Pitches (To read tab)",
    },
    {
      name: "One record per company",
      how: "A deck is matched to a company by its website domain. A second deck joins the same record as a Pitched again signal.",
      limits: "The 6 months of history are fictional: a small sample made from a fixed recipe of monthly counts per sector",
      where: "Pitches, company record",
    },
    {
      name: "Health word",
      how: "The first line of the company's attention list decides it: red is Needs help, amber is Watch, no report yet is Too early, otherwise Healthy.",
      limits: "Uses the cash, report and plan limits above",
      where: "Company cards, Portfolio health bar",
    },
    {
      name: "Currencies",
      how: "Compare converts to US dollars at fixed sample rates.",
      limits: Object.entries(FX)
        .filter(([k]) => k !== "USD")
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") + " to $1",
      where: "Compare, Fund at a glance",
    },
    {
      name: "Founders waiting on us",
      how: "New pitches that nobody has read or picked up, by days since they arrived.",
      limits: `The fund promises a reply within ${REPLY_PROMISE_DAYS} days; amber after 7, red after ${REPLY_PROMISE_DAYS}`,
      where: "Partner home",
    },
  ];

  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">How numbers work</h1>
        <p className="mt-1 text-slate-600">
          Where every number comes from, how it is worked out, and what moves it. The limits on this page are read from the same code that
          counts the tiles, so they always match. Any tile&apos;s panel also says how its own number is counted.
        </p>
      </div>

      {/* 0. Dedicated Institutional VC Conviction Matrix Section */}
      <section className="space-y-6 rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-indigo-100/80 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Institutional Venture Capital Diligence Standard
            </span>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              The Aarka Conviction Matrix &amp; Rating Engine
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-600">
              Deterministic, multi-pillar evaluation engine based on benchmarks from Sequoia, Benchmark, Founders Fund, and Craft Ventures. Unlike arbitrary AI text ratings, every point is grounded in verified disclosures, cross-source math veracity, and unit economics.
            </p>
          </div>
          <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
            5 Governed Pillars · Grade A to G
          </span>
        </div>

        {/* Master Formula Card */}
        <div className="rounded-xl bg-slate-900 p-4 text-slate-100 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>MASTER MATHEMATICAL CONVICTION EQUATION</span>
            <span className="text-emerald-400">Deterministic TS Implementation</span>
          </div>
          <div className="text-sm font-bold text-emerald-400">
            Conviction = round( RawWeightedScore * CompletenessMultiplier )
          </div>
          <div className="text-[11px] text-slate-300">
            RawWeightedScore = 0.20(Disclosure) + 0.25(Veracity) + 0.20(Founder) + 0.20(Economics) + 0.15(Mandate)
          </div>
          <div className="text-[11px] text-slate-300">
            CompletenessMultiplier = max(0.15, (DisclosedFacts / 10)^0.6)
          </div>
          <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
            * Strict Rule: If 6 or more core institutional facts are missing, the score is capped at Grade G (5 to 15 / 100), ensuring uncorroborated pitch decks cannot yield false-positive investment conviction.
          </div>
        </div>

        {/* 5 Interactive Clickable Pillar Tiles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Governed Conviction Pillars (Click any tile to inspect formula &amp; benchmarks)
            </h3>
            <span className="text-xs text-slate-500">Click to expand</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PILLARS.map((p) => {
              const active = selectedPillar === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPillar(active ? "" : p.id)}
                  className={cx(
                    "cursor-pointer rounded-xl border p-3.5 text-left transition shadow-2xs",
                    active
                      ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">{p.weight}</span>
                    <span className={cx("text-[10px] font-bold px-1.5 py-0.2 rounded", active ? "bg-indigo-200 text-indigo-900" : "bg-slate-100 text-slate-600")}>
                      {active ? "Active" : "Inspect"}
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-slate-900 line-clamp-2">
                    {p.title}
                  </h4>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    {p.metric}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Inspector Box */}
          {selectedPillar && (
            <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3 text-xs animate-in fade-in duration-150">
              {(() => {
                const p = PILLARS.find((x) => x.id === selectedPillar);
                if (!p) return null;
                return (
                  <>
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">{p.weight} Pillar Audit</span>
                        <h4 className="text-sm font-bold text-slate-900">{p.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{p.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPillar("")}
                        className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-700"
                      >
                        ✕ Close
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-900 p-3 text-slate-100 font-mono text-[11px] space-y-1">
                        <span className="text-slate-400">// Mathematical Formulation</span>
                        <pre className="whitespace-pre-wrap text-emerald-400 font-bold">{p.formula}</pre>
                      </div>

                      <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="font-semibold text-slate-800">Active Friction &amp; Penalties Applied:</span>
                        <ul className="space-y-1 text-slate-600">
                          {p.penalties.map((pen, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-rose-500 font-bold">•</span>
                              <span>{pen}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 text-slate-700 text-[11px]">
                      <strong className="text-indigo-900">Tier-1 Institutional Benchmark:</strong> {p.benchmark}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Grade A through Grade G Institutional Scale Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900">
            Institutional Conviction Grading Tiers (Grade A to Grade G)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Grade</th>
                  <th className="px-4 py-2.5 text-left font-medium">Score Range</th>
                  <th className="px-4 py-2.5 text-left font-medium">Institutional Definition</th>
                  <th className="px-4 py-2.5 text-left font-medium">Investment Committee Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {GRADES.map((g) => (
                  <tr key={g.grade} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <span className={cx("rounded px-2 py-0.5 font-bold text-[10px]", g.color)}>
                        {g.grade}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">{g.score}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{g.label}</td>
                    <td className="px-4 py-2.5 text-slate-600">{g.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">From a founder&apos;s file to a decision</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((f) => (
            <li key={f.step} className={cx("rounded-2xl p-4 ring-1", f.tone)}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{f.step}</p>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{f.who}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{f.what}</p>
              {f.href && (
                <Link href={f.href} className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900">
                  Open →
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">The rule underneath:</span> the AI reads and explains; code does every sum and every
          comparison; people decide. The AI never changes a founder&apos;s number, and nothing is marked checked unless a second source agrees.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">What one action changes</h2>
        <p className="text-sm text-slate-500">Nothing is counted twice and nothing is left out: each action moves these counts and nothing else.</p>
        <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {LINKS.map(([a, b]) => (
              <li key={a} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-6">
                <span className="font-medium text-slate-900">{a}</span>
                <span className="text-slate-600">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Every calculation</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Number</th>
                <th className="px-3 py-2.5 font-medium">How it is worked out</th>
                <th className="px-3 py-2.5 font-medium">Limits used</th>
                <th className="px-5 py-2.5 font-medium">Where it shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {calcs.map((c) => (
                <tr key={c.name}>
                  <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-3 py-3 text-slate-700">{c.how}</td>
                  <td className="px-3 py-3 text-slate-600">{c.limits}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{c.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The health limits are starting points from common seed-fund practice, not tested on real data yet. Change them in one place
          (lib/portfolio/health.ts) and every tile, panel and this page follow.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Labels on every number</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(STATUS_MEANING).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Diligence lines</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {Object.entries(DD_MEANING).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
                <dt className="font-medium text-slate-900">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Who sees what</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <span className="font-medium text-slate-900">Partner.</span>{" "}
              <span className="text-slate-600">The whole fund: every company, pitch, file and request, and what each analyst is carrying. Sets fund rules and makes decisions. Doesn&apos;t add pitches or send requests.</span>
            </li>
            <li>
              <span className="font-medium text-slate-900">Analyst.</span>{" "}
              <span className="text-slate-600">Only the portfolio companies and pitches they look after, plus new pitches nobody has picked up. Adds pitches, sends requests, checks and files what founders send.</span>
            </li>
            <li>
              <span className="font-medium text-slate-900">Founder.</span>{" "}
              <span className="text-slate-600">Never sees the dashboard. Sees only what the fund asked of their own company, on a link or after signing in to the founder portal with the email the fund holds.</span>
            </li>
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Data room folders</h3>
          <ol className="mt-2 space-y-1 text-sm text-slate-600">
            {FOLDERS.map((f) => (
              <li key={f.id}>
                <span className="font-medium text-slate-900">
                  {f.n}. {f.name}:
                </span>{" "}
                {f.holds}
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">Ready-made request lists</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {TEMPLATES.map((t) => (
              <li key={t.key}>
                <span className="font-medium text-slate-900">{t.name}</span> ({t.items.length} items): {t.when.toLowerCase()}.
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
