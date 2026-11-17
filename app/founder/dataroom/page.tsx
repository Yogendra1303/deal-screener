"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cx } from "@/components/ui";

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
  status: "verified" | "pending" | "uploading";
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: "deck",
    category: "pitch_deck",
    title: "Pitch Deck (Latest Version)",
    description: "PDF presentation detailing problem, product, traction, business model, and team.",
    required: true,
    status: "verified",
    fileName: "Fluxloop_Series_Seed_Deck.pdf",
    fileUrl: "#",
    uploadedAt: "Today",
  },
  {
    id: "fin_model",
    category: "financial_model",
    title: "Financial Model & Projections",
    description: "Monthly P&L, MRR waterfall, historical revenue, net burn, and 24-month forecast (.xlsx or .csv).",
    required: true,
    status: "verified",
    fileName: "Fluxloop_Financial_Model_FY26.csv",
    fileUrl: "#",
    uploadedAt: "Today",
  },
  {
    id: "cap_table",
    category: "cap_table",
    title: "Cap Table & Ownership Ledger",
    description: "Fully-diluted cap table showing founders, option pool, SAFEs, and prior angel investors.",
    required: true,
    status: "pending",
  },
  {
    id: "cohorts",
    category: "customer_contracts",
    title: "Customer Retention & Cohort Analysis",
    description: "Logo and net revenue retention (NRR) cohorts or anonymized top-10 customer contract terms.",
    required: false,
    status: "pending",
  },
  {
    id: "legal",
    category: "legal",
    title: "Certificate of Incorporation & IP Assignment",
    description: "Delaware / Singapore / India incorporation certificate and founder IP assignment agreements.",
    required: true,
    status: "pending",
  },
];

