"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownSelect } from "@/components/dropdown-select";

export interface WorkflowStep {
  num: string;
  stage: string;
  title: string;
  summary: string;
  routeLabel: string;
  visualTitle: string;
  visualSubtitle: string;
  metrics: { label: string; value: string; status: "checked" | "flagged" | "claimed" }[];
}

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    num: "01",
    stage: "Collect",
    title: "Capture startup decks and monthly financial records.",
    summary:
      "Founders upload a PDF pitch deck and optional monthly CSV or XLSX sheet via /pitch or inbound email, receiving a scoped status tracking link.",
    routeLabel: "/pitch -> /founder/dataroom/[id]",
    visualTitle: "Stage 01 · Founder Pitch & CSV Intake",
    visualSubtitle: "Direct PDF upload (up to 32 MB) + optional monthly CSV/XLSX sheet (up to 10 MB)",
    metrics: [
      { label: "Pitch Deck File", value: "PDF Validated (4.2 MB · 14 slides)", status: "checked" },
      { label: "Financial Sheet", value: "12-Month CSV Attached (Apr to Mar)", status: "checked" },
      { label: "Private Status Link", value: "Scoped Per-Deal Token Issued", status: "checked" },
    ],
  },
  {
    num: "02",
    stage: "Structure",
    title: "Extract slide claims with verbatim page citations.",
    summary:
      "Slide claims and tables are mapped into a standard 8-fact diligence schema while retaining the exact slide page number and direct quote.",
    routeLabel: "/deals/[id] -> Summary",
    visualTitle: "Stage 02 · Source-Cited Claim Record",
    visualSubtitle: "Every extracted claim links to its source file, slide page number, and quote",
    metrics: [
      { label: "Stated ARR (Slide p. 4)", value: "$1.44M (Verbatim quote attached)", status: "claimed" },
      { label: "Stated MoM Growth (Slide p. 6)", value: "14.0% monthly claim", status: "claimed" },
      { label: "Core Fact Coverage", value: "7 of 8 facts extracted", status: "checked" },
    ],
  },
  {
    num: "03",
    stage: "Verify",
    title: "Cross-check stated figures against monthly CSV rows.",
    summary:
      "Deterministic code compares stated ARR against CSV MRR x 12, runway against cash divided by burn, and slide growth against compounded CSV rows.",
    routeLabel: "/deals/[id]?tab=numbers",
    visualTitle: "Stage 03 · Deterministic Financial Cross-Checks",
    visualSubtitle: "10.0% default variance review threshold (configurable per fund rule)",
    metrics: [
      { label: "ARR vs. CSV MRR x 12", value: "$1.44M vs. $120K x 12 (0.0% gap)", status: "checked" },
      { label: "Deck vs. CSV Growth", value: "14.0% vs. 9.1% CSV (53.8% discrepancy flagged)", status: "flagged" },
      { label: "Cash Runway Math", value: "$1.16M / $80K burn = 14.5 months", status: "checked" },
    ],
  },
  {
    num: "04",
    stage: "Review",
    title: "Evaluate mandate fit, model dilution, and record IC votes.",
    summary:
      "Apply configurable fund rules, simulate post-money SAFE or priced-round ownership with explicit assumptions, and record partner IC votes.",
    routeLabel: "/deals -> /deals/[id]",
    visualTitle: "Stage 04 · Mandate Fit, SAFE Dilution & IC Review",
    visualSubtitle: "Assumptions: Post-Money SAFE · $6.0M Cap · 0% Discount · 10.0% Option Pool",
    metrics: [
      { label: "Fund Mandate Fit", value: "Seed · B2B Software · $1.50M Ask", status: "checked" },
      { label: "SAFE Ownership ($600K Check)", value: "10.0% Post-Round ($6.0M Cap · 10% Pool)", status: "checked" },
      { label: "Partner IC Consensus", value: "2 Yes · 1 Diligence Follow-up", status: "claimed" },
    ],
  },
  {
    num: "05",
    stage: "Monitor",
    title: "Track portfolio MIS health and look-again triggers.",
    summary:
      "Monitor monthly MIS reporting cadence, cash runway below 9 months, LP quarterly report exports, and re-engagement triggers on passed deals.",
    routeLabel: "/portfolio & /fund",
    visualTitle: "Stage 05 · Portfolio MIS & Re-Engagement Tracking",
    visualSubtitle: "Two-way reporting health bands, <9.0 mo runway watch, and LP quarterly packs",
    metrics: [
      { label: "MIS Reporting Cadence", value: "6 of 6 reports on time", status: "checked" },
      { label: "Runway Watch Rule", value: "Flagged when < 9.0 months cash", status: "flagged" },
      { label: "LP Quarterly Pack", value: "CSV & Printable PDF Ready", status: "checked" },
    ],
  },
] as const;

