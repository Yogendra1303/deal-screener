import { cookies } from "next/headers";
import { auth, authEnabled } from "@/lib/nextauth";

/** Who the server thinks you are. Reads both NextAuth and secure magic-link session cookie. */
export async function GET() {
  // 1. Check NextAuth if active
  if (authEnabled()) {
    try {
      const s = await auth();
      if (s?.user?.email) {
        return Response.json({
          enabled: true,
          user: { email: s.user.email, name: s.user.name, image: s.user.image ?? null },
          role: s.role ?? "VC",
        });
      }
    } catch {
      // ignore
    }
  }

  // 2. Check aarka_session cookie
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("aarka_session")?.value;
    if (raw) {
      const data = JSON.parse(raw);
      if (data.expiresAt > Date.now()) {
        return Response.json({
          enabled: true,
          user: {
            email: data.email,
            name: data.name,
            image: data.image ?? null,
          },
          role: data.role || "VC",
        });
      }
    }
  } catch {
    // ignore
  }

  return Response.json({ enabled: false, user: null, role: null });
}
