// Keeps signed-out people away from the internal screens. This is the first gate only; API routes and
// pages that matter re-check the role on the server (see requireRole in lib/nextauth.ts).
import { NextResponse } from "next/server";
import { auth, authEnabled } from "@/lib/nextauth";

export default auth((req) => {
  if (!authEnabled()) return NextResponse.next(); // not configured yet: leave the demo sign-in working
  const role = (req.auth as { role?: string } | null)?.role;
  if (req.auth?.user && role) return NextResponse.next();
  const url = new URL("/api/auth/signin", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  if (req.auth?.user && !role) url.searchParams.set("error", "AccessDenied");
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/deals/:path*", "/sectors/:path*", "/dataroom/:path*"],
};
