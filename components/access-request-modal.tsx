"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DropdownSelect } from "@/components/ui";

const BACKGROUND_OPTIONS = [
  "VC (Partner / Principal / Associate)",
  "Private Equity / Growth Equity",
  "Family Office / Angel Syndicate",
  "Founder (Raising Capital)",
  "Tech Scout / Product Evaluation",
  "Other",
];

const INTENT_OPTIONS = [
  "Evaluating for our fund's dealflow screening",
  "Testing automated financial checks & ARR verification",
  "Looking to syndicate or co-invest with Aarka",
  "Evaluating internal tools for fund operations",
  "Exploring early-stage benchmarks & thesis extraction",
  "Other",
];

const fieldCls =
  "w-full h-[38px] bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors";

const textareaCls =
  "w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors resize-none";

const labelCls = "text-xs font-medium text-zinc-400 mb-1.5 block";

export function AccessRequestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [background, setBackground] = useState(BACKGROUND_OPTIONS[0]);
  const [firm, setFirm] = useState("");
  const [intent, setIntent] = useState(INTENT_OPTIONS[0]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState(""); // honeypot

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          background,
          firm: firm.trim(),
          intent,
          additionalContext: additionalContext.trim() || undefined,
          companyWebsite,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit access request";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    setSubmitted(false);
    setName("");
    setEmail("");
    setFirm("");
    setAdditionalContext("");
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 cursor-pointer rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <div>
            {/* Header with Actual Aarka Logo */}
            <div className="mb-6 flex items-start gap-3.5 pr-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" className="h-7 w-auto object-contain" alt="Aarka" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-white">
                    Request Institutional Access
                  </h3>
                  <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Invite Only
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Aarka is strictly invite-only. Submit your details for manual partner review and approval.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden honeypot field */}
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="req-name" className={labelCls}>
                    Full Name
                  </label>
                  <input
                    id="req-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    className={fieldCls}
                  />
                </div>

                <div>
                  <label htmlFor="req-email" className={labelCls}>
                    Work Email *
                  </label>
                  <input
                    id="req-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@firm.com"
                    className={fieldCls}
                  />
                </div>

                <div>
                  <label htmlFor="req-role" className={labelCls}>
                    Professional Role
                  </label>
                  <DropdownSelect
                    id="req-role"
                    ariaLabel="Professional Role"
                    theme="dark"
                    value={background}
                    onChange={setBackground}
                    options={BACKGROUND_OPTIONS}
                    className="w-full"
                    buttonClassName="h-10 rounded-lg px-3.5 text-[13px]"
                  />
                </div>

                <div>
                  <label htmlFor="req-firm" className={labelCls}>
                    Fund / Company Name (Optional)
                  </label>
                  <input
                    id="req-firm"
                    type="text"
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="e.g. Peak XV / Independent"
                    className={fieldCls}
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label htmlFor="req-intent" className={labelCls}>
                    Why do you want to explore Aarka?
                  </label>
                  <DropdownSelect
                    id="req-intent"
                    ariaLabel="Why do you want to explore Aarka?"
                    theme="dark"
                    value={intent}
                    onChange={setIntent}
                    options={INTENT_OPTIONS}
                    className="w-full"
                    buttonClassName="h-10 rounded-lg px-3.5 text-[13px]"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label htmlFor="req-context" className={labelCls}>
                    Additional Context (Optional)
                  </label>
                  <textarea
                    id="req-context"
                    rows={3}
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Any specific requirements or details you want to share..."
                    className={textareaCls}
                  />
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-zinc-500">
                Your request is sent directly to the Aarka team for manual approval. Workspace access is restricted to verified, partner-approved accounts only.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-white py-2.5 text-sm font-medium text-black transition-all duration-200 hover:scale-[1.01] hover:bg-zinc-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{loading ? "Submitting Request…" : "Request Institutional Access"}</span>
                {!loading && (
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                )}
              </button>

              <div className="border-t border-zinc-800/80 pt-3 text-center text-xs text-zinc-400">
                Founder raising capital?{" "}
                <Link
                  href="/pitch"
                  onClick={onClose}
                  className="font-medium text-zinc-200 underline underline-offset-2 transition-colors hover:text-white"
                >
                  Submit your pitch deck →
                </Link>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-5 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xl font-semibold text-white">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">
                Access Request Received
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-400">
                Thank you, <strong className="font-medium text-zinc-200">{name || email}</strong>. Your request has been sent directly to the Aarka team for partner review.
              </p>
            </div>

            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-left text-xs text-zinc-300">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-200">Partner Approval Required</span>
                <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-300">
                  Pending Review
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                We manually review every institutional access request. Once approved, we will whitelist your Google account and reach out directly.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleDone}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-md bg-white py-2.5 text-sm font-medium text-black transition-all duration-200 hover:bg-zinc-200"
              >
                Done
              </button>
              <Link
                href="/pitch"
                onClick={handleDone}
                className="flex flex-1 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
              >
                Submit a Pitch →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
