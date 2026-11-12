import { lookupFacts } from "@/lib/lookups";
import { requireRole } from "@/lib/nextauth";
import type { FormInput } from "@/lib/types";

export const maxDuration = 60;

/** Live registry and founder-profile facts for a company, fetched here so the API keys stay on the server. */
export async function POST(request: Request) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Sign in first." : "Your account isn't permitted." }, { status: gate.status });
  let body: { form?: FormInput; founderNames?: string[]; companyName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  if (!body.form?.companyName?.trim()) return Response.json({ error: "form.companyName is required." }, { status: 400 });
  return Response.json(await lookupFacts({ ...body.form, founders: body.form.founders ?? [] }, { companyName: body.companyName, founderNames: body.founderNames }));
}
