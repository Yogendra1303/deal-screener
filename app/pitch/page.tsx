"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLinks } from "@/components/links-store";
import { DropdownSelect, cx } from "@/components/ui";
import { FUND_NAME } from "@/lib/links";
import { SECTORS } from "@/lib/types";

const MAX_MANDATE_USD = 4_000_000;

const inputCls =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
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

function PitchForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref")?.trim() || "";
  const links = useLinks();

  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [sector, setSector] = useState("");
  const [askRaw, setAskRaw] = useState("");
  const [deck, setDeck] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string; companyName: string; receivedAt: string } | null>(null);

  const parsedAsk = useMemo(() => parseAsk(askRaw), [askRaw]);
  const overMandate = parsedAsk !== null && parsedAsk > MAX_MANDATE_USD;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!founderName.trim()) return setError("Please enter your full name.");
    if (!founderEmail.trim()) return setError("Please enter your email address.");
    if (!companyName.trim()) return setError("Please enter your company name.");
    if (!sector) return setError("Please select a sector.");
    if (parsedAsk === null || parsedAsk <= 0) return setError("Please enter a valid funding amount in USD (e.g. 1500000 or 1.5M).");
    if (parsedAsk > MAX_MANDATE_USD) return setError("Our current fund mandate is strictly capped at $4M.");
    if (!deck) return setError("Please upload your pitch deck as a PDF.");

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("founderName", founderName.trim());
      fd.append("founderEmail", founderEmail.trim());
      fd.append("linkedinUrl", linkedinUrl.trim());
      fd.append("companyName", companyName.trim());
      fd.append("website", website.trim());
      fd.append("sector", sector);
      fd.append("askAmount", String(parsedAsk));
      if (ref) fd.append("ref", ref);
      fd.append("deck", deck);

      const res = await fetch("/api/pitch", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; receivedAt?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not submit your pitch. Please try again.");
        return;
      }

      const receivedAt = data.receivedAt || new Date().toISOString();
      await links.addInbound(
        {
          via: ref ? "Referral" : "Website",
          owner: ref || undefined,
          receivedAt,
          oneLiner: `${sector} · Public intake${website.trim() ? ` · ${website.trim()}` : ""}`,
          form: {
            companyName: companyName.trim(),
            website: website.trim(),
            country: "India",
            sector,
            stage: "Seed",
            amountUsd: parsedAsk,
            founders: [{ name: founderName.trim(), profileUrl: linkedinUrl.trim() }],
            email: founderEmail.trim(),
          },
        },
        [deck],
      );

      setSubmitted({ id: data.id || "submitted", companyName: companyName.trim(), receivedAt });
    } catch {
      setError("Network error while submitting your pitch. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">Pitch received for {submitted.companyName}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your deck is now in our live screening queue{ref ? ` with ${ref}` : ""}. Our team reviews every submission and verifies numbers directly against the deck.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Logged {new Date(submitted.receivedAt).toLocaleString()}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-800">Status: New · Unscreened</span>
          </div>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setFounderName("");
                setFounderEmail("");
                setLinkedinUrl("");
                setCompanyName("");
                setWebsite("");
                setSector("");
                setAskRaw("");
                setDeck(null);
              }}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            >
              Submit another pitch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Minimal institutional brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white shadow-xs">F</span>
            <span className="text-sm font-semibold text-slate-900">{FUND_NAME}</span>
          </div>
          {ref && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Shared by {ref}
            </span>
          )}
        </div>

        <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="border-b border-slate-100 pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Submit your pitch</h1>
            <p className="mt-1 text-sm text-slate-600">
              Early-stage mandate up to $4M. Share your deck and core details—every submission goes straight into our live review queue.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            {/* Founder Details */}
            <section className="space-y-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Founder details</h2>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={capCls}>Full name</span>
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
                  <span className={capCls}>Email address</span>
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
                <span className={capCls}>LinkedIn profile URL</span>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/your-profile"
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
                  <span className={capCls}>Company name</span>
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
                  <span className={capCls}>Website</span>
                  <input
                    type="url"
                    placeholder="https://company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className={labelCls}>
                  <span className={capCls}>Sector</span>
                  <DropdownSelect
                    value={sector}
                    onChange={setSector}
                    ariaLabel="Sector"
                    options={[{ value: "", label: "Select a sector" }, ...SECTORS.map((s) => ({ value: s, label: s }))]}
                    className="w-full"
                    buttonClassName="h-8 w-full text-sm border-slate-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className={labelCls}>
                  <span className={capCls}>Funding amount (USD, max $4M)</span>
                  <input
                    type="text"
                    required
                    inputMode="decimal"
                    placeholder="e.g. 2000000 or 2M"
                    value={askRaw}
                    onChange={(e) => setAskRaw(e.target.value)}
                    className={cx(inputCls, overMandate && "border-red-300 focus:border-red-500 focus:ring-red-500")}
                  />
                  {overMandate && <span className="block text-xs font-medium text-red-600">Our current fund mandate is strictly capped at $4M.</span>}
                </label>
              </div>
            </section>

            {/* The Pitch */}
            <section className="space-y-2 border-t border-slate-100 pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">The pitch</h2>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && (/\.pdf$/i.test(f.name) || f.type === "application/pdf")) setDeck(f);
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
                <span className="mt-2 text-sm font-medium text-slate-700">{deck ? deck.name : "Upload pitch deck PDF"}</span>
                <span className="mt-0.5 text-xs text-slate-500">
                  {deck ? `${(deck.size / 1024).toFixed(0)} KB · Click to replace` : "Drag & drop or click to browse (.pdf, up to 4.4 MB)"}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => setDeck(e.target.files?.[0] ?? null)}
                />
              </label>
            </section>

            {error && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">Reviewed directly by the investment team.</p>
              <button
                type="submit"
                disabled={submitting || overMandate}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Pitch"}
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
