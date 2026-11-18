"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DropdownSelect } from "@/components/dropdown-select";

interface LightboxAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export interface WorkflowStep {
  num: string;
  stage: string;
  title: string;
  summary: string;
  inputs: string;
  verification: string;
  output: string;
  routeLabel: string;
  metrics: { label: string; value: string; status: "checked" | "flagged" | "claimed" }[];
}

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    num: "01",
    stage: "Pitch Submission & Intake",
    title: "Capture founder decks and financial sheets through one structured intake.",
    summary:
      "Founders submit a PDF pitch deck (up to 32 MB) and an optional monthly CSV sheet through the public pitch form or inbound email webhook. Each submission receives a private, cryptographically signed tracking link.",
    inputs: "PDF pitch deck, optional monthly CSV sheet, stage, sector, and funding ask.",
    verification: "Binary magic-byte file validation and mandate ceiling check (up to $4M).",
    output: "Isolated company record and private founder data room.",
    routeLabel: "/pitch -> /founder/dataroom/[id]",
    metrics: [
      { label: "Deck Binary Check", value: "%PDF-1.7 Validated (4.2 MB)", status: "checked" },
      { label: "Monthly Financials", value: "12-Month CSV Attached", status: "checked" },
      { label: "Founder Tracking Token", value: "HMAC-SHA256 Issued", status: "checked" },
    ],
  },
  {
    num: "02",
    stage: "Source-Cited Structuring",
    title: "Extract deck claims into a standard schema with page and quote provenance.",
    summary:
      "Unstructured slide text, tables, and charts are mapped into a typed company record covering traction, round terms, team background, and market sizing. Every extracted fact retains its source file, slide page number, and verbatim quote.",
    inputs: "Uploaded PDF slides and founder application form fields.",
    verification: "Schema validation across 8 core diligence facts (revenue, growth, customers, team, round, founding year, burn, past roles).",
    output: "Page-cited company record with missing-fact indicators.",
    routeLabel: "/deals/[id] -> Summary & Numbers",
    metrics: [
      { label: "Stated ARR (Slide p. 4)", value: "$1.44M (Quote attached)", status: "claimed" },
      { label: "Stated MoM Growth (Slide p. 6)", value: "14.0% monthly", status: "claimed" },
      { label: "Core Fact Coverage", value: "7 of 8 facts present", status: "checked" },
    ],
  },
  {
    num: "03",
    stage: "Deterministic Math Verification",
    title: "Cross-check stated deck numbers against monthly CSV rows in plain code.",
    summary:
      "Deterministic TypeScript routines compare stated ARR against MRR multiplied by 12, cash runway against cash divided by net burn, and slide growth claims against compounded monthly CSV rows. Variances above 10% are flagged without altering the founder's original numbers.",
    inputs: "Structured deck claims + founder monthly CSV rows + intake form.",
    verification: "Exact arithmetic variance check with a 10.0% tolerance threshold.",
    output: "Provenance labels: Checked, Reported, Claimed, Conflict, or Missing.",
    routeLabel: "/deals/[id]?tab=numbers",
    metrics: [
      { label: "ARR vs. MRR x 12", value: "$1.44M vs. $120K x 12 (0.0% gap)", status: "checked" },
      { label: "Deck vs. CSV Growth", value: "14.0% vs. 9.1% CSV (+53.8% gap)", status: "flagged" },
      { label: "Cash Runway Math", value: "$1.16M / $80K burn = 14.5 mo", status: "checked" },
    ],
  },
  {
    num: "04",
    stage: "Structured Review & Dilution Modeling",
    title: "Evaluate mandate fit, model SAFE or priced dilution, and record partner votes.",
    summary:
      "Code applies your fund's written rules (stage, sector, geography, check size) alongside an interactive Cap Table and Series A pro-rata dilution modeler, side-by-side PDF slide viewer, and partner investment committee voting.",
    inputs: "Verified deal record + configurable fund rules + round terms.",
    verification: "Automated mandate fit check + post-money ownership and pro-rata math.",
    output: "Triage band (Priority, Review, Outside focus) + printable IC diligence memo.",
    routeLabel: "/deals -> /deals/[id]",
    metrics: [
      { label: "Fund Mandate Fit", value: "Seed · B2B Software · $1.5M Ask", status: "checked" },
      { label: "Post-Round Ownership", value: "10.0% on $6.0M Post-Money SAFE", status: "checked" },
      { label: "Partner IC Consensus", value: "2 Yes · 1 Diligence Follow-up", status: "claimed" },
    ],
  },
  {
    num: "05",
    stage: "Portfolio MIS & Re-Engagement",
    title: "Monitor backed companies and track look-again triggers on passed deals.",
    summary:
      "Track monthly MIS reporting deadlines, cash runway under 9 months, and revenue variance against the pitch deck forecast. For passed or held deals, log concrete re-engagement triggers so opportunities resurface when milestones are met.",
    inputs: "Monthly portfolio MIS reports + logged market and company signals.",
    verification: "Automated runway threshold (<9 months) and overdue report day counter.",
    output: "Portfolio health bands, weekly digest alerts, and quarterly LP report exports.",
    routeLabel: "/portfolio & /fund",
    metrics: [
      { label: "MIS Reporting Cadence", value: "6 of 6 reports on time", status: "checked" },
      { label: "Runway Watch Threshold", value: "Alert when < 9.0 months cash", status: "flagged" },
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
  "Testing automated financial checks & ARR verification",
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
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="absolute top-16 right-0 left-0 border-b border-slate-200 bg-white px-4 py-4 shadow-md md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-2">
            <a
              href="#workflow"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Workflow
            </a>
            <a
              href="#capabilities"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Capabilities
            </a>
            <a
              href="#privacy"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Data &amp; Privacy
            </a>
            <a
              href="#request-workspace"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Request Workspace
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <Link
                href="/pitch"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              >
                Submit a Pitch
              </Link>
              <PartnerSignInButton
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
              />
            </div>
          </nav>
        </div>
      )}
    </>
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
    <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start">
      {/* Left Column: Vertically Stacked Workflow Steps */}
      <div className="space-y-4 lg:col-span-6">
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
              className={`cursor-pointer rounded-xl border p-5 transition-colors ${
                isActive
                  ? "border-blue-600 bg-white shadow-sm"
                  : "border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className="cursor-pointer text-left font-mono text-xs font-semibold text-blue-700 focus:outline-none focus-visible:underline"
                >
                  {step.num} · {step.stage}
                </button>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                  {step.routeLabel}
                </span>
              </div>
              <h3 className="mt-2 text-[clamp(1.02rem,0.9vw+0.75rem,1.18rem)] font-semibold leading-[1.3] text-slate-950">
                {step.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.summary}</p>

              {/* Mobile inline step verification details */}
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 lg:hidden">
                {step.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">{m.label}</span>
                    <span className="font-mono font-semibold text-slate-900">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Column: Sticky Live Inspection Card on Desktop */}
      <div className="hidden lg:sticky lg:top-24 lg:col-span-6 lg:block">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Stage {currentStep.num} Inspection
              </span>
              <h3 className="text-sm font-semibold text-slate-950">{currentStep.stage}</h3>
            </div>
            <span className="rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700">
              {currentStep.routeLabel}
            </span>
          </div>

          <div className="space-y-4 p-5 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Inputs Captured
                </div>
                <p className="mt-1 leading-relaxed text-slate-700">{currentStep.inputs}</p>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Deterministic Check
                </div>
                <p className="mt-1 leading-relaxed text-slate-700">{currentStep.verification}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Verification Output Sample
              </div>
              <div className="divide-y divide-slate-100">
                {currentStep.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium text-slate-700">{m.label}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                        m.status === "checked"
                          ? "bg-emerald-50 text-emerald-800"
                          : m.status === "flagged"
                            ? "bg-rose-50 text-rose-800"
                            : "bg-blue-50 text-blue-800"
                      }`}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-900 px-4 py-3 text-white">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-300">Resulting Artifact</div>
                <div className="mt-0.5 text-xs font-medium">{currentStep.output}</div>
              </div>
              <Link
                href="/pitch"
                className="shrink-0 rounded bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-100"
              >
                Try Pitch Intake →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CapabilitiesInteractiveTabs() {
  const [capabilityTab, setCapabilityTab] = useState<"diligence" | "market" | "pipeline" | "portfolio">("diligence");
  const [lightbox, setLightbox] = useState<LightboxAsset | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Workspace Modules
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.65rem,2.5vw+0.75rem,2.35rem)] font-normal leading-[1.15] tracking-[-0.02em] text-slate-950">
            Built for screening, verification, and portfolio oversight.
          </h2>
        </div>

        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-100/80 p-1" role="tablist" aria-label="Workspace modules">
          {(
            [
              ["diligence", "01 · Financial Diligence"],
              ["pipeline", "02 · Deal Pipeline"],
              ["market", "03 · Sector Momentum"],
              ["portfolio", "04 · Portfolio Health"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={capabilityTab === key}
              onClick={() => setCapabilityTab(key)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                capabilityTab === key
                  ? "bg-white text-slate-950 shadow-2xs"
                  : "text-slate-600 hover:text-slate-950"
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
            <span className="font-mono text-xs font-semibold text-blue-700">01 · Financial Due Diligence</span>
            <h3 className="font-serif text-2xl font-normal text-slate-950">
              Audit deck claims against monthly financial sheets before the first call.
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Every company record includes a dedicated Numbers &amp; Checks tab that compares stated slide claims against the founder&apos;s raw monthly CSV rows. Variances greater than 10% are flagged with exact formulas.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200 pt-4 text-xs text-slate-700">
              <li>
                <strong className="font-semibold text-slate-900">Verbatim provenance:</strong> Every claim carries its slide page number and direct quote.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">Side-by-side PDF citation jump:</strong> Click any extracted metric or conflict flag to open the pitch deck at the exact cited slide page.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">Cap table &amp; SAFE modeler:</strong> Simulate post-money SAFE or priced equity dilution, option pool carve-outs, and Series A pro-rata checks.
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/financial-diligence-rahatrail.png",
                    width: 992,
                    height: 675,
                    alt: "Company diligence view showing matched checks, a flagged 14% vs 9.0% monthly growth discrepancy, and missing customer count.",
                    caption: "Company Diligence Record: 5 of 6 checks matched, 1 growth discrepancy (>10%) flagged, and 1 core fact missing.",
                  })
                }
                aria-label="Enlarge Financial Diligence screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/financial-diligence-rahatrail.png"
                  alt="Company diligence view showing matched checks and flagged growth discrepancy"
                  width={992}
                  height={675}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "pipeline" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs font-semibold text-blue-700">02 · Deal-Flow Management</span>
            <h3 className="font-serif text-2xl font-normal text-slate-950">
              List and horizontal board views with live intake sync.
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Organize incoming pitches across New Inbound, Reviewing, Meeting Set, On Hold, and Passed stages. Switch seamlessly between a high-density table and a horizontal stage board.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200 pt-4 text-xs text-slate-700">
              <li>
                <strong className="font-semibold text-slate-900">Signal filters:</strong> Filter by Fits Mandate, Strong Founder Fit, Repeat Founder, Math Gap &gt;10%, or Missing Facts.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">Look-again triggers:</strong> Record pass reasons and scheduled check dates so companies resurface when new signals arrive.
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/dealflow-pulse.png",
                    width: 1012,
                    height: 660,
                    alt: "Deal Flow Pulse pipeline view showing To read, Look again, Meetings, and Passed tabs.",
                    caption: "Deal Flow Pulse (/deals): Triage incoming pitches with rule-fit filters and math-gap alerts.",
                  })
                }
                aria-label="Enlarge Deal Pipeline screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/dealflow-pulse.png"
                  alt="Deal Flow Pulse pipeline view"
                  width={1012}
                  height={660}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "market" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs font-semibold text-blue-700">03 · Sector Momentum</span>
            <h3 className="font-serif text-2xl font-normal text-slate-950">
              Track inbound volume and median ask across your fund&apos;s own deal flow.
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Compare 3-month vs. prior 3-month pitch activity across sectors, inspect median round sizes and monthly growth rates, and log dated external market signals with verifiable links.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200 pt-4 text-xs text-slate-700">
              <li>
                <strong className="font-semibold text-slate-900">Cohort windowing:</strong> Toggle between 3-month, 6-month, and 12-month windows.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">Traceable counts:</strong> Every percentage move shows the underlying deck count so low-sample sectors are never misread.
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/market-Intelligence.png",
                    width: 1003,
                    height: 851,
                    alt: "Market sector intelligence view comparing inbound deck activity across sectors.",
                    caption: "Market Overview (/sectors): Sector momentum calculated from your fund's own inbound decks and logged signals.",
                  })
                }
                aria-label="Enlarge Sector Momentum screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/market-Intelligence.png"
                  alt="Market sector intelligence view"
                  width={1003}
                  height={851}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {capabilityTab === "portfolio" && (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs font-semibold text-blue-700">04 · Portfolio &amp; Fund Analytics</span>
            <h3 className="font-serif text-2xl font-normal text-slate-950">
              Two-way reporting health, runway alerts, and LP quarterly packs.
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Monitor monthly MIS submissions across backed companies, flag cash runway below 9 months or revenue off plan by more than 25%, and track fund responsiveness on founder requests.
            </p>
            <ul className="space-y-2.5 border-t border-slate-200 pt-4 text-xs text-slate-700">
              <li>
                <strong className="font-semibold text-slate-900">Plain-rule health bands:</strong> Classified as On track, Slipping, or Gone quiet from report dates and completeness.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">Fund analytics (/fund):</strong> Track TVPI, DPI, RVPI, capital deployment pacing, and export LP quarterly CSV or printable PDF reports.
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/portfolio-command.png",
                    width: 1007,
                    height: 851,
                    alt: "Portfolio view showing backed companies, cash runway months, and MIS reporting status.",
                    caption: "Portfolio Oversight (/portfolio): Runway watch, MIS report cadence, and open founder asks.",
                  })
                }
                aria-label="Enlarge Portfolio Health screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/portfolio-command.png"
                  alt="Portfolio view showing backed companies and MIS reporting status"
                  width={1007}
                  height={851}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs sm:p-6"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="text-xs font-medium text-slate-700">{lightbox.caption}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close (Esc)
              </button>
            </div>
            <div className="overflow-auto bg-slate-100/80 p-3 sm:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                width={lightbox.width}
                height={lightbox.height}
                className="mx-auto block h-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </>
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {!reqSuccess ? (
        <form onSubmit={handleWorkspaceRequest} className="space-y-4" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Request Fund Workspace Access</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Requests are saved with PENDING status and reviewed manually by an Aarka partner.
              </p>
            </div>
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-800">
              Invite-Only Waitlist
            </span>
          </div>

          {reqError && (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                buttonClassName="h-10 rounded-md border-slate-300 px-3 text-sm"
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
                buttonClassName="h-10 rounded-md border-slate-300 px-3 text-sm"
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
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-slate-600">
              Submitting records a pending request. Access is granted after partner whitelist approval.
            </p>
            <button
              type="submit"
              disabled={reqLoading}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{reqLoading ? "Submitting Request…" : "Request Fund Workspace"}</span>
              {!reqLoading && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 py-6 text-center" role="status" aria-live="polite">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-emerald-700 ring-1 ring-emerald-200">
            ✓
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-950">Workspace Access Request Logged</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
              Thank you, <strong className="font-semibold text-slate-900">{reqName || reqEmail}</strong>. Your request has been recorded with <span className="font-mono font-semibold">PENDING</span> status and sent for partner review. Once your email is whitelisted, you will be able to sign in via Google OAuth.
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
              className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Submit another request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
