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

export default auth((req) => {
  if (!authEnabled()) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;
  const role = req.auth?.role;

  // Public founder intake & token-based document request links stay open.
  if (pathname.startsWith("/pitch") || pathname.startsWith("/founder/request") || pathname.startsWith("/founder/pitch")) {
    return NextResponse.next();
  }

  // Signed-in FOUNDER: lock to /founder (redirect away from /, /login, and all VC routes).
  if (user && role === "FOUNDER") {
    if (pathname === "/" || pathname.startsWith("/login") || isVcRoute(pathname)) {
      return NextResponse.redirect(new URL("/founder", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Signed-in VC: redirect /login straight to /, allow all VC routes.
  if (user && role === "VC") {
    if (pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Unauthenticated visitor: allow /login and / (which renders LoginScreen), redirect protected routes to /login.
  if (pathname === "/" || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (isVcRoute(pathname) || pathname === "/founder" || pathname.startsWith("/founder/home")) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
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
