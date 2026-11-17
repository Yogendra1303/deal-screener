import { NextRequest, NextResponse } from "next/server";
import { listSystemErrors, recordAndAlertError, type SystemErrorEntry } from "@/lib/error-logger";

export async function GET() {
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
    const message = typeof body.message === "string" ? body.message.trim() : "";
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
      stack: typeof body.stack === "string" ? body.stack : undefined,
      url: typeof body.url === "string" ? body.url : req.headers.get("referer") || undefined,
      component: typeof body.component === "string" ? body.component : undefined,
      userEmail: typeof body.userEmail === "string" ? body.userEmail : undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/errors] POST error:", err);
    return NextResponse.json({ error: "Failed to log error" }, { status: 500 });
  }
}
