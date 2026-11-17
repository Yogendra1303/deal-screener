import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/db/seed";
import { listDeals, driver } from "@/lib/db/repository";
import { requireRole } from "@/lib/nextauth";

export async function GET() {
  const gate = await requireRole();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const drv = driver();
  const deals = await listDeals().catch(() => []);
  return NextResponse.json({
    driver: drv,
    dealsCount: deals.length,
    seeded: deals.length > 0,
  });
}

export async function POST() {
  const gate = await requireRole();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  try {
    const res = await seedDatabase();
    return NextResponse.json(res);
  } catch (err) {
    console.error("[api/seed] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
