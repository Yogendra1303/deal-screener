import { EFFORT, MODEL, hasKey } from "@/lib/ai";
import { driver, listStateKeys } from "@/lib/db/repository";
import { authEnabled } from "@/lib/nextauth";

export async function GET() {
  const dbDriver = driver();
  let dbReachable = false;

  if (dbDriver !== "none") {
    try {
      await listStateKeys();
      dbReachable = true;
    } catch {
      dbReachable = false;
    }
  }

  const ok = dbDriver === "none" || dbReachable;
  return Response.json(
    {
      ok,
      hasKey: hasKey(),
      hasEmail: Boolean(process.env.RESEND_API_KEY),
      authEnabled: authEnabled(),
      model: MODEL,
      effort: EFFORT,
      db: dbDriver,
      dbReachable,
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
