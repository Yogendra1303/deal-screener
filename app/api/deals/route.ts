// Every deal row the database knows (uploads, decided or changed sample deals, and history deals once touched).
import { NoDatabaseError, listDeals } from "@/lib/db/repository";
import { seedDatabase } from "@/lib/db/seed";

export async function GET() {
  try {
    let deals = await listDeals();
    if (!deals || deals.length === 0) {
      await seedDatabase().catch((err) => console.error("[deals][auto-seed]", err));
      deals = await listDeals();
    }
    return Response.json({ deals });
  } catch (e) {
    return e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
