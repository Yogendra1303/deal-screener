// Strict Default-Deny Route Proxy (Next.js 16 middleware convention).
// ONLY the landing page (/), pitch submission form (/pitch), auth/pending pages,
// tokenized founder pitch links, and explicitly required public APIs are accessible without VC auth.
// Every other internal route (e.g. /dashboard, /pipeline, /deals, /portfolio, /team, etc.) is DENIED by default.
import { NextResponse } from "next/server";
import { auth, authEnabled } from "@/lib/nextauth";

function isPublicPage(pathname: string, hasPitchToken: boolean): boolean {
  if (
    pathname === "/" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  )
    return true;
  if (pathname === "/pitch" || pathname.startsWith("/pitch/")) return true;
  if (pathname === "/founder/pitch") return true; // redirects cleanly to /pitch
  if (pathname === "/login" || pathname === "/pending" || pathname === "/unauthorized") return true;
  // Token-gated founder pitch status / data room (backend enforces cryptographic HMAC token check per dealId)
  if (pathname.startsWith("/founder/dataroom/") && hasPitchToken) return true;
  if (pathname === "/founder/dataroom" && hasPitchToken) return true;
  return false;
}

function isPublicApi(pathname: string, method: string, hasPitchToken: boolean): boolean {
  // NextAuth OAuth callbacks & session endpoints
  if (pathname.startsWith("/api/auth/")) return true;
  // Public founder pitch submission & signed upload URL
  if (pathname === "/api/submit-pitch" || pathname === "/api/pitch" || pathname === "/api/upload-url") return true;
  // Public Invite-Only access request submission (POST only; GET stays locked to VC)
  if (pathname === "/api/access-request" && method === "POST") return true;
  // Client error telemetry ingestion (POST only; GET stays locked to VC)
  if (pathname === "/api/errors" && method === "POST") return true;
  // Anonymous public pageview beacon (POST only; GET analytics stays locked to VC)
  if (pathname === "/api/track" && method === "POST") return true;
  // Minimal non-sensitive health probe
  if (pathname === "/api/health" && method === "GET") return true;
  // Secret-authenticated webhooks & cron jobs (route handlers strictly enforce secret or VC session -> 401 otherwise)
  if (pathname === "/api/webhooks/inbound-email" && method === "POST") return true;
  if (pathname === "/api/cron/portfolio-digest") return true;
  // Token-authenticated founder pitch tracking & data room endpoints (strict HMAC verified inside each handler)
  if (
    hasPitchToken &&
    (pathname === "/api/founder/dataroom" ||
      pathname === "/api/founder/file" ||
      pathname === "/api/founder/upload" ||
      pathname === "/api/founder/metrics")
  ) {
    return true;
  }
  return false;
}

export default auth((req) => {
  if (!authEnabled()) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;
  const method = req.method.toUpperCase();
  const hasPitchToken = Boolean(searchParams.get("token")?.trim() || req.headers.get("x-pitch-token")?.trim());
  const user = req.auth?.user ?? null;
  const role = req.auth?.role ?? null;
  const isApprovedVc = Boolean(user && role === "VC");

  // 1. API Routes — Default Deny (401 JSON) unless explicitly public or approved VC
  if (pathname.startsWith("/api/")) {
    if (isApprovedVc) return NextResponse.next();
    if (isPublicApi(pathname, method, hasPitchToken)) return NextResponse.next();
    // Allow signed-in founders on /api/founder/* (handlers still enforce strict row-level ownership)
    if (user && pathname.startsWith("/api/founder/")) return NextResponse.next();
    return NextResponse.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
  }

  // 2. Approved VC Partner — full workspace access; redirect /login and /pending straight to /
  if (isApprovedVc) {
    if (pathname === "/login" || pathname === "/pending" || pathname === "/unauthorized") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // 3. Public Pages — explicitly allowlisted only
  if (isPublicPage(pathname, hasPitchToken)) {
    return NextResponse.next();
  }

  // 4. Signed-in non-VC user trying any internal route -> /pending
  if (user) {
    return NextResponse.redirect(new URL("/pending", req.nextUrl.origin));
  }

  // 5. Default Deny — unauthenticated visitor hitting ANY internal route (/dashboard, /pipeline, /deals, /portfolio, /team, etc.) -> homepage (/)
  return NextResponse.redirect(new URL("/", req.nextUrl.origin));
});

export const config = {
  // Catch-all default-deny matcher excluding only static build/public assets
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|logo\\.png|aarka-logo\\.png|aarka-social-logo\\.png|og-card\\.png|og-image\\.png|images/|samples/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
