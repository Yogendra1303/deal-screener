import { auth, authEnabled } from "@/lib/nextauth";

/** Who the server thinks you are. Reads strictly from verified NextAuth session. */
export async function GET() {
  const enabled = authEnabled();
  if (!enabled) {
    return Response.json({ enabled: false, user: null, role: null });
  }

  try {
    const s = await auth();
    if (s?.user?.email) {
      return Response.json({
        enabled: true,
        user: { email: s.user.email, name: s.user.name, image: s.user.image ?? null },
        role: s.role ?? "FOUNDER",
      });
    }
  } catch {
    // ignore
  }

  return Response.json({ enabled: true, user: null, role: null });
}
