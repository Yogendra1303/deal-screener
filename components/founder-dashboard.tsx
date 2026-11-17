"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLinks } from "@/components/links-store";
import { DropdownSelect, cx } from "@/components/ui";
import { uploadFileDirect } from "@/lib/direct-upload";
import type { FounderPitchSummary } from "@/lib/db/repository";
import { SECTORS } from "@/lib/types";

const MAX_MANDATE_USD = 4_000_000;
const MAX_PRIOR_FUNDING_USD = 30_000_000;
const STAGE_OPTIONS = ["Pre-seed", "Seed", "Series A", "Series B+"] as const;

const inputCls =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

function parseAsk(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,_\s]/g, "");
  if (!cleaned) return null;
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s*([mk])?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]?.toLowerCase();
  if (unit === "m") return Math.round(n * 1_000_000);
  if (unit === "k") return Math.round(n * 1_000);
  return Math.round(n);
}

function statusBadge(status: string) {
  switch (status) {
    case "Meeting Scheduled":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Under Review":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "Passed":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-amber-50 text-amber-800 ring-amber-200";
  }
}

export function FounderDashboard({
  user,
  initialPitches,
}: {
  user: { name: string; email: string; image?: string | null };
  initialPitches: FounderPitchSummary[];
}) {
  const links = useLinks();
  const [pitches, setPitches] = useState<FounderPitchSummary[]>(initialPitches);
  const [showForm, setShowForm] = useState<boolean>(() => initialPitches.length === 0);

  // Pitch intake state
  const [founderName, setFounderName] = useState(user.name || "");
  const [founderEmail, setFounderEmail] = useState(user.email || "");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState("");
  const [oneLinePitch, setOneLinePitch] = useState("");
  const [stage, setStage] = useState<string>("Seed");
  const [location, setLocation] = useState("");
  const [priorFundingRaw, setPriorFundingRaw] = useState("");
  const [askRaw, setAskRaw] = useState("");
  const [deck, setDeck] = useState<File | null>(null);
  const [financials, setFinancials] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<
    "Uploading secure documents to vault..." | "Analyzing financials..." | "Complete." | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const parsedAsk = useMemo(() => parseAsk(askRaw), [askRaw]);
  const overMandate = parsedAsk !== null && parsedAsk > MAX_MANDATE_USD;
  const parsedPriorFunding = useMemo(() => {
    const n = Number(priorFundingRaw);
    return priorFundingRaw.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  }, [priorFundingRaw]);
  const overPriorFunding = parsedPriorFunding !== null && parsedPriorFunding > MAX_PRIOR_FUNDING_USD;

  const allPitches = useMemo(() => {
    const emailLower = user.email.trim().toLowerCase();
    const map = new Map<string, FounderPitchSummary>();
    for (const p of pitches) map.set(p.id, p);
    for (const i of links.inbound) {
      if ((i.form.email ?? "").trim().toLowerCase() === emailLower && !map.has(i.id)) {
        map.set(i.id, {
          id: i.id,
          companyName: i.form.companyName,
          sector: i.form.sector,
          askAmount: i.form.amountUsd,
          receivedAt: i.receivedAt,
          status: "Received",
        });
      }
    }
    return [...map.values()].sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
  }, [pitches, links.inbound, user.email]);

  async function submitPitch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!founderName.trim()) return setError("Please enter your full name.");
    if (!founderEmail.trim()) return setError("Please enter your email address.");
    if (!companyName.trim()) return setError("Please enter your company name.");
    if (!sector) return setError("Please select a sector.");
    if (parsedAsk === null || parsedAsk <= 0) return setError("Please enter a valid funding amount in USD.");
    if (parsedAsk > MAX_MANDATE_USD) return setError("Our current fund mandate is strictly capped at $4M.");
    if (!deck) return setError("Please attach your pitch deck PDF.");

    setSubmitting(true);
    setSubmitPhase("Uploading secure documents to vault...");
    try {
      // 1. Direct-to-Supabase upload for pitch deck (bypasses 4.5MB Vercel limit)
      const deckUpload = await uploadFileDirect(deck, "deck_pdf", companyName.trim());
      
      // 2. Direct-to-Supabase upload for financials (if attached)
      const finFileType = financials && /\.csv$/i.test(financials.name) ? "monthly_csv" : "financial_sheet";
      const finUpload = financials ? await uploadFileDirect(financials, finFileType, companyName.trim()) : null;

      setSubmitPhase("Analyzing financials...");

      let res: Response;
      if (deckUpload.direct && deckUpload.meta) {
        // Direct upload succeeded: send lightweight JSON payload
        res = await fetch("/api/submit-pitch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderName: founderName.trim(),
            founderEmail: founderEmail.trim(),
            linkedinUrl: linkedinUrl.trim(),
            companyName: companyName.trim(),
            website: website.trim(),
            sector,
            oneLinePitch: oneLinePitch.trim().slice(0, 60),
            stage,
            location: location.trim(),
            priorFunding: parsedPriorFunding,
            askAmount: parsedAsk,
            deck: deckUpload.meta,
            financials: finUpload?.meta,
          }),
        });
      } else {
        // Fallback to standard FormData (e.g. offline dev without Supabase)
        const fd = new FormData();
        fd.append("founderName", founderName.trim());
        fd.append("founderEmail", founderEmail.trim());
        fd.append("linkedinUrl", linkedinUrl.trim());
        fd.append("companyName", companyName.trim());
        fd.append("website", website.trim());
        fd.append("sector", sector);
        fd.append("oneLinePitch", oneLinePitch.trim().slice(0, 60));
        fd.append("stage", stage);
        fd.append("location", location.trim());
        if (parsedPriorFunding !== null) fd.append("priorFunding", String(parsedPriorFunding));
        fd.append("askAmount", String(parsedAsk));
        fd.append("deck", deck);
        if (financials) fd.append("financials", financials);

        res = await fetch("/api/submit-pitch", { method: "POST", body: fd });
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        receivedAt?: string;
        fileUrl?: string;
        financialFileUrl?: string | null;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setSubmitPhase(null);
        setError(data?.error || "Could not submit your pitch. Please try again.");
        return;
      }

      const receivedAt = data.receivedAt || new Date().toISOString();
      const pitchId = data.id || `pitch-${Date.now().toString(36)}`;
      const locParts = location.split(",").map((s) => s.trim()).filter(Boolean);
      const parsedCountry = locParts.length >= 2 ? locParts[locParts.length - 1] : "India";
      await links.addInbound(
        {
          id: pitchId,
          via: "Website",
          receivedAt,
          oneLiner: oneLinePitch.trim() || `${sector} · ${stage}${location.trim() ? ` · ${location.trim()}` : ""}`,
          form: {
            companyName: companyName.trim(),
            website: website.trim(),
            country: parsedCountry,
            sector,
            stage,
            amountUsd: parsedAsk,
            founders: [{ name: founderName.trim(), profileUrl: linkedinUrl.trim() }],
            email: founderEmail.trim(),
          },
          preUploadedFiles: [
            {
              name: deck.name,
              size: deck.size,
              at: receivedAt.slice(0, 10),
              key: `pitch:${pitchId}`,
              url: data.fileUrl || `/api/files/${encodeURIComponent(pitchId)}/deck_pdf`,
            },
            ...(financials && data.financialFileUrl
              ? [
                  {
                    name: financials.name,
                    size: financials.size,
                    at: receivedAt.slice(0, 10),
                    key: `fin:${pitchId}`,
                    url: data.financialFileUrl,
                  },
                ]
              : []),
          ],
        },
        [deck, ...(financials ? [financials] : [])],
      );

      setPitches((prev) => [
        {
          id: pitchId,
          companyName: companyName.trim(),
          sector,
          askAmount: parsedAsk,
          receivedAt,
          status: "Received",
        },
        ...prev,
      ]);

      setSubmitPhase("Complete.");
      await new Promise((r) => setTimeout(r, 600));
      setSuccessMsg(
        `Thank you for your submission, ${founderName.trim().split(/\s+/)[0]}! Your pitch for ${companyName.trim()} is in our live review queue and a confirmation from yogendrakapkoti13@gmail.com has been sent to ${founderEmail.trim()}.`,
      );
      setCompanyName("");
      setWebsite("");
      setSector("");
      setOneLinePitch("");
      setStage("Seed");
      setLocation("");
      setPriorFundingRaw("");
      setAskRaw("");
      setLinkedinUrl("");
      setDeck(null);
      setFinancials(null);
      setShowForm(false);
    } catch {
      setError("Network error while submitting your pitch. Please try again.");
    } finally {
      setSubmitting(false);
      setSubmitPhase(null);
    }
  }

  const initials = (user.name || user.email || "F")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/welcome" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aarka-logo.png" alt="Aarka" className="h-7 w-7 shrink-0 rounded-md object-cover shadow-xs" />
              <span className="text-sm font-semibold text-slate-900">Aarka</span>
            </Link>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">Founder Portal</span>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/welcome"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Back</span>
            </Link>
            <div className="flex items-center gap-2">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name || user.email}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{initials}</span>
              )}
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium leading-tight text-slate-900">{user.name || "Founder"}</p>
                <p className="text-[11px] leading-tight text-slate-500">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void nextAuthSignOut({ callbackUrl: "/" })}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-2xs">
          <span>
            <strong className="font-semibold text-slate-900">Invite-Only Fund Workspace:</strong> Internal investment views are restricted to authorised Aarka partners and analysts. Founders can submit a pitch deck below or track existing submissions.
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {allPitches.length === 0 ? "Submit Your Pitch to Aarka" : "Your Pitches"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {allPitches.length === 0
                ? "Early-stage mandate up to $4M. Share your pitch deck and core company details for review."
                : "Submit a new deck to Aarka or track high-level review status."}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/founder/dataroom"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-blue-600/30 bg-blue-50 px-3.5 text-xs font-semibold text-blue-700 shadow-2xs hover:bg-blue-100 transition-colors"
            >
              📁 Data Room Portal →
            </Link>
            {(allPitches.length > 0 || !showForm) && (
              <button
                type="button"
                onClick={() => {
                  setShowForm((v) => !v);
                  setError(null);
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                {showForm ? "Close form" : "Submit a New Pitch"}
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {showForm && submitting && submitPhase && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              {submitPhase === "Complete." ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              )}
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">{submitPhase}</p>
            <p className="mt-1 text-xs text-slate-500">
              Your deck and financials are being verified against our investment checks.
            </p>
          </div>
        )}

        {showForm && !submitting && (
          <form onSubmit={submitPitch} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Submit a New Pitch</h2>
            <p className="mt-0.5 text-xs text-slate-500">Early-stage mandate strictly capped at $4M.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Full name</span>
                <input type="text" required value={founderName} onChange={(e) => setFounderName(e.target.value)} className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Email address</span>
                <input type="email" required value={founderEmail} onChange={(e) => setFounderEmail(e.target.value)} className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">LinkedIn profile URL</span>
                <input type="url" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Company name</span>
                <input type="text" required placeholder="e.g. Acme AI" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Website</span>
                <input type="url" placeholder="https://company.com" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} />
              </label>
              <div className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Sector</span>
                <DropdownSelect
                  value={sector}
                  onChange={setSector}
                  ariaLabel="Sector"
                  options={[{ value: "", label: "Select a sector" }, ...SECTORS.map((s) => ({ value: s, label: s }))]}
                  className="w-full"
                  buttonClassName="h-8 w-full text-sm border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="block space-y-1 sm:col-span-2">
                <span className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span>One-Line Pitch</span>
                  <span className="text-[11px] font-normal text-slate-400 tabular-nums">{oneLinePitch.length}/60</span>
                </span>
                <input
                  type="text"
                  maxLength={60}
                  placeholder="e.g. AI-powered accounts payable for SMEs"
                  value={oneLinePitch}
                  onChange={(e) => setOneLinePitch(e.target.value)}
                  className={inputCls}
                />
              </label>
              <div className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Current Stage</span>
                <DropdownSelect
                  value={stage}
                  onChange={setStage}
                  ariaLabel="Current Stage"
                  options={STAGE_OPTIONS.map((s) => ({ value: s, label: s }))}
                  className="w-full"
                  buttonClassName="h-8 w-full text-sm border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">HQ Location</span>
                <input
                  type="text"
                  placeholder="City, Country"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Total Prior Funding (USD)</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="e.g. 500000"
                  value={priorFundingRaw}
                  onChange={(e) => setPriorFundingRaw(e.target.value)}
                  className={cx(inputCls, overPriorFunding && "border-amber-400 focus:border-amber-500 focus:ring-amber-500")}
                />
                {overPriorFunding && (
                  <span className="block text-xs font-medium text-amber-700">
                    Note: Our fund mandate is early-stage (prior funding is typically under $30M).
                  </span>
                )}
              </label>
              <label className="block space-y-1">
                <span className="block text-xs font-medium text-slate-700">Funding amount (USD, max $4M)</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2000000 or 2M"
                  value={askRaw}
                  onChange={(e) => setAskRaw(e.target.value)}
                  className={cx(inputCls, overMandate && "border-red-300 focus:border-red-500 focus:ring-red-500")}
                />
                {overMandate && <span className="block text-xs font-medium text-red-600">Our current fund mandate is strictly capped at $4M.</span>}
              </label>

              <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-slate-700">Pitch deck (.pdf)</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setDeck(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 file:mr-2.5 file:rounded file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-slate-700">Financials / Metrics (Optional)</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFinancials(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 file:mr-2.5 file:rounded file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-200"
                  />
                </label>
              </div>
            </div>

            {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              {allPitches.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : (
                <Link
                  href="/welcome"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  Back to home
                </Link>
              )}
              <button
                type="submit"
                disabled={submitting || overMandate}
                className="inline-flex h-8 items-center rounded-md bg-blue-600 px-4 text-xs font-medium text-white shadow-xs hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Pitch"}
              </button>
            </div>
          </form>
        )}

        {allPitches.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Sector</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allPitches.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{p.companyName}</td>
                      <td className="px-5 py-3.5 text-slate-600">{p.sector || "—"}</td>
                      <td className="px-5 py-3.5 text-slate-500 tabular-nums">
                        {p.receivedAt ? new Date(p.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", statusBadge(p.status))}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