function FounderDataRoomContent() {
  const searchParams = useSearchParams();
  const companyParam = searchParams.get("company") || "Fluxloop";
  const dealId = searchParams.get("id") || "h-0069";

  const [companyName, setCompanyName] = useState(companyParam);
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial metrics state
  const [mrr, setMrr] = useState("32,000");
  const [cash, setCash] = useState("480,000");
  const [burn, setBurn] = useState("28,000");
  const [headcount, setHeadcount] = useState("7");
  const [savingMetrics, setSavingMetrics] = useState(false);

  // Q&A state
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaSubmitted, setQaSubmitted] = useState(false);

  async function handleFileUpload(itemId: string, category: string, file: File) {
    setUploadingId(itemId);
    setToastMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dealId", dealId);
    formData.append("companyName", companyName);
    formData.append("category", category);

    try {
      const res = await fetch("/api/founder/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "verified",
                fileName: data.fileName,
                fileUrl: data.fileUrl,
                uploadedAt: "Just now",
              }
            : item
        )
      );

      setToastMessage(`✓ ${file.name} uploaded to data room and synced with Aarka partners.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(`Upload error: ${err.message || "Failed to upload file"}`);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSyncMetrics(e: React.FormEvent) {
    e.preventDefault();
    setSavingMetrics(true);

    try {
      const res = await fetch("/api/founder/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          mrr: Number(mrr.replace(/[^0-9.]/g, "")),
          cash: Number(cash.replace(/[^0-9.]/g, "")),
          burn: Number(burn.replace(/[^0-9.]/g, "")),
          headcount: Number(headcount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync metrics");

      setToastMessage("✓ Financial metrics updated. Recalculated VC scorecard synced with partners.");
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to sync metrics");
    } finally {
      setSavingMetrics(false);
    }
  }

  const completedCount = items.filter((i) => i.status === "verified").length;
  const progressPct = Math.round((completedCount / items.length) * 100);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 py-10 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              ▲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">{companyName}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-medium">
                  Founder Data Room
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Check: $1.5M Seed · Fund Mandate Approved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
            >
              ← Back to Main Platform
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Under Partner Review
            </div>
          </div>
        </div>

        {/* Global Toast Alert */}
        {toastMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300 flex items-center justify-between shadow-lg">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 5-Step Diligence Pipeline Stepper */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Diligence & Investment Committee Pipeline
            </h2>
            <span className="text-xs text-blue-400 font-medium">Stage 3 of 5: Partner Deep-Dive</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { num: "01", name: "Inbound Intake", status: "complete", sub: "Deck & Form Verified" },
              { num: "02", name: "Math Checks", status: "complete", sub: "ARR & Runway Verified" },
              { num: "03", name: "Partner Review", status: "active", sub: "Sanchit & Yogendra" },
              { num: "04", name: "Data Room", status: "pending", sub: "Diligence Checklist" },
              { num: "05", name: "IC Term Sheet", status: "pending", sub: "Final Committee Vote" },
            ].map((s) => (
              <div
                key={s.num}
                className={cx(
                  "p-3 rounded-xl border transition-all",
                  s.status === "complete"
                    ? "bg-slate-900/80 border-blue-500/40 text-blue-300"
                    : s.status === "active"
                    ? "bg-blue-600/10 border-blue-500 text-white ring-1 ring-blue-500"
                    : "bg-slate-900/40 border-slate-800/80 text-slate-500"
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>{s.num}</span>
                  {s.status === "complete" && <span className="text-emerald-400">✓</span>}
                  {s.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
                </div>
                <div className="text-xs font-semibold mt-1 text-slate-200">{s.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Room Checklist & Direct Uploader */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-white">Diligence Document Room</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload requested verification materials. All uploads are encrypted and shared directly with the investment team.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-400">{progressPct}% Complete</div>
                  <div className="text-[10px] text-slate-500">{completedCount} of {items.length} items verified</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-6 mt-3">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-800">
                {items.map((item) => (
                  <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-200">{item.title}</span>
                        {item.required && (
                          <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.2 rounded">
                            Required
                          </span>
                        )}
                        {item.status === "verified" ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span>✓</span> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                            Pending Upload
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
                      {item.fileName && (
                        <div className="text-[11px] text-blue-400 font-mono flex items-center gap-1.5 pt-0.5">
                          <span>📎 {item.fileName}</span>
                          <span className="text-slate-500">· {item.uploadedAt}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label
                        className={cx(
                          "cursor-pointer text-xs font-medium px-3.5 py-2 rounded-lg border transition-all inline-flex items-center gap-1.5",
                          uploadingId === item.id
                            ? "bg-slate-800 text-slate-400 border-slate-700 pointer-events-none"
                            : item.status === "verified"
                            ? "bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-300"
                            : "bg-blue-600 hover:bg-blue-500 border-transparent text-white shadow-sm shadow-blue-600/30"
                        )}
                      >
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(item.id, item.category, file);
                          }}
                        />
                        {uploadingId === item.id ? (
                          "Uploading…"
                        ) : item.status === "verified" ? (
                          "Replace File"
                        ) : (
                          "Upload Document ↑"
                        )}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Partner Q&A Section */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Investment Committee Diligence Q&A</h3>
                <span className="text-[10px] text-blue-400 font-mono">1 Active Question</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="font-semibold text-blue-400">Sanchit Kumar (Partner):</span>
                  <span>Received Today</span>
                </div>
                <p>
                  &ldquo;What is your current gross margin structure across pilot customers, and what is your expected payback period on CAC over the next 12 months?&rdquo;
                </p>
              </div>

              {qaSubmitted ? (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
                  ✓ Response sent to partner committee.
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={qaAnswer}
                    onChange={(e) => setQaAnswer(e.target.value)}
                    placeholder="Type your response to the partner question here…"
                    className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!qaAnswer.trim()) return;
                      setQaSubmitted(true);
                      setToastMessage("✓ Your response has been submitted to Sanchit Kumar.");
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    Submit Response →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Financial Metrics Live Sync */}
          <div className="space-y-6">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white">Financial Baseline Sync</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Keep your core financial metrics updated for real-time VC scorecard calculation.
                </p>
              </div>

              <form onSubmit={handleSyncMetrics} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-300 font-medium mb-1">
                    Current Monthly Revenue (MRR, USD)
                  </label>
                  <input
                    type="text"
                    value={mrr}
                    onChange={(e) => setMrr(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Implied ARR: ${(Number(mrr.replace(/\D/g, "") || 0) * 12).toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 font-medium mb-1">
                    Cash in Bank (USD)
                  </label>
                  <input
                    type="text"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 font-medium mb-1">
                    Monthly Net Burn (USD)
                  </label>
                  <input
                    type="text"
                    value={burn}
                    onChange={(e) => setBurn(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-emerald-400 mt-0.5 block">
                    Runway: {(Number(cash.replace(/\D/g, "") || 1) / Math.max(1, Number(burn.replace(/\D/g, "") || 1))).toFixed(1)} Months
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 font-medium mb-1">
                    Current Headcount (FTEs)
                  </label>
                  <input
                    type="text"
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingMetrics}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-sm disabled:opacity-50 mt-2"
                >
                  {savingMetrics ? "Syncing…" : "Update Financial Metrics →"}
                </button>
              </form>
            </div>

            {/* Deal Team Card */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Your Aarka Deal Leads
              </span>
              <div className="space-y-2.5">
                {[
                  { name: "Sanchit Kumar", role: "Partner · Deal Lead", email: "sanchitkr7@gmail.com", initials: "SK", color: "bg-cyan-600" },
                  { name: "Yogendra Kapkoti", role: "Managing Partner", email: "yogendrakapkoti13@gmail.com", initials: "YK", color: "bg-blue-600" },
                ].map((partner) => (
                  <div key={partner.email} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className={cx("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white", partner.color)}>
                      {partner.initials}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-200">{partner.name}</div>
                      <div className="text-[10px] text-slate-400">{partner.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FounderDataRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400 text-xs">Loading Data Room…</div>}>
      <FounderDataRoomContent />
    </Suspense>
  );
}