const BACKGROUND_OPTIONS = [
  "VC (Partner / Principal / Associate)",
  "Private Equity / Growth Equity",
  "Family Office / Angel Syndicate",
  "Founder (Raising Capital)",
  "Tech Scout / Product Evaluation",
  "Other",
];

const INTENT_OPTIONS = [
  "Evaluating for our fund's dealflow screening",
  "Testing automated financial checks & ARR corroboration",
  "Looking to syndicate or co-invest with Aarka",
  "Evaluating internal tools for fund operations",
  "Exploring early-stage benchmarks & thesis extraction",
  "Other",
];

export function PartnerSignInButton({
  label = "Partner Sign In",
  loadingLabel = "Connecting…",
  className,
}: {
  label?: string;
  loadingLabel?: string;
  className: string;
}) {
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    const { signIn } = await import("next-auth/react");
    void signIn("google", { callbackUrl: "/" });
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={signingIn}
      className={className}
    >
      {signingIn ? loadingLabel : label}
    </button>
  );
}

export function MobileHeaderMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="absolute top-16 right-0 left-0 border-b border-slate-200 bg-white px-4 py-4 shadow-md lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1.5">
            <a
              href="#workflow"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Platform · Workflow
            </a>
            <a
              href="#capabilities"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Platform · Capabilities
            </a>
            <a
              href="#for-founders"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              For Founders
            </a>
            <a
              href="#request-workspace"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              For Funds
            </a>
            <a
              href="#privacy"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Data &amp; Privacy
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <PartnerSignInButton
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
              />
              <a
                href="#request-workspace"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-800 px-3 text-xs font-medium text-white"
              >
                Request Workspace
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

/* ============================================================================
   BESPOKE NON-ROBOTIC PRODUCT UI VISUALS FOR THE 5 WORKFLOW STAGES
   Rendered in proportional Geist Sans with tabular numerals (zero robotic mono PNGs)
   ============================================================================ */
