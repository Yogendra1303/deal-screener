import { EFFORT, MODEL, hasKey } from "@/lib/ai";
import { driver } from "@/lib/db/repository";

export async function GET() {
  return Response.json({ hasKey: hasKey(), model: MODEL, effort: EFFORT, db: driver(), supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) });
}
