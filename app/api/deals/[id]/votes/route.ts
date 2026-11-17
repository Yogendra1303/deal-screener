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

const VALID_VOTES = new Set<VoteChoice>(["Term Sheet", "Take Call", "Hold", "Pass"]);
const STATE_KEY = "ic_votes_v1";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const all = (await getState<Record<string, PartnerVote[]>>(STATE_KEY).catch(() => undefined)) ?? {};
  const votes = Array.isArray(all[id]) ? all[id] : [];
  return NextResponse.json({ ok: true, dealId: id, votes });
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
  // Replace this partner's previous vote while preserving full audit log history
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

  return NextResponse.json({ ok: true, vote: entry, votes: nextForDeal });
}
