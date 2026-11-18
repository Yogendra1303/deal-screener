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
    "Deterministic arithmetic cross-checks (ARR vs. MRR x 12, runway, compounded growth)",
    "Cap table, SAFE, and priced round dilution modeling",
    "Portfolio MIS reporting health and fund analytics",
  ],
};

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#FAF9F6] text-slate-900 selection:bg-slate-900 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      {/* =====================================================================
          MINIMALIST STICKY NAVIGATION
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

          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            <a
              href="#workflow"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Workflow
            </a>
            <a
              href="#capabilities"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Capabilities
            </a>
            <a
              href="#privacy"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Data &amp; Privacy
            </a>
            <a
              href="#request-workspace"
              className="text-[13px] font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              Request Workspace
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              href="/pitch"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Submit a Pitch
            </Link>
            <PartnerSignInButton
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            />
          </div>

          <MobileHeaderMenu />
        </div>
      </header>

      <main>
        {/* ===================================================================
            STATIC ABOVE-THE-FOLD HERO SECTION
            Pure Server Component HTML/CSS: Zero client hydration delay on LCP
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

              <h1 className="mt-5 font-serif text-[clamp(2rem,4vw+0.85rem,3.35rem)] font-normal leading-[1.08] tracking-[-0.025em] text-slate-950">
                From Startup Pitch to Evidence-Backed Investment Review.
              </h1>

              <p className="mx-auto mt-4 max-w-[60ch] text-[clamp(0.95rem,0.3vw+0.88rem,1.0625rem)] leading-[1.6] text-slate-600">
                Extract slide claims with verbatim page citations, cross-check stated ARR and runway against monthly CSVs, model dilution, and track portfolio MIS in one workspace.
              </p>

              {/* Dual-Track Primary CTAs */}
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

              {/* Concrete Architecture Pill Strip */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>PDF deck + monthly CSV corroboration</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
                  <span>10.0% deterministic variance threshold</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden="true" />
                  <span>Invite-only partner &amp; analyst access</span>
                </span>
              </div>
            </div>

            {/* ===============================================================
                HERO PRODUCT VISUAL
                Lightweight, Static Browser-Style HTML/CSS Product Mockup
                Reserved layout space (zero CLS), synthetic demonstration data
               =============================================================== */}
            <div className="mx-auto mt-10 max-w-5xl sm:mt-12">
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
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                      Synthetic Demo Record
                    </span>
                    <span className="hidden rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-800 sm:inline-block">
                      Priority · Fits Mandate
                    </span>
                  </div>
                </div>

                {/* Product Workspace Mockup Body */}
                <div className="grid divide-y divide-slate-200 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                  {/* Left Pane: Company Record & Verbatim Citations (7 cols) */}
                  <div className="p-4 sm:p-6 lg:col-span-7">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-slate-950">Velora Systems</span>
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700">
                            Seed · B2B Software
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Automated cold-chain telemetry and invoice reconciliation for regional distributors.
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Round Ask</div>
                        <div className="text-sm font-semibold text-slate-950">$1.50M on $6.0M Post</div>
                      </div>
                    </div>

                    {/* Extracted Claims Table with Slide Page Citations */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <span>Extracted Claim &amp; Provenance</span>
                        <span>Corroboration Status</span>
                      </div>

                      <div className="mt-2 divide-y divide-slate-100 text-xs">
                        <div className="flex items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">Annualized Run-Rate (ARR)</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                Deck p. 4
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                              &ldquo;Reached $1.44M ARR in Sep with $120K monthly recurring revenue.&rdquo;
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono font-semibold text-slate-950">$1.44M</div>
                            <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-800">
                              Checked · CSV Match
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">Monthly Revenue Growth</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                Deck p. 6
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                              &ldquo;Growing 14.0% month-over-month across enterprise accounts.&rdquo;
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono font-semibold text-rose-700">14.0% vs. 9.1%</div>
                            <span className="inline-block rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-rose-800">
                              Conflict · +53.8% Gap
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">Cash Runway &amp; Net Burn</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                Deck p. 11 · CSV
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                              Cash $1.16M divided by $80K monthly net burn = 14.5 months.
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono font-semibold text-slate-950">14.5 months</div>
                            <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-800">
                              Checked · Formula
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Pane: Deterministic Code Checks & Dilution Summary (5 cols) */}
                  <div className="bg-slate-50/60 p-4 sm:p-6 lg:col-span-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                        Deterministic Code Checks
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">Tolerance: 10.0%</span>
                    </div>

                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">ARR vs. MRR x 12</span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-800">
                            Checked · 0.0% Gap
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-600">
                          Deck ARR ($1.44M) = Latest CSV MRR ($120K) x 12.
                        </p>
                      </div>

                      <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">Deck Growth vs. Monthly CSV Compounded</span>
                          <span className="rounded bg-rose-600 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                            Conflict · 53.8% Gap
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-700">
                          Deck p. 6 claims 14.0% MoM; CSV rows (Apr to Sep) compound at 9.1% MoM.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">Cap Table &amp; SAFE Dilution Preview</span>
                          <span className="font-mono text-[11px] font-semibold text-blue-700">
                            10.0% Post-Round
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-600">
                          $600K check on $6.0M Post-Money SAFE · $300K Series A pro-rata reserve.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-[11px] text-slate-600">
                Synthetic demonstration data illustrating Aarka&apos;s source-cited extraction and deterministic financial cross-checks.
              </p>
            </div>
          </div>
        </section>

        {/* ===================================================================
            PRODUCT WORKFLOW: Restrained Sticky Scroll on Desktop, Stacked on Mobile
           =================================================================== */}
        <section id="workflow" className="scroll-mt-20 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                Structured Review Pipeline
              </p>
              <h2 className="mt-2 font-serif text-[clamp(1.65rem,2.5vw+0.75rem,2.35rem)] font-normal leading-[1.15] tracking-[-0.02em] text-slate-950">
                From founder pitch submission to corroborated partner review.
              </h2>
              <p className="mt-3 max-w-[62ch] text-[clamp(0.875rem,0.25vw+0.82rem,0.975rem)] leading-[1.65] text-slate-600">
                Each submission moves through five concrete stages. Original founder files stay intact while deterministic checks cross-check arithmetic consistency and structure the record for investment review.
              </p>
            </div>

            <WorkflowInteractiveGrid />
          </div>
        </section>

        {/* ===================================================================
            CONFIRMED PRODUCT CAPABILITIES (Tabbed Below-the-Fold Previews)
           =================================================================== */}
        <section id="capabilities" className="scroll-mt-20 border-b border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <CapabilitiesInteractiveTabs />
          </div>
        </section>

        {/* ===================================================================
            AUTHENTIC TRUST SIGNALS: DATA HANDLING, ARCHITECTURE & PRIVACY
            Strictly factual implementation details: zero fake logos or fake badges
           =================================================================== */}
        <section id="privacy" className="scroll-mt-20 border-b border-slate-200/80 bg-slate-950 py-16 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-400">
                Data Handling &amp; Privacy Architecture
              </p>
              <h2 className="mt-2 font-serif text-[clamp(1.65rem,2.5vw+0.75rem,2.35rem)] font-normal leading-[1.15] tracking-[-0.02em] text-white">
                Clear separation between AI extraction, deterministic code, and partner access.
              </h2>
              <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-slate-300 sm:text-sm">
                Aarka is engineered around strict data boundaries. Uploaded founder decks are never rewritten by language models, arithmetic checks run in deterministic TypeScript, and every workspace route is protected by default-deny authentication.
              </p>
            </div>

            {/* 3-Layer Responsibility Matrix */}
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-blue-400">01 · AI Extraction Layer</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Read &amp; Cite</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">Structured reading with verbatim quotes</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Models read uploaded PDF slides to populate a typed schema with slide page numbers and direct quotes. Models are never trusted to compute financial ratios, ARR multiples, or runway arithmetic.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-400">02 · Deterministic Code Layer</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Cross-Check &amp; Score</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">Auditable math and mandate checks</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Deterministic financial rules compute MRR x 12, compounded monthly CSV growth, cash divided by net burn, and SAFE or priced round dilution. Any gap greater than 10.0% is flagged automatically.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-amber-300">03 · Human Decision Layer</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">Override &amp; Vote</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">Partner overrides with written trail</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Partners and analysts can override any score, mark facts as corroborated, record IC votes, and set pass or hold reasons. Every manual change preserves the original baseline alongside the written rationale.
                </p>
              </div>
            </div>

            {/* 4 Concrete Security & Data Handling Cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Row-Level Founder Isolation (HMAC-SHA256)
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  When a founder submits a pitch, Aarka issues a per-deal HMAC-SHA256 tracking token bound to that specific deal ID. A token for one pitch cannot read, list, or enumerate any other founder&apos;s pitch deck or data room files.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Default-Deny Route Proxy &amp; Invite-Only OAuth
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Internal workspace routes (/deals, /portfolio, /fund, /dataroom, /team) and APIs are locked behind a default-deny middleware proxy. Only partner-whitelisted Google OAuth accounts are granted workspace sessions.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    File Integrity Validation &amp; Direct Signed Uploads
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Uploaded pitch decks are checked against %PDF- file headers (up to 32 MB) and financial sheets against UTF-8 CSV/TSV or ZIP/XLSX signatures (up to 10 MB) before storage in isolated, non-public buckets.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Scoped LLM Processing &amp; Account-Bridge Option
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Teams can run deck extraction via a server-side Anthropic API key or use the manual account-bridge workflow to process prompts in their own subscription and paste validated JSON back into the workspace.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            EMBEDDED CONVERSION FORM + FOUNDER CTA
            Connected directly to POST /api/access-request
           =================================================================== */}
        <section id="request-workspace" className="scroll-mt-20 border-b border-slate-200/80 bg-[#FAF9F6] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              {/* Left Column: Context & Founder Routing */}
              <div className="space-y-6 lg:col-span-5">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                    Workspace Onboarding
                  </p>
                  <h2 className="mt-2 font-serif text-[clamp(1.65rem,2.5vw+0.75rem,2.25rem)] font-normal leading-[1.15] tracking-[-0.02em] text-slate-950">
                    Request a Fund Workspace or submit a startup pitch.
                  </h2>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
                    Aarka workspaces are invite-only. Submit your fund details to request partner access, or use the direct founder intake if you are raising capital.
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-950">Founders Raising Capital</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700">
                      Up to $4M Mandate
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    No account is required to submit a pitch deck. Upload your PDF deck and optional monthly CSV sheet to receive a private status tracking link.
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/pitch"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      <span>Go to Submit a Pitch</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
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

              {/* Right Column: Live Conversion Form connected to POST /api/access-request */}
              <div className="lg:col-span-7">
                <WorkspaceRequestFormClient />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          FOOTER
         ===================================================================== */}
      <footer className="bg-white py-10 text-xs text-slate-600">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 border-b border-slate-200/80 pb-8 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aarka-logo.png"
                alt="Aarka"
                width={22}
                height={22}
                className="h-[22px] w-[22px] shrink-0 rounded-md object-contain"
              />
              <span className="text-sm font-semibold text-slate-950">Aarka</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs text-slate-600">
                A Structured Workspace for Startup Pitches and Investor Review.
              </span>
            </div>

            <nav aria-label="Footer" className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
              <a href="#workflow" className="hover:text-slate-950">
                Workflow
              </a>
              <a href="#capabilities" className="hover:text-slate-950">
                Capabilities
              </a>
              <a href="#privacy" className="hover:text-slate-950">
                Data &amp; Privacy
              </a>
              <Link href="/pitch" className="hover:text-slate-950">
                Submit a Pitch
              </Link>
              <PartnerSignInButton
                className="cursor-pointer font-semibold text-slate-900 hover:text-slate-700"
              />
            </nav>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
            <p>© {new Date().getFullYear()} Aarka. All rights reserved.</p>
            <p>Public previews display synthetic demonstration data for illustration.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
