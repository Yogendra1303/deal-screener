// Real sign-in: Google, with the role decided on the server from the permitted list in the database.
// Auth is only enforced when AUTH_SECRET and AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET are set (see authEnabled()).
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getPermittedUser, type AppRole } from "./db/repository";

export function authEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

declare module "next-auth" {
  interface Session {
    role?: AppRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  callbacks: {
    // Only Google emails that are verified and on the permitted list get in.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified === false) return false;
      try {
        return (await getPermittedUser(email)) != null;
      } catch {
        return false;
      }
    },
    // The role is looked up again on every token refresh, so removing someone from the table takes effect.
    async jwt({ token }) {
      const email = typeof token.email === "string" ? token.email.toLowerCase() : "";
      try {
        const p = email ? await getPermittedUser(email) : null;
        token.role = p?.role;
      } catch {
        // Keep the last known role if the database is briefly unreachable.
      }
      return token;
    },
    async session({ session, token }) {
      session.role = token.role as AppRole | undefined;
      return session;
    },
  },
});

/** For API routes: the signed-in, permitted user's role, or null. Always true-ish "open" when auth isn't configured. */
export async function requireRole(allowed: AppRole[] = ["analyst", "partner"]): Promise<{ ok: true; role: AppRole | "open" } | { ok: false; status: 401 | 403 }> {
  if (!authEnabled()) return { ok: true, role: "open" };
  const s = await auth();
  if (!s?.user) return { ok: false, status: 401 };
  if (!s.role || !allowed.includes(s.role)) return { ok: false, status: 403 };
  return { ok: true, role: s.role };
}
