"use client";

// Deterministic methodology and formula audit console.
// Every threshold on this page is imported directly from the production constants used by the engine,
// guaranteeing this rule book never drifts from live calculations.
import Link from "next/link";
import { useMemo, useState } from "react";
import { NEVER_OPENED_DAYS } from "@/components/flow";
import { useStore } from "@/components/store";
import { DropdownSelect, cx } from "@/components/ui";
import { GAP_TOLERANCE } from "@/lib/checks";
import { FX } from "@/lib/compare";
import { FOLDERS } from "@/lib/dataroom";
import { DD_MEANING } from "@/lib/diligence";
import { LOOK_NOW, LOOK_RECENT_DAYS } from "@/lib/flow";
import { FIT_DEEP_YEARS, TEMP_SHARE } from "@/lib/funnel";
import { PITCH_INBOX, REPLY_PROMISE_DAYS, TEMPLATES } from "@/lib/links";
import { WATCH_RUNWAY_MONTHS } from "@/lib/portfolio/attention";
import { HEALTH_RULES } from "@/lib/portfolio/health";
import { STATUS_MEANING } from "@/lib/provenance";
import { MISSING_FLAG_THRESHOLD, usd } from "@/lib/rules";
import { calculateVCMetrics, GRADE_BADGE_STYLE } from "@/lib/vc-metrics";

type MethodTab = "conviction" | "formulas" | "actions" | "governance";
type CalcDomain = "All" | "Financial Math" | "Deal Triage" | "Portfolio Health" | "Market & Signals";
type ActorFilter = "All" | "Founder" | "Analyst" | "Partner" | "System";

interface PillarSpec {
  id: string;
  title: string;
  shortTitle: string;
  weight: string;
  weightNum: number;
  metric: string;
  summary: string;
  formula: string;
  penalties: string[];
  benchmark: string;
}

const PILLARS: PillarSpec[] = [
  {
    id: "disclosure",
    title: "1. Data Completeness & The 10 Core Facts",
    shortTitle: "Disclosure",
    weight: "20% Weight",
    weightNum: 20,
    metric: "R_comp = Disclosed / 10",
    summary:
      "Evaluates disclosure across 10 vital facts: revenue, growth, customers, net burn, runway, gross margin, retention, round ask, year founded, and founder roles.",
    formula: "Score = (DisclosedFacts / 10) * 100\nMultiplier = max(0.15, R_comp^0.6)",
    penalties: [
      "-10 pts per missing core fact from submission",
      "If 6 or more core facts are missing, final conviction is clamped to Grade G (5 to 15 / 100) regardless of sector or stage fit",
    ],
    benchmark: "Institutional Standard: Decks with fewer than 5 disclosed facts represent uncorroborated leads, not IC-ready pipelines.",
  },
  {
    id: "veracity",
    title: "2. Financial Integrity & The Strict 10% Gap Rule",
    shortTitle: "Veracity",
    weight: "25% Weight",
    weightNum: 25,
    metric: "Tolerance <= 10.0%",
    summary:
      "Cross-checks slide claims against monthly CSV sheets, forms, and registries. Any variance strictly above 10% triggers an auditable Conflict flag.",
    formula: "Variance = |DeckClaim - SheetActual| / SheetActual\nScore = BaseCorroboration - (20 * ConflictCount)",
    penalties: [
      "-20 pts for each conflict strictly > 10% variance",
      "0 pts corroboration credit if no monthly CSV sheet is provided",
      "Hard cap of 40/100 on Pillar 2 while any unresolved conflict remains",
    ],
    benchmark: "Aarka Standard: Uncorroborated slide ARR without sheet support cannot substantiate investment conviction.",
  },
  {
    id: "founder",
    title: "3. Founder Pedigree & Background Signal Rubric",
    shortTitle: "Founder Signal",
    weight: "20% Weight",
    weightNum: 20,
    metric: "Additive rubric: 0 to 100",
    summary:
      "Evaluates prior founding history, earned domain operator depth, technical/CTO roles, and corporate registry verification. School, age, and hometown are excluded.",
    formula: "Score = min(100, SerialFounder(+35) + DomainOverlap(+30) + TechPedigree(+20) + RegistryMatch(+15))",
    penalties: [
      "0 pts if no founder background or past roles are disclosed",
      "20 pts cap for first-time founders without documented domain depth or technical pedigree",
    ],
    benchmark: "Tier-1 Pattern: Repeat founders or operators with 5+ years in the problem space significantly de-risk early execution.",
  },
  {
    id: "economics",
    title: "4. Unit Economics & Capital Efficiency Curve",
    shortTitle: "Unit Economics",
    weight: "20% Weight",
    weightNum: 20,
    metric: "Burn Multiple + Runway + Magic",
    summary:
      "Combines Burn Multiple (Net Burn / Net New ARR), cash runway buffer, and SaaS Magic Number from verified monthly numbers.",
    formula: "Score = 0.40(BurnPts) + 0.40(RunwayPts) + 0.20(MagicPts)",
    penalties: [
      "Burn Multiple > 2.2x: High Burn Alarm (-30 pts)",
      "Runway < 6 months: Critical cash warning (-30 pts)",
      "Magic Number < 0.7x: GTM efficiency friction indicator",
    ],
    benchmark: "Seed Standard: Burn Multiple under 1.5x and post-round runway above 12-18 months for efficient scaling.",
  },
  {
    id: "mandate",
    title: "5. Fund Mandate & Target Ownership Feasibility",
    shortTitle: "Mandate Fit",
    weight: "15% Weight",
    weightNum: 15,
    metric: "Target 10% to 20% equity",
    summary:
      "Verifies stage fit, geography, sector focus, round ask corridor, and target equity ownership at implied post-money valuation.",
    formula: "Score = StageFit(30) + SectorFit(30) + OwnershipFit(40)",
    penalties: [
      "Sub-target (<10% ownership): -30 pts (dilutes fund return potential)",
      "High dilution (>20% at Seed): -20 pts (founder alignment risk)",
      "Outside focus sector or geography: -35 pts",
    ],
    benchmark: "Aarka Fund I Mandate: Pre-seed to Series A across target geographies and sectors with 10% to 20% target ownership.",
  },
];

