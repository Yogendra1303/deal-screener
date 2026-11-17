"use client";

import { signIn as nextAuthSignIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccessRequestModal } from "./access-request-modal";

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
    targetId: "teams",
    body: "Collect founder pitch decks and monthly financial sheets through a single public link or analyst request—preserved as received in the company data room.",
  },
  {
    num: "02",
    title: "Structure",
    targetId: "architecture",
    body: "AI reads unstructured deck slides and tables into a standardised company record, attaching the file, page number and a verbatim quote to every claim.",
  },
  {
    num: "03",
    title: "Validate",
    targetId: "capabilities",
    body: "Deterministic code checks ARR against MRR, cash runway against net burn, and deck figures against monthly CSV rows—flagging any discrepancy over 10%.",
  },
  {
    num: "04",
    title: "Evaluate",
    targetId: "pipeline",
    body: "Code applies your fund’s written rules (stage, sector, geography, round size) alongside traction and founder-fit assessments to sort opportunities clearly.",
  },
  {
    num: "05",
    title: "Monitor",
    targetId: "portfolio",
    body: "Track re-engagement triggers on passed deals and monitor monthly MIS reporting, cash runway and plan variance across every portfolio company.",
  },
] as const;

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [SigningIn, setSigningIn] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
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

  function scrollToSection(id: string) {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleSignIn() {
    setSigningIn(true);
    void nextAuthSignIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF9F6] text-slate-900 selection:bg-slate-900 selection:text-white">
      {/* =====================================================================
          HEADER & NAVIGATION — Clean, Minimal, Institutional
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
            <Image
              src="/aarka-logo.png"
              alt="Aarka"
              width={26}
              height={26}
              unoptimized
              className="h-[26px] w-[26px] shrink-0 rounded-md object-contain ring-1 ring-slate-900/10"
            />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Aarka</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            <button
              type="button"
              onClick={() => scrollToSection("workflow")}
              className="cursor-pointer text-[13.5px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Workflow
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("capabilities")}
              className="cursor-pointer text-[13.5px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Capabilities
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("architecture")}
              className="cursor-pointer text-[13.5px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("teams")}
              className="cursor-pointer text-[13.5px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              For Venture Teams
            </button>
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/pitch"
              className="text-[13.5px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Submit a Pitch
            </Link>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="text-[13.5px] font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              Request Access
            </button>
            <span aria-hidden className="h-4 w-px bg-slate-200" />
            <Link
              href="/login"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-slate-800"
            >
              Sign In
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 md:hidden"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-5 shadow-md md:hidden">
            <nav className="flex flex-col space-y-1">
              <button
                type="button"
                onClick={() => scrollToSection("workflow")}
                className="rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Workflow
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("capabilities")}
                className="rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Capabilities
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("architecture")}
                className="rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Architecture
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("teams")}
                className="rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                For Venture Teams
              </button>
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
              <Link
                href="/pitch"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
              >
                Submit a Pitch
              </Link>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={SigningIn}
                className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white"
              >
                {SigningIn ? "Connecting…" : "Sign In"}
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ===================================================================
            HERO — Restrained Editorial Hierarchy & Centered Compact Showcase
           =================================================================== */}
        <section className="border-b border-slate-200/80 bg-white pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                  INVITE-ONLY INSTITUTIONAL PLATFORM
                </span>
              </div>

              <h1 className="mt-4 font-serif text-4xl font-normal tracking-[-0.02em] text-balance text-slate-950 sm:text-5xl lg:text-[52px] lg:leading-[1.08]">
                See beyond the pitch.
              </h1>

              <p className="mt-3 text-base font-medium tracking-[-0.01em] text-slate-800 sm:text-lg">
                One workspace for more informed investment decisions.
              </p>

              <p className="mx-auto mt-3.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                Reduce the manual work involved in screening, structuring and reviewing investment opportunities without removing human investment judgment. Turn incoming pitches into structured records, validate financial claims and track your pipeline with clarity.
              </p>

              <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-[13.5px] font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/35"
                >
                  <span>Explore the Platform →</span>
                </button>
                <Link
                  href="/login"
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 rounded-md bg-slate-900 px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-slate-800"
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
                  <span>Partner Sign In</span>
                </Link>
                <Link
                  href="/pitch"
                  className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-[13.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                >
                  Submit a Pitch
                </Link>
              </div>

              <p className="mx-auto mt-3.5 max-w-xl text-xs leading-relaxed text-slate-500">
                <strong className="font-medium text-slate-700">Invite-only fund workspace:</strong> Verified fund partners and analysts enter with credentials. If you are exploring for a fund, click{" "}
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-4 hover:text-blue-800 cursor-pointer"
                >
                  Explore the Platform
                </button>{" "}
                to request trial access. Founders submit decks via{" "}
                <Link href="/pitch" className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
                  Pitch Form
                </Link>
                .
              </p>
            </div>

            {/* Centered Hero Product Showcase (880px max width) */}
            <div className="mx-auto mt-12 max-w-[880px]">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_12px_36px_-12px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span className="ml-2 text-[11px] font-medium text-slate-500">
                      Aarka — Partner Workspace
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        src: "/images/aarka/hero-workspace.png",
                        width: 1024,
                        height: 575,
                        alt: "Aarka main investment workspace showing active deal-flow pipeline, team distribution, sector momentum map and incoming pitches.",
                        caption: "Main Investment Workspace: Live deal flow, sector heatmaps, partner notifications, team workload and incoming pitches.",
                      })
                    }
                    className="cursor-pointer text-[11px] font-medium text-slate-600 hover:text-slate-950"
                  >
                    Expand view ↗
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/hero-workspace.png",
                      width: 1024,
                      height: 575,
                      alt: "Aarka main investment workspace showing active deal-flow pipeline, team distribution, sector momentum map and incoming pitches.",
                      caption: "Main Investment Workspace: Live deal flow, sector heatmaps, partner notifications, team workload and incoming pitches.",
                    })
                  }
                  aria-label="Inspect Main Investment Workspace screenshot in full size"
                  className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                >
                  <Image
                    src="/images/aarka/hero-workspace.png"
                    alt="Aarka main investment workspace showing active deal-flow pipeline, team distribution, sector momentum map and incoming pitches."
                    width={1024}
                    height={575}
                    unoptimized
                    priority
                    className="block h-auto w-full object-contain"
                  />
                </button>
              </div>
              <p className="mt-2.5 text-center text-[11px] text-slate-400">
                Sample demonstration pipeline and company records shown for illustration. Click any preview to inspect full size.
              </p>
            </div>
          </div>
        </section>

        {/* ===================================================================
            THE AARKA WORKFLOW — 5-Step Connected Sequence
           =================================================================== */}
        <section id="workflow" className="scroll-mt-16 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                THE INVESTMENT WORKFLOW
              </p>
              <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                From incoming pitches to informed decisions.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                Every stage of a deal carries manual work—extracting deck claims, cross-checking CSV sheets, verifying registry dates and tracking monthly reports. Aarka structures and validates the record so your team can focus on judgment.
              </p>
            </div>

            <div className="mt-10 border-t border-slate-200/90 pt-8">
              <ol className="grid gap-6 md:grid-cols-5 md:gap-6">
                {WORKFLOW_STEPS.map((step) => (
                  <li
                    key={step.num}
                    className="relative border-l border-slate-300 pl-4 md:border-l-0 md:pl-0"
                  >
                    <button
                      type="button"
                      onClick={() => scrollToSection(step.targetId)}
                      className="group block cursor-pointer text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-500">
                          {step.num}
                        </span>
                        <span className="text-slate-300">—</span>
                        <h3 className="text-sm font-semibold text-slate-950 group-hover:text-blue-700">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.body}</p>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ===================================================================
            01 · FINANCIAL DUE DILIGENCE (Text Left, Compact Preview Right)
           =================================================================== */}
        <section id="capabilities" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  01 · FINANCIAL DUE DILIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Every number deserves a closer look.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Aarka compares stated pitch deck figures against the founder’s monthly CSV sheet, intake form and registry record. Original claims remain untouched while variances over 10% are flagged with their exact formula.
                </p>

                <dl className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Revenue, growth &amp; runway verification</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Cross-checks stated ARR against MRR×12, runway against cash divided by net burn, and deck growth against compounded monthly CSV rows.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Missing facts &amp; discrepancy flags</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Highlights omitted core metrics (such as customer count or cash balance) and flags &gt;10% discrepancies before the first partner call.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Linked source evidence &amp; founder domain fit</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Every company record links its Deck summary, Monthly CSV, Financial snapshot, Intake form and printable Audit report.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="lg:col-span-7">
                <div className="mx-auto max-w-[560px]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="inline-flex rounded-md border border-slate-200 bg-slate-100/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => setDiligenceTab("audit")}
                        className={
                          diligenceTab === "audit"
                            ? "cursor-pointer rounded bg-white px-2.5 py-1 text-xs font-medium text-slate-950 shadow-2xs"
                            : "cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                        }
                      >
                        Diligence Checks
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiligenceTab("compare")}
                        className={
                          diligenceTab === "compare"
                            ? "cursor-pointer rounded bg-white px-2.5 py-1 text-xs font-medium text-slate-950 shadow-2xs"
                            : "cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                        }
                      >
                        Growth Benchmark
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400">Click to enlarge ↗</span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-8px_rgba(15,23,42,0.07)]">
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
                        className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
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
                        className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
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
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            02 · MARKET INTELLIGENCE (Compact Preview Left, Text Right)
           =================================================================== */}
        <section id="market" className="scroll-mt-16 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="order-2 lg:order-1 lg:col-span-7">
                <div className="mx-auto max-w-[560px]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setMarketTab("momentum")}
                        className={
                          marketTab === "momentum"
                            ? "cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                            : "cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                        }
                      >
                        Momentum Map
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarketTab("sector")}
                        className={
                          marketTab === "sector"
                            ? "cursor-pointer rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                            : "cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                        }
                      >
                        B2B Software Drilldown
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
                                caption: "Market Intelligence (/sectors): Sector momentum scatter plot paired with monthly inbound deck breakdown.",
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
                      className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-950"
                    >
                      Open full dashboard ↗
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-8px_rgba(15,23,42,0.07)]">
                    {marketTab === "momentum" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: "/images/aarka/market-momentum-map.png",
                            width: 992,
                            height: 658,
                            alt: "Full Market Intelligence dashboard showing sector KPI strip, Momentum map and monthly deck volume.",
                            caption: "Market Intelligence (/sectors): Sector momentum scatter plot paired with monthly inbound deck breakdown.",
                          })
                        }
                        aria-label="Inspect full Market Intelligence dashboard in lightbox"
                        className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
                      >
                        <Image
                          src="/images/aarka/market-momentum-chart-crop.png"
                          alt="Aarka Sector Momentum Map plotting decks received against money raised across Heating up, Crowding, Steady and Cooling quadrants."
                          width={570}
                          height={446}
                          unoptimized
                          className="mx-auto block h-auto w-full object-contain"
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
                        className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
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
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:col-span-5">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  02 · MARKET INTELLIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Know where the market is moving.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Analyse sector momentum directly from your fund’s inbound pitch flow against tracked market funding—identifying which categories are heating up, crowding or cooling.
                </p>

                <dl className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Quantified sector temperature (±15% rule)</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Compares the last 3 months of inbound decks against the prior 3-month window and 90-day capital raised across each sector.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Sector &amp; sub-category drilldowns</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Click any sector to inspect cohort conversion from pitched to meeting alongside founder-market fit distributions.
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            03 · DEAL-FLOW MANAGEMENT (Text Left, Compact Preview Right)
           =================================================================== */}
        <section id="pipeline" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  03 · DEAL-FLOW MANAGEMENT
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Every opportunity. One clear pipeline.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Organise incoming pitches across To Read, Look Again, Meetings and Passed queues—keeping pass reasoning and re-engagement triggers intact across funding cycles.
                </p>

                <dl className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Rule-fit &amp; verification filters</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Filter the pipeline by Strong Founder Fit, Math Gap &gt;10%, Missing Facts, Re-Engage Due and Never Opened status.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Look-again triggers on passed deals</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Record why you passed and set a scheduled check date or milestone trigger so companies automatically resurface when ready.
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="lg:col-span-7">
                <div className="mx-auto max-w-[560px]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Deal Flow Pulse (/deals)</span>
                    <span className="text-[11px] text-slate-400">Click to enlarge ↗</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-8px_rgba(15,23,42,0.07)]">
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
                      className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
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
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            04 · PORTFOLIO INTELLIGENCE (Compact Preview Left, Text Right)
           =================================================================== */}
        <section id="portfolio" className="scroll-mt-16 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="order-2 lg:order-1 lg:col-span-7">
                <div className="mx-auto max-w-[560px]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Portfolio Health Grid (/portfolio)</span>
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
                      className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-950"
                    >
                      Open full workspace view ↗
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-8px_rgba(15,23,42,0.07)]">
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
                      className="block w-full cursor-zoom-in bg-white text-left focus:outline-none"
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
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:col-span-5">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  04 · PORTFOLIO INTELLIGENCE
                </p>
                <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                  Stay close to every portfolio company.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Monitor monthly MIS reporting, cash runway, burn and revenue against the pitch deck’s original plan—so quiet reporting or tightening runway is spotted early.
                </p>

                <dl className="mt-7 space-y-4 border-t border-slate-200/80 pt-5">
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Runway, burn &amp; plan variance</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Computes months of cash left at latest net burn and compares reported monthly revenue against the deck’s forecast.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-900">Reporting cadence &amp; health status</dt>
                    <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                      Flags overdue MIS reports and assigns Needs help, Watch or Healthy indicators from deterministic code rules.
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            THE AARKA DIFFERENCE — AI -> Code -> People Architecture
           =================================================================== */}
        <section id="architecture" className="scroll-mt-16 border-b border-slate-200/80 bg-[#0F172A] py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                THE AARKA ARCHITECTURE
              </p>
              <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-white sm:text-4xl">
                AI reads and explains. Code checks the numbers. People decide.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Aarka separates document reading, financial calculation and investment judgment into three distinct layers so every figure remains traceable to its source.
              </p>
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">
              <div className="bg-[#131C31] p-6">
                <span className="font-mono text-xs font-medium text-slate-400">01 · AI Layer</span>
                <h3 className="mt-3 font-serif text-lg font-normal text-white">
                  Extracts, structures and explains.
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Reads pages, charts and tables from pitch decks into one standard company record—keeping the file name, page number and a verbatim quote for every fact without doing the sums.
                </p>
              </div>

              <div className="bg-[#131C31] p-6">
                <span className="font-mono text-xs font-medium text-emerald-400">02 · Code Layer</span>
                <h3 className="mt-3 font-serif text-lg font-normal text-white">
                  Validates and calculates deterministically.
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Compares deck, form, monthly CSV sheet, MIS and registry records. Calculates runway, growth and burn multiple, and labels every figure Checked, Reported, Claimed, Conflict or Missing.
                </p>
              </div>

              <div className="bg-[#131C31] p-6">
                <span className="font-mono text-xs font-medium text-slate-400">03 · Human Layer</span>
                <h3 className="mt-3 font-serif text-lg font-normal text-white">
                  Reviews evidence and makes the call.
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Analysts and partners inspect source quotes, resolve conflicts with founders, override bands with written reasoning when warranted and record the final investment decision.
                </p>
              </div>
            </div>

            <div className="mt-8 grid items-center gap-8 rounded-xl border border-white/10 bg-[#131C31]/70 p-5 sm:p-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className="font-mono text-[11px] text-slate-400">Data Lineage (/sources)</span>
                <h3 className="mt-1.5 font-serif text-xl font-normal text-white">
                  Full provenance for every metric.
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Every number in Aarka starts in a file a founder sent or a public record. A conflict stays open until a person settles it with a source—AI never changes a founder’s number.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setLightbox({
                      src: "/images/aarka/data-transparency-lineage.png",
                      width: 998,
                      height: 655,
                      alt: "Where data comes from diagram showing 1. Comes in, 2. Aarka works on it, and 3. Shows up for the team.",
                      caption: "Where Data Comes From (/sources): End-to-end lineage from founder files through AI extraction and code verification.",
                    })
                  }
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white"
                >
                  <span>Inspect data lineage diagram ↗</span>
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
                        alt: "Where data comes from diagram showing 1. Comes in, 2. Aarka works on it, and 3. Shows up for the team.",
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
            FOR INVESTMENT TEAMS & FOUNDER EXPERIENCE
           =================================================================== */}
        <section id="teams" className="scroll-mt-16 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                ROLE-VERIFIED ACCESS
              </p>
              <h2 className="mt-2.5 font-serif text-3xl font-normal tracking-[-0.015em] text-slate-950 sm:text-4xl">
                Built for partners, analysts and founders.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                One unified Google Sign-In routes authorised investment team members to the fund workspace and directs all other visitors straight to the Founder Pitch Form.
              </p>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="space-y-4 lg:col-span-6">
                <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Investment Partners</h3>
                    <span className="font-mono text-[11px] text-slate-500">Invite-Only · Partner View</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Fund-wide visibility, weekly decision queue, inbound pipeline velocity, sector momentum trends, configurable fund rules and portfolio oversight.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Investment Analysts</h3>
                    <span className="font-mono text-[11px] text-slate-500">Invite-Only · Analyst View</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Pitch screening queue, AI deck extraction, deterministic math and registry verification, page-cited evidence matrices and founder document request links.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Founders</h3>
                    <span className="font-mono text-[11px] text-slate-500">Open Pitch Intake</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    Anyone signing in without an authorised fund email is routed directly to the Founder Pitch Form to submit their deck (up to 100 MB PDF) and track review status.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="mx-auto max-w-[460px]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Founder Pitch Submission (/pitch)</span>
                    <span className="text-[11px] text-slate-400">Click to enlarge ↗</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-8px_rgba(15,23,42,0.07)]">
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: "/images/aarka/founder-pitch-portal.png",
                          width: 605,
                          height: 657,
                          alt: "Aarka founder pitch submission page with company details and 100 MB PDF deck upload.",
                          caption: "Founder Pitch Intake (/pitch): Direct submission experience for founders.",
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
            FINAL CONVERSION SECTION
           =================================================================== */}
        <section className="border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-normal tracking-[-0.015em] text-balance text-slate-950 sm:text-4xl">
              Make every investment decision more informed.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Bring deal flow, diligence and investment intelligence into one connected workspace.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={SigningIn}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 rounded-md bg-slate-900 px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                <span>{SigningIn ? "Redirecting to Google…" : "Sign In with Google"}</span>
              </button>
              <Link
                href="/pitch"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-[13.5px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                Submit a Founder Pitch
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          FOOTER
         ===================================================================== */}
      <footer className="bg-white py-10 text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Image
                src="/aarka-logo.png"
                alt="Aarka"
                width={22}
                height={22}
                unoptimized
                className="h-[22px] w-[22px] shrink-0 rounded-md object-contain"
              />
              <span className="text-sm font-semibold text-slate-950">Aarka</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">
                Investment intelligence and deal-flow management for venture capital teams.
              </span>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => scrollToSection("workflow")}
                className="cursor-pointer hover:text-slate-950"
              >
                Workflow
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("capabilities")}
                className="cursor-pointer hover:text-slate-950"
              >
                Capabilities
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("architecture")}
                className="cursor-pointer hover:text-slate-950"
              >
                Architecture
              </button>
              <Link href="/pitch" className="hover:text-slate-950">
                Submit a Pitch
              </Link>
              <button
                type="button"
                onClick={handleSignIn}
                className="cursor-pointer font-semibold text-slate-900 hover:text-slate-700"
              >
                Sign In
              </button>
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
                unoptimized
                className="mx-auto block h-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Institutional Invite Access Request Modal */}
      <AccessRequestModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
