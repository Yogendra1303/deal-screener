import type { NextRequest } from "next/server";
import { authEnabled, handlers } from "@/lib/nextauth";

export async function GET(req: NextRequest) {
  if (!authEnabled()) {
    return Response.json(null);
  }
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return Response.json({ error: "Auth is not configured." }, { status: 400 });
  }
  return handlers.POST(req);
}