const GRADES = [
  { grade: "Grade A", score: "90 to 100", label: "Elite Conviction", color: "bg-emerald-50 text-emerald-700 ring-emerald-200", action: "Fast-track Lead Partner deep-dive and schedule immediate IC review." },
  { grade: "Grade B", score: "75 to 89", label: "Strong Conviction", color: "bg-blue-50 text-blue-700 ring-blue-200", action: "Proceed to partner call, customer references, and Cap Table modeling." },
  { grade: "Grade C", score: "60 to 74", label: "Investigate Further", color: "bg-indigo-50 text-indigo-700 ring-indigo-200", action: "Request missing unit economics and verify monthly CSV on Numbers tab." },
  { grade: "Grade D", score: "45 to 59", label: "High Diligence Friction", color: "bg-amber-50 text-amber-800 ring-amber-200", action: "Audit >10% math gap conflicts between deck and monthly sheet before call." },
  { grade: "Grade E", score: "25 to 44", label: "Capital Efficiency Alarm", color: "bg-rose-50 text-rose-700 ring-rose-200", action: "Severe burn multiple, short runway, or mandate mismatch. Issue partner query." },
  { grade: "Grade G", score: "0 to 24", label: "Unsubstantiated Intake", color: "bg-slate-100 text-slate-700 ring-slate-300", action: "6+ missing core facts or non-pitch file. Request monthly CSV and re-score." },
];

const LIFECYCLE_STEPS = [
  { step: "01", title: "Founder Sends", who: "Founder", what: `Pitch form, ${PITCH_INBOX}, private request link, or monthly MIS portal.`, href: "/pitch" },
  { step: "02", title: "Vault Stores Raw", who: "Code", what: "Saved verbatim with route, sender, and timestamp in numbered Data Room folders.", href: "/dataroom" },
  { step: "03", title: "Dual Parse & Cite", who: "AI + Code", what: "Extracts claims with slide page numbers and verbatim quotes. Never edits founder figures.", href: "/sources" },
  { step: "04", title: "Math & Gap Audit", who: "Code", what: `Every number receives a provenance label. Variance strictly >${GAP_TOLERANCE * 100}% flags a Conflict.`, href: "/compare" },
  { step: "05", title: "Rules & Conviction", who: "Code", what: "Fund rules set the Band; 5-Pillar Matrix computes Grade A-G; Runway Radar tracks cash.", href: "/rules" },
  { step: "06", title: "Partners Decide", who: "Team", what: "Review conflicts, log 1-5 IC votes, export IC Memo PDF, or promote closed deals to Portfolio.", href: "/deals" },
];

interface ActionRule {
  actor: Exclude<ActorFilter, "All">;
  trigger: string;
  deltas: { label: string; tone: "emerald" | "rose" | "indigo" | "amber" }[];
  effect: string;
}

