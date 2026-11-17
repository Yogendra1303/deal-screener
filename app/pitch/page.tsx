"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DropdownSelect, cx } from "@/components/ui";
import { uploadFileDirect } from "@/lib/direct-upload";
import { FUND_NAME } from "@/lib/links";
import { SECTORS } from "@/lib/types";

const MAX_MANDATE_USD = 4_000_000;
const MAX_PDF_BYTES = 32 * 1024 * 1024; // 32 MB
const MAX_FIN_BYTES = 10 * 1024 * 1024; // 10 MB

const STAGE_OPTIONS = [
  { value: "Pre-seed", label: "Pre-seed" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B+", label: "Series B+" },
];

const inputCls =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";
const labelCls = "block space-y-1.5";
const capCls = "block text-xs font-medium text-slate-700";

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

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function PitchForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref")?.trim() || "";

  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [oneLinePitch, setOneLinePitch] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("Seed");
  const [location, setLocation] = useState("");
  const [askRaw, setAskRaw] = useState("");
  const [deck, setDeck] = useState<File | null>(null);
  const [financials, setFinancials] = useState<File | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState(""); // honeypot
  const [dragOver, setDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<
    "Uploading secure documents to vault..." | "Running initial intake checks..." | "Complete." | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    id: string;
    founderName: string;
    founderEmail: string;
    companyName: string;
    receivedAt: string;
    statusUrl?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const parsedAsk = useMemo(() => parseAsk(askRaw), [askRaw]);
  const overMandate = parsedAsk !== null && parsedAsk > MAX_MANDATE_USD;

  function pickDeck(file: File | null) {
    if (!file) {
      setDeck(null);
      return;
    }
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    if (!isPdf) {
      setError("Please upload your pitch deck as a PDF file (.pdf).");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("Your pitch deck PDF exceeds the 32 MB limit. Please compress it and try again.");
      return;
    }
    setError(null);
    setDeck(file);
  }

  function pickFinancials(file: File | null) {
    if (!file) {
      setFinancials(null);
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setError("Financial sheet must be a .csv or .xlsx file.");
      return;
    }
    if (file.size > MAX_FIN_BYTES) {
      setError("Financial sheet exceeds the 10 MB limit.");
      return;
    }
    setError(null);
    setFinancials(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!founderName.trim()) return setError("Please enter your full name.");
    if (!founderEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(founderEmail.trim())) {
      return setError("Please enter a valid email address.");
    }
    if (!companyName.trim()) return setError("Please enter your company name.");
    if (!sector) return setError("Please select a sector.");
    if (parsedAsk === null || parsedAsk <= 0) {
      return setError("Please enter a valid funding amount in USD (e.g. 1500000 or 1.5M).");
    }
    if (parsedAsk > MAX_MANDATE_USD) {
      return setError("Our current fund mandate is strictly capped at $4M.");
    }
    if (!deck) return setError("Please upload your pitch deck as a PDF.");

    setSubmitting(true);
    setSubmitPhase("Uploading secure documents to vault...");
    try {
      const deckUpload = await uploadFileDirect(deck, "deck_pdf", companyName.trim());
      if (!deckUpload.direct && deck.size > 4 * 1024 * 1024) {
        setSubmitPhase(null);
        setError("Direct cloud upload could not connect for this large file. Please try again or compress your PDF under 4 MB.");
        return;
      }

      const finFileType = financials && /\.csv$/i.test(financials.name) ? "monthly_csv" : "financial_sheet";
      const finUpload = financials ? await uploadFileDirect(financials, finFileType, companyName.trim()) : null;

      setSubmitPhase("Running initial intake checks...");

      const normalizedWebsite = normalizeUrl(website);
      const normalizedLinkedin = normalizeUrl(linkedinUrl);

      let res: Response;
      if (deckUpload.direct && deckUpload.meta) {
        res = await fetch("/api/submit-pitch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderName: founderName.trim(),
            founderEmail: founderEmail.trim().toLowerCase(),
            linkedinUrl: normalizedLinkedin,
            companyName: companyName.trim(),
            website: normalizedWebsite,
            oneLinePitch: oneLinePitch.trim(),
            sector,
            stage,
            location: location.trim(),
            askAmount: parsedAsk,
            ref,
            companyWebsite,
            deck: deckUpload.meta,
            financials: finUpload?.meta,
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("founderName", founderName.trim());
        fd.append("founderEmail", founderEmail.trim().toLowerCase());
        fd.append("linkedinUrl", normalizedLinkedin);
        fd.append("companyName", companyName.trim());
        fd.append("website", normalizedWebsite);
        fd.append("oneLinePitch", oneLinePitch.trim());
        fd.append("sector", sector);
        fd.append("stage", stage);
        fd.append("location", location.trim());
        fd.append("askAmount", String(parsedAsk));
        if (ref) fd.append("ref", ref);
        if (companyWebsite) fd.append("companyWebsite", companyWebsite);
        fd.append("deck", deck);
        if (financials) fd.append("financials", financials);

        res = await fetch("/api/submit-pitch", { method: "POST", body: fd });
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        id?: string;
        receivedAt?: string;
        statusUrl?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setSubmitPhase(null);
        setError(data?.error || "Could not submit your pitch. Please try again.");
        return;
      }

      const receivedAt = data.receivedAt || new Date().toISOString();
      const pitchId = data.id || `pitch-${Date.now().toString(36)}`;

      setSubmitPhase("Complete.");
      await new Promise((r) => setTimeout(r, 500));
      setSubmitted({
        id: pitchId,
        founderName: founderName.trim(),
        founderEmail: founderEmail.trim().toLowerCase(),
        companyName: companyName.trim(),
        receivedAt,
        statusUrl: data.statusUrl,
      });
    } catch {
      setError("Network error while submitting your pitch. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
      setSubmitPhase(null);
    }
  }

  if (submitting && submitPhase) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
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
          <p className="mt-1 text-xs text-slate-500">Your pitch deck is being securely stored in our private review queue.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
            Thank you for your submission, {submitted.founderName.split(/\s+/)[0]}!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            We have securely received the pitch deck for{" "}
            <strong className="font-semibold text-slate-900">{submitted.companyName}</strong> and placed it directly into our confidential investment review queue{ref ? ` (${ref})` : ""}. Our team will reach out to{" "}
            <span className="font-medium text-slate-900">{submitted.founderEmail}</span> after reviewing your materials.
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Reference: <strong className="font-mono text-slate-800">{submitted.id}</strong></span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-800">Status: Received</span>
          </div>

          {submitted.statusUrl && (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-left">
              <p className="text-xs font-semibold text-slate-900">Your Private Pitch Status &amp; Data Room Link</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Bookmark this private link to check your review status, replace your deck, or upload optional financials anytime. It is cryptographically scoped only to your submission.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={submitted.statusUrl}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Open Private Data Room →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const full = `${window.location.origin}${submitted.statusUrl}`;
                    void navigator.clipboard?.writeText(full);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copiedLink ? "✓ Link Copied" : "Copy private link"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-5">
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to home
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setFounderName("");
                setFounderEmail("");
                setLinkedinUrl("");
                setCompanyName("");
                setWebsite("");
                setOneLinePitch("");
                setSector("");
                setStage("Seed");
                setLocation("");
                setAskRaw("");
                setDeck(null);
                setFinancials(null);
                setError(null);
              }}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              Submit another pitch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Minimal institutional brand header with Back button */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aarka-logo.png" alt="Aarka" className="h-7 w-7 shrink-0 rounded-md object-cover shadow-xs" />
            <span className="text-sm font-semibold text-slate-900">{FUND_NAME}</span>
          </Link>
          <div className="flex items-center gap-2.5">
            {ref && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Shared by {ref}
              </span>
            )}
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back
            </Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {/* Hidden honeypot for spam bots */}
          <input
            type="text"
            name="companyWebsite"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <div className="border-b border-slate-100 pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Submit your pitch</h1>
            <p className="mt-1 text-sm text-slate-600">
              Early-stage mandate up to $4M. Share your pitch deck and core details—every submission goes privately into our review queue.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {/* Founder Details */}
            <section className="space-y-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Founder details</h2>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={capCls}>Full name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Sharma"
                    value={founderName}
                    onChange={(e) => setFounderName(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={capCls}>Email address *</span>
                  <input
                    type="email"
                    required
                    placeholder="founder@company.com"
                    value={founderEmail}
                    onChange={(e) => setFounderEmail(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              <label className={labelCls}>
                <span className={capCls}>LinkedIn profile (Optional)</span>
                <input
                  type="text"
                  placeholder="linkedin.com/in/your-profile"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className={inputCls}
                />
              </label>
            </section>

            {/* Company Details */}
            <section className="space-y-3.5 border-t border-slate-100 pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company details</h2>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={capCls}>Company name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Logistics"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={capCls}>Website (Optional)</span>
                  <input
                    type="text"
                    placeholder="company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              <label className={labelCls}>
                <span className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span>One-line pitch (Optional)</span>
                  <span className="text-[11px] font-normal text-slate-400 tabular-nums">{oneLinePitch.length}/120</span>
                </span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Automated freight reconciliation for mid-market exporters"
                  value={oneLinePitch}
                  onChange={(e) => setOneLinePitch(e.target.value)}
                  className={inputCls}
                />
              </label>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className={labelCls}>
                  <span className={capCls}>Sector *</span>
                  <DropdownSelect
                    value={sector}
                    onChange={setSector}
                    ariaLabel="Sector"
                    options={[{ value: "", label: "Select a sector" }, ...SECTORS.map((s) => ({ value: s, label: s }))]}
                    className="w-full"
                    buttonClassName="h-10 w-full text-sm border-slate-200 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className={labelCls}>
                  <span className={capCls}>Stage *</span>
                  <DropdownSelect
                    value={stage}
                    onChange={setStage}
                    ariaLabel="Stage"
                    options={STAGE_OPTIONS}
                    className="w-full"
                    buttonClassName="h-10 w-full text-sm border-slate-200 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={capCls}>HQ Location (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, US or Bengaluru, India"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={capCls}>Funding amount (USD, max $4M) *</span>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    placeholder="e.g. 1500000 or 1.5M"
                    value={askRaw}
                    onChange={(e) => setAskRaw(e.target.value)}
                    className={cx(inputCls, overMandate && "border-red-300 focus:border-red-500 focus:ring-red-500/30")}
                  />
                  {overMandate && (
                    <span className="block text-xs font-medium text-red-600">
                      Our current fund mandate is strictly capped at $4M.
                    </span>
                  )}
                </label>
              </div>
            </section>

            {/* The Pitch */}
            <section className="space-y-3 border-t border-slate-100 pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pitch materials</h2>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0] ?? null;
                  pickDeck(f);
                }}
                className={cx(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                  dragOver ? "border-blue-500 bg-blue-50/40" : "border-slate-300 bg-slate-50/60 hover:bg-slate-50",
                )}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                <span className="mt-2 text-sm font-medium text-slate-700">
                  {deck ? deck.name : "Upload pitch deck PDF *"}
                </span>
                <span className="mt-0.5 text-xs text-slate-500">
                  {deck ? `${formatFileSize(deck.size)} · Click to replace` : "Drag & drop or click to browse (.pdf, up to 32 MB)"}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => pickDeck(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700">
                    Monthly Financials / Metrics (Optional)
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {financials
                      ? `${financials.name} (${formatFileSize(financials.size)})`
                      : "Attach a .csv or .xlsx sheet if you have monthly revenue & burn"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {financials && (
                    <button
                      type="button"
                      onClick={() => setFinancials(null)}
                      className="cursor-pointer text-xs text-slate-500 hover:text-slate-800"
                    >
                      Remove
                    </button>
                  )}
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50">
                    {financials ? "Replace" : "Attach sheet"}
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv"
                      className="sr-only"
                      onChange={(e) => pickFinancials(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            </section>

            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
              Confidentiality: Your pitch deck and metrics are stored privately and reviewed strictly by the Aarka investment team—never shared publicly or visible to other founders.
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <Link
                href="/"
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </Link>
              <button
                type="submit"
                disabled={submitting || overMandate}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-600 px-5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Pitch →"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PublicPitchPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
          <span>Loading pitch form…</span>
        </div>
      }
    >
      <PitchForm />
    </Suspense>
  );
}
