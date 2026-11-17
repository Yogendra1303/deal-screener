import { NextRequest, NextResponse } from "next/server";
import { createMagicLinkToken, sendMagicLinkEmail } from "@/lib/magic-link";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const callbackUrl = typeof body.callbackUrl === "string" ? body.callbackUrl : "/";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { token, otp, role, name } = await createMagicLinkToken(email, callbackUrl);

    // Determine base URL
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.aarkavc.xyz";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    const emailResult = await sendMagicLinkEmail({
      email,
      name,
      role,
      token,
      otp,
      origin,
      callbackUrl,
    });

    return NextResponse.json({
      success: true,
      message: `Verification code and magic link sent to ${email}`,
      email,
      role,
      name,
      // Provide preview OTP in development / non-production to guarantee zero lockouts
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    console.error("[api/auth/magic-link] error:", err);
    return NextResponse.json({ error: "Failed to process magic link request." }, { status: 500 });
  }
}