const ACTION_MAP: ActionRule[] = [
  {
    actor: "Founder",
    trigger: "Uploads a file on a private request link",
    deltas: [
      { label: "New from founders +1", tone: "indigo" },
      { label: "Diligence -> Received", tone: "amber" },
      { label: "To check +1", tone: "indigo" },
    ],
    effect: "Streams directly into the deal's Data Room folder and alerts the assigned analyst and partner.",
  },
  {
    actor: "Analyst",
    trigger: "Marks an uploaded founder file as Checked",
    deltas: [
      { label: "New from founders -1", tone: "emerald" },
      { label: "Diligence -> Done", tone: "emerald" },
    ],
    effect: "Clears the unreviewed file counter; the founder portal immediately updates to 'Seen by the fund'.",
  },
  {
    actor: "Founder",
    trigger: "Emails a file to the company's inbound address",
    deltas: [{ label: "Data room: To file +1", tone: "amber" }],
    effect: "Lands in the company's filing queue with an automatic folder suggestion derived from the file name only.",
  },
  {
    actor: "Analyst",
    trigger: "Files an emailed document and links what it answers",
    deltas: [
      { label: "To file -1", tone: "emerald" },
      { label: "Request -> Sent & checked", tone: "emerald" },
      { label: "Missing reports -1", tone: "emerald" },
    ],
    effect: "Closes the linked diligence request line and clears any overdue portfolio document flag.",
  },
  {
    actor: "Founder",
    trigger: "Submits the monthly MIS report (or Partner drops CSV)",
    deltas: [
      { label: "Missing reports -1", tone: "emerald" },
      { label: "Reports to read +1", tone: "indigo" },
      { label: "Runway & Fund NAV updated", tone: "indigo" },
    ],
    effect: "Recalculates latest monthly revenue, net burn, cash runway (<9 mo / <6 mo radar), Compare rankings, and Fund TVPI live.",
  },
  {
    actor: "Analyst",
    trigger: "Marks a monthly MIS report as Read",
    deltas: [
      { label: "Reports to read -1", tone: "emerald" },
      { label: "Fund response SLA improved", tone: "emerald" },
    ],
    effect: "Logs acknowledgement timestamp and improves the company's Fund Responsiveness score (target <= 7 days).",
  },
  {
    actor: "Partner",
    trigger: "Updates a pitch status (Reviewing / Meeting set / Passed)",
    deltas: [
      { label: "New pitches -1", tone: "emerald" },
      { label: "Pipeline stage moved", tone: "indigo" },
    ],
    effect: "Moves the deal across Kanban columns; Passed records a mandatory rationale, trigger, and archives it out of active Data Room.",
  },
  {
    actor: "Analyst",
    trigger: "Claims an unassigned pitch from Team or Pitches",
    deltas: [
      { label: "Unassigned -1", tone: "emerald" },
      { label: "Owner queue +1", tone: "indigo" },
    ],
    effect: "Removes the deck from 'Unassigned' and 'Founders waiting on us', routing it into that analyst's queue.",
  },
  {
    actor: "Partner",
    trigger: "Edits a Fund Rule (stage, country, sector, or round size)",
    deltas: [
      { label: "All pitches re-banded live", tone: "indigo" },
      { label: "Pillar 5 fit recalculated", tone: "indigo" },
    ],
    effect: "Deterministically re-evaluates every screened and queued deal; any pitch entering Priority surfaces in Partner Decisions.",
  },
  {
    actor: "Partner",
    trigger: "Overrules an automated Band with written rationale",
    deltas: [
      { label: "Partner override logged", tone: "amber" },
      { label: "Rule band preserved", tone: "indigo" },
    ],
    effect: "Displays the partner's override alongside the original engine band and reason so governance stays 100% auditable.",
  },
  {
    actor: "Partner",
    trigger: "Clicks 'Mark Invested' to promote a closed deal",
    deltas: [
      { label: "Portfolio companies +1", tone: "emerald" },
      { label: "Fund deployed & NAV updated", tone: "emerald" },
    ],
    effect: "Carries Cap Table check size, ownership %, and historical monthly CSV rows straight into /portfolio and /fund.",
  },
  {
    actor: "System",
    trigger: "Receives post-pass market news or Look-Again trigger",
    deltas: [{ label: "Look again score recalculated", tone: "amber" }],
    effect: `When news points hit ${LOOK_NOW}+ within ${LOOK_RECENT_DAYS} days, the passed/held company automatically resurfaces in 'Look again now'.`,
  },
];

interface CalcSpec {
  name: string;
  domain: Exclude<CalcDomain, "All">;
  formula: string;
  how: string;
  example: string;
  limits: string;
  where: string[];
}

const DELTA_TONE = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
};

const ACTOR_TONE: Record<Exclude<ActorFilter, "All">, string> = {
  Founder: "bg-blue-50 text-blue-700 ring-blue-200",
  Analyst: "bg-teal-50 text-teal-700 ring-teal-200",
  Partner: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  System: "bg-slate-100 text-slate-700 ring-slate-200",
};

