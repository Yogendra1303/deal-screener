"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BACKGROUND_OPTIONS = [
  "Venture Capital (Partner / Principal / Associate)",
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

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

export function AccessRequestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [background, setBackground] = useState(BACKGROUND_OPTIONS[0]);
  const [firm, setFirm] = useState("");
  const [intent, setIntent] = useState(INTENT_OPTIONS[0]);
  const [customIntent, setCustomIntent] = useState("");

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
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid work or personal email address.");
      return;
    }
    if (intent === "Other" && !customIntent.trim()) {
      setError("Please specify your reason for exploring Aarka.");
      return;
    }

    setLoading(true);
    setError(null);

    const finalIntent = intent === "Other" ? `Other: ${customIntent.trim()}` : intent;

    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          background,
          firm: firm.trim(),
          intent: finalIntent,
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

  function handleEnterPreview() {
    onClose();
    window.location.href = "/?role=Partner";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 cursor-pointer rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <div>
            {/* Header */}
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-sm">
                ▲
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-white">
                    Request Institutional Access
                  </h3>
                  <span className="rounded-full border border-blue-500/30 bg-blue-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                    Invite Only
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Aarka is an invite-only workspace. Submit your details to unlock preview access.
                </p>
              </div>
            </div>

            {error && (
              <div className="my-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-name" className="mb-1 block font-medium text-zinc-300">
                    Your Full Name
                  </label>
                  <input
                    id="req-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="req-email" className="mb-1 block font-medium text-zinc-300">
                    Work / Preferred Email *
                  </label>
                  <input
                    id="req-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@firm.com or gmail"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-role" className="mb-1 block font-medium text-zinc-300">
                    Professional Role
                  </label>
                  <select
                    id="req-role"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className={inputCls}
                  >
                    {BACKGROUND_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-zinc-900 text-zinc-100">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="req-firm" className="mb-1 block font-medium text-zinc-300">
                    Fund / Company Name (Optional)
                  </label>
                  <input
                    id="req-firm"
                    type="text"
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="e.g. Peak XV / Independent"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="req-intent" className="mb-1 block font-medium text-zinc-300">
                  Why do you want to explore Aarka?
                </label>
                <select
                  id="req-intent"
                  value={intent}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setIntent(nextVal);
                    if (nextVal !== "Other") setCustomIntent("");
                  }}
                  className={inputCls}
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-zinc-900 text-zinc-100">
                      {opt}
                    </option>
                  ))}
                </select>

                {intent === "Other" && (
                  <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <textarea
                      id="req-custom-intent"
                      rows={3}
                      required
                      autoFocus
                      value={customIntent}
                      onChange={(e) => setCustomIntent(e.target.value)}
                      placeholder="Please specify..."
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                )}
              </div>

              <p className="pt-1 text-[11px] leading-relaxed text-zinc-500">
                Your request is recorded and sent to Yogendra Kapkoti. Upon submission, you will receive immediate Guest Access to test the live platform.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
              >
                {loading ? "Recording Request…" : "Submit & Unlock Preview Workspace →"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-blue-500/40 bg-blue-600/20 text-2xl text-blue-400">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Access Request Recorded</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">
                Thank you, <strong className="text-zinc-200">{name || email}</strong>. Your invitation request has been forwarded to Yogendra Kapkoti and the investment committee.
              </p>
            </div>

            <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 text-left text-xs text-zinc-300">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="font-semibold text-blue-400">Preview Access Granted:</span>
                <span className="font-medium text-blue-400">Active</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                You can now explore the live pipeline, thesis extraction, and mathematical verification modules in full Institutional Guest Mode.
              </p>
            </div>

            <button
              type="button"
              onClick={handleEnterPreview}
              className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              Enter Preview Workspace Now →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
