// Workspace settings: which data shows, the fund rules, and whether the AI runs through an account or a key.
import { NoDatabaseError, driver, getSettings, putSettings } from "@/lib/db/repository";

const fail = (e: unknown) => (e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 }));

export async function GET() {
  try {
    return Response.json({ driver: driver(), settings: await getSettings() });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the settings as JSON." }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.workspace_mode === "string") patch.workspace_mode = body.workspace_mode;
  if (typeof body.ai_mode === "string") patch.ai_mode = body.ai_mode;
  if (body.fund_rules_json !== undefined) patch.fund_rules_json = body.fund_rules_json;
  try {
    return Response.json({ settings: await putSettings(patch) });
  } catch (e) {
    return fail(e);
  }
}