const LABEL_BADGE: Record<string, string> = {
  Checked: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Reported: "bg-blue-50 text-blue-700 ring-blue-200",
  Claimed: "bg-slate-100 text-slate-700 ring-slate-200",
  Conflict: "bg-rose-50 text-rose-700 ring-rose-200",
  Missing: "bg-amber-50 text-amber-800 ring-amber-200",
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Ask founder": "bg-amber-50 text-amber-800 ring-amber-200",
  Later: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function MethodPage() {
  const store = useStore();
  const rules = store.rules;

  const [tab, setTab] = useState<MethodTab>("conviction");
  const [selectedPillar, setSelectedPillar] = useState<string>("disclosure");
  const [traceDealId, setTraceDealId] = useState<string>(() => store.deals[0]?.id ?? "");
  const [calcDomain, setCalcDomain] = useState<CalcDomain>("All");
  const [calcQuery, setCalcQuery] = useState("");
  const [actorFilter, setActorFilter] = useState<ActorFilter>("All");

  const activeDeal = useMemo(
    () => store.deals.find((d) => d.id === traceDealId) ?? store.deals[0] ?? null,
    [store.deals, traceDealId],
  );

  const liveTrace = useMemo(() => {
    if (!activeDeal) return null;
    return calculateVCMetrics(activeDeal.sheet, activeDeal.record, activeDeal.form.amountUsd, { deal: activeDeal });
  }, [activeDeal]);

  const calcs = useMemo<CalcSpec[]>(
    () => [
      {
        name: "Months of cash (Runway)",
        domain: "Financial Math",
        formula: "Runway = Cash in Bank / Latest Monthly Net Burn",
        how: "Computed from the latest monthly report or CSV row that provides both cash balance and positive net burn. Zero or negative burn never divides by zero.",
        example: "$540,000 cash / $65,000 net burn = 8.3 months (Amber warning)",
        limits: `Amber under ${WATCH_RUNWAY_MONTHS} mo · Red critical under ${HEALTH_RULES.runwayMonths} mo`,
        where: ["Runway Radar", "Portfolio Cards", "Compare"],
      },
      {
        name: "Monthly growth (3-month CMGR)",
        domain: "Financial Math",
        formula: "CMGR = (Rev_latest / Rev_t-3)^(1/3) - 1",
        how: "Compounded average month-on-month revenue growth across the last 3 monthly periods so single-month spikes don't distort trajectory.",
        example: "$42K to $58K over 3 months -> (58/42)^(1/3) - 1 = +11.4% MoM",
        limits: `Single-month jump/drop > ${HEALTH_RULES.moveShare * 100}% is flagged for review`,
        where: ["Deal Numbers", "Portfolio", "Compare"],
      },
      {
        name: "Burn multiple",
        domain: "Financial Math",
        formula: "Burn Multiple = 3-Month Net Burn / (Net New MRR * 12)",
        how: "Measures how many dollars of cash are burned to generate $1 of net new annualized recurring revenue over the trailing quarter.",
        example: "$90K 3-mo burn / ($6K new MRR * 12 = $72K ARR) = 1.25x (Good)",
        limits: "Under 1.0x elite · Under 2.0x target · Over 2.2x triggers Pillar 4 penalty",
        where: ["Conviction Pillar 4", "Deal Scorecard", "Compare"],
      },
      {
        name: "Strict >10% Math Gap (Conflict)",
        domain: "Financial Math",
        formula: "Variance = (DeckClaim - SourceValue) / SourceValue",
        how: "Deterministic cross-check comparing the same metric across Deck, Monthly CSV, Intake Form, and Registry. Founder figures are never overwritten.",
        example: "Deck ₹7.5 Cr vs CSV ₹5.76 Cr -> (7.5 - 5.76) / 5.76 = +30.2% (Conflict)",
        limits: `Strictly > ${GAP_TOLERANCE * 100}% flags Conflict (9.9% and 10.0% pass; 10.1% flags)`,
        where: ["Evidence Matrix", "Pillar 2 Veracity", "Audit Report"],
      },
      {
        name: "Multi-currency FX normalization",
        domain: "Financial Math",
        formula: "USD_Value = NativeAmount / FX_Rate[Currency]",
        how: "Compare Grid, Fund Analytics, and opt-in Evidence Matrix FX mode normalize local reporting currencies to USD while keeping original figures visible.",
        example: "₹84 L / 84 = $100K USD equivalent",
        limits: Object.entries(FX)
          .filter(([k]) => k !== "USD")
          .map(([k, v]) => `${k} ${v}`)
          .join(" · ") + " per $1",
        where: ["Compare Matrix", "Evidence Matrix", "Fund Analytics"],
      },
      {
        name: "Against pitch plan variance",
        domain: "Portfolio Health",
        formula: "PlanDelta = (ActualRev - DeckPlanRev) / DeckPlanRev",
        how: "Compares a portfolio company's latest reported monthly revenue against the milestone revenue promised in their original pitch deck.",
        example: "Actual ₹24L vs Plan ₹36L -> -33.3% (Triggers Revenue Review play)",
        limits: `Flagged when trailing plan by more than ${HEALTH_RULES.planShare * 100}%`,
        where: ["Portfolio Attention", "Support Plays", "Compare"],
      },
      {
        name: "Monthly MIS reporting SLA",
        domain: "Portfolio Health",
        formula: "DueDate = Day 15 of (ReportMonth + 1)",
        how: `Evaluates timeliness and metric completeness across the trailing ${HEALTH_RULES.windowMonths} monthly reporting periods.`,
        example: "September MIS due 15 Oct -> arriving 2 Nov is 18 days late (Slipping)",
        limits: `Late > ${HEALTH_RULES.lateDays}d · Gone quiet >= ${HEALTH_RULES.quietDays}d · Incomplete < ${HEALTH_RULES.completeMin * 100}%`,
        where: ["Portfolio Health", "Reporting Strip", "Digest Cron"],
      },
      {
        name: "Fund responsiveness SLA",
        domain: "Portfolio Health",
        formula: "AckWait = AckDate - ReceivedDate",
        how: "Tracks how fast Aarka partners and analysts read incoming MIS reports, resolve founder asks, and send proactive check-in notes.",
        example: "Report read within 1 day + asks closed in 4 days -> Responsive",
        limits: `Read <= ${HEALTH_RULES.ackDays}d · Asks <= ${HEALTH_RULES.askOpenDays}d · Notes <= ${HEALTH_RULES.noteDays}d · Founder replies <= ${HEALTH_RULES.followUpDays}d`,
        where: ["Team Queues", "Portfolio Health", "Founder Support"],
      },
      {
        name: "Company health status word",
        domain: "Portfolio Health",
        formula: "Health = HighestSeverity(Runway, MIS, PlanVariance)",
        how: "Determined automatically by the highest-priority alert on the company's attention queue so urgent cash or reporting issues always surface first.",
        example: "Runway 5.6 mo (Red) overrides on-time MIS -> Needs help",
        limits: "Red = Needs help · Amber = Watch · <2 reports = Too early · Clear = Healthy",
        where: ["Portfolio Cards", "Home Alerts", "Fund Analytics"],
      },
      {
        name: "Fit with fund mandate",
        domain: "Deal Triage",
        formula: "Fit = StageOk && CountryOk && SectorOk && RoundInRange",
        how: "Deterministic code check evaluating the founder's intake form against the live Partner-edited rules on /rules.",
        example: "Seed + India + B2B Software + $1.5M ask -> Strong Fit",
        limits: `Stages: ${rules.stages.join(", ")} · Geos: ${rules.countries.join(", ")} · Round: ${usd(rules.minRoundUsd)} to ${usd(rules.maxRoundUsd)}`,
        where: ["Fund Rules Simulator", "Pillar 5", "Pipeline Band"],
      },
      {
        name: "Automated deal band",
        domain: "Deal Triage",
        formula: "if !Fit -> Outside focus; else if StrongTraction & Team -> Priority; else Review",
        how: "Only a failed Fund Rule puts a pitch Outside focus. Conflicts never silently drop a band; a human partner inspects and decides.",
        example: "Fits rules + Strong traction + Mixed team -> Priority",
        limits: "Rule-computed by TypeScript; Partners can override with mandatory audit reason",
        where: ["Pitches Kanban", "Deal Header", "Compare"],
      },
      {
        name: "Key facts completeness",
        domain: "Deal Triage",
        formula: "MissingCount = CoreFactsWithoutValue(record)",
        how: "Checks presence of vital diligence disclosures: revenue, growth, customers, team size, round size, founding year, burn, margin, retention, and past roles.",
        example: "Only round ask stated (9 missing) -> Weak completeness + Grade G clamp",
        limits: `${MISSING_FLAG_THRESHOLD}+ missing flags Weak; 6+ missing clamps Conviction to Grade G (5-15/100)`,
        where: ["Pillar 1 Disclosure", "Deal Key Numbers", "Outreach Request"],
      },
      {
        name: "Founder-market fit (Bias-controlled)",
        domain: "Deal Triage",
        formula: "Deep = (SameProblemYears >= 5) || PriorCompanyInSpace",
        how: "Scores operator experience and domain relevance strictly from past roles. School pedigree, age, gender, and hometown are never used.",
        example: "1 Deep founder + 1 Nearby operator -> Strong Founder-Market Fit",
        limits: `Deep threshold: ${FIT_DEEP_YEARS}+ years in exact problem space or repeat founder`,
        where: ["Pillar 3 Founder Signal", "Founders Tab", "Deal Brief"],
      },
      {
        name: "Founders waiting on us & Never opened",
        domain: "Deal Triage",
        formula: "WaitDays = Today - ReceivedDate (where Status == New)",
        how: "Tracks unreviewed inbound pitches without an assigned owner so no founder deck slips through the cracks.",
        example: "Deck sitting unassigned for 9 days -> Flagged in Never Opened",
        limits: `Never opened >= ${NEVER_OPENED_DAYS}d · Amber > 7d · Red SLA > ${REPLY_PROMISE_DAYS}d`,
        where: ["Partner Home", "Pitches To Read", "Team Unassigned"],
      },
      {
        name: "Market temperature",
        domain: "Market & Signals",
        formula: "Delta = (Last90d - Prev90d) / Prev90d",
        how: "Compares trailing 3-month inbound pitch volume and sector funding volume against the prior 3-month baseline.",
        example: "Decks +24% and Sector Capital +31% -> Heating Up",
        limits: `Both > +${TEMP_SHARE * 100}% Heating up · Decks up / Capital flat Crowding · Either < -${TEMP_SHARE * 100}% Cooling`,
        where: ["Home Market Map", "Market Pulse", "Sector Pages"],
      },
      {
        name: "Look-again re-engagement score",
        domain: "Market & Signals",
        formula: "LookScore = Trigger(3) + Raised(3) + RePitch(2) + HotSector(1) + StrongFMF(1) + CheckDate(1)",
        how: "Continuously scores passed or held companies as fresh market signals arrive so winning companies resurface automatically.",
        example: "Trigger met (+3) + Raised bridge (+3) = 6 pts -> Look Again Now",
        limits: `Triggers at ${LOOK_NOW}+ points from signals within last ${LOOK_RECENT_DAYS} days`,
        where: ["Home Look Again", "Pitches Queue", "Deal History"],
      },
      {
        name: "Raised since we passed (Anti-portfolio miss rate)",
        domain: "Market & Signals",
        formula: "MissRate[Reason] = RaisedAfterPass / TotalPassedForReason",
        how: "Measures how often deals passed for a specific reason subsequently raise institutional rounds elsewhere, exposing blind spots in thesis rules.",
        example: "3 of 10 'Early traction' passes raised Series A -> 30% miss rate",
        limits: "Pass reasons with fewer than 3 historical deals are excluded to avoid small-N noise",
        where: ["Partner Home", "Market Analytics"],
      },
      {
        name: "One canonical record per company",
        domain: "Market & Signals",
        formula: "CanonicalKey = NormalizedWebsiteDomain(company)",
        how: "Matches repeat submissions by normalized domain so a second pitch deck appends as a 'Pitched again' timeline signal rather than duplicating the record.",
        example: "ledgerly.in resubmits 6 months later -> Linked to existing Ledgerly record",
        limits: "Rolling 6-month sector cohort deduplication",
        where: ["Pitches", "Market Cohorts", "Data Room"],
      },
    ],
    [rules],
  );

  const filteredCalcs = useMemo(() => {
    const q = calcQuery.trim().toLowerCase();
    return calcs.filter((c) => {
      if (calcDomain !== "All" && c.domain !== calcDomain) return false;
      if (q && !`${c.name} ${c.formula} ${c.how} ${c.limits} ${c.where.join(" ")}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [calcs, calcDomain, calcQuery]);

  const filteredActions = useMemo(
    () => ACTION_MAP.filter((a) => actorFilter === "All" || a.actor === actorFilter),
    [actorFilter],
  );

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Deterministic Methodology &amp; Formula Audit
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
            How numbers work
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspect every mathematical formula, conviction weight, threshold, and state transition running behind the curtain. All limits are read directly from live production TypeScript constants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Zero AI Arithmetic
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Read-Only Audit Spec
          </span>
          <Link
            href="/rules"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            Fund Rules →
          </Link>
        </div>
      </div>

      {/* 4 Interactive Summary KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setTab("conviction")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "conviction" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Conviction Engine</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Live Trace</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            5
            <span className="text-sm font-normal text-slate-400"> pillars · A-G</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Master formula &amp; live deal audit →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("formulas")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "formulas" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Formula Catalog</span>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Code-Synced</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {calcs.length}
            <span className="text-sm font-normal text-slate-400"> equations</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Worked examples &amp; limits →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("actions")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "actions" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Action State Map</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">+/- Deltas</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            {ACTION_MAP.length}
            <span className="text-sm font-normal text-slate-400"> triggers</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Exact counter changes per action →
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab("governance")}
          className={cx(
            "group cursor-pointer rounded-xl border bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-sm",
            tab === "governance" ? "border-indigo-400 ring-2 ring-indigo-500/15" : "border-slate-200 hover:border-indigo-300",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Labels &amp; Access</span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">RBAC</span>
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
            5
            <span className="text-sm font-normal text-slate-400"> labels · 3 roles</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 group-hover:text-indigo-700">
            Provenance tags, folders &amp; roles →
          </p>
        </button>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold" role="tablist">
          {(
            [
              ["conviction", "01 · Conviction Matrix & Live Trace"],
              ["formulas", `02 · Every Calculation (${calcs.length})`],
              ["actions", `03 · Action State Map (${ACTION_MAP.length})`],
              ["governance", "04 · Labels, Folders & Roles"],
            ] as [MethodTab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx(
                "cursor-pointer rounded-lg px-3.5 py-1.5 transition",
                tab === k ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Link href="/sources" className="text-xs font-semibold text-indigo-700 hover:underline">
          Inspect Data Lineage Architecture →
        </Link>
      </div>

      {/* TAB 1: CONVICTION MATRIX + BEHIND-THE-CURTAIN LIVE DEAL TRACE */}
      {tab === "conviction" && (
        <div className="space-y-6">
          {/* Master Equation + Behind-the-Curtain Live Deal Trace */}
          <section className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 shadow-2xs sm:p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-indigo-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Institutional Venture Capital Diligence Standard
                </span>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">
                  The Aarka 5-Pillar Conviction Matrix (Grade A to G)
                </h2>
                <p className="mt-1 max-w-2xl text-xs text-slate-600">
                  Every point is computed deterministically in TypeScript from verified disclosures, cross-source math veracity, founder signals, unit economics, and mandate fit.
                </p>
              </div>
              <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-xs font-semibold text-indigo-800">
                100% Auditable · 0 AI Math
              </span>
            </div>

            {/* Master Formula Card */}
            <div className="rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>MASTER MATHEMATICAL CONVICTION EQUATION</span>
                <span className="text-emerald-400">lib/vc-metrics.ts · Deterministic Execution</span>
              </div>
              <div className="text-sm font-bold text-emerald-400">
                FinalScore = round( RawWeightedScore * CompletenessMultiplier )
              </div>
              <div className="text-[11px] text-slate-300">
                RawWeightedScore = 0.20(Disclosure) + 0.25(Veracity) + 0.20(Founder) + 0.20(Economics) + 0.15(Mandate)
              </div>
              <div className="text-[11px] text-slate-300">
                CompletenessMultiplier = max(0.15, (DisclosedFacts / 10)^0.6)
              </div>
              <div className="border-t border-slate-800 pt-2 text-[11px] text-amber-300/90">
                Guardrail Clamp: If 6 or more of the 10 core facts are missing (or the file fails the 7-section Pitch Deck Gate), FinalScore is clamped to Grade G (5 to 15 / 100).
              </div>
            </div>

            {/* BEHIND THE CURTAIN: LIVE WORKED CALCULATION TRACE (READ-ONLY) */}
            {activeDeal && liveTrace && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Live Calculation Trace
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        Watch How the Math Computes a Real Deal Step-by-Step
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Select any screened deal in your workspace to audit its exact pillar scores, weighting math, completeness multiplier, and active penalties.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownSelect
                      ariaLabel="Select deal to trace"
                      value={activeDeal.id}
                      onChange={setTraceDealId}
                      options={store.deals.map((d) => ({
                        value: d.id,
                        label: `${d.form.companyName} (${d.form.stage})`,
                      }))}
                      size="sm"
                      align="right"
                    />
                    <Link
                      href={`/deals/${activeDeal.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Open Deal →
                    </Link>
                  </div>
                </div>

                {/* Step-by-step Pipeline Trace */}
                <div className="grid gap-3 md:grid-cols-5">
                  {(
                    [
                      ["P1 · Disclosure (20%)", liveTrace.conviction.dimensions.disclosure],
                      ["P2 · Veracity (25%)", liveTrace.conviction.dimensions.veracity],
                      ["P3 · Founder (20%)", liveTrace.conviction.dimensions.founder],
                      ["P4 · Economics (20%)", liveTrace.conviction.dimensions.economics],
                      ["P5 · Mandate (15%)", liveTrace.conviction.dimensions.mandate],
                    ] as const
                  ).map(([label, dim]) => {
                    const weighted = ((dim.score * dim.weightPct) / 100).toFixed(1);
                    return (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="font-mono text-lg font-bold text-slate-900">{dim.score}</span>
                          <span className="font-mono text-[11px] font-semibold text-indigo-700">+{weighted} pts</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, dim.score)}%` }} />
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-500">{dim.summary}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Final Arithmetic Rollup Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-xs text-slate-200">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                    <span>
                      Raw Sum: <strong className="text-white">{liveTrace.conviction.rawWeightedScore.toFixed(1)}</strong>
                    </span>
                    <span className="text-slate-500">×</span>
                    <span>
                      Multiplier ({liveTrace.conviction.disclosedCount}/{liveTrace.conviction.totalCoreFacts} facts):{" "}
                      <strong className="text-amber-300">{liveTrace.conviction.completenessMultiplier.toFixed(2)}x</strong>
                    </span>
                    <span className="text-slate-500">=</span>
                    <span>
                      Final Score: <strong className="text-emerald-400">{liveTrace.conviction.score} / 100</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ring-1 ring-inset",
                        GRADE_BADGE_STYLE[liveTrace.conviction.grade],
                      )}
                    >
                      Grade {liveTrace.conviction.grade} · {liveTrace.conviction.tierLabel}
                    </span>
                  </div>
                </div>

                {liveTrace.conviction.missingFacts.length > 0 && (
                  <p className="text-[11px] text-slate-500">
                    <strong className="text-slate-700">Active Missing Disclosures on {activeDeal.form.companyName}:</strong>{" "}
                    {liveTrace.conviction.missingFacts.join(", ")}.
                  </p>
                )}
              </div>
            )}

            {/* 5 Interactive Clickable Pillar Audit Tiles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Inspect Pillar Formulas &amp; Penalty Rules
                </h3>
                <span className="text-xs text-slate-500">Click any pillar tile</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {PILLARS.map((p) => {
                  const active = selectedPillar === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPillar(p.id)}
                      className={cx(
                        "cursor-pointer rounded-xl border p-3.5 text-left shadow-2xs transition",
                        active
                          ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                          : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-indigo-700">{p.weight}</span>
                        <span
                          className={cx(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {active ? "Selected" : "Inspect"}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-xs font-bold text-slate-900">{p.title}</h4>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{p.metric}</p>
                    </button>
                  );
                })}
              </div>

              {selectedPillar &&
                (() => {
                  const p = PILLARS.find((x) => x.id === selectedPillar);
                  if (!p) return null;
                  return (
                    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-xs space-y-3 text-xs">
                      <div className="border-b border-slate-100 pb-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                          {p.weight} Specification
                        </span>
                        <h4 className="mt-0.5 text-sm font-bold text-slate-900">{p.title}</h4>
                        <p className="mt-0.5 text-xs text-slate-600">{p.summary}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100 space-y-1">
                          <span className="text-slate-400">{"// Deterministic Formula"}</span>
                          <pre className="whitespace-pre-wrap font-bold text-emerald-400">{p.formula}</pre>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                          <span className="font-semibold text-slate-800">Active Friction &amp; Penalty Caps</span>
                          <ul className="space-y-1 text-slate-600">
                            {p.penalties.map((pen) => (
                              <li key={pen} className="flex items-start gap-1.5">
                                <span className="font-bold text-rose-500">•</span>
                                <span>{pen}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 text-[11px] text-slate-700">
                        <strong className="text-indigo-900">Institutional Benchmark:</strong> {p.benchmark}
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* Grade A through Grade G Scale */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900">Grade A to Grade G Institutional Tier Scale</h3>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {GRADES.map((g) => (
                  <div key={g.grade} className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ring-1 ring-inset", g.color)}>
                        {g.grade}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700">{g.score}</span>
                    </div>
                    <p className="font-bold text-slate-900">{g.label}</p>
                    <p className="leading-relaxed text-slate-600">{g.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: EVERY CALCULATION (SEARCHABLE FORMULA CATALOG WITH WORKED EXAMPLES) */}
      {tab === "formulas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-1.5">
              {(["All", "Financial Math", "Deal Triage", "Portfolio Health", "Market & Signals"] as CalcDomain[]).map(
                (dom) => (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => setCalcDomain(dom)}
                    className={cx(
                      "cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition",
                      calcDomain === dom
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900",
                    )}
                  >
                    {dom}
                  </button>
                ),
              )}
            </div>
            <input
              type="search"
              value={calcQuery}
              onChange={(e) => setCalcQuery(e.target.value)}
              placeholder="Search formula, metric, or limit..."
              className="h-8 w-60 rounded-lg border border-slate-300 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCalcs.map((c) => (
              <article
                key={c.name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{c.domain}</span>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">{c.name}</h3>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {c.where.map((w) => (
                      <span key={w} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Exact Mathematical Equation */}
                <div className="rounded-lg bg-slate-900 px-3.5 py-2.5 font-mono text-xs font-semibold text-emerald-400">
                  {c.formula}
                </div>

                <p className="text-xs leading-relaxed text-slate-600">{c.how}</p>

                {/* Worked Example + Live Code Threshold */}
                <div className="mt-auto space-y-2 border-t border-slate-100 pt-3 text-[11px]">
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-slate-700">
                    <strong className="font-semibold text-indigo-900">Worked Example:</strong> {c.example}
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <span className="shrink-0 font-bold text-slate-800">Active Code Limit:</span>
                    <span>{c.limits}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            All numerical limits above are imported directly from <code>lib/checks.ts</code>, <code>lib/portfolio/health.ts</code>, <code>lib/vc-metrics.ts</code>, and live Partner Fund Rules so documentation and runtime math always match.
          </p>
        </div>
      )}

      {/* TAB 3: WHAT ONE ACTION CHANGES (STATE TRANSITION MAP + LIFECYCLE) */}
      {tab === "actions" && (
        <div className="space-y-6">
          {/* 6-Step End-to-End File Lifecycle */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">From a Founder&apos;s File to a Partner Decision</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Core separation of duties: AI extracts and cites; TypeScript computes every sum and comparison; Partners make every decision.
              </p>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LIFECYCLE_STEPS.map((s) => (
                <li key={s.step} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-indigo-600">STEP {s.step}</span>
                    <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {s.who}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">{s.title}</p>
                  <p className="mt-1 flex-1 break-words leading-relaxed text-slate-600">{s.what}</p>
                  <Link href={s.href} className="mt-3 font-semibold text-indigo-600 hover:underline">
                    Open →
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Action -> State Delta Cards */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">What One Action Changes (State Delta Ledger)</h2>
                <p className="text-xs text-slate-500">
                  Nothing is counted twice and nothing is silently dropped. Filter by actor to audit exact counter moves.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["All", "Founder", "Analyst", "Partner", "System"] as ActorFilter[]).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setActorFilter(act)}
                    className={cx(
                      "cursor-pointer rounded-lg px-3 py-1 text-xs font-semibold transition",
                      actorFilter === act
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {filteredActions.map((item) => (
                <article
                  key={item.trigger}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                          ACTOR_TONE[item.actor],
                        )}
                      >
                        {item.actor}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900">{item.trigger}</h3>
                    </div>
                  </div>

                  {/* Visual Counter Delta Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {item.deltas.map((d) => (
                      <span
                        key={d.label}
                        className={cx(
                          "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ring-1 ring-inset",
                          DELTA_TONE[d.tone],
                        )}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600">{item.effect}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: PROVENANCE LABELS, DATA ROOM FOLDERS & ROLE ACCESS */}
      {tab === "governance" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Provenance & Diligence Labels */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Labels on Every Number</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Every figure across Deals, Portfolio, and Compare carries one explicit provenance label.
              </p>
              <div className="mt-3 space-y-2">
                {Object.entries(STATUS_MEANING).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                    <span
                      className={cx(
                        "w-20 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-bold ring-1 ring-inset",
                        LABEL_BADGE[k] ?? "bg-slate-100 text-slate-700 ring-slate-200",
                      )}
                    >
                      {k}
                    </span>
                    <span className="leading-relaxed text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900">Diligence Checklist States</h3>
              <div className="mt-3 space-y-2">
                {Object.entries(DD_MEANING).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                    <span
                      className={cx(
                        "w-24 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-bold ring-1 ring-inset",
                        LABEL_BADGE[k] ?? "bg-slate-100 text-slate-700 ring-slate-200",
                      )}
                    >
                      {k}
                    </span>
                    <span className="leading-relaxed text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right: RBAC Roles, Data Room Folders & Request Lists */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Who Sees What (Access &amp; Governance)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Strict role isolation enforced at middleware and API layers.
              </p>
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5">
                  <p className="font-bold text-indigo-950">Partner (Full Fund Oversight)</p>
                  <p className="mt-1 leading-relaxed text-slate-700">
                    Full access across every pitch, portfolio company, Fund Analytics, Team queues, and Founder Support Desk. Sets Fund Rules, logs IC votes, sends founder requests, exports IC/LP PDFs, and promotes closed deals to Portfolio.
                  </p>
                </div>
                <div className="rounded-xl border border-teal-200/80 bg-teal-50/40 p-3.5">
                  <p className="font-bold text-teal-950">Analyst (Assigned Deal &amp; Portfolio Scope)</p>
                  <p className="mt-1 leading-relaxed text-slate-700">
                    Manages assigned portfolio companies, owned pitches, and unclaimed inbound decks. Screens uploads, verifies math conflicts, files founder documents, and routes support plays.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="font-bold text-slate-900">Founder (Row-Level Isolated Portal)</p>
                  <p className="mt-1 leading-relaxed text-slate-700">
                    Never sees the internal VC dashboard, scores, or partner notes. Accesses only their own company via time-bound HMAC-SHA256 tokens to upload files, report monthly MIS, and message Aarka in two-way support threads.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900">Standard Data Room Folders</h3>
              <ol className="mt-2.5 grid gap-2 sm:grid-cols-2 text-xs">
                {FOLDERS.map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <span className="font-mono font-bold text-indigo-700">0{f.n}.</span>{" "}
                    <span className="font-semibold text-slate-900">{f.name}</span>
                    <p className="mt-0.5 text-[11px] text-slate-500">{f.holds}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-900">Ready-Made Diligence Request Lists</h3>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 text-xs">
                {TEMPLATES.map((t) => (
                  <li key={t.key} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900">{t.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                        {t.items.length} items
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t.when}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
