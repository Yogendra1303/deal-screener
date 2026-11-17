"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface PreviewImage {
  src: string;
  alt: string;
  caption: string;
}

const HERO_TABS = [
  {
    id: "workspace",
    label: "Partner Workspace",
    badge: "Home · Active Pipeline",
    url: "aarkavc.xyz — Investment Workspace",
    src: "/images/aarka/hero-workspace.png",
    alt: "Aarka main investment workspace showing deal-flow velocity, pending partner decisions, sector heatmap, and analyst workload.",
    caption:
      "Partner Home: Pending investment decisions, 6-month inbound pitch velocity, active first calls, look-again triggers, sector heatmap, and analyst workload in one view.",
  },
  {
    id: "dealflow",
    label: "Deal Flow Pulse",
    badge: "Pipeline · 48 Companies",
    url: "aarkavc.xyz/deals — Deal Flow Pulse",
    src: "/images/aarka/dealflow-pulse.png",
    alt: "Aarka Deal Flow Pulse pipeline showing To Read, Look Again, Meetings, Passed tabs, and automated math gap badges.",
    caption:
      "Deal Flow Pulse: Triage incoming pitches by rule fit, founder fit, math gaps (>10% variance), missing facts, and scheduled re-engagement triggers.",
  },
  {
    id: "market",
    label: "Market Momentum",
    badge: "Sectors · 90 Decks",
    url: "aarkavc.xyz/market — Sector Momentum Map",
    src: "/images/aarka/market-momentum-map.png",
    alt: "Aarka Market page showing sector momentum scatter plot comparing inbound deck velocity against 90-day capital raised.",
    caption:
      "Market Intelligence: Sector-by-sector momentum plotting 3-month inbound pitch velocity against 90-day market capital raised.",
  },
] as const;

const VALUE_STEPS = [
  {
    num: "01",
    title: "Capture",
    subtitle: "Receive founder pitches and documents.",
    detail:
      "Founders submit pitch decks (up to 100 MB PDF) and monthly financial sheets through the public intake link, analyst referral links, or token-based diligence requests. Every file is stored as received in the company data room.",
    tags: ["Pitch Portal", "Referral Links", "Data Room"],
  },
  {
    num: "02",
    title: "Structure",
    subtitle: "Convert pitch information into standardised company records.",
    detail:
      "AI reads unstructured pitch decks and financial tables into one canonical company schema—preserving the source document, exact page number, and a verbatim quote for every extracted claim.",
    tags: ["Page Citations", "Standard Schema", "Verbatim Quotes"],
  },
  {
    num: "03",
    title: "Validate",
    subtitle: "Compare financial claims against available source documents.",
    detail:
      "Deterministic code checks ARR against MRR×12, runway against cash and burn, deck figures against monthly CSV rows, and incorporation dates against registry records—flagging any variance strictly above 10%.",
    tags: ["Math Gap >10%", "CSV Corroboration", "Registry Check"],
  },
  {
    num: "04",
    title: "Evaluate",
    subtitle: "Apply investment criteria and surface relevant findings.",
    detail:
      "Code checks the submission against the fund’s written rules (stage, geography, sector, and maximum ask) and combines traction and founder-fit assessments into clear Priority, Review, or Outside focus bands.",
    tags: ["Fund Rules", "Evidence Matrix", "Priority Bands"],
  },
  {
    num: "05",
    title: "Monitor",
    subtitle: "Keep track of pipeline developments and portfolio reporting.",
    detail:
      "Set scheduled check dates and news triggers on passed or on-hold deals so they resurface in Look Again, and track monthly MIS reporting, cash runway, burn multiple, and plan variance across backed portfolio companies.",
    tags: ["Look Again Triggers", "MIS Tracking", "Runway Alerts"],
  },
] as const;

