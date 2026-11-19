// Every deal row the database knows - with ETag / 304 Not Modified conditional caching for zero-lag sync.
import crypto from "crypto";
import { NoDatabaseError, listDeals } from "@/lib/db/repository";
import { seedDatabase } from "@/lib/db/seed";
import { requireRole } from "@/lib/nextauth";

export async function GET(req: Request) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  try {
    let deals = await listDeals();
    if (!deals || deals.length === 0) {
      await seedDatabase().catch((err) => console.error("[deals][auto-seed]", err));
      deals = await listDeals();
    }

    const payload = JSON.stringify({ deals });
    const etag = `"${crypto.createHash("sha1").update(payload).digest("hex").slice(0, 20)}"`;
    const ifNoneMatch = req.headers.get("if-none-match");

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ETag: etag,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    return e instanceof NoDatabaseError ? Response.json({ error: e.message }, { status: 503 }) : Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
