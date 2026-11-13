import { auth, authEnabled } from "@/lib/nextauth";

/** Who the server thinks you are. The role comes from the permitted list, never from the browser. */
export async function GET() {
  if (!authEnabled()) return Response.json({ enabled: false, user: null, role: null });
  const s = await auth();
  return Response.json({
    enabled: true,
    user: s?.user ? { email: s.user.email, name: s.user.name, image: s.user.image ?? null } : null,
    role: s?.role ?? null,
  });
}
