// One deal row, with its files and signals. PATCH updates only changed columns safely; DELETE removes spam/test deals.
import { revalidatePath } from "next/cache";
import { NoDatabaseError, deleteDeal, getDeal, getState, insertAuditLog, listFiles, listSignals, patchDeal, putState } from "@/lib/db/repository";
import { STATE_KEYS } from "@/lib/db/project";
import { auth, requireRole } from "@/lib/nextauth";
import { broadcastRealtimeEvent } from "@/lib/realtime";

const EDITABLE = new Set([
  "status",
  "band",
  "owner",
  "sector",
  "stage",
  "ask_amount",
  "checks_status",
  "decision_json",
  "research_pack_json",
  "record_json",
  "founder_fit",
]);

const VALID_STATUSES = new Set(["New", "Reviewing", "Meeting set", "On hold", "Passed"]);

const fail = (e: unknown) =>
  e instanceof NoDatabaseError
    ? Response.json({ error: e.message }, { status: 503 })
    : Response.json({ error: (e as Error).message }, { status: 500 });

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const { id } = await ctx.params;
  try {
    const deal = await getDeal(id);
    if (!deal) return Response.json({ error: "No such deal." }, { status: 404 });
    return Response.json({ deal, files: await listFiles(id), signals: await listSignals(id) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the changed columns as JSON." }, { status: 400 });
  }

  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.has(k)));
  if (!Object.keys(patch).length) {
    return Response.json({ error: `Nothing to change. Editable: ${[...EDITABLE].join(", ")}.` }, { status: 400 });
  }

  if (patch.status !== undefined && (typeof patch.status !== "string" || !VALID_STATUSES.has(patch.status))) {
    return Response.json(
      { error: `Invalid status. Allowed: ${[...VALID_STATUSES].join(", ")}.` },
      { status: 400 },
    );
  }

  if (patch.ask_amount !== undefined) {
    const n = Number(patch.ask_amount);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      return Response.json({ error: "ask_amount must be a valid non-negative USD number." }, { status: 400 });
    }
    patch.ask_amount = n;
  }

  try {
    const existing = await getDeal(id);
    if (!existing) {
      return Response.json({ error: "No such deal." }, { status: 404 });
    }

    // Use patchDeal so only provided fields change — never clobber company_name, sector, founder_email, or intake_json!
    const updated = await patchDeal(id, patch);

    const session = await auth().catch(() => null);
    const actor = session?.user?.email?.trim().toLowerCase() || "partner";
    void insertAuditLog("DEAL_UPDATED", actor, {
      dealId: id,
      companyName: updated?.company_name ?? existing.company_name,
      changedFields: Object.keys(patch),
      status: patch.status ?? updated?.status,
    }).catch(() => undefined);

    try {
      broadcastRealtimeEvent("deal.updated", { id, patch });
    } catch {
      // non-blocking
    }

    revalidatePath("/deals");
    revalidatePath("/");
    return Response.json({ ok: true, deal: updated });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const { id } = await ctx.params;
  try {
    const existing = await getDeal(id);
    if (!existing) {
      return Response.json({ error: "No such deal." }, { status: 404 });
    }

    await deleteDeal(id);

    // Cleanly remove from mirrored app_state stores so deleted spam/test pitches never resurrect on reload
    try {
      const dealsMap = await getState<Record<string, unknown>>(STATE_KEYS.deals);
      if (dealsMap && id in dealsMap) {
        const next = { ...dealsMap };
        delete next[id];
        await putState(STATE_KEYS.deals, next);
      }
      const links = await getState<{ inbound?: Array<{ id?: string }> } & Record<string, unknown>>(STATE_KEYS.links);
      if (links && Array.isArray(links.inbound)) {
        await putState(STATE_KEYS.links, {
          ...links,
          inbound: links.inbound.filter((item) => item?.id !== id),
        });
      }
    } catch {
      // non-blocking mirror cleanup
    }

    const session = await auth().catch(() => null);
    const actor = session?.user?.email?.trim().toLowerCase() || "partner";
    void insertAuditLog("DEAL_DELETED", actor, {
      dealId: id,
      companyName: existing.company_name,
      message: `${actor} deleted deal ${existing.company_name} (${id}).`,
    }).catch(() => undefined);

    try {
      broadcastRealtimeEvent("deal.updated", { type: "deleted", id });
    } catch {
      // non-blocking
    }

    revalidatePath("/deals");
    revalidatePath("/");
    return Response.json({ ok: true, deletedId: id });
  } catch (e) {
    return fail(e);
  }
}
