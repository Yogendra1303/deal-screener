"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DropdownSelect, cx } from "@/components/ui";

interface FounderPitch {
  id: string;
  companyName: string;
  sector: string | null;
  stage?: string | null;
  askAmount: number | null;
  receivedAt: string | null;
  status: string;
  rawStatus?: string | null;
  location?: string | null;
  website?: string | null;
  oneLinePitch?: string | null;
  founderName?: string | null;
  founderEmail?: string | null;
}

interface UploadedFile {
  id: string;
  fileType: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string | null;
  downloadUrl: string;
}

interface SavedMetrics {
  mrr?: string;
  cash?: string;
  burn?: string;
  headcount?: string;
  updatedAt?: string;
}

interface DataRoomResponse {
  user?: { name: string; email: string };
  pitches: FounderPitch[];
  selected: FounderPitch | null;
  files: UploadedFile[];
  metrics: SavedMetrics | null;
  error?: string;
}

const DOC_SLOTS: {
  id: string;
  fileTypes: string[];
  uploadCategory: string;
  title: string;
  description: string;
  required: boolean;
  accept: string;
}[] = [
  {
    id: "deck",
    fileTypes: ["deck_pdf", "pitch_deck"],
    uploadCategory: "deck_pdf",
    title: "Pitch Deck (PDF)",
    description: "Your submitted pitch deck presentation. You can replace it anytime with an updated version.",
    required: true,
    accept: "application/pdf,.pdf",
  },
  {
    id: "financials",
    fileTypes: ["monthly_csv", "financial_sheet", "financial_model"],
    uploadCategory: "monthly_csv",
    title: "Financial Model / Monthly Metrics",
    description: "Optional monthly revenue, burn, cash balance, or financial projections (.csv or .xlsx).",
    required: false,
    accept: ".csv,.xlsx,.xls,text/csv",
  },
  {
    id: "cap_table",
    fileTypes: ["cap_table"],
    uploadCategory: "cap_table",
    title: "Cap Table",
    description: "Share only if requested or ready — founder ownership, option pool, SAFEs, and prior rounds.",
    required: false,
    accept: ".pdf,.csv,.xlsx,.xls",
  },
  {
    id: "cohorts",
    fileTypes: ["customer_contracts"],
    uploadCategory: "customer_contracts",
    title: "Customer Retention / Cohorts",
    description: "Optional retention or anonymized customer metrics to support diligence.",
    required: false,
    accept: ".pdf,.csv,.xlsx,.xls",
  },
  {
    id: "legal",
    fileTypes: ["legal"],
    uploadCategory: "legal",
    title: "Incorporation & Legal Docs",
    description: "Certificate of incorporation or IP assignment documents (only needed later in diligence).",
    required: false,
    accept: ".pdf",
  },
];

