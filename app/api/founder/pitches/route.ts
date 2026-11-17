import { auth, authEnabled } from "@/lib/nextauth";
import { listFounderDeals } from "@/lib/db/repository";

export async function GET() {
  if (authEnabled()) {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const pitches = await listFounderDeals(session.user.email);
      return Response.json({ pitches });
    } catch {
      return Response.json({ pitches: [] });
    }
  }
  return Response.json({ pitches: [] });
}
