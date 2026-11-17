"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface LightboxAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Capture",
    href: "#teams",
    body: "Founders submit pitch decks and monthly financial sheets through a single public link or analyst request—stored as received in the company data room.",
  },
  {
    num: "02",
    title: "Structure",
    href: "#difference",
    body: "AI reads unstructured deck pages, charts and tables into one standardised company record, attaching the file, page number and a verbatim quote to every claim.",
  },
  {
    num: "03",
    title: "Validate",
    href: "#diligence",
    body: "Deterministic code checks ARR against MRR, cash runway against net burn, and deck figures against monthly CSV rows—flagging any discrepancy over 10%.",
  },
  {
    num: "04",
    title: "Evaluate",
    href: "#dealflow",
    body: "Code applies your fund’s written rules (stage, sector, geography, round size) alongside traction and founder-fit assessments to sort opportunities clearly.",
  },
  {
    num: "05",
    title: "Monitor",
    href: "#portfolio",
    body: "Track re-engagement triggers on passed deals and monitor monthly MIS reporting, cash runway and plan variance across every portfolio company.",
  },
] as const;

const DILIGENCE_POINTS = [
  {
    label: "Revenue & growth checks",
    detail: "Compares deck-stated revenue and monthly growth against compounded figures from the monthly CSV sheet.",
  },
  {
    label: "Runway & burn calculations",
    detail: "Verifies stated runway months by dividing latest reported cash in bank by net monthly burn.",
  },
  {
    label: "Missing company information",
    detail: "Surfaces core facts omitted from a submission—such as customer count or cash balance—before the first call.",
  },
  {
    label: "Source-backed evidence",
    detail: "Links every figure to its underlying Deck summary, Monthly sheet, Financial snapshot, Intake form and Audit report.",
  },
  {
    label: "Financial discrepancies",
    detail: "Flags >10% variances between sources while keeping the founder’s original stated numbers intact.",
  },
  {
    label: "Founder experience assessment",
    detail: "Reviews operating history tied directly to the problem without using school or demographic proxies.",
  },
] as const;

const MARKET_POINTS = [
  {
    label: "Sector momentum",
    detail: "Classifies sectors as Heating up, Crowding, Steady or Cooling using a transparent ±15% code rule.",
  },
  {
    label: "Incoming pitch patterns",
    detail: "Compares the last 3 months of inbound decks against the prior 3-month window across every tracked category.",
  },
  {
    label: "Market funding comparisons",
    detail: "Plots your fund’s inbound pitch velocity against 90-day capital raised across the broader market.",
  },
  {
    label: "Company & sector drilldowns",
    detail: "Inspect cohort conversion from pitched to meeting alongside founder-market fit distributions inside each sector.",
  },
] as const;

const DEALFLOW_POINTS = [
  {
    label: "To Read",
    detail: "Unreviewed inbound decks ordered by fund-rule fit, founder fit and days waiting.",
  },
  {
    label: "Look Again",
    detail: "Passed or on-hold companies that hit a scheduled check date or a logged news trigger.",
  },
  {
    label: "Meetings",
    detail: "Active first calls and diligence workstreams in progress across the investment team.",
  },
  {
    label: "Passed",
    detail: "Permanent institutional record of passed deals with structured reasons and re-engagement dates.",
  },
  {
    label: "Team assignments",
    detail: "Clear analyst and partner ownership so no inbound deck goes unopened.",
  },
  {
    label: "Pipeline visibility",
    detail: "Instant filters for Strong Founder Fit, Math Gap >10%, Missing Facts and Never Opened decks.",
  },
] as const;

