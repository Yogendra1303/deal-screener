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

export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      return;
    }

    setRevealed(false);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -48px 0px", threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out ${
        revealed ? "opacity-100 translate-y-0" : "motion-safe:opacity-0 motion-safe:translate-y-3"
      } ${className}`}
    >
      {children}
    </div>
  );
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
      "Capture founder decks and monthly financial sheets through one structured intake. Every submission issues a private, trackable data room link.",
    inputs: "PDF pitch deck, optional monthly CSV sheet, stage, sector, and funding ask.",
    verification: "Automated file integrity check and mandate ceiling check (up to $4M).",
    output: "Isolated company record and private founder data room.",
    routeLabel: "Founder Intake",
    metrics: [
      { label: "Pitch Deck Check", value: "PDF Validated (4.2 MB)", status: "checked" },
      { label: "Monthly Financials", value: "12-Month CSV Attached", status: "checked" },
      { label: "Founder Tracking Link", value: "Private Token Issued", status: "checked" },
    ],
  },
  {
    num: "02",
    stage: "Source-Cited Structuring",
    title: "Extract deck claims into a standard schema with page and quote provenance.",
    summary:
      "Map unstructured slide text, tables, and charts into a standardized deal record. Every extracted figure links back to its exact slide page and verbatim quote.",
    inputs: "Uploaded PDF slides and founder application form fields.",
    verification: "Structured coverage check across 8 core diligence facts (revenue, growth, customers, team, round, founding year, burn, past roles).",
    output: "Page-cited company record with missing-fact indicators.",
    routeLabel: "Source Citations",
    metrics: [
      { label: "Stated ARR (Slide p. 4)", value: "$1.44M (Quote attached)", status: "claimed" },
      { label: "Stated MoM Growth (Slide p. 6)", value: "14.0% monthly", status: "claimed" },
      { label: "Core Fact Coverage", value: "7 of 8 facts present", status: "checked" },
    ],
  },
  {
    num: "03",
    stage: "Deterministic Financial Checks",
    title: "Cross-check stated deck numbers against monthly CSV rows automatically.",
    summary:
      "Cross-check stated ARR, runway, and growth rates against submitted monthly CSV rows. Variances above your fund's threshold are flagged automatically with exact formulas.",
    inputs: "Structured deck claims + founder monthly CSV rows + intake form.",
    verification: "Exact arithmetic cross-check with a 10.0% default tolerance threshold.",
    output: "Provenance labels: Arithmetic Checked, Reported, Claimed, Conflict, or Missing.",
    routeLabel: "Financial Cross-Check",
    metrics: [
      { label: "ARR vs. MRR x 12", value: "$1.44M vs. $120K x 12 (0.0% gap)", status: "checked" },
      { label: "Deck vs. CSV Growth", value: "14.0% vs. 9.1% CSV (+53.8% gap)", status: "flagged" },
      { label: "Cash Runway Math", value: "$1.16M / $80K burn = 14.5 mo", status: "checked" },
    ],
  },
  {
    num: "04",
    stage: "Investment Review & Dilution",
    title: "Evaluate mandate fit, model SAFE or priced dilution, and record partner votes.",
    summary:
      "Evaluate mandate fit, model SAFE or priced-round dilution with visible assumptions, and record partner IC votes in one place.",
    inputs: "Corroborated deal record + configurable fund rules + round terms.",
    verification: "Automated mandate fit check + post-money ownership and pro-rata math.",
    output: "Triage band (Priority, Review, Outside focus) + printable IC diligence memo.",
    routeLabel: "IC Review",
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
      "Track monthly portfolio reporting cadence, runway alerts, and look-again triggers for passed deals.",
    inputs: "Monthly portfolio MIS reports + logged market and company signals.",
    verification: "Automated runway threshold (<9 months) and overdue report day counter.",
    output: "Portfolio health bands, weekly digest alerts, and quarterly LP report exports.",
    routeLabel: "Portfolio MIS",
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
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    toggleBtnRef.current?.focus();
  }

  return (
    <>
      <button
        ref={toggleBtnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 motion-safe:transition-colors motion-safe:duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={closeMenu}
            className="fixed inset-x-0 top-16 bottom-0 z-30 bg-slate-950/25 backdrop-blur-[1px] md:hidden"
          />
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-label="Mobile navigation"
            className="aarka-panel-enter absolute top-16 right-0 left-0 z-40 border-b border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              <a
                ref={firstLinkRef}
                href="#workflow"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-700 motion-safe:transition-colors hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Workflow
              </a>
              <a
                href="#capabilities"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-700 motion-safe:transition-colors hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Capabilities
              </a>
              <a
                href="#privacy"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-700 motion-safe:transition-colors hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Data &amp; Privacy
              </a>
              <a
                href="#request-workspace"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-700 motion-safe:transition-colors hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Request Workspace
              </a>
              <div className="mt-2 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3">
                <Link
                  href="/pitch"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Submit a Pitch
                </Link>
                <PartnerSignInButton
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                />
              </div>
            </nav>
          </div>
        </>
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
      {/* Left Column: Connected Vertical Timeline (Cleanly Expanded on Mobile, Interactive on Desktop) */}
      <div className="relative pl-7 sm:pl-9 lg:col-span-6">
        {/* Subtle Vertical SVG Connector Rail linking 01 -> 05 */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-6 bottom-6 left-[11px] h-[calc(100%-3rem)] w-0.5 text-slate-300 sm:left-[15px]"
          preserveAspectRatio="none"
          viewBox="0 0 2 100"
        >
          <line x1="1" y1="0" x2="1" y2="100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>

        <div className="space-y-4">
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
                className="relative"
              >
                {/* Timeline Step Connector Node */}
                <span
                  aria-hidden="true"
                  className={`absolute top-5 -left-7 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-semibold motion-safe:transition-colors motion-safe:duration-200 sm:-left-9 sm:h-7 sm:w-7 ${
                    isActive
                      ? "border-blue-600 bg-blue-600 text-white shadow-2xs"
                      : "border-slate-300 bg-[#FAF9F6] text-slate-600"
                  }`}
                >
                  {step.num}
                </span>

                <div
                  className={`cursor-pointer rounded-xl border p-4 motion-safe:transition-all motion-safe:duration-200 sm:p-5 ${
                    isActive
                      ? "border-blue-600 bg-white shadow-sm"
                      : "border-slate-200/90 bg-white/85 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep(idx)}
                      className="cursor-pointer text-left font-mono text-xs font-semibold text-blue-700 focus:outline-none focus-visible:underline"
                    >
                      {step.num} · {step.stage}
                    </button>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                      {step.routeLabel}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[clamp(1rem,0.9vw+0.75rem,1.18rem)] font-semibold leading-[1.3] text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{step.summary}</p>

                  {/* Mobile Inline Stage Inspection & Output Preview (Zero Sticky Trapping) */}
                  <div className="mt-3.5 space-y-2.5 border-t border-slate-100 pt-3 lg:hidden">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Cross-Check Output Sample
                      </div>
                      <div className="mt-2 space-y-2">
                        {step.metrics.map((m) => (
                          <div key={m.label} className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-medium text-slate-700">{m.label}</span>
                            <span
                              className={`inline-block w-fit max-w-full break-words rounded px-2 py-0.5 font-mono text-xs font-semibold ${
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
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white">
                      <span className="min-w-0 text-slate-200">{step.output}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Sticky Live Inspection Card on Desktop */}
      <div className="hidden lg:sticky lg:top-24 lg:col-span-6 lg:block">
        <div
          key={currentStep.num}
          className="aarka-panel-enter overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="min-w-0">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Stage {currentStep.num} Inspection
              </span>
              <h3 className="text-sm font-semibold text-slate-950">{currentStep.stage}</h3>
            </div>
            <span className="shrink-0 rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700">
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
                Cross-Check Output Sample
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

            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-slate-300">Resulting Artifact</div>
                <div className="mt-0.5 text-xs font-medium">{currentStep.output}</div>
              </div>
              <Link
                href="/pitch"
                className="shrink-0 rounded bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 motion-safe:transition-colors motion-safe:duration-200 hover:bg-slate-100"
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
      <div className="space-y-6">
        <div className="w-full">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Workspace Modules
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.5rem,1.75vw+0.5rem,2.2rem)] font-normal leading-[1.2] tracking-[-0.02em] text-slate-950 lg:whitespace-nowrap">
            Built for screening, financial cross-checks, and portfolio oversight.
          </h2>
        </div>

        {/* Clean 4-Column Clickable Module Selector Directly Below Heading */}
        <div
          className="grid w-full grid-cols-2 gap-2.5 lg:grid-cols-4"
          role="tablist"
          aria-label="Workspace modules"
        >
          {(
            [
              ["diligence", "01", "Financial Diligence", "Audit deck claims vs. CSVs"],
              ["pipeline", "02", "Deal Pipeline", "Triage & stage boards"],
              ["market", "03", "Sector Momentum", "Track inbound sector trends"],
              ["portfolio", "04", "Portfolio Health", "MIS cadence & LP packs"],
            ] as const
          ).map(([key, num, title, sub]) => {
            const active = capabilityTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCapabilityTab(key)}
                className={`flex min-h-[68px] cursor-pointer flex-col items-start justify-between rounded-xl border px-4 py-3 text-left motion-safe:transition-all motion-safe:duration-200 ${
                  active
                    ? "border-blue-600 bg-white shadow-sm ring-1 ring-blue-600/15"
                    : "border-slate-200/90 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[11px] font-semibold ${
                      active ? "text-blue-700" : "text-slate-500"
                    }`}
                  >
                    {num}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full motion-safe:transition-colors ${
                      active ? "bg-blue-600" : "bg-slate-300"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-1.5">
                  <div className={`text-xs font-semibold sm:text-[13px] ${active ? "text-slate-950" : "text-slate-700"}`}>
                    {title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {capabilityTab === "diligence" && (
        <div key="diligence" className="aarka-panel-enter mt-8 grid items-center gap-8 lg:grid-cols-12">
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md">
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
        <div key="pipeline" className="aarka-panel-enter mt-8 grid items-center gap-8 lg:grid-cols-12">
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md">
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
        <div key="market" className="aarka-panel-enter mt-8 grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs font-semibold text-blue-700">03 · Sector Momentum</span>
            <h3 className="font-serif text-2xl font-normal text-slate-950">
              Track inbound volume and median ask across your fund&apos;s own deal flow.
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              Compare 3-month vs. prior 3-month pitch activity across sectors, inspect median round sizes and monthly growth rates, and log dated external market signals with source-cited links.
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/market-momentum-map.png",
                    width: 992,
                    height: 658,
                    alt: "Market sector intelligence view comparing inbound deck activity across sectors.",
                    caption: "Market Overview (/sectors): Sector momentum calculated from your fund's own inbound decks and logged signals.",
                  })
                }
                aria-label="Enlarge Sector Momentum screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/market-momentum-map.png"
                  alt="Market sector intelligence view"
                  width={992}
                  height={658}
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
        <div key="portfolio" className="aarka-panel-enter mt-8 grid items-center gap-8 lg:grid-cols-12">
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-md">
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    src: "/images/aarka/portfolio-overview.png",
                    width: 1024,
                    height: 555,
                    alt: "Portfolio view showing backed companies, cash runway months, and MIS reporting status.",
                    caption: "Portfolio Oversight (/portfolio): Runway watch, MIS report cadence, and open founder asks.",
                  })
                }
                aria-label="Enlarge Portfolio Health screenshot"
                className="block w-full cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/aarka/portfolio-overview.png"
                  alt="Portfolio view showing backed companies and MIS reporting status"
                  width={1024}
                  height={555}
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
            className="aarka-panel-enter relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="min-w-0 text-xs font-medium text-slate-700">{lightbox.caption}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      {!reqSuccess ? (
        <form onSubmit={handleWorkspaceRequest} className="flex flex-1 flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-950">Request Fund Workspace Access</h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Requests are saved with PENDING status and reviewed manually by an Aarka partner.
              </p>
            </div>
            <span className="w-fit shrink-0 whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-800">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:h-10"
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
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:h-10"
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
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:h-10"
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
                buttonClassName="h-11 rounded-md border-slate-300 px-3 text-sm sm:h-10"
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
                buttonClassName="h-11 rounded-md border-slate-300 px-3 text-sm sm:h-10"
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

          <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-600 sm:text-[11px]">
              Submitting records a pending request. Access is granted after partner whitelist approval.
            </p>
            <button
              type="submit"
              disabled={reqLoading}
              className="inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-xs font-semibold text-white shadow-xs motion-safe:transition-all motion-safe:duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:min-h-0 sm:w-auto"
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
              className="min-h-[44px] cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:min-h-0"
            >
              Submit another request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