const DILIGENCE_HIGHLIGHTS = [
  {
    title: "Revenue & growth checks",
    body: "Compares deck-stated revenue and monthly growth rates directly against compounded figures computed from the founder’s monthly CSV sheet.",
    badge: "Deck vs. Sheet",
  },
  {
    title: "Runway & burn calculations",
    body: "Verifies stated runway months by dividing latest reported cash in bank by net monthly burn—never relying on unverified deck projections.",
    badge: "Cash ÷ Burn",
  },
  {
    title: "Missing information flags",
    body: "Automatically identifies core facts left out of a submission—such as customer count, net burn, or cash balance—so analysts know exactly what to ask.",
    badge: "Core Fact Audit",
  },
  {
    title: "Source-backed financial records",
    body: "Every company record links directly to its underlying Deck summary, Monthly CSV sheet, Financial snapshot, Intake form, and printable Audit report.",
    badge: "5 Linked Sources",
  },
  {
    title: "Discrepancy flags (>10% tolerance)",
    body: "When two sources disagree by more than 10%, Aarka raises a visible Conflict badge with the exact variance formula while keeping both original numbers intact.",
    badge: "Non-Destructive",
  },
  {
    title: "Founder experience assessment",
    body: "Evaluates domain-relevant operating history and past work tied to the problem without using demographic or school background proxies.",
    badge: "Domain Fit",
  },
] as const;

