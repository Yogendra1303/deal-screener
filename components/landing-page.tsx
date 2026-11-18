import Link from "next/link";
import {
  CapabilitiesInteractiveTabs,
  MobileHeaderMenu,
  PartnerSignInButton,
  WorkflowInteractiveGrid,
  WorkspaceRequestFormClient,
} from "./landing-interactive";

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Aarka",
  url: "https://www.aarkavc.xyz",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "A structured workspace for startup pitches and investor review. Bring startup submissions and investment opportunities into a structured review process with source-cited extraction, deterministic financial cross-checks, and portfolio monitoring.",
  featureList: [
    "Startup pitch deck and monthly CSV financial sheet intake",
    "Source-cited slide claim extraction with verbatim page provenance",
    "Deterministic financial cross-checks against monthly CSVs (ARR vs. MRR x 12, runway, compounded growth)",
    "Cap table, SAFE, and priced round dilution modeling with explicit assumptions",
    "Portfolio MIS reporting health and fund analytics",
  ],
};

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#FAF9F6] font-sans text-slate-900 selection:bg-slate-900 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      {/* =====================================================================
          AFFINITY-INSPIRED COMPACT NAVIGATION
          Platform (dropdown) · For Founders · For Funds · Data & Privacy
          Actions: Partner Sign In · Request Fund Workspace
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aarka-logo.png"
              alt="Aarka logo"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md object-contain ring-1 ring-slate-900/10"
            />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">Aarka</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {/* Discoverability Dropdown for Platform */}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950">
                <span>Platform</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="absolute left-0 mt-2.5 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/5">
                <a
                  href="#workflow"
                  className="block rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="text-xs font-semibold text-slate-900">Five-Stage Workflow</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Collect, Structure, Verify, Review, Monitor</div>
                </a>
                <a
                  href="#capabilities"
                  className="block rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="text-xs font-semibold text-slate-900">Platform Capabilities</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Diligence, Pipeline, Review &amp; Portfolio</div>
                </a>
              </div>
            </details>

            <a
              href="#for-founders"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              For Founders
            </a>
            <a
              href="#request-workspace"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              For Funds
            </a>
            <a
              href="#privacy"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Data &amp; Privacy
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 lg:flex">
            <PartnerSignInButton
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
            />
            <a
              href="#request-workspace"
              className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
            >
              Request Fund Workspace
            </a>
          </div>

          <MobileHeaderMenu />
        </div>
      </header>

      <main>
        {/* ===================================================================
            STATIC ABOVE-THE-FOLD HERO SECTION
            Geist Sans H1 (58-64px desktop / 40-44px mobile, 600 weight, 1.06 line-height)
           =================================================================== */}
        <section className="relative border-b border-slate-200/80 pt-12 pb-16 sm:pt-16 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium tracking-wide text-slate-700">
                  SOURCE-CITED DILIGENCE · DETERMINISTIC FINANCIAL CHECKS
                </span>
              </div>

              <h1 className="mx-auto mt-5 max-w-[16ch] font-sans text-[clamp(2.5rem,4.2vw+1rem,3.875rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-balance text-slate-950 sm:max-w-[18ch]">
                From startup pitch to investment review.
              </h1>

              <p className="mx-auto mt-4 max-w-[56ch] font-sans text-[clamp(1rem,0.35vw+0.92rem,1.125rem)] font-normal leading-[1.6] text-pretty text-slate-600">
                Turn startup pitches into evidence-backed investment reviews. Aarka structures founder submissions, extracts source-cited slide claims, cross-checks financial figures against monthly CSV records, and supports partner review and portfolio monitoring in one workspace.
              </p>

              {/* Strictly Two Primary CTAs */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#request-workspace"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
                >
                  <span>Request Fund Workspace</span>
                  <span aria-hidden="true">→</span>
                </a>

                <Link
                  href="/pitch"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-xs font-semibold text-slate-900 shadow-2xs transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <span>Submit a Pitch</span>
                </Link>
              </div>
            </div>

            {/* ===============================================================
                HERO PRODUCT VISUAL: VELORA SYSTEMS DISCREPANCY SPOTLIGHT
               =============================================================== */}
            <div className="mx-auto mt-10 max-w-4xl sm:mt-12">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/5">
                {/* Browser Window Chrome Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    </div>
                    <span className="ml-2 rounded border border-slate-200/90 bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-600">
                      aarkavc.xyz/deals/velora-systems
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700">
                      Velora Systems · Seed · $1.50M Ask
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Synthetic Demo Record
                    </span>
                  </div>
                </div>

                {/* Primary Focal Point: Side-by-Side Growth Discrepancy Spotlight */}
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        Automated Financial Cross-Check · Monthly Revenue Growth
                      </span>
                      <h2 className="mt-1 font-sans text-base font-semibold tracking-[-0.01em] text-slate-950 sm:text-lg">
                        Deck claim cross-checked against submitted monthly CSV rows
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-2xs">
                      <span>53.8% discrepancy flagged</span>
                    </span>
                  </div>

                  {/* Side-by-Side Comparison Cards */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {/* Left: What the founder claims */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">What the founder claims</span>
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
                          Pitch Deck · Slide p. 6
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-mono text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                          14.0%
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          Monthly revenue growth, pitch deck
                        </span>
                      </div>
                      <p className="mt-2.5 font-mono text-[11px] text-slate-600">
                        &ldquo;Growing 14.0% month-over-month across enterprise accounts.&rdquo;
                      </p>
                    </div>

                    {/* Right: What the financial records show */}
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-rose-950">What the financial records show</span>
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-rose-800 ring-1 ring-rose-200">
                          Submitted CSV · Apr to Sep
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-mono text-3xl font-bold tracking-tight text-rose-700 sm:text-4xl">
                          9.1%
                        </span>
                        <span className="text-xs font-medium text-rose-900">
                          Compounded monthly growth, submitted CSV
                        </span>
                      </div>
                      <p className="mt-2.5 font-mono text-[11px] text-rose-900/80">
                        Variance: (14.0% - 9.1%) / 9.1% = +53.8% (exceeds 10.0% default review threshold).
                      </p>
                    </div>
                  </div>

                  {/* Secondary Corroborated Checks & Transparent SAFE Assumptions Strip */}
                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">ARR vs. CSV MRR x 12</span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          Source Corroborated
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-600">
                        $1.44M (Slide p. 4) = $120K MRR x 12 (0.0% gap).
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">Cash Runway Math</span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                          Arithmetic Checked
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-600">
                        $1.16M cash / $80K net burn = 14.5 months.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">SAFE Ownership ($600K)</span>
                        <span className="font-mono text-[11px] font-semibold text-blue-700">
                          10.0% Post-Round
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-600">
                        Post-Money SAFE · $6.0M Cap · 0% Disc · 10.0% Option Pool.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-[11px] text-slate-600">
                Synthetic demonstration data illustrating Aarka&apos;s source-cited extraction and deterministic financial cross-checks (10.0% default review threshold, configurable per fund rule).
              </p>
            </div>
          </div>
        </section>

        {/* ===================================================================
            PRODUCT WORKFLOW: 5-Stage Narrative (Collect, Structure, Verify, Review, Monitor)
           =================================================================== */}
        <section id="workflow" className="scroll-mt-20 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                Product Workflow
              </p>
              <h2 className="mt-2 max-w-[23ch] font-sans text-[clamp(1.875rem,2.6vw+0.9rem,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance text-slate-950">
                A Structured Workspace for Startup Pitches and Investor Review.
              </h2>
              <p className="mt-3 max-w-[56ch] font-sans text-[clamp(1rem,0.25vw+0.92rem,1.125rem)] font-normal leading-[1.6] text-slate-600">
                Bring startup submissions and investment opportunities into a structured review process across five connected stages.
              </p>
            </div>

            <WorkflowInteractiveGrid />
          </div>
        </section>

        {/* ===================================================================
            PLATFORM CAPABILITIES: Four Consistently Styled Product Panels
           =================================================================== */}
        <section id="capabilities" className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <CapabilitiesInteractiveTabs />
          </div>
        </section>

        {/* ===================================================================
            DATA & PRIVACY: AI Extraction vs. Deterministic Code vs. Human Decisions
            + Native Progressive Disclosure for Technical Security Architecture
           =================================================================== */}
        <section id="privacy" className="scroll-mt-20 border-b border-slate-200/80 bg-slate-950 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-400">
                Data Handling &amp; Privacy
              </p>
              <h2 className="mt-2 max-w-[22ch] font-sans text-[clamp(1.875rem,2.6vw+0.9rem,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance text-white">
                AI reads and cites. Code checks the math. Partners decide.
              </h2>
              <p className="mt-3 max-w-[56ch] font-sans text-[clamp(1rem,0.25vw+0.92rem,1.125rem)] font-normal leading-[1.6] text-slate-300">
                Aarka preserves original founder documents while separating information extraction, deterministic financial calculations, and partner investment decisions.
              </p>
            </div>

            {/* 3 Partner-Facing Pillars */}
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-blue-400">01 · AI Extraction</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Read &amp; Cite</span>
                </div>
                <h3 className="mt-2.5 font-sans text-[clamp(1.25rem,0.8vw+0.95rem,1.45rem)] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
                  Original files remain intact
                </h3>
                <p className="mt-2 font-sans text-[clamp(0.95rem,0.15vw+0.9rem,1.025rem)] font-normal leading-[1.6] text-slate-300">
                  Uploaded founder PDFs and monthly CSV sheets are preserved without alteration. AI extracts slide claims with exact page citations and never computes financial ratios.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-400">02 · Deterministic Code</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Check &amp; Flag</span>
                </div>
                <h3 className="mt-2.5 font-sans text-[clamp(1.25rem,0.8vw+0.95rem,1.45rem)] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
                  Auditable calculations
                </h3>
                <p className="mt-2 font-sans text-[clamp(0.95rem,0.15vw+0.9rem,1.025rem)] font-normal leading-[1.6] text-slate-300">
                  Financial checks (ARR vs. MRR x 12, runway, compounded CSV growth) and SAFE dilution models run in deterministic TypeScript code rather than LLM-generated arithmetic.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-amber-300">03 · Human Decisions</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Override &amp; Vote</span>
                </div>
                <h3 className="mt-2.5 font-sans text-[clamp(1.25rem,0.8vw+0.95rem,1.45rem)] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
                  Controlled workspace access
                </h3>
                <p className="mt-2 font-sans text-[clamp(0.95rem,0.15vw+0.9rem,1.025rem)] font-normal leading-[1.6] text-slate-300">
                  Partner and analyst access is restricted through invite-only, role-based authorization. Partners can override any score or record IC votes with a written rationale.
                </p>
              </div>
            </div>

            {/* Native HTML Progressive Disclosure for Deep Technical Controls */}
            <details className="group mt-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-xs font-semibold tracking-wide text-slate-200 transition-colors hover:bg-slate-900/90 sm:text-sm">
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
                  <span>View Technical Security Architecture</span>
                </span>
                <span className="font-mono text-xs text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  ↓
                </span>
              </summary>
              <div className="grid gap-4 border-t border-slate-800/90 p-5 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Row-Level Founder Isolation (HMAC-SHA256)
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Each pitch submission receives a per-deal HMAC-SHA256 token bound to that specific deal ID. A token for one pitch cannot read, list, or enumerate any other founder&apos;s pitch deck or data room files.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Default-Deny Route Proxy &amp; Invite-Only OAuth
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Internal workspace routes (/deals, /portfolio, /fund, /dataroom, /team) and APIs are gated by a default-deny middleware proxy. Only partner-whitelisted Google OAuth accounts receive workspace sessions.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Binary File Validation &amp; Non-Public Storage
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Uploaded pitch decks are checked against %PDF- magic bytes (up to 32 MB) and financial sheets against UTF-8 CSV/TSV or ZIP/XLSX headers (up to 10 MB) before storage in isolated, non-public buckets.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Scoped Anthropic API or Manual Account-Bridge
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    Teams can run slide extraction via a server-side Anthropic API key or use the manual account-bridge workflow to process prompts in their own subscription and paste schema-validated JSON back into the workspace.
                  </p>
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* ===================================================================
            AUDIENCE SEGMENTATION TRACK 1: FOR FOUNDERS (/pitch)
            Dedicated founder conversion experience separated from fund onboarding
           =================================================================== */}
        <section id="for-founders" className="scroll-mt-20 border-b border-slate-200/80 bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-[#FAF9F6] p-6 sm:p-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    For Founders
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                    Early-Stage Mandate · Up to $4M
                  </span>
                </div>
                <h2 className="max-w-[23ch] font-sans text-[clamp(1.65rem,2.2vw+0.85rem,2.25rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance text-slate-950">
                  Raising a Pre-Seed, Seed, or Series A round?
                </h2>
                <p className="max-w-[56ch] font-sans text-[clamp(0.95rem,0.15vw+0.9rem,1.05rem)] font-normal leading-[1.6] text-slate-600">
                  Submit your PDF pitch deck and optional monthly CSV financial sheet directly into our review queue. No account is required, and every submission issues a private data room link to track review status.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Link
                  href="/pitch"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
                >
                  <span>Submit a Pitch</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            AUDIENCE SEGMENTATION TRACK 2: FOR FUNDS (#request-workspace)
            Dedicated investor workspace onboarding connected to POST /api/access-request
           =================================================================== */}
        <section id="request-workspace" className="scroll-mt-20 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              {/* Left Column: Fund Workspace Context & Partner Sign-In */}
              <div className="space-y-6 lg:col-span-5">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    For Funds &amp; Investment Teams
                  </p>
                  <h2 className="mt-2 max-w-[20ch] font-sans text-[clamp(1.875rem,2.6vw+0.9rem,2.75rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-balance text-slate-950">
                    Request a Fund Workspace.
                  </h2>
                  <p className="mt-3 max-w-[48ch] font-sans text-[clamp(0.95rem,0.15vw+0.9rem,1.05rem)] font-normal leading-[1.6] text-slate-600">
                    Aarka workspaces are invite-only. Submit your fund details to evaluate Aarka for your investment team&apos;s deal screening, financial cross-checks, and portfolio monitoring.
                  </p>
                </div>

                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">What is included in a fund workspace</div>
                  <ul className="space-y-2 pt-1 text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                      <span>Dedicated founder pitch intake URL and inbound email webhook.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                      <span>Configurable mandate rules and variance review thresholds (10.0% default).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                      <span>Partner and analyst role views with IC voting and portfolio MIS tracking.</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">Already an approved partner or analyst?</div>
                  <p className="leading-relaxed">
                    Sign in with your whitelisted Google account to open the active workspace.
                  </p>
                  <div className="pt-1">
                    <PartnerSignInButton
                      label="Partner Sign In with Google"
                      loadingLabel="Redirecting to Google…"
                      className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Investor Conversion Form connected to POST /api/access-request */}
              <div className="lg:col-span-7">
                <WorkspaceRequestFormClient />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          4-COLUMN FOOTER (Platform, Founders, Funds, Company & Legal)
         ===================================================================== */}
      <footer className="bg-white py-12 text-xs text-slate-600">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-slate-200/80 pb-10 sm:grid-cols-2 lg:grid-cols-6">
            {/* Brand Column (2 cols on lg) */}
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aarka-logo.png"
                  alt="Aarka"
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-md object-contain"
                />
                <span className="text-sm font-semibold text-slate-950">Aarka</span>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-slate-600">
                A Structured Workspace for Startup Pitches and Investor Review.
              </p>
            </div>

            {/* Column 1: Platform */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                Platform
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>
                  <a href="#workflow" className="hover:text-slate-950">
                    Workflow
                  </a>
                </li>
                <li>
                  <a href="#capabilities" className="hover:text-slate-950">
                    Capabilities
                  </a>
                </li>
                <li>
                  <a href="#privacy" className="hover:text-slate-950">
                    Data &amp; Privacy
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2: Founders */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                Founders
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>
                  <Link href="/pitch" className="hover:text-slate-950">
                    Submit a Pitch
                  </Link>
                </li>
                <li>
                  <a href="#for-founders" className="hover:text-slate-950">
                    Founder Intake
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Funds */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                Funds
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>
                  <a href="#request-workspace" className="hover:text-slate-950">
                    Request Workspace
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-slate-950">
                    Partner Sign In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Company & Legal */}
            <div className="space-y-2.5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                Company &amp; Legal
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>
                  <Link href="/privacy" className="hover:text-slate-950">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-slate-950">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <a href="mailto:pitches@aarkavc.xyz" className="hover:text-slate-950">
                    pitches@aarkavc.xyz
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
            <p>© {new Date().getFullYear()} Aarka. All rights reserved.</p>
            <p>Public previews display synthetic demonstration data for illustration.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
