// Every deal row the database knows (uploads, decided or changed sample deals, and history deals once touched).
import { NoDatabaseError, listDeals } from "@/lib/db/repository";

export async function GET() {
  try {
    return Response.json({ deals: await listDeals() });
  } catch (e) {
    return e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
