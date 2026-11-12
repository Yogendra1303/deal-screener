// Direct API-key mode. The same jobs the account bridge does by copy and paste, run here when a key is set.
// Deck extraction needs the PDF, so the browser sends that job to /api/process as a form upload instead.
import { MissingKeyError, MODEL, hasKey } from "@/lib/ai";
import { runResearch } from "@/lib/research";
import type { DealRecord } from "@/lib/schema";
import type { FormInput } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return Response.json({ mode: hasKey() ? "API_KEY" : "ACCOUNT_BRIDGE", hasKey: hasKey(), model: MODEL });
}

export async function POST(request: Request) {
  if (!hasKey()) return Response.json({ error: new MissingKeyError().message, mode: "ACCOUNT_BRIDGE" }, { status: 503 });
  let body: { kind?: string; form?: FormInput; record?: DealRecord };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send { kind, form, record } as JSON." }, { status: 400 });
  }
  if (body.kind === "research" && body.form && body.record) {
    try {
      return Response.json(await runResearch({ form: body.form, record: body.record }));
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  }
  if (body.kind === "extract") return Response.json({ error: "Send the deck PDF to /api/process as a multipart form; it runs extraction, checks and assessment." }, { status: 400 });
  return Response.json({ error: "kind must be research or extract." }, { status: 400 });
}
