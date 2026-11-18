"use client";

import Image from "next/image";
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
  routeLabel: string;
  visualTitle: string;
  visualSubtitle: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  imageCaption: string;
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
    imageSrc: "/images/aarka/founder-pitch-portal.png",
    imageWidth: 605,
    imageHeight: 657,
    imageAlt: "Founder pitch portal intake form",
    imageCaption: "Founder Pitch Intake (/pitch): Direct PDF deck and financial sheet submission.",
    metrics: [
      { label: "Pitch Deck File", value: "%PDF-1.7 Validated (4.2 MB)", status: "checked" },
      { label: "Financial Sheet", value: "12-Month CSV Attached", status: "checked" },
      { label: "Private Status Link", value: "Per-Deal Token Issued", status: "checked" },
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
    imageSrc: "/images/aarka/data-transparency-lineage.png",
    imageWidth: 998,
    imageHeight: 655,
    imageAlt: "Source-cited data lineage view",
    imageCaption: "Data Lineage (/sources): End-to-end provenance from uploaded files to verified team views.",
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
    imageSrc: "/images/aarka/financial-diligence-rahatrail.png",
    imageWidth: 992,
    imageHeight: 675,
    imageAlt: "Financial diligence checks view",
    imageCaption: "Financial Diligence (/deals/[id]): 5 of 6 checks corroborated, 1 growth discrepancy (>10%) flagged.",
    metrics: [
      { label: "ARR vs. CSV MRR x 12", value: "$1.44M vs. $120K x 12 (0.0% gap)", status: "checked" },
      { label: "Deck vs. CSV Growth", value: "14.0% vs. 9.1% CSV (53.8% discrepancy flagged)", status: "flagged" },
      { label: "Cash Runway Math", value: "$1.16M / $80K burn = 14.5 mo", status: "checked" },
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
    imageSrc: "/images/aarka/dealflow-pulse.png",
    imageWidth: 1012,
    imageHeight: 660,
    imageAlt: "Deal pipeline and investment review workspace",
    imageCaption: "Deal Pipeline (/deals): Triage incoming pitches with rule-fit filters and discrepancy alerts.",
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
    imageSrc: "/images/aarka/portfolio-overview.png",
    imageWidth: 1024,
    imageHeight: 555,
    imageAlt: "Portfolio MIS reporting health and runway overview",
    imageCaption: "Portfolio Monitoring (/portfolio): Runway watch, MIS report cadence, and open founder asks.",
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

function ScreenshotLightbox({
  lightbox,
  onClose,
}: {
  lightbox: LightboxAsset | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, onClose]);

  if (!lightbox) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lightbox.alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs font-medium text-slate-700">{lightbox.caption}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close (Esc)
          </button>
        </div>
        <div className="overflow-auto bg-slate-100/80 p-3 sm:p-5">
          <Image
            src={lightbox.src}
            alt={lightbox.alt}
            width={lightbox.width}
            height={lightbox.height}
            sizes="95vw"
            className="mx-auto block h-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
          />
        </div>
      </div>
    </div>
  );
}

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
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
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
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Platform · Workflow
            </a>
            <a
              href="#capabilities"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Platform · Capabilities
            </a>
            <a
              href="#for-founders"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              For Founders
            </a>
            <a
              href="#request-workspace"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              For Funds
            </a>
            <a
              href="#privacy"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Data &amp; Privacy
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <PartnerSignInButton
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              />
              <a
                href="#request-workspace"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white"
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

