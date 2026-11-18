import { NextRequest, NextResponse } from "next/server";
import { getState, insertAuditLog, putState } from "@/lib/db/repository";
import { auth, requireRole } from "@/lib/nextauth";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export type VoteChoice = "Term Sheet" | "Take Call" | "Hold" | "Pass";

export interface PartnerVote {
  id: string;
  dealId: string;
  voterEmail: string;
  voterName: string;
  vote: VoteChoice;
  conviction: number; // 1 to 5
  rationale: string;
  votedAt: string;
}

export interface VoteConsensus {
  totalVotes: number;
  avgConviction: number | null;
  counts: Record<VoteChoice, number>;
  leadingVote: VoteChoice | null;
}

const VALID_VOTES = new Set<VoteChoice>(["Term Sheet", "Take Call", "Hold", "Pass"]);
const STATE_KEY = "ic_votes_v1";

function summarizeVotes(votes: PartnerVote[]): VoteConsensus {
  const counts: Record<VoteChoice, number> = {
    "Term Sheet": 0,
    "Take Call": 0,
    Hold: 0,
    Pass: 0,
  };
  let sumConviction = 0;
  for (const v of votes) {
    if (VALID_VOTES.has(v.vote)) counts[v.vote]++;
    sumConviction += Number(v.conviction) || 0;
  }
  const totalVotes = votes.length;
  const avgConviction = totalVotes > 0 ? Math.round((sumConviction / totalVotes) * 10) / 10 : null;
  let leadingVote: VoteChoice | null = null;
  let maxCount = 0;
  for (const [choice, count] of Object.entries(counts) as [VoteChoice, number][]) {
    if (count > maxCount) {
      maxCount = count;
      leadingVote = choice;
    }
  }
  return { totalVotes, avgConviction, counts, leadingVote };
}

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const all = (await getState<Record<string, PartnerVote[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  const votes = Array.isArray(all[id]) ? all[id] : [];
  return NextResponse.json({ ok: true, dealId: id, votes, consensus: summarizeVotes(votes) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    vote?: string;
    conviction?: number;
    rationale?: string;
  };

  const vote = String(body.vote || "") as VoteChoice;
  if (!VALID_VOTES.has(vote)) {
    return NextResponse.json({ error: "Vote must be Term Sheet, Take Call, Hold, or Pass." }, { status: 400 });
  }

  const conviction = Math.min(5, Math.max(1, Math.round(Number(body.conviction ?? 4) || 4)));
  const rationale = String(body.rationale || "").trim().slice(0, 600);

  const session = await auth().catch(() => null);
  const voterEmail = session?.user?.email?.trim().toLowerCase() || "partner@aarkavc.xyz";
  const voterName = session?.user?.name?.trim() || voterEmail.split("@")[0];

  const entry: PartnerVote = {
    id: `vote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    dealId: id,
    voterEmail,
    voterName,
    vote,
    conviction,
    rationale,
    votedAt: new Date().toISOString(),
  };

  const all = (await getState<Record<string, PartnerVote[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  const existing = Array.isArray(all[id]) ? all[id] : [];
  const nextForDeal = [entry, ...existing.filter((v) => v.voterEmail !== voterEmail)];
  await putState(STATE_KEY, { ...all, [id]: nextForDeal });

  void insertAuditLog("IC_VOTE", voterEmail, {
    name: voterName,
    dealId: id,
    vote,
    conviction,
    rationale,
    message: `${voterName} voted "${vote}" (${conviction}/5 conviction) on ${id}${rationale ? `: "${rationale}"` : ""}.`,
  }).catch(() => undefined);

  try {
    broadcastRealtimeEvent("deal.updated", { type: "ic_vote", dealId: id, vote: entry });
  } catch {
    // non-blocking
  }

  return NextResponse.json({ ok: true, vote: entry, votes: nextForDeal, consensus: summarizeVotes(nextForDeal) });
}

/** Retract the signed-in partner's IC vote on this deal. */
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const session = await auth().catch(() => null);
  const voterEmail = session?.user?.email?.trim().toLowerCase() || "partner@aarkavc.xyz";

  const all = (await getState<Record<string, PartnerVote[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  const existing = Array.isArray(all[id]) ? all[id] : [];
  const nextForDeal = existing.filter((v) => v.voterEmail !== voterEmail);
  await putState(STATE_KEY, { ...all, [id]: nextForDeal });

  void insertAuditLog("IC_VOTE_RETRACTED", voterEmail, {
    dealId: id,
    message: `${voterEmail} retracted IC vote on ${id}.`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, dealId: id, votes: nextForDeal, consensus: summarizeVotes(nextForDeal) });
}
