// Strict server-side RBAC gate: prevents UI flickering and blocks FOUNDERs from internal VC routes.
import { NextResponse } from "next/server";
import { auth, authEnabled } from "@/lib/nextauth";

const VC_PREFIXES = [
  "/deals",
  "/portfolio",
  "/sectors",
  "/market",
  "/team",
  "/dataroom",
  "/compare",
  "/new",
  "/upload",
  "/rules",
  "/workspace",
  "/method",
  "/sources",
  "/resources",
  "/results",
];

function isVcRoute(pathname: string): boolean {
  return VC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function readCookieSession(raw?: string): { email: string; role: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: string; role?: string; expiresAt?: number };
    if (parsed.email && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
      return { email: parsed.email, role: parsed.role || "VC" };
    }
  } catch {
    // ignore malformed cookie
  }
  return null;
}

export default auth((req) => {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const cookieSession = readCookieSession(req.cookies.get("aarka_session")?.value);
  const user = req.auth?.user ?? (cookieSession ? { email: cookieSession.email } : null);
  const role = req.auth?.role ?? cookieSession?.role ?? null;

  // Public founder intake, data room portal, login, & token-based request links stay open.
  if (
    pathname.startsWith("/pitch") ||
    pathname.startsWith("/founder/request") ||
    pathname.startsWith("/founder/pitch") ||
    pathname.startsWith("/founder/dataroom")
  ) {
    return NextResponse.next();
  }

  // Signed-in FOUNDER: lock to /founder (redirect away from /, /login, and all VC routes).
  if (user && role === "FOUNDER") {
    if (pathname === "/" || pathname.startsWith("/login") || isVcRoute(pathname)) {
      return NextResponse.redirect(new URL("/founder", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Signed-in VC (or Guest Preview): redirect /login straight to /, allow all VC routes.
  if (user && (role === "VC" || role === "partner" || role === "analyst")) {
    if (pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Unauthenticated visitor: / and /welcome and /login stay accessible.
  if (pathname === "/" || pathname.startsWith("/welcome") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (isVcRoute(pathname) || pathname === "/founder" || pathname.startsWith("/founder/home")) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/login",
    "/founder",
    "/founder/:path*",
    "/deals/:path*",
    "/portfolio/:path*",
    "/sectors/:path*",
    "/market/:path*",
    "/team/:path*",
    "/dataroom/:path*",
    "/compare/:path*",
    "/new/:path*",
    "/upload/:path*",
    "/rules/:path*",
    "/workspace/:path*",
    "/method/:path*",
    "/sources/:path*",
    "/resources/:path*",
    "/results/:path*",
  ],
};
