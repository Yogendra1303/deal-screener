"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./ui";

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid work or personal email address.");
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit access request");
    } finally {
      setLoading(false);
    }
  }

  function handleEnterPreview() {
    onClose();
    // Redirect to partner workspace with role=Partner query
    router.push("/?role=Partner");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d1527] border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 text-white overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                ▲
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">Request Institutional Access</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold uppercase">
                    Invite Only
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aarka is an invite-only workspace. Submit your details to unlock preview access.
                </p>
              </div>
            </div>

            {error && (
              <div className="my-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Verma"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Work / Preferred Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@firm.com or gmail"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Professional Role</label>
                  <select
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                  >
                    {BACKGROUND_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-slate-900 text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fund / Company Name (Optional)</label>
                  <input
                    type="text"
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="e.g. Peak XV / Independent"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-white placeholder-slate-500 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Why do you want to explore Aarka?</label>
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                >
                  {INTENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-slate-900 text-white">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 pt-1">
                Your request is recorded and sent to Yogendra Kapkoti. Upon submission, you will receive immediate Guest Access to test the live platform.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/30 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Recording Request…" : "Submit & Unlock Preview Workspace →"}
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Access Request Recorded</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Thank you, <strong className="text-slate-200">{name || email}</strong>. Your invitation request has been forwarded to Yogendra Kapkoti and the investment committee.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 text-left space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span className="font-semibold text-blue-400">Preview Access Granted:</span>
                <span>Active</span>
              </div>
              <p className="text-[11px] text-slate-400">
                You can now explore the live pipeline, thesis extraction, and mathematical verification modules in full Institutional Guest Mode.
              </p>
            </div>

            <button
              type="button"
              onClick={handleEnterPreview}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-600/30 text-xs"
            >
              Enter Preview Workspace Now →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
