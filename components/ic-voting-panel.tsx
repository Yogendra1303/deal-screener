"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, cx } from "@/components/ui";
import type { PartnerVote, VoteChoice } from "@/app/api/deals/[id]/votes/route";

const CHOICES: { value: VoteChoice; label: string; activeCls: string; idleCls: string }[] = [
  {
    value: "Term Sheet",
    label: "Term Sheet",
    activeCls: "border-emerald-600 bg-emerald-600 text-white",
    idleCls: "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
  },
  {
    value: "Take Call",
    label: "Take Call",
    activeCls: "border-blue-600 bg-blue-600 text-white",
    idleCls: "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800",
  },
  {
    value: "Hold",
    label: "Hold",
    activeCls: "border-amber-500 bg-amber-500 text-white",
    idleCls: "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800",
  },
  {
    value: "Pass",
    label: "Pass",
    activeCls: "border-slate-900 bg-slate-900 text-white",
    idleCls: "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100",
  },
];

function voteBadge(vote: VoteChoice): string {
  if (vote === "Term Sheet") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (vote === "Take Call") return "bg-blue-50 text-blue-700 ring-blue-200";
  if (vote === "Hold") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function ICVotingPanel({ dealId, companyName }: { dealId: string; companyName: string }) {
  const [votes, setVotes] = useState<PartnerVote[]>([]);
  const [selectedVote, setSelectedVote] = useState<VoteChoice>("Take Call");
  const [conviction, setConviction] = useState<number>(4);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadVotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/votes`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok?: boolean; votes?: PartnerVote[] };
      if (json.ok && Array.isArray(json.votes)) setVotes(json.votes);
    } catch {
      // ignore transient errors
    }
  }, [dealId]);

  useEffect(() => {
    void loadVotes();
  }, [loadVotes]);

  async function submitVote(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vote: selectedVote,
          conviction,
          rationale: rationale.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; votes?: PartnerVote[]; error?: string };
      if (!res.ok || !json.ok) {
        setStatusMsg(json.error || "Could not log vote.");
        return;
      }
      if (Array.isArray(json.votes)) setVotes(json.votes);
      setRationale("");
      setStatusMsg(`Recorded "${selectedVote}" vote for ${companyName}.`);
      setTimeout(() => setStatusMsg(null), 4000);
    } catch {
      setStatusMsg("Network error saving vote.");
    } finally {
      setSaving(false);
    }
  }

  const avgConviction =
    votes.length > 0 ? (votes.reduce((acc, v) => acc + (v.conviction || 0), 0) / votes.length).toFixed(1) : null;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Partner IC Consensus</h3>
          <p className="text-[11px] text-slate-500">Logged with voter &amp; timestamp to audit history.</p>
        </div>
        {avgConviction && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
            {avgConviction}/5 avg
          </span>
        )}
      </div>

      <form onSubmit={submitVote} className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setSelectedVote(c.value)}
              className={cx(
                "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                selectedVote === c.value ? c.activeCls : c.idleCls,
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-600">Conviction</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConviction(n)}
                className={cx(
                  "h-6 w-6 cursor-pointer rounded text-xs font-semibold transition-colors",
                  conviction >= n ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={2}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Short IC note or rationale (optional)…"
          className="w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Logging vote…" : `Log "${selectedVote}" Vote`}
        </button>

        {statusMsg && <p className="text-[11px] font-medium text-emerald-700">{statusMsg}</p>}
      </form>

      {votes.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Recorded Votes ({votes.length})
          </p>
          <ul className="space-y-2">
            {votes.map((v) => (
              <li key={v.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-900">{v.voterName}</span>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset", voteBadge(v.vote))}>
                    {v.vote} · {v.conviction}/5
                  </span>
                </div>
                {v.rationale && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{v.rationale}</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Date(v.votedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
