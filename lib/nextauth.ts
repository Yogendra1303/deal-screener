// Real sign-in: open Google OAuth for both VCs and Founders, with strict server-side RBAC.
// Auth is only enforced when AUTH_SECRET and AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET are set (see authEnabled()).
import NextAuth from "next-auth";
import "next-auth/jwt";
import Google from "next-auth/providers/google";
import { getPermittedUser, upsertUser, type AppRole, type UserRole } from "./db/repository";

export type AuthRole = UserRole; // "VC" | "FOUNDER"

const DEFAULT_VC_EMAILS = ["yogendrakapkoti1309@gmail.com", "yogendrakapkoti13@gmail.com"];

function getVcEmailSet(): Set<string> {
  const extra = (process.env.VC_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_VC_EMAILS, ...extra]);
}

export async function resolveAuthRole(email: string): Promise<AuthRole> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "FOUNDER";
  if (getVcEmailSet().has(normalized)) return "VC";
  try {
    if ((await getPermittedUser(normalized)) != null) return "VC";
  } catch {
    // Fall back to default FOUNDER role if permitted_users lookup is unavailable.
  }
  return "FOUNDER";
}

export function authEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

declare module "next-auth" {
  interface Session {
    role?: AuthRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AuthRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  trustHost: true,
  debug: false,
  logger: {
    error(error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      console.error("[auth][error]", error.name, "-", error.message, cause instanceof Error ? `| cause: ${cause.name}: ${cause.message}` : cause ? `| cause: ${JSON.stringify(cause)}` : "");
    },
  },
  callbacks: {
    // Open to any verified Google account; role is assigned dynamically and synced to Supabase users table.
    async signIn({ user, profile }) {
      const email = (profile?.email ?? user?.email)?.trim().toLowerCase();
      if (!email || profile?.email_verified === false) return false;
      const role = await resolveAuthRole(email);
      const avatar = (profile as { picture?: string } | undefined)?.picture ?? user?.image ?? null;
      const name = profile?.name ?? user?.name ?? null;
      try {
        await upsertUser({ email, name, avatar, role });
      } catch (err) {
        console.error("[auth][upsertUser]", err);
      }
      return true;
    },
    async jwt({ token, user, profile }) {
      const email = ((typeof token.email === "string" ? token.email : user?.email) ?? "").trim().toLowerCase();
      if (email) {
        token.email = email;
        token.role = await resolveAuthRole(email);
      }
      const picture = (profile as { picture?: string } | undefined)?.picture ?? user?.image;
      if (picture) token.picture = picture;
      return token;
    },
    async session({ session, token }) {
      session.role = token.role ?? "FOUNDER";
      if (session.user && typeof token.picture === "string") {
        session.user.image = token.picture;
      }
      return session;
    },
  },
});

/** For API routes: allows VC users (or "open" when auth isn't configured), rejects FOUNDER with 403. */
export async function requireRole(allowed: Array<AppRole | AuthRole> = ["VC", "analyst", "partner"]): Promise<{ ok: true; role: AuthRole | AppRole | "open" } | { ok: false; status: 401 | 403 }> {
  if (!authEnabled()) return { ok: true, role: "open" };
  const s = await auth();
  if (!s?.user) return { ok: false, status: 401 };
  const role = s.role ?? "FOUNDER";
  if (!allowed.includes(role)) return { ok: false, status: 403 };
  return { ok: true, role };
}