export function LandingPage() {
  const [heroTab, setHeroTab] = useState<(typeof HERO_TABS)[number]["id"]>("workspace");
  const [marketView, setMarketView] = useState<"map" | "drilldown">("map");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [lightbox, setLightbox] = useState<PreviewImage | null>(null);

  const activeHero = HERO_TABS.find((t) => t.id === heroTab) ?? HERO_TABS[0];

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

  function handleGoogleAuth() {
    setAuthLoading(true);
    void nextAuthSignIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* =====================================================================
          SECTION 1 — NAVIGATION
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aarka-logo.png"
                alt="Aarka logo"
                className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-xs ring-1 ring-slate-900/10"
              />
              <span className="text-base font-semibold tracking-tight text-slate-950">Aarka</span>
            </Link>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 sm:inline-block">
              Investment Intelligence
            </span>
          </div>

          <nav aria-label="Primary Navigation" className="hidden items-center gap-7 md:flex">
            <a href="#platform" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
              Platform
            </a>
            <a href="#diligence" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
              Capabilities
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
              How it works
            </a>
            <a href="#teams" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
              For venture teams
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
            >
              {authLoading ? "Redirecting…" : "Sign In"}
            </button>
            <a
              href="#early-access"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-xs transition hover:bg-slate-800"
            >
              Request Early Access
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
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
          <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-5 shadow-lg md:hidden">
            <nav className="flex flex-col space-y-2.5">
              <a
                href="#platform"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Platform
              </a>
              <a
                href="#diligence"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Capabilities
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                How it works
              </a>
              <a
                href="#teams"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                For venture teams
              </a>
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
              >
                {authLoading ? "Redirecting…" : "Sign In"}
              </button>
              <a
                href="#early-access"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-medium text-white"
              >
                Request Early Access
              </a>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ===================================================================
            SECTION 2 — HERO
           =================================================================== */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-white pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)]"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-2xs sm:px-3.5 sm:text-xs">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                <span className="truncate">AI reads and explains · Code validates and calculates · People decide</span>
              </div>

              <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-balance text-slate-950 sm:text-6xl sm:leading-[1.04]">
                See beyond the pitch.
              </h1>

              <p className="mt-3 text-base font-medium tracking-tight text-slate-800 sm:text-2xl">
                Investment intelligence for modern venture capital teams.
              </p>

              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-lg">
                Turn incoming pitches into structured intelligence. Validate financial claims, understand market momentum and manage your investment pipeline from one connected workspace.
              </p>

              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
                <a
                  href="#early-access"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                >
                  <span>Request Early Access</span>
                  <span aria-hidden className="text-slate-400">→</span>
                </a>
                <a
                  href="#platform"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Explore the Platform
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>Venture partner &amp; analyst workspaces</span>
                <span aria-hidden className="text-slate-300">·</span>
                <Link href="/pitch" className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
                  Founder submitting a pitch deck? Open Pitch Intake →
                </Link>
              </div>
            </div>

            {/* Hero Workspace Switcher Controls */}
            <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                {HERO_TABS.map((tab) => {
                  const active = tab.id === activeHero.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHeroTab(tab.id)}
                      className={
                        active
                          ? "rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-2xs ring-1 ring-slate-200/80"
                          : "rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-500">
                Click any product view to inspect at full resolution · Sample demonstration portfolio &amp; pipeline records shown
              </span>
            </div>

            {/* Main Application Frame Showcase */}
            <div className="mt-3 rounded-2xl bg-slate-900/5 p-2 ring-1 ring-slate-200/90 sm:rounded-3xl sm:p-3">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.14)] sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="ml-2 hidden text-xs font-medium text-slate-500 sm:inline">
                      {activeHero.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                      {activeHero.badge}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: activeHero.src,
                          alt: activeHero.alt,
                          caption: activeHero.caption,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-slate-700"
                    >
                      <span>Expand view</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: activeHero.src,
                      alt: activeHero.alt,
                      caption: activeHero.caption,
                    })
                  }
                  className="group relative block w-full cursor-zoom-in overflow-hidden bg-slate-50 text-left focus:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeHero.src}
                    alt={activeHero.alt}
                    className="w-full object-cover transition duration-500 ease-out group-hover:scale-[1.005]"
                  />
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
                  <span>{activeHero.caption}</span>
                  <span className="font-mono text-[11px] text-slate-400">Illustrative demonstration data</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 3 — PRODUCT VALUE PROPOSITION
           =================================================================== */}
        <section id="platform" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F8FAFC] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                Connected Investment Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                From incoming pitches to informed decisions.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Aarka replaces disconnected inbox threads, unverified spreadsheets, and static pitch memos with one continuous record per company—from first founder submission to monthly portfolio reporting.
              </p>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 lg:grid-cols-5">
              {VALUE_STEPS.map((step) => (
                <div key={step.num} className="flex flex-col justify-between bg-white p-6 sm:p-7">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold tracking-wider text-blue-700">
                        {step.num}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-slate-800">
                      {step.subtitle}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {step.detail}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 4 — FINANCIAL DUE DILIGENCE
           =================================================================== */}
        <section id="diligence" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Financial Due Diligence &amp; Verification
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                  Every number deserves a closer look.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                  Pitch decks state the narrative; monthly financial sheets and public registries hold the corroborating detail. Aarka cross-checks stated figures automatically, preserving original founder claims intact while flagging discrepancies and missing facts for human review.
                </p>
              </div>
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-950">
                  <p className="font-semibold">Non-destructive audit principle</p>
                  <p className="mt-1 text-amber-900/90">
                    Aarka never overwrites a founder’s stated numbers. When a deck claim and a monthly CSV sheet differ by more than 10%, both figures are kept alongside the exact variance calculation.
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Diligence Screenshot Showcase */}
            <div className="mt-12 rounded-2xl bg-slate-900/5 p-2 ring-1 ring-slate-200/90 sm:rounded-3xl sm:p-3">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-semibold text-slate-800">
                      Company Diligence Record — Automated Math &amp; Completeness Checks
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      5 of 6 checks matched
                    </span>
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                      1 gap over 10% flagged
                    </span>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                      1 core fact missing
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/financial-diligence-rahatrail.png",
                      alt: "Aarka company diligence view showing matched checks, a flagged 14% vs 9.0% monthly growth discrepancy, missing customer count, founder credibility, and decision log.",
                      caption:
                        "Company Diligence Record: Shows stated round ask, implied ARR, MoM growth, runway, linked source files (Deck, CSV, Snapshot, Form, Audit report), and explicit discrepancy flags.",
                    })
                  }
                  className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/aarka/financial-diligence-rahatrail.png"
                    alt="Company diligence record showing 5 of 6 checks matched, 1 gap over 10% flagged between deck and sheet growth, and 1 missing core fact."
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.005]"
                  />
                </button>
              </div>
            </div>

            {/* 6 Diligence Capabilities + Secondary Compare View */}
            <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start">
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                {DILIGENCE_HIGHLIGHTS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-5 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                      <span className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-800">
                      Cross-Company Metric Comparison
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">/compare</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        src: "/images/aarka/financial-comparison-growth.png",
                        alt: "Aarka Compare view ranking portfolio and pitch companies by monthly growth in US dollars or native currency, highlighting conflicted and stale figures.",
                        caption:
                          "Compare View: Benchmark pitches and portfolio companies across Revenue, Growth, Burn multiple, Cash left, Plan variance, and Customers in one normalized currency.",
                      })
                    }
                    className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/aarka/financial-comparison-growth.png"
                      alt="Cross-company comparison chart ranking companies by monthly growth and marking conflicted or stale metrics with striped bars."
                      className="w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                    />
                  </button>
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-xs font-semibold text-slate-900">
                      Standardised benchmarking with provenance intact
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Compare pitches and portfolio companies side by side in US dollars or native reporting currency. Conflicted or stale numbers are visibly striped so analysts never mistake an unverified claim for a clean figure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 5 — MARKET INTELLIGENCE
           =================================================================== */}
        <section id="market" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F8FAFC] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Inbound Market Intelligence
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                  Know where the market is moving.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                  Analyse sector momentum directly from your fund’s inbound pitch pipeline alongside tracked market funding rounds—identifying which categories are heating up, crowding, or cooling before consensus forms.
                </p>
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMarketView("map")}
                  className={
                    marketView === "map"
                      ? "rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white"
                      : "rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-950"
                  }
                >
                  Sector Momentum Map
                </button>
                <button
                  type="button"
                  onClick={() => setMarketView("drilldown")}
                  className={
                    marketView === "drilldown"
                      ? "rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white"
                      : "rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-950"
                  }
                >
                  B2B Software Drilldown
                </button>
              </div>
            </div>

            {/* Large Visual Composition */}
            <div className="mt-10 grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-800">
                      {marketView === "map"
                        ? "Market Overview — 2D Sector Momentum Map & Monthly Pitch Volume"
                        : "Sector Drilldown — B2B Software Cohort, Conversion Funnel & Sub-Categories"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox(
                          marketView === "map"
                            ? {
                                src: "/images/aarka/market-momentum-map.png",
                                alt: "Aarka Market dashboard showing sector momentum map and monthly inbound pitch breakdown.",
                                caption:
                                  "Sector Momentum Map: Plots 3-month inbound pitch growth (horizontal) against 90-day sector capital raised (vertical).",
                              }
                            : {
                                src: "/images/aarka/market-sector-b2b.png",
                                alt: "Aarka B2B software sector drilldown showing +117% deck growth, $23M raised, pipeline conversion, and founder-market fit.",
                                caption:
                                  "Sector Drilldown (B2B Software): Tracks 6-month vs. 3-month pitch velocity, tracked market rounds, rule fit, and funnel conversion.",
                              },
                        )
                      }
                      className="text-xs font-medium text-blue-700 hover:text-blue-900"
                    >
                      Inspect full screen →
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setLightbox(
                        marketView === "map"
                          ? {
                              src: "/images/aarka/market-momentum-map.png",
                              alt: "Aarka Market dashboard showing sector momentum map and monthly inbound pitch breakdown.",
                              caption:
                                "Sector Momentum Map: Plots 3-month inbound pitch growth (horizontal) against 90-day sector capital raised (vertical).",
                            }
                          : {
                              src: "/images/aarka/market-sector-b2b.png",
                              alt: "Aarka B2B software sector drilldown showing +117% deck growth, $23M raised, pipeline conversion, and founder-market fit.",
                              caption:
                                "Sector Drilldown (B2B Software): Tracks 6-month vs. 3-month pitch velocity, tracked market rounds, rule fit, and funnel conversion.",
                            },
                      )
                    }
                    className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        marketView === "map"
                          ? "/images/aarka/market-momentum-map.png"
                          : "/images/aarka/market-sector-b2b.png"
                      }
                      alt={
                        marketView === "map"
                          ? "Market dashboard showing Heating up, Crowding, Steady, and Cooling sectors."
                          : "B2B software sector drilldown showing monthly pitch volume and pipeline conversion."
                      }
                      className="w-full object-cover transition duration-500 group-hover:scale-[1.005]"
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 lg:col-span-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Deterministic Temperature Rules
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-slate-950">
                    Quantified sector classification
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Every sector is classified by code using a transparent ±15% threshold comparing the last 3 months of inbound decks against the prior 3 months and tracked sector funding:
                  </p>
                  <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-3.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <dt className="font-semibold text-emerald-700">Heating up</dt>
                      <dd className="text-right text-slate-600">Decks &amp; capital both up &gt;15%</dd>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <dt className="font-semibold text-amber-700">Crowding</dt>
                      <dd className="text-right text-slate-600">Decks up &gt;15%, capital flat/down</dd>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <dt className="font-semibold text-rose-700">Cooling</dt>
                      <dd className="text-right text-slate-600">Decks or capital down &gt;15%</dd>
                    </div>
                  </dl>
                </div>

                {/* Companion Secondary Thumbnail Card */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">
                      {marketView === "map" ? "Sector Drilldown View" : "Full Sector Momentum Map"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMarketView(marketView === "map" ? "drilldown" : "map")}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Switch to view →
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Click any sector bubble to inspect cohort conversion, founder-market fit distribution, and sub-category velocity.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMarketView(marketView === "map" ? "drilldown" : "map")}
                    className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        marketView === "map"
                          ? "/images/aarka/market-sector-b2b.png"
                          : "/images/aarka/market-momentum-map.png"
                      }
                      alt="Companion market intelligence view"
                      className="h-36 w-full object-cover object-top transition hover:opacity-90"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 6 — DEAL-FLOW MANAGEMENT
           =================================================================== */}
        <section id="pipeline" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                Deal-Flow Management
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                Every opportunity. One clear pipeline.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Organise incoming pitches across analysts and partners without losing track of unreviewed decks or high-potential companies you passed on months ago.
              </p>
            </div>

            <div className="mt-10 rounded-2xl bg-slate-900/5 p-2 ring-1 ring-slate-200/90 sm:rounded-3xl sm:p-3">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-800">
                    Deal Flow Pulse — Queue Triage, Verification Badges &amp; Re-Engagement Triggers
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">To read · Look again · Meetings · Passed</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/dealflow-pulse.png",
                      alt: "Deal flow pulse dashboard showing inbound counts, To Read queue, Strong Founder Fit filter, Math Gap >10% filter, and company pipeline rows.",
                      caption:
                        "Deal Flow Pulse: Filter pitches by Strong Founder Fit, Math Gap >10%, Missing Facts, Re-Engage Due, and Never Opened status.",
                    })
                  }
                  className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/aarka/dealflow-pulse.png"
                    alt="Deal flow pulse screen showing To read, Look again, Meetings, and Passed queues with verification badges."
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.005]"
                  />
                </button>
              </div>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Incoming pitches & To-read queue",
                  body: "New submissions from the website pitch form, analyst referral links, or pitch inbox appear immediately with source badges (DECK, CSV, FORM, REG) and unassigned wait-time tracking.",
                },
                {
                  title: "Look-again opportunities",
                  body: "When an analyst passes or puts a company on hold, they set a scheduled check date or milestone trigger. When news arrives or the date passes, the company automatically surfaces in Look Again.",
                },
                {
                  title: "Meetings, Passed & On-hold history",
                  body: "Every status change, first call, and pass reason (such as unit economics or stage fit) is recorded permanently so the team has full institutional memory across funding cycles.",
                },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                  <h3 className="text-sm font-semibold text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 7 — PORTFOLIO INTELLIGENCE
           =================================================================== */}
        <section id="portfolio" className="scroll-mt-16 border-b border-slate-200/80 bg-[#F8FAFC] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Portfolio Intelligence &amp; Monitoring
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                Stay close to every portfolio company.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Track monthly MIS reporting, cash runway, net burn, and revenue performance against the original pitch deck’s plan—so quiet reporting or shrinking runway is spotted early.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-12">
              {/* Portfolio Grid Screenshot */}
              <div className="lg:col-span-6">
                <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-800">
                        Portfolio Health Grid — Runway, Revenue &amp; Reporting Status
                      </span>
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        Needs help · Watch · Healthy
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/portfolio-overview.png",
                          alt: "Aarka Portfolio dashboard showing 6 portfolio companies with Needs help, Watch, and Healthy status badges, cash runway, revenue, and missing MIS report alerts.",
                          caption:
                            "Portfolio Overview: Code-computed health status based on cash runway (<9 months), missing MIS reports, form vs. MIS discrepancies, and variance against the pitch deck's plan.",
                        })
                      }
                      className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/images/aarka/portfolio-overview.png"
                        alt="Portfolio overview showing company cards with cash runway, monthly revenue, and overdue report flags."
                        className="w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                      />
                    </button>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <h3 className="text-sm font-semibold text-slate-950">
                      Automated attention triage across every backed company
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Each company card is computed directly from its monthly reports: highlighting cash runway under 9 months, overdue MIS submissions, numbers that disagree between the founder’s form and MIS sheet, and revenue variance against the pitch deck’s plan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Portfolio Company Detail Screenshot */}
              <div className="lg:col-span-6">
                <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-800">
                        Company Record — Code-Generated Brief &amp; Two-Way Reporting
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">Written by code · No AI</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/portfolio-company-sehatflow.png",
                          alt: "Sehatflow portfolio company detail showing code-generated Brief on Revenue, Cash runway, Reporting status, and Who knows them.",
                          caption:
                            "Portfolio Company Record (Sehatflow): Synthesizes revenue trend, net burn runway (5.6 months), two-way reporting responsiveness (Company vs. Fund), and open founder asks.",
                        })
                      }
                      className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/images/aarka/portfolio-company-sehatflow.png"
                        alt="Sehatflow company page showing deterministic brief, 5.6 months runway alert, and reporting timeliness."
                        className="w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                      />
                    </button>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <h3 className="text-sm font-semibold text-slate-950">
                      Two-way accountability: company reporting &amp; fund responsiveness
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Monitors not only whether a founder sent their monthly report on time, but also how many days the fund took to read and acknowledge it, alongside open founder requests for introductions or advice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 8 — THE AARKA DIFFERENCE (AI -> CODE -> HUMAN)
           =================================================================== */}
        <section id="how-it-works" className="scroll-mt-16 border-b border-slate-800 bg-[#080C11] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
                The Aarka Architecture
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">
                AI reads and explains. Code checks the numbers. People decide.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
                Language models are built to read unstructured documents—not to do financial arithmetic or make investment commitments. Aarka enforces a strict separation of responsibilities so every number is traceable to its source.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                    01 · AI Layer
                  </span>
                  <span className="text-xs text-slate-400">Extraction &amp; Context</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                  AI reads and explains.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Reads pitch deck slides, charts, and tables into a single structured record—attaching the exact file name, page number, and a short verbatim quote to every extracted claim.
                </p>
                <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <li>· Never performs financial sums or rewrites founder figures</li>
                  <li>· Summarises traction, team domain experience, and open diligence questions</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
                    02 · Code Layer
                  </span>
                  <span className="text-xs text-emerald-300/80">Deterministic Verification</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                  Code checks the numbers.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  Plain, auditable code compares the deck against the monthly CSV sheet, intake form, and company registry—calculating runway, compounded growth, and variance percentages.
                </p>
                <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
                  <li>· Labels every metric: Checked, Reported, Claimed, Conflict, or Missing</li>
                  <li>· Evaluates fund rules and computes Priority, Review, or Outside focus bands</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-blue-500/20 px-2.5 py-1 font-mono text-xs font-semibold text-blue-300">
                    03 · Human Layer
                  </span>
                  <span className="text-xs text-slate-400">Investment Judgement</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-white">
                  People decide.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Analysts and partners inspect the evidence panel, request missing documents from founders, override scores with written reasoning when warranted, and make the final investment call.
                </p>
                <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <li>· Conflicts never silently downgrade a company; they flag a person to look</li>
                  <li>· Every status change, note, and override is preserved with its author</li>
                </ul>
              </div>
            </div>

            {/* Data Transparency Lineage Screenshot */}
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-2 sm:rounded-3xl sm:p-3">
              <div className="overflow-hidden rounded-xl bg-white text-slate-900 sm:rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-800">
                    Data Transparency — Where Every Number Comes From &amp; How It Moves Through Aarka
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">/sources</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/data-transparency-lineage.png",
                      alt: "Where data comes from screen showing 1. Comes in, 2. Aarka works on it (Read AI, Clean Code, Check Code, Label Code), and 3. Shows up for the team.",
                      caption:
                        "Data Lineage (/sources): Shows every input source, the exact division between AI reading and deterministic code checking, and where verified figures appear across the workspace.",
                    })
                  }
                  className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/aarka/data-transparency-lineage.png"
                    alt="Where data comes from diagram showing the route a number takes from founder files through AI reading and code checks to team views."
                    className="w-full object-cover transition duration-500 group-hover:scale-[1.005]"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 9 — BUILT FOR INVESTMENT TEAMS & FOUNDER EXPERIENCE
           =================================================================== */}
        <section id="teams" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                Role-Specific Workspaces
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                Built for investment teams—and respectful of founders’ time.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Aarka provides tailored views for investment partners and analysts inside the fund, paired with a clean, direct submission experience for founders.
              </p>
            </div>

            {/* Two Venture Team Pathways */}
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-blue-900">
                      Investment Partners
                    </span>
                    <span className="text-xs font-medium text-slate-500">Fund-Wide Oversight</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                    Portfolio visibility, thesis alignment, and high-conviction decisions.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    See the entire fund at a glance: which screened pitches need a partner decision this week, which portfolio companies have shrinking runway or overdue reports, how inbound sector momentum is shifting, and how pitch load is distributed across analysts.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Weekly decision queue and portfolio watch list</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Configurable fund rules (stage, sector, geography, round cap)</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <span>Team workload overview and direct partner-to-analyst questions on any metric</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 sm:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900">
                      Analysts
                    </span>
                    <span className="text-xs font-medium text-slate-500">Diligence &amp; Execution</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                    Structured pitch screening, automated checks, and clean data rooms.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Focus on your assigned companies and unclaimed inbound decks. Run AI deck extraction and deterministic code checks, inspect page-cited evidence matrices, send structured document request links to founders, and file incoming materials in the data room.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span>Personal work queue: decks to screen, numbers to verify, and reports to read</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span>One-click founder document request links mapped to diligence checklist items</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      <span>Printable HTML/PDF tear-sheets and line-by-line audit reports</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Founder Experience Showcase */}
            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-5">
                  <span className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Founder Experience
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                    A frictionless front door for founders.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    Founders can submit their pitch deck (up to 100 MB PDF) and core company details directly through Aarka’s public intake link, or sign in with Google to track their submission status and upload financial sheets in the Founder Portal.
                  </p>
                  <ul className="mt-5 space-y-2 text-xs text-slate-600">
                    <li>· Direct-to-vault document uploads up to 100 MB</li>
                    <li>· Automatic role routing on sign-in: Founders enter the Founder Portal; fund members enter the Investment Workspace</li>
                    <li>· Original files kept exactly as submitted</li>
                  </ul>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href="/pitch"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
                    >
                      Open Founder Pitch Form →
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Founder Portal Sign In
                    </Link>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-12 lg:col-span-7">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:col-span-7">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
                      Public Founder Pitch Intake (/pitch)
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/founder-pitch-portal.png",
                          alt: "Aarka Submit your pitch page allowing founders to enter company details and upload a pitch deck PDF up to 100 MB.",
                          caption:
                            "Founder Pitch Intake (/pitch): Clean external submission form supporting direct PDF uploads up to 100 MB.",
                        })
                      }
                      className="group block w-full cursor-zoom-in overflow-hidden bg-white text-left focus:outline-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/images/aarka/founder-pitch-portal.png"
                        alt="Founder pitch submission form showing founder details, company details, and 100 MB PDF upload dropzone."
                        className="w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                      />
                    </button>
                  </div>

                  <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:col-span-5">
                    <div>
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
                        Role-Verified Sign-In (/login)
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/auth-signin.png",
                            alt: "Sign in to Aarka screen with Google OAuth and server-side role verification.",
                            caption:
                              "Unified Google Sign-In (/login): Server-side role verification routes fund partners and analysts to the Investment Workspace and founders to the Founder Portal.",
                          })
                        }
                        className="group block w-full cursor-zoom-in overflow-hidden bg-white p-2 text-left focus:outline-none"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/aarka/auth-signin.png"
                          alt="Sign in to Aarka screen with Continue with Google button."
                          className="w-full rounded-lg object-contain transition duration-500 group-hover:scale-[1.01]"
                        />
                      </button>
                    </div>
                    <div className="border-t border-slate-100 bg-slate-50/60 p-3.5 text-[11px] leading-relaxed text-slate-600">
                      Server-side RBAC verifies each account on sign-in and routes partners, analysts, and founders to their respective workspaces automatically.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 10 — FINAL CONVERSION SECTION
           =================================================================== */}
        <section id="early-access" className="scroll-mt-16 border-b border-slate-200/80 bg-[#080C11] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1 text-xs font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Aarka Investment Intelligence</span>
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-balance text-white sm:text-5xl">
              Make every investment decision more informed.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Bring your deal flow, diligence and investment intelligence into one workspace.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-white px-6 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{authLoading ? "Redirecting to Google…" : "Request Early Access"}</span>
              </button>

              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] px-6 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              >
                Sign In to Workspace
              </Link>
            </div>

            <p className="mx-auto mt-5 max-w-xl text-xs leading-relaxed text-slate-400">
              Signing in with Google authenticates your identity and logs your access request with the administrator. Authorised investment team members enter the Investment Workspace directly; founders are routed to the Founder Portal or can{" "}
              <Link href="/pitch" className="text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white">
                submit a pitch deck directly
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      {/* =====================================================================
          SECTION 11 — FOOTER
         ===================================================================== */}
      <footer className="bg-white py-12 text-slate-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-slate-200 pb-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aarka-logo.png"
                  alt="Aarka logo"
                  className="h-7 w-7 shrink-0 rounded-md object-cover"
                />
                <span className="text-base font-semibold text-slate-950">Aarka</span>
              </div>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-600">
                Investment intelligence and deal-flow management platform for venture capital teams. One record per company from first pitch to latest monthly report.
              </p>
              <p className="mt-3 font-mono text-[11px] text-slate-500">
                AI reads and explains · Code validates and calculates · People decide.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                  Platform
                </h3>
                <ul className="mt-3 space-y-2 text-xs">
                  <li>
                    <a href="#platform" className="hover:text-slate-950">
                      Workflow Overview
                    </a>
                  </li>
                  <li>
                    <a href="#diligence" className="hover:text-slate-950">
                      Financial Due Diligence
                    </a>
                  </li>
                  <li>
                    <a href="#market" className="hover:text-slate-950">
                      Market Intelligence
                    </a>
                  </li>
                  <li>
                    <a href="#pipeline" className="hover:text-slate-950">
                      Deal-Flow Pulse
                    </a>
                  </li>
                  <li>
                    <a href="#portfolio" className="hover:text-slate-950">
                      Portfolio Intelligence
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                  Architecture
                </h3>
                <ul className="mt-3 space-y-2 text-xs">
                  <li>
                    <a href="#how-it-works" className="hover:text-slate-950">
                      AI, Code &amp; Human Layers
                    </a>
                  </li>
                  <li>
                    <a href="#teams" className="hover:text-slate-950">
                      For Partners &amp; Analysts
                    </a>
                  </li>
                  <li>
                    <a href="#teams" className="hover:text-slate-950">
                      For Founders
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                  Access
                </h3>
                <ul className="mt-3 space-y-2 text-xs">
                  <li>
                    <Link href="/login" className="hover:text-slate-950">
                      Sign In (Google OAuth)
                    </Link>
                  </li>
                  <li>
                    <a href="#early-access" className="hover:text-slate-950">
                      Request Early Access
                    </a>
                  </li>
                  <li>
                    <Link href="/pitch" className="hover:text-slate-950">
                      Submit a Pitch Deck
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Aarka. All rights reserved.</p>
            <p>
              Product screenshots display illustrative sample company data for demonstration purposes.
            </p>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          FULLSCREEN SCREENSHOT LIGHTBOX MODAL
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
            className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-xs font-semibold text-slate-800">{lightbox.caption}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close (Esc)
              </button>
            </div>
            <div className="max-h-[calc(92vh-52px)] overflow-auto bg-slate-100 p-2 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                className="mx-auto w-full rounded-lg border border-slate-200 bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
