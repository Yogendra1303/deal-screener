import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms governing use of the Aarka public pitch submission portal and invite-only investment review workspace.",
  alternates: {
    canonical: "https://www.aarkavc.xyz/terms",
  },
};

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
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
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-700">
            Legal &amp; Workspace Terms
          </p>
          <h1 className="mt-2 font-sans text-3xl font-normal tracking-[-0.02em] text-slate-800 sm:text-4xl">
            Terms of Use
          </h1>
          <p className="mt-2 text-xs text-slate-500">Last updated: November 18, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">1. Acceptance of Terms</h2>
              <p>
                By accessing Aarka (aarkavc.xyz), submitting a startup pitch deck, or requesting access to an invite-only fund workspace, you agree to these Terms of Use.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">2. No Investment Commitment or Advisory Relationship</h2>
              <p>
                Submitting a pitch deck or financial sheet through /pitch places your materials into an internal review queue and issues a private status tracking link. Submission of materials, automated claim extraction, or deterministic arithmetic cross-checking does not constitute an offer to invest, investment advice, or a fiduciary relationship.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">3. Founder Representations on Submitted Materials</h2>
              <p>
                Founders submitting pitch decks (PDF) and financial records (CSV or XLSX) represent that they are authorized to share those documents for investment evaluation and that uploaded files do not contain malicious code or unlawful content.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">4. Invite-Only Workspace Access</h2>
              <p>
                Internal workspace routes (/deals, /portfolio, /fund, /dataroom, /team) are restricted to partner-approved users authenticating via whitelisted Google OAuth accounts. Attempting to bypass route access controls, forge founder tracking tokens, or probe protected API endpoints is strictly prohibited.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">5. Decision Support &amp; Human Review</h2>
              <p>
                Aarka structures pitch claims with page citations and runs configurable code-based arithmetic checks (such as a 10.0% default variance review threshold and post-money SAFE dilution simulations). All outputs are decision-support tools designed to assist human partners and analysts, who retain sole responsibility for investment decisions.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
