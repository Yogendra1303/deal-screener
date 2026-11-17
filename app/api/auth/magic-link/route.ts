import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/nextauth";
import { createMagicLinkToken, sendMagicLinkEmail } from "@/lib/magic-link";

/**
 * Admin-only invite magic link dispatch.
 * Public self-service magic links are disabled; only an authenticated VC Partner session can issue invite links.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.role !== "VC") {
      return NextResponse.json(
        { error: "Forbidden: Magic link invitations can only be issued by authorised fund partners." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const callbackUrl = typeof body.callbackUrl === "string" ? body.callbackUrl : "/";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const { token, otp, role, name } = await createMagicLinkToken(email, callbackUrl);

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.aarkavc.xyz";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;

    await sendMagicLinkEmail({
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
      message: `Partner invite link sent to ${email}`,
      email,
      role,
      name,
    });
  } catch (err) {
    console.error("[api/auth/magic-link] error:", err);
    return NextResponse.json({ error: "Failed to process magic link request." }, { status: 500 });
  }
}
