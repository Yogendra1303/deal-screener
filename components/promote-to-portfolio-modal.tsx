"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePortfolio } from "@/components/portfolio-store";
import { useStore } from "@/components/store";
import { calculateCapTable, type CapTableInput } from "@/lib/captable";
import { dueDateFor } from "@/lib/portfolio/health";
import type { MonthlyReport, PortfolioCompany } from "@/lib/portfolio/types";
import type { DealResult } from "@/lib/types";

const CAPTABLE_KEY = "ds.captable.v1";

export function PromoteToPortfolioModal({
  isOpen,
  onClose,
  deal,
  leadPartner,
  owner,
}: {
  isOpen: boolean;
  onClose: () => void;
  deal: DealResult;
  leadPartner: string;
  owner: string;
}) {
  const portfolio = usePortfolio();
  const store = useStore();

  const defaultCurrency =
    deal.sheet?.at(-1)?.currency ||
    deal.record.traction.mrr.currency ||
    deal.record.traction.arr.currency ||
    "USD";

  const [round, setRound] = useState(deal.form.stage || "Seed");
  const [checkUsd, setCheckUsd] = useState<number>(() => {
    const ask = deal.form.amountUsd || 1_000_000;
    return Math.min(2_000_000, Math.max(100_000, Math.round(ask * 0.5)));
  });
  const [ownershipPct, setOwnershipPct] = useState<number>(12.5);
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [investDate, setInvestDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [promotedId, setPromotedId] = useState<string | null>(null);

  // Pre-fill check size & ownership from saved Cap Table Modeler scenario if available
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = window.localStorage.getItem(CAPTABLE_KEY);
      if (raw) {
        const all = JSON.parse(raw) as Record<string, CapTableInput>;
        const saved = all[deal.id];
        if (saved) {
          const out = calculateCapTable(saved);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          if (saved.fundCheckUsd > 0) setCheckUsd(saved.fundCheckUsd);
          if (out.fundOwnershipPct > 0) setOwnershipPct(Number(out.fundOwnershipPct.toFixed(1)));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [isOpen, deal.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    const safeCheck = Math.max(25_000, Number(checkUsd) || 250_000);
    const safeOwn = Math.max(0.5, Math.min(60, Number(ownershipPct) || 12));
    const todayIso = new Date().toISOString().slice(0, 10);

    // Map any submitted CSV sheet rows directly into live monthly portfolio reports
    const reports: MonthlyReport[] = (deal.sheet ?? []).map((row) => ({
      month: row.month,
      dueDate: dueDateFor(row.month),
      receivedAt: todayIso,
      fileName: `${deal.form.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${row.month}.csv`,
      pages: 4,
      acknowledgedAt: todayIso,
      numbers: {
        ...(row.revenue != null ? { revenue: { value: row.revenue, page: 2 } } : {}),
        ...(row.netBurn != null ? { burn: { value: Math.abs(row.netBurn), page: 3 } } : {}),
        ...(row.cash != null ? { cash: { value: row.cash, page: 3 } } : {}),
        ...(row.customers != null ? { customers: { value: row.customers, page: 4 } } : {}),
      },
    }));

    const latestRev =
      deal.sheet?.at(-1)?.revenue ??
      deal.record.traction.mrr.amount ??
      (deal.record.traction.arr.amount ? Math.round(deal.record.traction.arr.amount / 12) : 0);

    const newCompany: PortfolioCompany = {
      id: deal.id,
      name: deal.form.companyName,
      oneLiner: deal.record.oneLiner || `${deal.form.sector} company in ${deal.form.country}.`,
      sector: deal.form.sector || "B2B software",
      country: deal.form.country || "India",
      currency: currency || "USD",
      website: deal.form.website || "",
      founders:
        deal.form.founders?.length > 0
          ? deal.form.founders.map((f, idx) => ({ name: f.name, role: idx === 0 ? "Co-founder & CEO" : "Co-founder" }))
          : [{ name: "Founder", role: "CEO" }],
      owner: owner || leadPartner || "Partner",
      partner: leadPartner || "Partner",
      investment: {
        date: investDate,
        round,
        amountUsd: safeCheck,
        ownershipPct: safeOwn,
      },
      pitch: {
        receivedAt: deal.receivedAt.slice(0, 10),
        deckFile: deal.deck.fileName,
        band: store.bandOf(deal) === "Priority" ? "Priority" : "Review",
        meetingAt: todayIso,
        claims: {
          ...(latestRev ? { revenue: { value: latestRev, page: deal.record.traction.mrr.page ?? 4 } } : {}),
          ...(deal.record.traction.monthlyBurn.amount
            ? { burn: { value: deal.record.traction.monthlyBurn.amount, page: deal.record.traction.monthlyBurn.page ?? 9 } }
            : {}),
          ...(deal.record.traction.cash.amount
            ? { cash: { value: deal.record.traction.cash.amount, page: deal.record.traction.cash.page ?? 9 } }
            : {}),
          ...(deal.record.traction.customers.value
            ? { customers: { value: deal.record.traction.customers.value, page: deal.record.traction.customers.page ?? 4 } }
            : {}),
        },
        plan: {
          month: investDate.slice(0, 7),
          revenue: latestRev || 50_000,
          page: 9,
        },
      },
      reports,
      requests: [],
      asks: [],
      notes: [
        {
          date: todayIso,
          author: leadPartner || "Partner",
          text: `Closed ${round} investment of $${(safeCheck / 1_000_000).toFixed(2)}M for ${safeOwn}% ownership. Promoted from deal pipeline.`,
        },
      ],
    };

    portfolio.addCompany(newCompany);
    store.setStatus(deal.id, "Meeting set");
    void fetch(`/api/deals/${encodeURIComponent(deal.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Meeting set",
        decision_json: {
          status: "Invested",
          round,
          amountUsd: safeCheck,
          ownershipPct: safeOwn,
          promotedAt: new Date().toISOString(),
        },
      }),
    }).catch(() => undefined);

    setPromotedId(newCompany.id);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Close Deal &amp; Promote
            </span>
            <h3 className="mt-1 text-base font-bold text-slate-900">
              Move {deal.form.companyName} to Active Portfolio
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Records the closed check in Portfolio Oversight and immediately updates Fund Analytics (Capital Deployed, Dry Powder, and NAV).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {promotedId ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
              <div className="font-bold text-sm text-emerald-950">
                Investment Recorded in Portfolio &amp; Fund Analytics
              </div>
              <p>
                {deal.form.companyName} ({round}: ${(checkUsd / 1_000_000).toFixed(2)}M for {ownershipPct}% ownership) is now live in Portfolio Oversight and reflected in Fund I capital pacing.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/fund"
                className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                View Fund Analytics →
              </Link>
              <Link
                href={`/portfolio/${encodeURIComponent(promotedId)}`}
                className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open Portfolio Company →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Check Size (USD)</label>
                <input
                  type="number"
                  min={25000}
                  step={25000}
                  value={checkUsd}
                  onChange={(e) => setCheckUsd(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Ownership Stake (%)</label>
                <input
                  type="number"
                  min={0.5}
                  max={60}
                  step={0.1}
                  value={ownershipPct}
                  onChange={(e) => setOwnershipPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Round</label>
                <select
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="Pre-seed">Pre-seed</option>
                  <option value="Seed">Seed</option>
                  <option value="Series A">Series A</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Reporting Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AED">AED</option>
                  <option value="SAR">SAR</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Close Date</label>
                <input
                  type="date"
                  value={investDate}
                  onChange={(e) => setInvestDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  required
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Implied Post-Money</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                  ${ownershipPct > 0 ? ((checkUsd / (ownershipPct / 100)) / 1_000_000).toFixed(2) : "0.00"}M
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900">
              {deal.sheet && deal.sheet.length > 0
                ? `${deal.sheet.length} monthly CSV rows from diligence will be carried forward as initial portfolio MIS history.`
                : "No monthly CSV attached yet; monthly MIS tracking will begin after close."}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
              >
                Confirm Investment &amp; Add to Portfolio
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