export function WorkflowInteractiveGrid() {
  const [activeStep, setActiveStep] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxAsset | null>(null);
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
      <div className="rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-2xs">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCompleted = idx < activeStep;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-[#0F172A] text-white shadow-xs"
                    : isCompleted
                      ? "bg-slate-50 text-slate-800 hover:bg-slate-100"
                      : "bg-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      isActive ? "text-blue-300" : isCompleted ? "text-blue-700" : "text-slate-500"
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
        {/* Left Column: Clean 5-Stage Narrative */}
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
                className={`cursor-pointer rounded-xl border p-4 transition-colors sm:p-5 ${
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
                <h3 className="mt-1.5 font-sans text-base font-semibold leading-[1.3] tracking-[-0.015em] text-balance text-[#0F172A]">
                  {step.title}
                </h3>
                <p className="mt-1.5 font-sans text-sm font-normal leading-[1.6] text-slate-600">
                  {step.summary}
                </p>

                {/* Mobile inline stage metrics */}
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 lg:hidden">
                  {step.metrics.map((m) => (
                    <div key={m.label} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-600">{m.label}</span>
                      <span className="font-mono font-medium text-[#0F172A]">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Sticky Browser-Framed Dashboard Screenshot & Check Summary on Desktop */}
        <div className="hidden lg:sticky lg:top-24 lg:col-span-7 lg:block">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
            {/* Browser Chrome Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="ml-2 rounded border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-600">
                  {currentStep.routeLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : WORKFLOW_STEPS.length - 1))}
                  aria-label="Previous workflow stage"
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) % WORKFLOW_STEPS.length)}
                  aria-label="Next workflow stage"
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <span>Next Stage</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-sans text-sm font-semibold text-[#0F172A]">{currentStep.visualTitle}</h3>
                  <p className="mt-0.5 text-xs text-slate-600">{currentStep.visualSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: currentStep.imageSrc,
                      width: currentStep.imageWidth,
                      height: currentStep.imageHeight,
                      alt: currentStep.imageAlt,
                      caption: currentStep.imageCaption,
                    })
                  }
                  className="shrink-0 cursor-pointer text-[11px] font-medium text-slate-600 hover:text-[#0F172A]"
                >
                  Enlarge ↗
                </button>
              </div>

              {/* Authentic Product Dashboard Screenshot */}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: currentStep.imageSrc,
                      width: currentStep.imageWidth,
                      height: currentStep.imageHeight,
                      alt: currentStep.imageAlt,
                      caption: currentStep.imageCaption,
                    })
                  }
                  aria-label={`Enlarge ${currentStep.visualTitle} screenshot`}
                  className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                >
                  <Image
                    src={currentStep.imageSrc}
                    alt={currentStep.imageAlt}
                    width={currentStep.imageWidth}
                    height={currentStep.imageHeight}
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    loading="lazy"
                    className="block max-h-[320px] w-full object-cover object-top"
                  />
                </button>
              </div>

              {/* Stage Check Output Strip */}
              <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3.5 py-1 text-xs">
                {currentStep.metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium text-slate-700">{m.label}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
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
          </div>
        </div>
      </div>

      <ScreenshotLightbox lightbox={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

interface CapabilityModule {
  key: "diligence" | "pipeline" | "review" | "portfolio";
  tabLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: { heading: string; text: string }[];
  routeLabel: string;
  screenshot: LightboxAsset;
}

const CAPABILITY_MODULES: readonly CapabilityModule[] = [
  {
    key: "diligence",
    tabLabel: "Financial Diligence",
    eyebrow: "01 · Financial Diligence",
    title: "Spot arithmetic gaps between slide claims and monthly CSV rows before the first call.",
    description:
      "Compare stated ARR, monthly growth, and runway against submitted CSV rows. Variances above the 10.0% default threshold (configurable per fund rule) are flagged with exact formulas.",
    bullets: [
      {
        heading: "Verbatim slide provenance:",
        text: "Click any extracted metric to open the PDF deck at the cited slide page.",
      },
      {
        heading: "Explicit SAFE & equity assumptions:",
        text: "Model dilution with visible terms (Post-Money SAFE, $6.0M cap, 0% discount, 10.0% option pool).",
      },
    ],
    routeLabel: "aarkavc.xyz/deals/rahatrail",
    screenshot: {
      src: "/images/aarka/financial-diligence-rahatrail.png",
      width: 992,
      height: 675,
      alt: "Company diligence view showing corroborated checks, a flagged 14% vs 9.0% monthly growth discrepancy, and missing customer count.",
      caption:
        "Financial Diligence (/deals/[id]): 5 of 6 checks corroborated, 1 growth discrepancy (>10% default threshold) flagged.",
    },
  },
  {
    key: "pipeline",
    tabLabel: "Deal Pipeline",
    eyebrow: "02 · Deal Pipeline",
    title: "Triage every inbound deck across list and horizontal stage boards.",
    description:
      "Organize submissions across New Inbound, Reviewing, Meeting Set, On Hold, and Passed stages with live intake sync and one-click CSV exports.",
    bullets: [
      {
        heading: "Mandate & discrepancy filters:",
        text: "Filter by Fits Mandate, Strong Founder Fit, Discrepancy >10% (default rule), or Missing Facts.",
      },
      {
        heading: "Look-again triggers:",
        text: "Record pass reasons and check dates so companies resurface when milestones are met.",
      },
    ],
    routeLabel: "aarkavc.xyz/deals",
    screenshot: {
      src: "/images/aarka/dealflow-pulse.png",
      width: 1012,
      height: 660,
      alt: "Deal Flow Pulse pipeline view showing To read, Look again, Meetings, and Passed tabs.",
      caption:
        "Deal Pipeline (/deals): Triage incoming pitches with rule-fit filters and discrepancy alerts.",
    },
  },
  {
    key: "review",
    tabLabel: "Investment Review",
    eyebrow: "03 · Investment Review",
    title: "Benchmark sector cohorts and document partner IC decisions with an audit trail.",
    description:
      "Compare incoming opportunities against 3-month, 6-month, and 12-month sector cohorts, record partner votes, and preserve written rationales when overriding code scores.",
    bullets: [
      {
        heading: "Traceable cohort counts:",
        text: "Every sector trend displays the underlying deck count and median round ask.",
      },
      {
        heading: "Partner IC voting & memos:",
        text: "Capture Yes, No, or Discuss votes and export printable diligence memos.",
      },
    ],
    routeLabel: "aarkavc.xyz/sectors",
    screenshot: {
      src: "/images/aarka/market-momentum-map.png",
      width: 992,
      height: 658,
      alt: "Market sector intelligence view comparing inbound deck activity across sectors.",
      caption:
        "Investment Review & Sector Cohorts (/sectors & /compare): Benchmark deal flow across your fund's own submissions.",
    },
  },
  {
    key: "portfolio",
    tabLabel: "Portfolio Monitoring",
    eyebrow: "04 · Portfolio Monitoring",
    title: "Track monthly MIS reporting health, cash runway alerts, and LP quarterly packs.",
    description:
      "Monitor monthly MIS submissions across backed companies, flag cash runway below 9 months or revenue off plan by more than 25%, and track fund responsiveness on founder asks.",
    bullets: [
      {
        heading: "Plain-rule health bands:",
        text: "Classified as On track, Slipping, or Gone quiet from report dates and completeness.",
      },
      {
        heading: "Fund analytics (/fund):",
        text: "Track TVPI, DPI, RVPI, deployment pacing, and export LP quarterly CSV or printable PDF reports.",
      },
    ],
    routeLabel: "aarkavc.xyz/portfolio",
    screenshot: {
      src: "/images/aarka/portfolio-overview.png",
      width: 1024,
      height: 555,
      alt: "Portfolio view showing backed companies, cash runway months, and MIS reporting status.",
      caption:
        "Portfolio Monitoring (/portfolio): Runway watch, MIS report cadence, and open founder asks.",
    },
  },
] as const;

export function CapabilitiesInteractiveTabs() {
  const [capabilityTab, setCapabilityTab] = useState<"diligence" | "pipeline" | "review" | "portfolio">("diligence");
  const [lightbox, setLightbox] = useState<LightboxAsset | null>(null);

  const activeModule = CAPABILITY_MODULES.find((m) => m.key === capabilityTab) ?? CAPABILITY_MODULES[0];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            Platform Capabilities
          </p>
          <h2 className="mt-2 max-w-[24ch] font-serif text-[clamp(1.75rem,2.6vw+0.85rem,2.65rem)] font-normal leading-[1.12] tracking-[-0.02em] text-balance text-[#0F172A]">
            Four modules built for structured investment review.
          </h2>
        </div>

        <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-100/80 p-1" role="tablist" aria-label="Platform capabilities">
          {CAPABILITY_MODULES.map((mod) => (
            <button
              key={mod.key}
              type="button"
              role="tab"
              aria-selected={capabilityTab === mod.key}
              onClick={() => setCapabilityTab(mod.key)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                capabilityTab === mod.key
                  ? "bg-white text-[#0F172A] shadow-2xs"
                  : "text-slate-600 hover:text-[#0F172A]"
              }`}
            >
              {mod.tabLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
        <div className="space-y-3.5 lg:col-span-5">
          <span className="font-mono text-xs font-semibold text-blue-700">{activeModule.eyebrow}</span>
          <h3 className="font-serif text-[clamp(1.45rem,1.2vw+0.95rem,1.85rem)] font-normal leading-[1.18] tracking-[-0.015em] text-balance text-[#0F172A]">
            {activeModule.title}
          </h3>
          <p className="max-w-[54ch] font-sans text-[clamp(0.95rem,0.2vw+0.9rem,1.025rem)] font-normal leading-[1.6] text-slate-600">
            {activeModule.description}
          </p>
          <ul className="space-y-2.5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-700">
            {activeModule.bullets.map((b) => (
              <li key={b.heading}>
                <strong className="font-semibold text-[#0F172A]">{b.heading}</strong> {b.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-900/5">
            {/* Clean Browser-Style Frame Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="ml-2 rounded border border-slate-200/90 bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-600">
                  {activeModule.routeLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(activeModule.screenshot)}
                className="cursor-pointer text-[11px] font-medium text-slate-600 hover:text-[#0F172A]"
              >
                Click to enlarge ↗
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLightbox(activeModule.screenshot)}
              aria-label={`Enlarge ${activeModule.tabLabel} screenshot`}
              className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
            >
              <Image
                src={activeModule.screenshot.src}
                alt={activeModule.screenshot.alt}
                width={activeModule.screenshot.width}
                height={activeModule.screenshot.height}
                sizes="(min-width: 1024px) 58vw, 100vw"
                loading="lazy"
                className="block h-auto w-full object-contain"
              />
            </button>
          </div>
        </div>
      </div>

      <ScreenshotLightbox lightbox={lightbox} onClose={() => setLightbox(null)} />
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
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-sans text-base font-semibold text-[#0F172A]">Request Fund Workspace Access</h3>
              <p className="mt-1 text-xs text-slate-600">
                For partners, principals, and investment teams at VC funds, family offices, or angel syndicates.
              </p>
            </div>
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-800">
              Manual Partner Review
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
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
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-[11px] leading-relaxed text-slate-600">
              Privacy note: Your work email and fund details are used solely for manual workspace access review and are never shared with third parties.
            </p>
            <button
              type="submit"
              disabled={reqLoading}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
            <span className="inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-900">
              Status: Pending Manual Review
            </span>
            <h3 className="mt-2 font-sans text-base font-semibold text-[#0F172A]">Workspace Access Request Received</h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
              Thank you, <strong className="font-semibold text-[#0F172A]">{reqName || reqEmail}</strong>. Your request is now <span className="font-mono font-semibold text-[#0F172A]">PENDING</span> manual review by an Aarka partner. Once your work email is approved and whitelisted, you can sign in via Google OAuth.
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
