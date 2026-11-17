import { NextRequest, NextResponse } from "next/server";
import { listSystemErrors, recordAndAlertError, type SystemErrorEntry } from "@/lib/error-logger";
import { requireRole } from "@/lib/nextauth";

export async function GET() {
  const gate = await requireRole();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const errors = await listSystemErrors();
  return NextResponse.json({
    ok: true,
    count: errors.length,
    errors,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) : "";
    if (!message) {
      return NextResponse.json({ error: "Missing error message" }, { status: 400 });
    }

    const allowedSources: SystemErrorEntry["source"][] = [
      "client_runtime",
      "client_promise",
      "react_boundary",
      "api_route",
      "other",
    ];
    const source: SystemErrorEntry["source"] = allowedSources.includes(body.source) ? body.source : "other";

    const result = await recordAndAlertError({
      source,
      message,
      stack: typeof body.stack === "string" ? body.stack.slice(0, 3000) : undefined,
      url: typeof body.url === "string" ? body.url.slice(0, 500) : req.headers.get("referer")?.slice(0, 500) || undefined,
      component: typeof body.component === "string" ? body.component.slice(0, 120) : undefined,
      userEmail: typeof body.userEmail === "string" ? body.userEmail.slice(0, 160) : undefined,
      userAgent: req.headers.get("user-agent")?.slice(0, 250) || undefined,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/errors] POST error:", err);
    return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
  }
}