function formatAsk(usd: number | null | undefined): string {
  if (!usd || !Number.isFinite(usd)) return "Not specified";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(usd % 1_000_000 === 0 ? 0 : 1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${usd.toLocaleString("en-US")}`;
}

function getPipelineSteps(status: string) {
  const s = status.toLowerCase();
  const isPassed = s === "passed";
  const isMeeting = s === "meeting scheduled" || s === "meeting set";
  const isReviewing = s === "under review" || s === "on hold" || s === "reviewing";

  return [
    {
      num: "01",
      name: "Pitch Received",
      sub: "Logged in review queue",
      state: "complete" as const,
    },
    {
      num: "02",
      name: s === "on hold" ? "On Hold" : "Partner Review",
      sub: isReviewing ? "In progress" : isMeeting ? "Completed" : isPassed ? "Reviewed" : "Queued for review",
      state: isMeeting || isPassed ? ("complete" as const) : isReviewing ? ("active" as const) : ("active" as const),
    },
    {
      num: "03",
      name: "Partner Meeting",
      sub: isMeeting ? "Meeting scheduled" : isPassed ? "Not moving forward" : "Next step if selected",
      state: isMeeting ? ("active" as const) : ("pending" as const),
    },
  ];
}

function FounderDataRoomContent() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const routeId = typeof params?.id === "string" ? params.id : "";
  const requestedId = routeId || searchParams.get("id") || "";
  const token = searchParams.get("token")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataRoomResponse | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Founder-entered financial metrics — strictly blank until THIS founder enters them
  const [mrr, setMrr] = useState("");
  const [cash, setCash] = useState("");
  const [burn, setBurn] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [savingMetrics, setSavingMetrics] = useState(false);

  const loadDataRoom = useCallback(async (id?: string) => {
    setLoading(true);
    setError(null);
    setAccessDenied(null);
    try {
      const qs = new URLSearchParams();
      if (id) qs.set("id", id);
      if (token) qs.set("token", token);
      const res = await fetch(`/api/founder/dataroom${qs.toString() ? `?${qs.toString()}` : ""}`, {
        cache: "no-store",
        headers: token ? { "x-pitch-token": token } : undefined,
      });
      if (res.status === 401 || res.status === 403) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        setAccessDenied(errJson?.error || "Access denied. This pitch link is invalid or does not belong to this submission.");
        setData(null);
        return;
      }
      const json = (await res.json()) as DataRoomResponse;
      if (!res.ok) {
        setError(json.error || "Could not load your data room.");
        return;
      }
      setData(json);
      setMrr(json.metrics?.mrr ?? "");
      setCash(json.metrics?.cash ?? "");
      setBurn(json.metrics?.burn ?? "");
      setHeadcount(json.metrics?.headcount ?? "");
    } catch {
      setError("Network error while loading your data room.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDataRoom(requestedId || undefined);
  }, [loadDataRoom, requestedId]);

  const selected = data?.selected ?? null;
  const pitches = data?.pitches ?? [];
  const files = data?.files ?? [];

  async function handleFileUpload(slotId: string, uploadCategory: string, file: File) {
    if (!selected) return;
    if (file.size > 32 * 1024 * 1024) {
      setError("File exceeds the 32 MB size limit.");
      return;
    }
    setUploadingSlot(slotId);
    setError(null);
    setToast(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("dealId", selected.id);
    fd.append("category", uploadCategory);
    if (token) fd.append("token", token);

    try {
      const res = await fetch("/api/founder/upload", {
        method: "POST",
        headers: token ? { "x-pitch-token": token } : undefined,
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Upload failed");
      }
      setToast(`Uploaded ${file.name} to your data room.`);
      await loadDataRoom(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not upload document.");
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSaveMetrics(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingMetrics(true);
    setError(null);
    setToast(null);

    try {
      const res = await fetch("/api/founder/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-pitch-token": token } : {}),
        },
        body: JSON.stringify({
          dealId: selected.id,
          token: token || undefined,
          mrr,
          cash,
          burn,
          headcount,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not save financial metrics.");
      }
      setToast("Saved your financial details.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save metrics.");
    } finally {
      setSavingMetrics(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-sm text-slate-500">
        Loading your data room…
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Access Restricted</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{accessDenied}</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/pitch"
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700"
            >
              Submit a Pitch Deck →
            </Link>
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/aarka-logo.png" alt="Aarka" className="h-7 w-7 rounded-md object-contain" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Your Private Data Room</h1>
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t submitted a pitch deck under{" "}
            <span className="font-medium text-slate-900">{data?.user?.email || "this account"}</span> yet. Submit your pitch first and your private data room will appear here automatically.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/founder"
              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to Founder Portal
            </Link>
            <Link
              href="/pitch"
              className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700"
            >
              Submit Your Pitch Deck →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const uploadedCount = DOC_SLOTS.filter((slot) =>
    files.some((f) => slot.fileTypes.includes(f.fileType)),
  ).length;
  const steps = getPipelineSteps(selected.status);

  const parsedMrr = Number(mrr.replace(/[^0-9.]/g, "")) || 0;
  const parsedCash = Number(cash.replace(/[^0-9.]/g, "")) || 0;
  const parsedBurn = Number(burn.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <Link href="/founder" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aarka-logo.png" alt="Aarka" className="h-6 w-6 rounded object-contain" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{selected.companyName}</h1>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                  Private Founder Data Room
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {[selected.sector, selected.stage, `Asking ${formatAsk(selected.askAmount)}`, selected.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {pitches.length > 1 && (
              <DropdownSelect
                ariaLabel="Select submission"
                size="sm"
                prefix="Pitch:"
                align="right"
                value={selected.id}
                onChange={(val) => router.push(`/founder/dataroom?id=${encodeURIComponent(val)}`)}
                options={pitches.map((p) => ({
                  value: p.id,
                  label: `${p.companyName} (${p.receivedAt ? new Date(p.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recent"})`,
                }))}
              />
            )}
            <Link
              href={token ? "/" : "/founder"}
              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {token ? "← Aarka Home" : "← Your Pitches"}
            </Link>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Status: {selected.status}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
        {toast && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
            <span>✓ {toast}</span>
            <button type="button" onClick={() => setToast(null)} className="text-emerald-700 hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* Submission Summary & Current Review Stage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Where Your Pitch Stands</h2>
              {selected.oneLinePitch && <p className="mt-1 text-sm text-slate-700">{selected.oneLinePitch}</p>}
            </div>
            {selected.receivedAt && (
              <span className="text-xs text-slate-500">
                Submitted {new Date(selected.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className={cx(
                  "rounded-lg border p-3.5",
                  s.state === "active"
                    ? "border-blue-500 bg-blue-50/50"
                    : s.state === "complete"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-slate-200 bg-slate-50/60",
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>{s.num}</span>
                  {s.state === "complete" && <span className="font-sans font-semibold text-emerald-600">✓ Done</span>}
                  {s.state === "active" && <span className="font-sans font-semibold text-blue-700">Current</span>}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
            <div>
              <span className="block text-slate-400">Company</span>
              <span className="mt-0.5 block font-medium text-slate-900">{selected.companyName}</span>
            </div>
            <div>
              <span className="block text-slate-400">Stage &amp; Ask</span>
              <span className="mt-0.5 block font-medium text-slate-900">
                {selected.stage || "—"} · {formatAsk(selected.askAmount)}
              </span>
            </div>
            <div>
              <span className="block text-slate-400">Sector</span>
              <span className="mt-0.5 block font-medium text-slate-900">{selected.sector || "—"}</span>
            </div>
            <div>
              <span className="block text-slate-400">Website</span>
              {selected.website ? (
                <a
                  href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block truncate font-medium text-blue-600 hover:underline"
                >
                  {selected.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span className="mt-0.5 block text-slate-500">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Documents & Optional Financial Details */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Only THIS founder's documents */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Your Shared Documents</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Only files you have uploaded for {selected.companyName} appear here. Everything is private to your account and the Aarka review team.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {uploadedCount} of {DOC_SLOTS.length} uploaded
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {DOC_SLOTS.map((slot) => {
                  const uploaded = files.find((f) => slot.fileTypes.includes(f.fileType));
                  return (
                    <div key={slot.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{slot.title}</span>
                          {slot.required && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                              Required
                            </span>
                          )}
                          {uploaded ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                              ✓ Uploaded
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Not uploaded yet
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{slot.description}</p>
                        {uploaded && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                            <a
                              href={uploaded.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-blue-600 hover:underline"
                            >
                              {uploaded.fileName}
                            </a>
                            {uploaded.uploadedAt && (
                              <span className="text-slate-400">
                                · {new Date(uploaded.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <label
                        className={cx(
                          "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors",
                          uploadingSlot === slot.id
                            ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                            : uploaded
                              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              : "border-transparent bg-blue-600 text-white hover:bg-blue-700",
                        )}
                      >
                        <input
                          type="file"
                          accept={slot.accept}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleFileUpload(slot.id, slot.uploadCategory, f);
                            e.currentTarget.value = "";
                          }}
                        />
                        {uploadingSlot === slot.id ? "Uploading…" : uploaded ? "Replace file" : "Upload"}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Optional Founder-Entered Financial Details */}
          <div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold text-slate-900">Your Financial Details (Optional)</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Fill in or update your current numbers if you&apos;d like to share them alongside your deck.
                </p>
              </div>

              <form onSubmit={handleSaveMetrics} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Monthly Revenue (MRR, USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 25000 (leave blank if pre-revenue)"
                    value={mrr}
                    onChange={(e) => setMrr(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  {parsedMrr > 0 && (
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Implied ARR: ${(parsedMrr * 12).toLocaleString("en-US")}
                    </span>
                  )}
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700">Cash in Bank (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 300000"
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700">Monthly Net Burn (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 20000"
                    value={burn}
                    onChange={(e) => setBurn(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                  {parsedCash > 0 && parsedBurn > 0 && (
                    <span className="mt-1 block text-[11px] text-emerald-700">
                      Estimated Runway: {(parsedCash / parsedBurn).toFixed(1)} months
                    </span>
                  )}
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700">Team Size (FTEs)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 5"
                    value={headcount}
                    onChange={(e) => setHeadcount(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingMetrics}
                  className="mt-1 inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingMetrics ? "Saving…" : "Save Financial Details"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FounderDataRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 px-4 py-16 text-center text-sm text-slate-500">Loading your data room…</div>}>
      <FounderDataRoomContent />
    </Suspense>
  );
}
