// All saved stores. DELETE is the factory reset: every blob, every logged signal, every non-sample deal row.
import { NoDatabaseError, clearState, driver, listStateKeys } from "@/lib/db/repository";

const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET() {
  try {
    return Response.json({ driver: driver(), keys: await listStateKeys() });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  try {
    await clearState();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
