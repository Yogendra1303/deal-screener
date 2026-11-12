// One store's saved blob. GET returns it; PUT replaces it and mirrors it into the deals tables.
import { NoDatabaseError, getState, putState } from "@/lib/db/repository";
import { projectState } from "@/lib/db/project";

const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET(_: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  try {
    const value = await getState(key);
    return value === undefined ? new Response(null, { status: 204 }) : Response.json({ value });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  let body: { value?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send { value } as JSON." }, { status: 400 });
  }
  try {
    await putState(key, body.value ?? null);
    await projectState(key, body.value);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
