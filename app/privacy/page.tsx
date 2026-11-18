import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aarka handles founder pitch decks, financial sheets, workspace access requests, and partner authentication data.",
  alternates: {
    canonical: "https://www.aarkavc.xyz/privacy",
  },
};

export default function PrivacyPolicyPage() {
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
            Legal &amp; Data Governance
          </p>
          <h1 className="mt-2 font-sans text-3xl font-normal tracking-[-0.02em] text-slate-800 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-slate-500">Last updated: November 18, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-600">
            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">1. Scope and Purpose</h2>
              <p>
                Aarka provides a structured workspace for startup pitch submissions, source-cited diligence extraction, deterministic financial checks, and portfolio MIS monitoring. This policy explains what data is collected across public and authenticated routes and how it is stored and processed.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">2. Founder Pitch Submissions and Data Rooms</h2>
              <p>
                When a founder submits a pitch via /pitch, Aarka collects founder contact details (name, email, optional LinkedIn profile), company metadata (company name, website, stage, sector, location, funding ask), the uploaded PDF pitch deck (up to 32 MB), and any optional monthly financial sheet (CSV or XLSX, up to 10 MB).
              </p>
              <p>
                Uploaded files are validated against binary magic bytes and stored in private, non-public storage buckets (Supabase Storage or local workspace storage). Each submission is assigned a per-deal HMAC-SHA256 tracking token scoped strictly to that deal ID so one founder cannot view or enumerate another founder&apos;s documents.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">3. Workspace Access Requests and Partner Authentication</h2>
              <p>
                When an investor or evaluator submits the workspace access request form (POST /api/access-request), Aarka stores the submitted name, work email, organization, role, evaluation focus, and optional notes with a PENDING status for manual partner review.
              </p>
              <p>
                Authenticated workspace access uses Google OAuth via NextAuth. Only email addresses explicitly whitelisted by an Aarka partner are granted active workspace sessions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">4. AI Extraction and Deterministic Code Processing</h2>
              <p>
                Original founder PDFs and CSV sheets are preserved intact. When an authorized workspace member initiates automated reading, slide text and tables are processed either via a configured server-side Anthropic API key or through the manual account-bridge workflow to extract structured claims with slide page citations.
              </p>
              <p>
                Financial cross-checks (such as comparing stated ARR against monthly CSV revenue multiplied by 12, cash runway math, and compounded monthly growth) run in deterministic TypeScript routines within the application rather than language model arithmetic.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">5. First-Party Telemetry</h2>
              <p>
                Public pages record basic first-party visit metadata (page path, referrer, UTM parameters, viewport category, and active visit duration) via POST /api/track to help partners monitor inbound pitch traffic and operational reliability.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-medium text-slate-800">6. Data Retention and Contact</h2>
              <p>
                Founders or prospective workspace users may request updates or removal of their submitted pitch materials or access request records by contacting the Aarka workspace administrators through their private data room link or fund contact channel.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
