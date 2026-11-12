// One deal row, with its files and signals. PATCH changes the columns a person may set.
import { NoDatabaseError, getDeal, listFiles, listSignals, mergeDeals } from "@/lib/db/repository";
import { baseRow } from "@/lib/db/project";

const EDITABLE = new Set(["status", "band", "owner", "decision_json", "research_pack_json", "record_json", "founder_fit"]);
const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the changed columns as JSON." }, { status: 400 });
  }
  const patch = Object.fromEntries(Object.entries(body).filter(([k]) => EDITABLE.has(k)));
  if (!Object.keys(patch).length) return Response.json({ error: `Nothing to change. Editable: ${[...EDITABLE].join(", ")}.` }, { status: 400 });
  try {
    await mergeDeals([{ ...baseRow(id), ...patch }]);
    return Response.json({ deal: await getDeal(id) });
  } catch (e) {
    return fail(e);
  }
}
