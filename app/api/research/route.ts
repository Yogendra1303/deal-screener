import { runResearch } from "@/lib/research";
import { MissingKeyError, hasKey } from "@/lib/ai";
import type { DealRecord } from "@/lib/schema";
import type { FormInput } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!hasKey()) return Response.json({ error: new MissingKeyError().message }, { status: 503 });
  let body: { form: FormInput; record: DealRecord };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the deal's form and record as JSON." }, { status: 400 });
  }
  if (!body?.form?.companyName || !body?.record) {
    return Response.json({ error: "The deal's form and record are required." }, { status: 400 });
  }
  try {
    const { research, step } = await runResearch({ form: body.form, record: body.record });
    return Response.json({ research, step });
  } catch (e) {
    console.error("research failed", e);
    return Response.json({ error: (e as Error).message || "Research failed." }, { status: 500 });
  }
}
