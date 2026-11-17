import { NextRequest } from "next/server";
import { requireRole } from "@/lib/nextauth";
import { realtimeBus, type RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireRole();
  if (!gate.ok) return Response.json({ error: gate.status === 401 ? "Unauthorized" : "Forbidden" }, { status: gate.status });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection payload
      const initPayload = `event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initPayload));

      // 2. Send recent events to hydrate
      const recent = realtimeBus.getRecentEvents();
      if (recent.length > 0) {
        const historyPayload = `event: history\ndata: ${JSON.stringify(recent)}\n\n`;
        controller.enqueue(encoder.encode(historyPayload));
      }

      // 3. Subscribe to live bus
      const unsubscribe = realtimeBus.subscribe((event: RealtimeEvent) => {
        try {
          const chunk = `event: message\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream might be closed
        }
      });

      // 4. Heartbeat ping every 15s to keep connection open
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {"time":${Date.now()}}\n\n`));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