const PORTFOLIO_POINTS = [
  {
    label: "Revenue & growth against plan",
    detail: "Compares latest monthly MIS revenue directly against the trajectory promised in the original pitch deck.",
  },
  {
    label: "Cash runway & burn",
    detail: "Computes months of cash remaining at latest net burn and highlights any company under 9 months of runway.",
  },
  {
    label: "Reporting gaps",
    detail: "Tracks overdue or incomplete monthly MIS reports and documents owed to the fund.",
  },
  {
    label: "Company health indicators",
    detail: "Assigns Needs help, Watch or Healthy status from deterministic rules on runway, reporting and plan variance.",
  },
] as const;

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [diligenceTab, setDiligenceTab] = useState<"audit" | "compare">("audit");
  const [marketTab, setMarketTab] = useState<"momentum" | "sector">("momentum");
  const [lightbox, setLightbox] = useState<LightboxAsset | null>(null);

  useEffect(() => {
    if (!lightbox && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, mobileMenuOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F7F5F0] text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* =====================================================================
          SECTION A — NAVIGATION
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B101B]/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
            <Image
              src="/aarka-logo.png"
              alt="Aarka"
              width={28}
              height={28}
              unoptimized
              className="h-7 w-7 shrink-0 rounded-md object-contain ring-1 ring-white/15"
            />
            <span className="text-[15px] font-semibold tracking-tight text-white">Aarka</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            <a href="#workflow" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              Platform
            </a>
            <a href="#diligence" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              Capabilities
            </a>
            <a href="#difference" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              How it works
            </a>
            <a href="#teams" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
              For investment teams
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-md border border-white/20 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.1]"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-2xs transition-colors hover:bg-blue-500"
            >
              <span>Request Early Access</span>
              <span aria-hidden className="text-blue-200">→</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/5 text-white md:hidden"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#0B101B] px-4 pt-3 pb-5 shadow-xl md:hidden">
            <nav className="flex flex-col space-y-1.5">
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Platform
              </a>
              <a
                href="#diligence"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Capabilities
              </a>
              <a
                href="#difference"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                How it works
              </a>
              <a
                href="#teams"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                For investment teams
              </a>
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-white/20 bg-white/5 px-3 text-sm font-medium text-white"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white"
              >
                Request Early Access
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ===================================================================
            SECTION B — HERO (Affinity-Inspired Institutional Dark Hero + Centered Compact Showcase)
           =================================================================== */}
        <section className="relative border-b border-slate-200/80 bg-[#0B101B] pt-14 pb-16 text-white sm:pt-20 sm:pb-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(37,99,235,0.16),transparent_75%)]"
          />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400">
                INVESTMENT INTELLIGENCE PLATFORM
              </p>

              <h1 className="mt-4 font-serif text-4xl font-normal tracking-[-0.02em] text-balance text-white sm:text-6xl sm:leading-[1.06]">
                See beyond the pitch.
              </h1>

              <p className="mt-3 text-base font-medium tracking-tight text-slate-200 sm:text-xl">
                One workspace for more informed investment decisions.
              </p>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Reduce the manual work involved in screening, structuring and reviewing investment opportunities without removing human investment judgment. Turn incoming pitches into structured intelligence, validate financial claims, understand market momentum and manage your pipeline with clarity.
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <a
                  href="#workflow"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-500"
                >
                  <span>Explore the Platform</span>
                  <span aria-hidden>→</span>
                </a>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 bg-white/[0.06] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
                >
                  Sign In
                </Link>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Founder submitting a pitch deck?{" "}
                <Link href="/pitch" className="font-medium text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white">
                  Open Founder Pitch Intake →
                </Link>
              </p>
            </div>

            {/* Compact, Centered Hero Product Showcase (max-w-[880px], never upscaled past 1024px natural width) */}
            <div className="mx-auto mt-12 max-w-[880px]">
              <div className="overflow-hidden rounded-xl border border-white/15 bg-[#131B2E] p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] sm:p-2">
                <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50 px-3.5 py-2 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                      <span className="ml-2 text-[11px] font-medium text-slate-500">
                        Aarka — Active Investment Workspace
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/hero-workspace.png",
                          width: 1024,
                          height: 573,
                          alt: "Aarka main investment workspace showing deal-flow velocity, pending decisions, sector heatmap and team workload.",
                          caption: "Main Investment Workspace: Active pipeline velocity, pending partner decisions, sector heatmap and analyst workload.",
                        })
                      }
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                    >
                      Inspect full resolution ↗
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        src: "/images/aarka/hero-workspace.png",
                        width: 1024,
                        height: 573,
                        alt: "Aarka main investment workspace showing deal-flow velocity, pending decisions, sector heatmap and team workload.",
                        caption: "Main Investment Workspace: Active pipeline velocity, pending partner decisions, sector heatmap and analyst workload.",
                      })
                    }
                    aria-label="Inspect Main Investment Workspace screenshot in full size"
                    className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                  >
                    <Image
                      src="/images/aarka/hero-workspace.png"
                      alt="Aarka main investment workspace showing deal-flow velocity, pending decisions, sector heatmap and team workload."
                      width={1024}
                      height={573}
                      unoptimized
                      priority
                      className="block h-auto w-full object-contain"
                    />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                Click any product preview to inspect at full resolution · Sample demonstration data shown for illustration.
              </p>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION C — THE AARKA WORKFLOW
           =================================================================== */}
        <section id="workflow" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F7F5F0] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                THE INVESTMENT WORKFLOW
              </p>
              <h2 className="mt-3 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                From incoming pitches to informed decisions.
              </h2>
              <p className="mt-3.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                Every stage of a deal carries manual work that has to happen—reading decks into standard records, checking whether ARR matches MRR, comparing deck claims against monthly CSV sheets, and tracking overdue reports. Aarka handles the manual structuring and validation so your team can focus on conviction and judgment.
              </p>
            </div>

            {/* Refined Horizontal Workflow on Desktop / Compact Vertical Timeline on Mobile */}
            <div className="mt-12 border-t border-slate-300/80 pt-8">
              <ol className="grid gap-6 md:grid-cols-5 md:gap-6">
                {WORKFLOW_STEPS.map((step) => (
                  <li
                    key={step.num}
                    className="relative border-l-2 border-slate-300 pl-4 md:border-l-0 md:pl-0"
                  >
                    <a href={step.href} className="group block focus:outline-none">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700">
                          {step.num}
                        </span>
                        <span className="text-slate-400">—</span>
                        <h3 className="font-serif text-base font-normal text-slate-950 group-hover:text-blue-700">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.body}</p>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION D — FINANCIAL DUE DILIGENCE (Text Left, Compact Framed Preview Right)
           =================================================================== */}
        <section id="diligence" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Column: Narrative & Highlights */}
              <div className="lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  01 · FINANCIAL DUE DILIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Every number deserves a closer look.
                </h2>
                <p className="mt-3.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Aarka compares what a pitch deck claims against the founder’s <strong className="font-semibold text-slate-900">monthly CSV sheet</strong>, <strong className="font-semibold text-slate-900">intake form</strong> and <strong className="font-semibold text-slate-900">registry record</strong>. Original founder claims are kept intact—discrepancies over 10% are surfaced alongside the exact variance formula.
                </p>

                <dl className="mt-7 grid gap-4 sm:grid-cols-2">
                  {DILIGENCE_POINTS.map((pt) => (
                    <div key={pt.label} className="border-l border-slate-200 pl-3.5">
                      <dt className="text-xs font-semibold text-slate-900">{pt.label}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-slate-600">{pt.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Right Column: Affinity-Style Framed Card with Compact Product Preview (~500px width) */}
              <div className="lg:col-span-6">
                <div className="mx-auto max-w-[540px] rounded-2xl border border-slate-200/90 bg-[#F2EFE9] p-4 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-lg border border-slate-300/80 bg-white/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => setDiligenceTab("audit")}
                        className={
                          diligenceTab === "audit"
                            ? "rounded-md bg-[#0B101B] px-2.5 py-1 text-xs font-medium text-white"
                            : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950"
                        }
                      >
                        Company Diligence Checks
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiligenceTab("compare")}
                        className={
                          diligenceTab === "compare"
                            ? "rounded-md bg-[#0B101B] px-2.5 py-1 text-xs font-medium text-white"
                            : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950"
                        }
                      >
                        Growth Comparison
                      </button>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">Click to enlarge ↗</span>
                  </div>

                  <div className="rounded-xl bg-[#0B101B] p-2.5 shadow-md sm:p-3">
                    <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-slate-300">
                      <span>
                        {diligenceTab === "audit"
                          ? "Diligence Audit · 5 matched, 1 gap >10%, 1 missing"
                          : "Cross-Company Growth · USD & Native Currency"}
                      </span>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        {diligenceTab === "audit" ? "14% deck vs 9.0% sheet" : "Conflict flagged"}
                      </span>
                    </div>

                    {diligenceTab === "audit" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/financial-diligence-rahatrail.png",
                            width: 992,
                            height: 675,
                            alt: "Company diligence view showing matched checks, a flagged 14% vs 9.0% monthly growth discrepancy, missing customer count and founder credibility.",
                            caption: "Company Diligence Record: 5 of 6 checks matched, 1 growth discrepancy (>10%) flagged, and 1 core fact missing.",
                          })
                        }
                        aria-label="Inspect Company Diligence screenshot in full size"
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white text-left focus:outline-none"
                      >
                        <Image
                          src="/images/aarka/financial-diligence-rahatrail.png"
                          alt="Company diligence view showing matched checks, a flagged 14% vs 9.0% monthly growth discrepancy, missing customer count and founder credibility."
                          width={992}
                          height={675}
                          unoptimized
                          className="block h-auto w-full object-contain"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/financial-comparison-growth.png",
                            width: 992,
                            height: 636,
                            alt: "Compare view ranking companies by monthly growth and marking conflicted or stale metrics with striped bars.",
                            caption: "Cross-Company Comparison (/compare): Standardized growth benchmarking with explicit conflicted and stale indicators.",
                          })
                        }
                        aria-label="Inspect Growth Comparison screenshot in full size"
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white text-left focus:outline-none"
                      >
                        <Image
                          src="/images/aarka/financial-comparison-growth.png"
                          alt="Compare view ranking companies by monthly growth and marking conflicted or stale metrics with striped bars."
                          width={992}
                          height={636}
                          unoptimized
                          className="block h-auto w-full object-contain"
                        />
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    Walk into partner meetings with every stated metric verified against raw monthly rows—without spending hours rebuilding spreadsheets by hand.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION E — MARKET INTELLIGENCE (Compact Framed Preview Left, Text Right)
           =================================================================== */}
        <section id="market" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F7F5F0] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Column on Desktop: Focused Momentum Chart Preview */}
              <div className="order-2 lg:order-1 lg:col-span-6">
                <div className="mx-auto max-w-[540px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setMarketTab("momentum")}
                        className={
                          marketTab === "momentum"
                            ? "rounded-md bg-[#0B101B] px-2.5 py-1 text-xs font-medium text-white"
                            : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950"
                        }
                      >
                        Momentum Map Chart
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarketTab("sector")}
                        className={
                          marketTab === "sector"
                            ? "rounded-md bg-[#0B101B] px-2.5 py-1 text-xs font-medium text-white"
                            : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950"
                        }
                      >
                        Sector Drilldown (B2B)
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox(
                          marketTab === "momentum"
                            ? {
                                src: "/images/aarka/market-momentum-map.png",
                                width: 992,
                                height: 658,
                                alt: "Full Market Intelligence dashboard showing sector KPI strip, Momentum map and monthly deck volume.",
                                caption: "Full Market Intelligence Dashboard (/market): Sector momentum scatter plot paired with monthly inbound deck breakdown.",
                              }
                            : {
                                src: "/images/aarka/market-sector-b2b.png",
                                width: 994,
                                height: 637,
                                alt: "B2B software sector drilldown showing +117% deck growth, $23M raised and pipeline conversion.",
                                caption: "Sector Drilldown (/sectors/B2B software): Cohort pitch velocity, tracked rounds, rule fit and conversion funnel.",
                              },
                        )
                      }
                      className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
                    >
                      Open full dashboard ↗
                    </button>
                  </div>

                  <div className="rounded-xl bg-[#0B101B] p-2.5 shadow-md sm:p-3">
                    <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-slate-300">
                      <span>
                        {marketTab === "momentum"
                          ? "Momentum Map · 3-Month Pitch Velocity vs. Market Funding"
                          : "B2B Software · 19 Decks (+117%) · $23M Raised (+28%)"}
                      </span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Heating up
                      </span>
                    </div>

                    {marketTab === "momentum" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/market-momentum-map.png",
                            width: 992,
                            height: 658,
                            alt: "Full Market Intelligence dashboard showing sector KPI strip, Momentum map and monthly deck volume.",
                            caption: "Full Market Intelligence Dashboard (/market): Sector momentum scatter plot paired with monthly inbound deck breakdown.",
                          })
                        }
                        aria-label="Inspect full Market Intelligence dashboard in lightbox"
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white p-1.5 text-left focus:outline-none"
                      >
                        <Image
                          src="/images/aarka/market-momentum-chart-crop.png"
                          alt="Focused view of the Aarka Sector Momentum Map plotting decks received against money raised across Heating up, Crowding, Steady and Cooling quadrants."
                          width={570}
                          height={446}
                          unoptimized
                          className="mx-auto block h-auto max-w-full object-contain"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/market-sector-b2b.png",
                            width: 994,
                            height: 637,
                            alt: "B2B software sector drilldown showing +117% deck growth, $23M raised and pipeline conversion.",
                            caption: "Sector Drilldown (/sectors/B2B software): Cohort pitch velocity, tracked rounds, rule fit and conversion funnel.",
                          })
                        }
                        aria-label="Inspect B2B Software Sector Drilldown in lightbox"
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white text-left focus:outline-none"
                      >
                        <Image
                          src="/images/aarka/market-sector-b2b.png"
                          alt="B2B software sector drilldown showing +117% deck growth, $23M raised and pipeline conversion."
                          width={994}
                          height={637}
                          unoptimized
                          className="block h-auto w-full object-contain"
                        />
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    Focused view of the Sector Momentum chart. Click the preview to inspect the complete Market dashboard.
                  </p>
                </div>
              </div>

              {/* Right Column on Desktop: Market Intelligence Narrative */}
              <div className="order-1 lg:order-2 lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                  02 · MARKET INTELLIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Know where the market is moving.
                </h2>
                <p className="mt-3.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Your fund’s inbound pitch flow is a proprietary signal. Aarka automatically aggregates <strong className="font-semibold text-slate-900">sector pitch velocity</strong> against <strong className="font-semibold text-slate-900">90-day capital raised</strong> so partners see which categories are accelerating, crowding or cooling.
                </p>

                <dl className="mt-7 space-y-4">
                  {MARKET_POINTS.map((pt) => (
                    <div key={pt.label} className="border-l border-slate-300 pl-3.5">
                      <dt className="text-xs font-semibold text-slate-900">{pt.label}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-slate-600">{pt.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION F — DEAL-FLOW MANAGEMENT (Text Left, Compact Framed Preview Right)
           =================================================================== */}
        <section id="dealflow" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Column: Narrative */}
              <div className="lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  03 · DEAL-FLOW MANAGEMENT
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Every opportunity. One clear pipeline.
                </h2>
                <p className="mt-3.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Keep every stage and next step current, <strong className="font-semibold text-slate-900">record why you passed</strong> on previous rounds, and automatically surface companies when a <strong className="font-semibold text-slate-900">re-engagement trigger</strong> or check date arrives.
                </p>

                <dl className="mt-7 grid gap-4 sm:grid-cols-2">
                  {DEALFLOW_POINTS.map((pt) => (
                    <div key={pt.label} className="border-l border-slate-200 pl-3.5">
                      <dt className="text-xs font-semibold text-slate-900">{pt.label}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-slate-600">{pt.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Right Column: Compact Deal Flow Pulse Preview */}
              <div className="lg:col-span-6">
                <div className="mx-auto max-w-[540px] rounded-2xl border border-slate-200/90 bg-[#F2EFE9] p-4 sm:p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Deal Flow Pulse (/deals)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/dealflow-pulse.png",
                          width: 1012,
                          height: 660,
                          alt: "Deal Flow Pulse pipeline view showing To read, Look again, Meetings, Passed tabs and automated check badges.",
                          caption: "Deal Flow Pulse (/deals): Triage incoming pitches with rule-fit filters, math-gap alerts and re-engagement triggers.",
                        })
                      }
                      className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
                    >
                      Inspect full resolution ↗
                    </button>
                  </div>

                  <div className="rounded-xl bg-[#0B101B] p-2.5 shadow-md sm:p-3">
                    <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-slate-300">
                      <span>To read · Look again · Meetings · Passed</span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        Re-Engage Due
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/dealflow-pulse.png",
                          width: 1012,
                          height: 660,
                          alt: "Deal Flow Pulse pipeline view showing To read, Look again, Meetings, Passed tabs and automated check badges.",
                          caption: "Deal Flow Pulse (/deals): Triage incoming pitches with rule-fit filters, math-gap alerts and re-engagement triggers.",
                        })
                      }
                      aria-label="Inspect Deal Flow Pulse screenshot in full size"
                      className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white text-left focus:outline-none"
                    >
                      <Image
                        src="/images/aarka/dealflow-pulse.png"
                        alt="Deal Flow Pulse pipeline view showing To read, Look again, Meetings, Passed tabs and automated check badges."
                        width={1012}
                        height={660}
                        unoptimized
                        className="block h-auto w-full object-contain"
                      />
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    When a company you passed on at Seed raises or hits a scheduled check date, Aarka brings your prior diligence and pass reasoning straight back into Look Again.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION G — PORTFOLIO INTELLIGENCE (Compact Framed Preview Left, Text Right)
           =================================================================== */}
        <section id="portfolio" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F7F5F0] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Column on Desktop: Compact Portfolio Health Cards Preview */}
              <div className="order-2 lg:order-1 lg:col-span-6">
                <div className="mx-auto max-w-[540px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Portfolio Health Grid (/portfolio)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/portfolio-overview.png",
                          width: 1024,
                          height: 555,
                          alt: "Full Portfolio dashboard showing backed companies with Needs help, Watch and Healthy status badges, cash runway and reporting gaps.",
                          caption: "Portfolio Overview (/portfolio): Tracks cash runway, monthly revenue, overdue MIS reports and variance against plan.",
                        })
                      }
                      className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
                    >
                      Open full workspace view ↗
                    </button>
                  </div>

                  <div className="rounded-xl bg-[#0B101B] p-2.5 shadow-md sm:p-3">
                    <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-slate-300">
                      <span>Runway · Monthly Revenue · MIS Reporting</span>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        Needs help · Watch · Healthy
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/portfolio-overview.png",
                          width: 1024,
                          height: 555,
                          alt: "Full Portfolio dashboard showing backed companies with Needs help, Watch and Healthy status badges, cash runway and reporting gaps.",
                          caption: "Portfolio Overview (/portfolio): Tracks cash runway, monthly revenue, overdue MIS reports and variance against plan.",
                        })
                      }
                      aria-label="Inspect full Portfolio Overview screenshot in lightbox"
                      className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-white p-1.5 text-left focus:outline-none"
                    >
                      <Image
                        src="/images/aarka/portfolio-cards-crop.png"
                        alt="Portfolio company health cards showing Sehatflow, Voltnest, Brightcart, Mandiwise, Kitebay and Nestara with runway, revenue and MIS report status."
                        width={788}
                        height={472}
                        unoptimized
                        className="block h-auto w-full object-contain"
                      />
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    Each company card is computed by code from its monthly reports—surfacing runway under 9 months, overdue MIS files, and revenue variance against the pitch deck’s plan.
                  </p>
                </div>
              </div>

              {/* Right Column on Desktop: Portfolio Narrative */}
              <div className="order-1 lg:order-2 lg:col-span-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  04 · PORTFOLIO INTELLIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Stay close to every portfolio company.
                </h2>
                <p className="mt-3.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Know which founders have <strong className="font-semibold text-slate-900">gone quiet on monthly reporting</strong>, where <strong className="font-semibold text-slate-900">cash runway is tightening</strong>, and where reported MIS figures diverge from the plan—so you can offer help at the right time.
                </p>

                <dl className="mt-7 space-y-4">
                  {PORTFOLIO_POINTS.map((pt) => (
                    <div key={pt.label} className="border-l border-slate-300 pl-3.5">
                      <dt className="text-xs font-semibold text-slate-900">{pt.label}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-slate-600">{pt.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION H — THE AARKA DIFFERENCE (Affinity-Inspired Architectural Cards + Lineage)
           =================================================================== */}
        <section id="difference" className="scroll-mt-16 border-b border-slate-800 bg-[#0B101B] py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                THE AARKA DIFFERENCE
              </p>
              <h2 className="mt-3 font-serif text-3xl font-normal tracking-[-0.015em] text-white sm:text-4xl">
                AI reads and explains. Code checks the numbers. People decide.
              </h2>
              <p className="mt-3.5 text-sm leading-relaxed text-slate-300 sm:text-base">
                Reduce the manual work of reading decks and checking spreadsheets without turning investment judgment over to a black box. Every layer in Aarka has a strict, auditable boundary.
              </p>
            </div>

            {/* Three Connected Architectural Panels with Line-Art Diagrams */}
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {/* Panel 1: AI */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#121929] p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <svg viewBox="0 0 36 36" className="h-9 w-9 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.3}>
                      <rect x="4" y="4" width="12" height="14" rx="1.5" />
                      <path d="M7 8h6M7 11h6M7 14h4" />
                      <path d="M16 11h6" strokeDasharray="2 2" />
                      <rect x="22" y="6" width="10" height="10" rx="1.5" />
                      <circle cx="27" cy="26" r="5" />
                      <path d="M27 16v5" />
                    </svg>
                    <span className="font-mono text-xs font-semibold text-blue-400">01 · AI</span>
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-normal text-white">
                    Extracts, structures and explains information.
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                    Reads pitch deck pages, charts and tables into one standard company record—attaching the source file, page number and a verbatim quote to every claim.
                  </p>
                </div>
                <p className="mt-5 border-t border-white/10 pt-3.5 font-mono text-[11px] text-slate-400">
                  Never performs financial sums or overwrites founder figures.
                </p>
              </div>

              {/* Panel 2: Code */}
              <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-[#121929] p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <svg viewBox="0 0 36 36" className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.3}>
                      <rect x="4" y="5" width="28" height="26" rx="2" />
                      <path d="M4 12h28M14 12v19" />
                      <path d="M8 17h3M8 22h3M8 27h3" />
                      <path d="M18 17l2.5 2.5L26 14" />
                      <path d="M18 25h9" />
                    </svg>
                    <span className="font-mono text-xs font-semibold text-emerald-400">02 · Code</span>
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-normal text-white">
                    Performs deterministic calculations and flags inconsistencies.
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                    Compares deck claims against the monthly CSV sheet, intake form, MIS and registry. Calculates runway, growth and burn multiple with auditable formulas.
                  </p>
                </div>
                <p className="mt-5 border-t border-white/10 pt-3.5 font-mono text-[11px] text-emerald-300/90">
                  Labels every metric: Checked, Reported, Claimed, Conflict or Missing.
                </p>
              </div>

              {/* Panel 3: People */}
              <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#121929] p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <svg viewBox="0 0 36 36" className="h-9 w-9 text-amber-300" fill="none" stroke="currentColor" strokeWidth={1.3}>
                      <circle cx="18" cy="12" r="5" />
                      <path d="M8 29c1.8-5 5.2-7.5 10-7.5s8.2 2.5 10 7.5" />
                      <rect x="5" y="4" width="26" height="28" rx="3" />
                    </svg>
                    <span className="font-mono text-xs font-semibold text-amber-300">03 · People</span>
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-normal text-white">
                    Review evidence, challenge assessments and make investment decisions.
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                    Analysts and partners inspect source quotes, question discrepancies, override bands with written reasoning when warranted and make the final call.
                  </p>
                </div>
                <p className="mt-5 border-t border-white/10 pt-3.5 font-mono text-[11px] text-slate-400">
                  Every decision, note and override is recorded with its author.
                </p>
              </div>
            </div>

            {/* Compact Data Lineage Preview inside Navy Section */}
            <div className="mt-8 grid items-center gap-8 rounded-xl border border-white/10 bg-[#121929]/80 p-5 sm:p-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className="font-mono text-[11px] text-blue-400">Data Transparency (/sources)</span>
                <h3 className="mt-2 font-serif text-xl font-normal text-white">
                  Trace the route every number takes.
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Every number in Aarka starts in a file a founder sent or a public record. A conflict stays open until a person settles it with a source—nothing is silently altered.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/data-transparency-lineage.png",
                      width: 998,
                      height: 655,
                      alt: "Where data comes from diagram showing 1. Comes in, 2. Aarka works on it (Read AI, Clean Code, Check Code, Label Code), and 3. Shows up for the team.",
                      caption: "Where Data Comes From (/sources): End-to-end lineage from founder files through AI extraction and code verification.",
                    })
                  }
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  <span>Inspect data lineage diagram</span>
                  <span aria-hidden>↗</span>
                </button>
              </div>

              <div className="lg:col-span-7">
                <div className="mx-auto max-w-[520px] overflow-hidden rounded-lg border border-white/15 bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        src: "/images/aarka/data-transparency-lineage.png",
                        width: 998,
                        height: 655,
                        alt: "Where data comes from diagram showing 1. Comes in, 2. Aarka works on it (Read AI, Clean Code, Check Code, Label Code), and 3. Shows up for the team.",
                        caption: "Where Data Comes From (/sources): End-to-end lineage from founder files through AI extraction and code verification.",
                      })
                    }
                    aria-label="Inspect Data Transparency Lineage screenshot in full size"
                    className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                  >
                    <Image
                      src="/images/aarka/data-transparency-lineage.png"
                      alt="Where data comes from diagram showing 1. Comes in, 2. Aarka works on it, and 3. Shows up for the team."
                      width={998}
                      height={655}
                      unoptimized
                      className="block h-auto w-full object-contain"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION I — FOR INVESTMENT TEAMS
           =================================================================== */}
        <section id="teams" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F7F5F0] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                FOR INVESTMENT TEAMS
              </p>
              <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                Built for how venture capital teams work.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Server-side role verification routes partners and analysts to their tailored views inside the workspace, while founders have a clean, direct pathway to submit pitches and share requested documents.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:items-start">
              {/* Three Audience Cards (Left 7 Columns) */}
              <div className="space-y-4 lg:col-span-7">
                <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-normal text-slate-950">Investment Partners</h3>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                      Partner View
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Fund-wide visibility, weekly decision queue, inbound pipeline velocity, sector momentum trends, configurable fund rules and portfolio oversight across every backed company.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-normal text-slate-950">Investment Analysts</h3>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      Analyst View
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Pitch review, AI deck extraction, deterministic math and registry verification, page-cited evidence matrices, founder document request links and structured deal management.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-normal text-slate-950">Founders</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Founder Intake &amp; Portal
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    A straightforward way to submit pitches (up to 100 MB PDF) and share requested diligence documents without friction.
                  </p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <Link
                      href="/pitch"
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Submit a pitch (/pitch) →
                    </Link>
                    <span className="text-slate-300">·</span>
                    <Link
                      href="/login"
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Sign In (/login)
                    </Link>
                  </div>
                </div>
              </div>

              {/* Compact Founder Pitch Portal Preview (Right 5 Columns, max-w-[420px]) */}
              <div className="lg:col-span-5">
                <div className="mx-auto max-w-[420px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">
                      Founder Pitch Submission (/pitch)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/founder-pitch-portal.png",
                          width: 605,
                          height: 657,
                          alt: "Aarka founder pitch submission page with company details and 100 MB PDF deck upload.",
                          caption: "Founder Pitch Intake (/pitch): Clean external submission experience for founders.",
                        })
                      }
                      className="text-[11px] font-medium text-blue-700 hover:text-blue-900"
                    >
                      Enlarge ↗
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/founder-pitch-portal.png",
                          width: 605,
                          height: 657,
                          alt: "Aarka founder pitch submission page with company details and 100 MB PDF deck upload.",
                          caption: "Founder Pitch Intake (/pitch): Clean external submission experience for founders.",
                        })
                      }
                      aria-label="Inspect Founder Pitch Portal screenshot in full size"
                      className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                    >
                      <Image
                        src="/images/aarka/founder-pitch-portal.png"
                        alt="Aarka founder pitch submission page with company details and 100 MB PDF deck upload."
                        width={605}
                        height={657}
                        unoptimized
                        className="block h-auto w-full object-contain"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION J — FINAL CTA
           =================================================================== */}
        <section className="border-b border-slate-800 bg-[#0B101B] py-16 text-white sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400">
              GET STARTED WITH AARKA
            </p>
            <h2 className="mt-3 font-serif text-3xl font-normal tracking-[-0.015em] text-balance text-white sm:text-5xl">
              Make every investment decision more informed.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Bring deal flow, diligence and investment intelligence into one connected workspace.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-500"
              >
                <span>Request Early Access</span>
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 bg-white/[0.06] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          SECTION K — FOOTER
         ===================================================================== */}
      <footer className="bg-white py-10 text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Image
                src="/aarka-logo.png"
                alt="Aarka"
                width={24}
                height={24}
                unoptimized
                className="h-6 w-6 shrink-0 rounded-md object-contain"
              />
              <span className="text-sm font-semibold text-slate-950">Aarka</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">
                Investment intelligence and deal-flow management for venture capital teams.
              </span>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600">
              <a href="#workflow" className="hover:text-slate-950">
                Platform
              </a>
              <a href="#diligence" className="hover:text-slate-950">
                Capabilities
              </a>
              <a href="#difference" className="hover:text-slate-950">
                How it works
              </a>
              <a href="#teams" className="hover:text-slate-950">
                For investment teams
              </a>
              <Link href="/pitch" className="hover:text-slate-950">
                Submit a Pitch
              </Link>
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">
                Sign In
              </Link>
            </nav>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} Aarka. All rights reserved.</p>
            <p>Dashboard previews display fictional sample data for demonstration purposes.</p>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          ACCESSIBLE IMAGE PREVIEW LIGHTBOX MODAL
         ===================================================================== */}
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
                className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
                unoptimized
                className="mx-auto block h-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