function WorkflowStagePreview({ stepIndex }: { stepIndex: number }) {
  if (stepIndex === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-4 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="text-xs font-medium text-slate-800">Founder Submission Package · Velora Systems</div>
            <div className="text-[11px] text-slate-500">Submitted via /pitch · Seed · B2B Infrastructure · $1.50M Ask</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80">
            Intake Validated
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Pitch Deck PDF</span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                14 Slides
              </span>
            </div>
            <div className="mt-1.5 text-sm font-medium text-slate-800">velora-seed-deck-2026.pdf</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
              <span>PDF header verified</span>
              <span>4.2 MB / 32 MB limit</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Monthly Financial Sheet</span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                12 Monthly Rows
              </span>
            </div>
            <div className="mt-1.5 text-sm font-medium text-slate-800">velora-monthly-mis-2026.csv</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
              <span>MRR, burn &amp; cash columns mapped</span>
              <span>184 KB</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
            <span className="font-medium text-slate-700">Private Founder Data Room Link Issued</span>
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">/founder/dataroom/velora-systems</span>
        </div>
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-4 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="text-xs font-medium text-slate-800">8-Fact Diligence Schema · Verbatim Slide Citations</div>
            <div className="text-[11px] text-slate-500">Every extracted claim preserves its exact slide page and source quote</div>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200/80 tabular-nums">
            7 of 8 Core Facts Cited
          </span>
        </div>

        <div className="space-y-2">
          {[
            {
              fact: "Annual Recurring Revenue (ARR)",
              value: "$1.44M",
              cite: "Pitch Deck · Slide p. 4",
              quote: "“Reached $1.44M ARR across 18 production enterprise workspaces.”",
              tone: "blue",
            },
            {
              fact: "Stated Monthly Growth Rate",
              value: "14.0% MoM",
              cite: "Pitch Deck · Slide p. 6",
              quote: "“Growing 14.0% month-over-month across enterprise accounts.”",
              tone: "blue",
            },
            {
              fact: "Net Burn & Cash Balance",
              value: "$80K/mo · $1.16M Cash",
              cite: "Pitch Deck · Slide p. 11",
              quote: "“$1.16M ending cash balance with $80K net monthly burn.”",
              tone: "emerald",
            },
          ].map((row) => (
            <div key={row.fact} className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">{row.fact}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 tabular-nums">{row.value}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {row.cite}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{row.quote}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stepIndex === 2) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-4 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="text-xs font-medium text-slate-800">Deterministic Financial Cross-Checks</div>
            <div className="text-[11px] text-slate-500">Slide claims verified in TypeScript against submitted monthly CSV rows</div>
          </div>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200/80 tabular-nums">
            1 Variance Flagged (&gt;10.0%)
          </span>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500">Founder Deck Claim</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Slide p. 6</span>
            </div>
            <div className="mt-2 text-2xl font-medium tracking-tight text-slate-800 tabular-nums">14.0%</div>
            <div className="mt-0.5 text-xs text-slate-500">Stated monthly revenue growth</div>
          </div>

          <div className="rounded-xl border border-rose-200/90 bg-rose-50/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-800">Submitted CSV Actuals</span>
              <span className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-200">
                53.8% Gap
              </span>
            </div>
            <div className="mt-2 text-2xl font-medium tracking-tight text-rose-700 tabular-nums">9.1%</div>
            <div className="mt-0.5 text-xs text-rose-800/80">Compounded CSV growth (Apr to Sep)</div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs">
            <span className="text-slate-600">ARR vs. CSV MRR × 12</span>
            <span className="font-medium text-emerald-700 tabular-nums">$1.44M = $120K × 12 (0.0% gap)</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs">
            <span className="text-slate-600">Cash Runway Math</span>
            <span className="font-medium text-emerald-700 tabular-nums">$1.16M / $80K = 14.5 months</span>
          </div>
        </div>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-4 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div>
            <div className="text-xs font-medium text-slate-800">Mandate Rule Fit, SAFE Dilution &amp; IC Voting</div>
            <div className="text-[11px] text-slate-500">Transparent post-money SAFE ownership &amp; partner consensus record</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80">
            Mandate Matched
          </span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Post-Money SAFE Ownership Simulation</span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 tabular-nums">
              10.0% Post-Round Ownership
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
            {[
              ["Check Size", "$600K"],
              ["Valuation Cap", "$6.0M"],
              ["Discount", "0.0%"],
              ["Option Pool", "10.0%"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[10px] text-slate-500">{k}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-800 tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Investment Committee (IC) Partner Votes</span>
            <span className="text-[11px] text-slate-500 tabular-nums">2 Yes · 1 Follow-up</span>
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
              <span className="text-slate-700">General Partner · Thesis &amp; ARR Corroboration</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Vote: Yes</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
              <span className="text-slate-700">Principal · Verify Q3 cohort net expansion</span>
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">Discuss</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <div className="text-xs font-medium text-slate-800">Portfolio MIS Reporting &amp; Runway Watch</div>
          <div className="text-[11px] text-slate-500">Monthly founder reporting cadence, &lt;9.0 mo runway alerts, and LP exports</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80 tabular-nums">
          1.42x Net TVPI
        </span>
      </div>

      <div className="space-y-2">
        {[
          {
            company: "Ledgerly AI",
            stage: "Seed · Backed",
            mrr: "$148K MRR (+11.2%)",
            runway: "18.5 months",
            status: "On Track",
            tone: "emerald",
          },
          {
            company: "Kinetix Cloud",
            stage: "Pre-Seed · Backed",
            mrr: "$64K MRR (+8.4%)",
            runway: "7.8 months",
            status: "Runway < 9m",
            tone: "rose",
          },
          {
            company: "Vantara Pay",
            stage: "Seed · Backed",
            mrr: "$210K MRR (+12.8%)",
            runway: "22.0 months",
            status: "On Track",
            tone: "emerald",
          },
        ].map((item) => (
          <div key={item.company} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs text-xs">
            <div>
              <div className="font-medium text-slate-800">{item.company}</div>
              <div className="text-[11px] text-slate-500">{item.stage}</div>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-slate-600">{item.mrr}</span>
              <span className="font-medium text-slate-800">{item.runway}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  item.tone === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowInteractiveGrid() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;
    const attach = () => {
      if (observer) return;
      const nodes = stepRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!nodes.length) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const idx = Number(entry.target.getAttribute("data-step-index"));
              if (!Number.isNaN(idx)) setActiveStep(idx);
            }
          }
        },
        { rootMargin: "-25% 0px -45% 0px", threshold: 0.2 },
      );
      nodes.forEach((n) => observer?.observe(n));
    };

    window.addEventListener("scroll", attach, { once: true, passive: true });
    return () => {
      window.removeEventListener("scroll", attach);
      observer?.disconnect();
    };
  }, []);

  const currentStep = WORKFLOW_STEPS[activeStep] ?? WORKFLOW_STEPS[0];

  return (
    <div className="mt-10 space-y-6">
      {/* Connected Horizontal 5-Stage Progress Flow Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xs">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = idx < activeStep;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all ${
                  isActive
                    ? "bg-slate-800 text-white shadow-xs"
                    : isCompleted
                      ? "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      : "bg-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums ${
                      isActive
                        ? "bg-white/15 text-white"
                        : isCompleted
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {step.num}
                  </span>
                  <span className="text-xs font-medium">{step.stage}</span>
                </div>
                <span
                  className={`hidden text-xs transition-transform group-hover:translate-x-0.5 sm:inline ${
                    isActive ? "text-slate-300" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Connected Vertical Stage Flow */}
        <div className="space-y-3 lg:col-span-5">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <div
                key={step.num}
                ref={(el) => {
                  stepRefs.current[idx] = el;
                }}
                data-step-index={idx}
                onClick={() => setActiveStep(idx)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all sm:p-5 ${
                  isActive
                    ? "border-slate-300 bg-white shadow-sm ring-1 ring-slate-900/5"
                    : "border-slate-200/75 bg-white/70 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className="inline-flex cursor-pointer items-center gap-2 text-left text-xs font-medium text-blue-700 focus:outline-none focus-visible:underline"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[11px] font-medium text-blue-700 tabular-nums">
                      {step.num}
                    </span>
                    <span>{step.stage}</span>
                  </button>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    {step.routeLabel}
                  </span>
                </div>
                <h3 className="mt-2 font-sans text-[clamp(1.05rem,0.45vw+0.92rem,1.25rem)] font-medium leading-[1.25] tracking-[-0.015em] text-balance text-slate-800">
                  {step.title}
                </h3>
                <p className="mt-1.5 font-sans text-[clamp(0.9rem,0.15vw+0.86rem,0.975rem)] font-normal leading-[1.6] text-slate-600">
                  {step.summary}
                </p>

                {/* Mobile inline stage metrics */}
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 lg:hidden">
                  {step.metrics.map((m) => (
                    <div key={m.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="font-medium text-slate-800 tabular-nums">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Sticky Live Non-Robotic Product Visual & Flow Controls */}
        <div className="hidden lg:sticky lg:top-24 lg:col-span-7 lg:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div>
                <h3 className="font-sans text-sm font-medium text-slate-800">{currentStep.visualTitle}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{currentStep.visualSubtitle}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : WORKFLOW_STEPS.length - 1))}
                  aria-label="Previous workflow stage"
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) % WORKFLOW_STEPS.length)}
                  aria-label="Next workflow stage"
                  className="inline-flex h-7 items-center gap-1 cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>Next Stage</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <div className="p-5">
              <WorkflowStagePreview stepIndex={activeStep} />

              {/* Stage Check Output Strip */}
              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white px-4 py-1 text-xs">
                {currentStep.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="font-medium text-slate-600">{m.label}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${
                        m.status === "checked"
                          ? "bg-emerald-50 text-emerald-700"
                          : m.status === "flagged"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PLATFORM CAPABILITIES: 4 INTERACTIVE PRODUCT PANELS (Proportional Geist Sans)
   Zero robotic slashed-zero monospace static PNGs; crisp native DOM previews
   ============================================================================ */
export function CapabilitiesInteractiveTabs() {
  const [capabilityTab, setCapabilityTab] = useState<"diligence" | "pipeline" | "review" | "portfolio">("diligence");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-700">
            Platform Capabilities
          </p>
          <h2 className="mt-2 max-w-[23ch] font-sans text-[clamp(1.75rem,2.4vw+0.85rem,2.55rem)] font-normal leading-[1.14] tracking-[-0.02em] text-balance text-slate-800">
            Four connected modules{" "}
            <span className="text-slate-500">built for structured investment review.</span>
          </h2>
        </div>

        <div className="inline-flex flex-wrap rounded-xl border border-slate-200/90 bg-slate-100/80 p-1" role="tablist" aria-label="Platform capabilities">
          {(
            [
              ["diligence", "01 · Financial Diligence"],
              ["pipeline", "02 · Deal Pipeline"],
              ["review", "03 · Investment Review"],
              ["portfolio", "04 · Portfolio Monitoring"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={capabilityTab === key}
              onClick={() => setCapabilityTab(key)}
              className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                capabilityTab === key
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {capabilityTab === "diligence" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              01 · Financial Diligence
            </span>
            <h3 className="font-sans text-[clamp(1.35rem,1vw+0.9rem,1.6rem)] font-normal leading-[1.22] tracking-[-0.018em] text-balance text-slate-800">
              Spot arithmetic gaps between slide claims and monthly CSV rows{" "}
              <span className="text-slate-500">before the first partner call.</span>
            </h3>
            <p className="max-w-[54ch] font-sans text-[clamp(0.95rem,0.2vw+0.9rem,1.025rem)] font-normal leading-[1.65] text-slate-600">
              Compare stated ARR, monthly growth, and runway against submitted CSV rows. Variances above the 10.0% default threshold (configurable per fund rule) are flagged with exact formulas.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200/80 pt-4 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Verbatim slide provenance:</strong> Click any extracted metric to inspect the PDF deck at the cited slide page.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Explicit SAFE &amp; equity assumptions:</strong> Model dilution with visible terms (Post-Money SAFE, $6.0M cap, 0% discount, 10.0% option pool).
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-800">Diligence Verification Ledger · Velora Systems</span>
                </div>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 tabular-nums">
                  5 Corroborated · 1 Flagged
                </span>
              </div>

              <div className="space-y-3 p-5">
                <div className="overflow-hidden rounded-xl border border-slate-200/80">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-medium text-slate-500">
                      <tr>
                        <th className="px-3.5 py-2.5">Diligence Check</th>
                        <th className="px-3.5 py-2.5">Pitch Deck Claim</th>
                        <th className="px-3.5 py-2.5">CSV Actual</th>
                        <th className="px-3.5 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white tabular-nums">
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-700">ARR vs. MRR × 12</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$1.44M (p. 4)</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$120K × 12</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            0.0% gap
                          </span>
                        </td>
                      </tr>
                      <tr className="bg-rose-50/35">
                        <td className="px-3.5 py-2.5 font-medium text-rose-900">Monthly Revenue Growth</td>
                        <td className="px-3.5 py-2.5 font-medium text-rose-900">14.0% MoM (p. 6)</td>
                        <td className="px-3.5 py-2.5 font-medium text-rose-700">9.1% Compounded</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                            +53.8% gap
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-700">Cash Runway Math</td>
                        <td className="px-3.5 py-2.5 text-slate-600">14.5 months (p. 11)</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$1.16M / $80K</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            Corroborated
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-700">Gross Margin Check</td>
                        <td className="px-3.5 py-2.5 text-slate-600">78.4% (p. 9)</td>
                        <td className="px-3.5 py-2.5 text-slate-600">78.1% CSV avg</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            0.4% gap
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                  <span>SAFE Dilution Preview ($600K check at $6.0M Post-Money Cap, 10.0% Pool)</span>
                  <span className="font-medium text-blue-700 tabular-nums">10.0% Post-Round Ownership</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "pipeline" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              02 · Deal Pipeline
            </span>
            <h3 className="font-sans text-[clamp(1.35rem,1vw+0.9rem,1.6rem)] font-normal leading-[1.22] tracking-[-0.018em] text-balance text-slate-800">
              Triage every inbound deck across list views{" "}
              <span className="text-slate-500">and horizontal stage boards.</span>
            </h3>
            <p className="max-w-[54ch] font-sans text-[clamp(0.95rem,0.2vw+0.9rem,1.025rem)] font-normal leading-[1.65] text-slate-600">
              Organize submissions across New Inbound, Reviewing, Meeting Set, On Hold, and Passed stages with live intake sync and one-click CSV exports.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200/80 pt-4 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Mandate &amp; discrepancy filters:</strong> Filter by Fits Mandate, Strong Founder Fit, Discrepancy &gt;10% (default rule), or Missing Facts.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Look-again triggers:</strong> Record pass reasons and check dates so companies resurface when milestones are met.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <span className="text-xs font-medium text-slate-800">Deal Flow Pulse · Active Inbound Triage</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200/80">
                    Fits Mandate (14)
                  </span>
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                    Variance Flagged (3)
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {[
                  {
                    col: "To Read (6)",
                    deals: [
                      { name: "Velora Systems", meta: "Seed · $1.50M Ask", tag: "53.8% Growth Gap", tagTone: "rose" },
                      { name: "Arbor Compute", meta: "Pre-Seed · $800K Ask", tag: "6/6 Corroborated", tagTone: "emerald" },
                    ],
                  },
                  {
                    col: "Meetings Set (4)",
                    deals: [
                      { name: "Aether Grid", meta: "Seed · $2.20M Ask", tag: "Fits Mandate · 2 Yes", tagTone: "blue" },
                      { name: "Solvay Health", meta: "Seed · $1.80M Ask", tag: "ARR Verified ($1.9M)", tagTone: "emerald" },
                    ],
                  },
                  {
                    col: "Look Again (4)",
                    deals: [
                      { name: "RahaTrail", meta: "Seed · Re-check Q3", tag: "Trigger: $100K MRR", tagTone: "amber" },
                      { name: "Nexo Freight", meta: "Pre-Seed · Watch", tag: "Trigger: 12m Runway", tagTone: "amber" },
                    ],
                  },
                ].map((lane) => (
                  <div key={lane.col} className="rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-3">
                    <div className="text-xs font-medium text-slate-700 tabular-nums">{lane.col}</div>
                    <div className="mt-2.5 space-y-2">
                      {lane.deals.map((d) => (
                        <div key={d.name} className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-2xs">
                          <div className="text-xs font-medium text-slate-800">{d.name}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{d.meta}</div>
                          <div className="mt-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
                                d.tagTone === "rose"
                                  ? "bg-rose-50 text-rose-700"
                                  : d.tagTone === "emerald"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : d.tagTone === "blue"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {d.tag}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "review" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              03 · Investment Review
            </span>
            <h3 className="font-sans text-[clamp(1.35rem,1vw+0.9rem,1.6rem)] font-normal leading-[1.22] tracking-[-0.018em] text-balance text-slate-800">
              Benchmark sector cohorts and document partner IC decisions{" "}
              <span className="text-slate-500">with a complete audit trail.</span>
            </h3>
            <p className="max-w-[54ch] font-sans text-[clamp(0.95rem,0.2vw+0.9rem,1.025rem)] font-normal leading-[1.65] text-slate-600">
              Compare incoming opportunities against 3-month, 6-month, and 12-month sector cohorts, record partner votes, and preserve written rationales when overriding code scores.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200/80 pt-4 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Traceable cohort counts:</strong> Every sector trend displays the underlying deck count and median round ask.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Partner IC voting &amp; memos:</strong> Capture Yes, No, or Discuss votes and export printable diligence memos.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <span className="text-xs font-medium text-slate-800">Sector Cohort Benchmarks · Trailing 6-Month Window</span>
                <span className="rounded-md bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 tabular-nums">
                  118 Inbound Decks Indexed
                </span>
              </div>

              <div className="space-y-3 p-5">
                {[
                  {
                    sector: "B2B AI & Developer Infrastructure",
                    count: "42 decks",
                    medianAsk: "$1.60M Median Ask",
                    medianGrowth: "11.4% Median MoM",
                    delta: "+28% inbound volume",
                    pct: "w-[82%]",
                  },
                  {
                    sector: "Fintech & Embedded Compliance",
                    count: "31 decks",
                    medianAsk: "$1.85M Median Ask",
                    medianGrowth: "9.8% Median MoM",
                    delta: "+14% inbound volume",
                    pct: "w-[66%]",
                  },
                  {
                    sector: "Supply Chain & Industrial SaaS",
                    count: "26 decks",
                    medianAsk: "$1.40M Median Ask",
                    medianGrowth: "8.6% Median MoM",
                    delta: "+9% inbound volume",
                    pct: "w-[54%]",
                  },
                ].map((s) => (
                  <div key={s.sector} className="rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-800">{s.sector}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 tabular-nums">
                        {s.delta} ({s.count})
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div className={`h-full rounded-full bg-blue-600 ${s.pct}`} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>{s.medianAsk}</span>
                      <span>{s.medianGrowth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "portfolio" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              04 · Portfolio Monitoring
            </span>
            <h3 className="font-sans text-[clamp(1.35rem,1vw+0.9rem,1.6rem)] font-normal leading-[1.22] tracking-[-0.018em] text-balance text-slate-800">
              Track monthly MIS reporting health, cash runway alerts,{" "}
              <span className="text-slate-500">and LP quarterly packs.</span>
            </h3>
            <p className="max-w-[54ch] font-sans text-[clamp(0.95rem,0.2vw+0.9rem,1.025rem)] font-normal leading-[1.65] text-slate-600">
              Monitor monthly MIS submissions across backed companies, flag cash runway below 9 months or revenue off plan by more than 25%, and track fund responsiveness on founder asks.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200/80 pt-4 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Plain-rule health bands:</strong> Classified as On track, Slipping, or Gone quiet from report dates and completeness.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-slate-800">Fund analytics (/fund):</strong> Track TVPI, DPI, RVPI, deployment pacing, and export LP quarterly CSV or printable PDF reports.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <span className="text-xs font-medium text-slate-800">Portfolio Health &amp; Fund Analytics · Q4 Pack Ready</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 tabular-nums">
                  6 of 6 MIS Reports Current
                </span>
              </div>

              <div className="space-y-3.5 p-5">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  {[
                    ["Net TVPI", "1.42x", "Across 12 backed companies"],
                    ["RVPI / DPI", "1.28x / 0.14x", "Audited quarterly marks"],
                    ["Runway Watch", "1 Company", "Flagged below 9.0 months"],
                  ].map(([label, val, sub]) => (
                    <div key={label} className="rounded-xl border border-slate-200/80 bg-[#FAF9F6] p-3">
                      <div className="text-[11px] text-slate-500">{label}</div>
                      <div className="mt-1 text-lg font-medium text-slate-800 tabular-nums">{val}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200/80">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-medium text-slate-500">
                      <tr>
                        <th className="px-3.5 py-2">Portfolio Company</th>
                        <th className="px-3.5 py-2">Latest MRR</th>
                        <th className="px-3.5 py-2">Cash Runway</th>
                        <th className="px-3.5 py-2 text-right">Health Band</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white tabular-nums">
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">Ledgerly AI</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$148K (+11.2%)</td>
                        <td className="px-3.5 py-2.5 text-slate-600">18.5 months</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            On Track
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">Kinetix Cloud</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$64K (+8.4%)</td>
                        <td className="px-3.5 py-2.5 font-medium text-rose-700">7.8 months</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            Runway Alert (&lt;9m)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">Vantara Pay</td>
                        <td className="px-3.5 py-2.5 text-slate-600">$210K (+12.8%)</td>
                        <td className="px-3.5 py-2.5 text-slate-600">22.0 months</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            On Track
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkspaceRequestFormClient() {
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqFirm, setReqFirm] = useState("");
  const [reqRole, setReqRole] = useState<string>(BACKGROUND_OPTIONS[0]);
  const [reqIntent, setReqIntent] = useState<string>(INTENT_OPTIONS[0]);
  const [reqNotes, setReqNotes] = useState("");
  const [reqHoneypot, setReqHoneypot] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState(false);

  async function handleWorkspaceRequest(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = reqEmail.trim().toLowerCase();
    if (!reqName.trim()) {
      setReqError("Please enter your full name.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setReqError("Please enter a valid work email address.");
      return;
    }

    setReqLoading(true);
    setReqError(null);

    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reqName.trim(),
          email: trimmedEmail,
          background: reqRole,
          firm: reqFirm.trim(),
          intent: reqIntent,
          additionalContext: reqNotes.trim() || undefined,
          companyWebsite: reqHoneypot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Unable to submit request right now.");
      }
      setReqSuccess(true);
    } catch (err: unknown) {
      setReqError(err instanceof Error ? err.message : "Failed to submit workspace request.");
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm sm:p-8">
      {!reqSuccess ? (
        <form onSubmit={handleWorkspaceRequest} className="space-y-4" noValidate>
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-sans text-base font-medium text-slate-800">Request Fund Workspace Access</h3>
              <p className="mt-1 text-xs text-slate-500">
                For partners, principals, and investment teams at VC funds, family offices, or angel syndicates.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
              Manual Partner Review
            </span>
          </div>

          {reqError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {reqError}
            </div>
          )}

          {/* Honeypot field */}
          <input
            type="text"
            name="companyWebsite"
            value={reqHoneypot}
            onChange={(e) => setReqHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="landing-req-name" className="mb-1.5 block text-xs font-medium text-slate-700">
                Full Name *
              </label>
              <input
                id="landing-req-name"
                type="text"
                required
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="e.g. Kabir Shah"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="landing-req-email" className="mb-1.5 block text-xs font-medium text-slate-700">
                Work Email *
              </label>
              <input
                id="landing-req-email"
                type="email"
                required
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
                placeholder="name@fund.com"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="landing-req-firm" className="mb-1.5 block text-xs font-medium text-slate-700">
                Fund or Organization
              </label>
              <input
                id="landing-req-firm"
                type="text"
                value={reqFirm}
                onChange={(e) => setReqFirm(e.target.value)}
                placeholder="e.g. Horizon Seed Fund"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="landing-req-role" className="mb-1.5 block text-xs font-medium text-slate-700">
                Role
              </label>
              <DropdownSelect
                id="landing-req-role"
                ariaLabel="Role"
                value={reqRole}
                onChange={setReqRole}
                options={BACKGROUND_OPTIONS}
                className="w-full"
                buttonClassName="h-10 rounded-lg border-slate-300 px-3 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="landing-req-intent" className="mb-1.5 block text-xs font-medium text-slate-700">
                Primary Evaluation Focus
              </label>
              <DropdownSelect
                id="landing-req-intent"
                ariaLabel="Primary Evaluation Focus"
                value={reqIntent}
                onChange={setReqIntent}
                options={INTENT_OPTIONS}
                className="w-full"
                buttonClassName="h-10 rounded-lg border-slate-300 px-3 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="landing-req-notes" className="mb-1.5 block text-xs font-medium text-slate-700">
                Additional Context (Optional)
              </label>
              <textarea
                id="landing-req-notes"
                rows={2}
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                placeholder="Share your fund stage focus, monthly deck volume, or specific workflow questions."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
              Privacy note: Your work email and fund details are used solely for manual workspace access review and are never shared with third parties.
            </p>
            <button
              type="submit"
              disabled={reqLoading}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{reqLoading ? "Submitting Request…" : "Request Fund Workspace"}</span>
              {!reqLoading && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 py-6 text-center" role="status" aria-live="polite">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-base font-medium text-emerald-700 ring-1 ring-emerald-200">
            ✓
          </div>
          <div>
            <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
              Status: Pending Manual Review
            </span>
            <h3 className="mt-2 font-sans text-base font-medium text-slate-800">Workspace Access Request Received</h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
              Thank you, <strong className="font-medium text-slate-800">{reqName || reqEmail}</strong>. Your request is now <span className="font-medium text-slate-800">PENDING</span> manual review by an Aarka partner. Once your work email is approved and whitelisted, you can sign in via Google OAuth.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setReqSuccess(false);
                setReqName("");
                setReqEmail("");
                setReqFirm("");
                setReqNotes("");
              }}
              className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Submit another request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
