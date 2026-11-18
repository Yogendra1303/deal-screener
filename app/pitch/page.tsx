import Link from "next/link";
import { PitchFormClient } from "@/components/pitch-form-client";
import { FUND_NAME } from "@/lib/links";

export default function PublicPitchPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Static Server-Rendered Brand Header */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aarka-logo.png"
              alt="Aarka"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-md object-cover shadow-xs"
            />
            <span className="text-sm font-semibold text-slate-950">{FUND_NAME}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Home
          </Link>
        </header>

        {/* Static Server-Rendered Intake Overview Card (Immediate SSR HTML, zero blank loading state) */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-blue-700">
              Founder Pitch Intake
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
              Early-Stage Mandate · Up to $4M
            </span>
          </div>
          <h1 className="mt-2 font-sans text-2xl font-normal tracking-[-0.02em] text-slate-800 sm:text-3xl">
            Submit Your Pitch Deck
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
            Share your company details, pitch deck, and optional monthly financial sheet. Every submission enters our private review queue and issues a dedicated status tracking link.
          </p>

          <div className="mt-4 grid gap-2.5 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-[#FAF8F5] px-3 py-2">
              <div className="text-[11px] font-medium text-slate-800">
                Accepted Files
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                PDF deck (up to 32 MB) + optional CSV/XLSX (up to 10 MB).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-[#FAF8F5] px-3 py-2">
              <div className="text-[11px] font-medium text-slate-800">
                Structured Review
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Claims are extracted with page citations and cross-checked in code.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-[#FAF8F5] px-3 py-2">
              <div className="text-[11px] font-medium text-slate-800">
                Private Data Room
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Receive a signed link to track status or update files anytime.
              </p>
            </div>
          </div>
        </section>

        <PitchFormClient />
      </div>
    </div>
  );
}
