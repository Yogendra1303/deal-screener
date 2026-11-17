import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/nextauth";

const COOKIE_NAME = "aarka_session";

export async function GET(req: NextRequest) {
  // Check NextAuth first if available
  try {
    const nextAuthSession = await auth();
    if (nextAuthSession?.user?.email) {
      return NextResponse.json({
        authenticated: true,
        user: {
          email: nextAuthSession.user.email,
          name: nextAuthSession.user.name || nextAuthSession.user.email.split("@")[0],
          image: nextAuthSession.user.image || null,
          role: nextAuthSession.role || "VC",
        },
      });
    }
  } catch {
    // NextAuth inactive or not configured
  }

  // Check custom aarka_session cookie
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.expiresAt > Date.now()) {
        return NextResponse.json({
          authenticated: true,
          user: {
            email: data.email,
            name: data.name,
            role: data.role,
            image: null,
          },
        });
      }
    } catch {
      // invalid cookie
    }
  }

  return NextResponse.json({ authenticated: false, user: null });
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ success: true, message: "Logged out" });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
