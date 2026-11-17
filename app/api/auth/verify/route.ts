import { NextRequest, NextResponse } from "next/server";
import { verifyMagicOtp, verifyMagicToken } from "@/lib/magic-link";
import { upsertUser } from "@/lib/db/repository";

const COOKIE_NAME = "aarka_session";

function makeSessionCookieValue(user: { email: string; name: string; role: string }) {
  return JSON.stringify({
    ...user,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", req.url));
  }

  const record = verifyMagicToken(token);
  if (!record) {
    return NextResponse.redirect(new URL("/login?error=expired_token", req.url));
  }

  try {
    await upsertUser({
      email: record.email,
      name: record.name,
      avatar: null,
      role: record.role,
    });
  } catch (err) {
    console.error("[api/auth/verify] upsertUser error:", err);
  }

  const targetUrl = record.role === "VC" ? callbackUrl || "/" : "/founder";
  const res = NextResponse.redirect(new URL(targetUrl, req.url));

  res.cookies.set({
    name: COOKIE_NAME,
    value: makeSessionCookieValue(record),
    path: "/",
    httpOnly: false, // Accessible to client components for seamless UI state
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 14 * 24 * 60 * 60,
  });

  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, otp, token, callbackUrl = "/" } = body;

    let record = null;
    if (token) {
      record = verifyMagicToken(token);
    } else if (email && otp) {
      record = verifyMagicOtp(email, otp);
    }

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 401 });
    }

    try {
      await upsertUser({
        email: record.email,
        name: record.name,
        avatar: null,
        role: record.role,
      });
    } catch (err) {
      console.error("[api/auth/verify] upsertUser error:", err);
    }

    const redirectUrl = record.role === "VC" ? callbackUrl || "/" : "/founder";
    const res = NextResponse.json({
      success: true,
      user: {
        email: record.email,
        name: record.name,
        role: record.role,
      },
      redirectUrl,
    });

    res.cookies.set({
      name: COOKIE_NAME,
      value: makeSessionCookieValue(record),
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 14 * 24 * 60 * 60,
    });

    return res;
  } catch (err) {
    console.error("[api/auth/verify] error:", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
