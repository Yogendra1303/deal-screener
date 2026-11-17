// Invite-Only Google OAuth via NextAuth v5.
// Only explicitly whitelisted/approved emails can sign into the VC workspace;
// uninvited users are blocked during signIn() and redirected to /pending with no session created.
import NextAuth from "next-auth";
import "next-auth/jwt";
import Google from "next-auth/providers/google";
import { getPermittedUser, getState, upsertUser, type AppRole, type UserRole } from "./db/repository";
import { logAndNotify } from "./notify";

export type AuthRole = UserRole; // "VC" | "FOUNDER"

const DEFAULT_VC_EMAILS = [
  "yogendrakapkoti1309@gmail.com",
  "yogendrakapkoti13@gmail.com",
  "02.ashutosh@gmail.com",
  "hello@gopalahuja.com",
  "sanchitkr7@gmail.com",
];

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function getWhitelistedVcEmails(): Set<string> {
  return new Set([
    ...DEFAULT_VC_EMAILS,
    ...parseEmailList(process.env.VC_EMAILS),
    ...parseEmailList(process.env.FUNDHUB_PARTNERS),
    ...parseEmailList(process.env.FUNDHUB_ANALYSTS),
  ]);
}

/** Checks static whitelist, env whitelists, Supabase permitted_users table, and approved access_requests. */
export async function isApprovedPartner(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (getWhitelistedVcEmails().has(normalized)) return true;

  try {
    if ((await getPermittedUser(normalized)) != null) return true;
  } catch {
    // Continue checking approved access_requests fallback.
  }

  try {
    const reqs = (await getState<Array<{ email?: string; status?: string }>>("access_requests")) ?? [];
    if (
      reqs.some(
        (r) =>
          (r.email ?? "").trim().toLowerCase() === normalized &&
          ["approved", "invited"].includes((r.status ?? "").trim().toLowerCase()),
      )
    ) {
      return true;
    }
  } catch {
    // Ignore if app_state is unavailable.
  }

  return false;
}

export async function resolveAuthRole(email: string): Promise<AuthRole> {
  return (await isApprovedPartner(email)) ? "VC" : "FOUNDER";
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
  pages: {
    signIn: "/login",
    error: "/pending",
  },
  trustHost: true,
  debug: false,
  logger: {
    error(error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      console.error(
        "[auth][error]",
        error.name,
        "-",
        error.message,
        cause instanceof Error ? `| cause: ${cause.name}: ${cause.message}` : cause ? `| cause: ${JSON.stringify(cause)}` : "",
      );
    },
  },
  callbacks: {
    // STRICT INVITE-ONLY GATE: Only explicitly approved emails can create a dashboard session.
    async signIn({ user, profile }) {
      const email = (profile?.email ?? user?.email)?.trim().toLowerCase();
      if (!email || profile?.email_verified === false) {
        return "/pending";
      }

      const approved = await isApprovedPartner(email);
      const displayName = profile?.name ?? user?.name ?? email;

      if (!approved) {
        // Block dashboard access completely — log attempt and redirect to /pending with zero session issued.
        void logAndNotify("FOUNDER_LOGIN", email, {
          name: displayName,
          status: "BLOCKED_UNINVITED",
          subject: `🔒 Blocked Uninvited Login: ${displayName}`,
          message: `${email} tried to sign into Aarka via Google OAuth and was redirected to /pending because they are not on the approved whitelist.`,
        });
        return `/pending?email=${encodeURIComponent(email)}`;
      }

      const avatar = (profile as { picture?: string } | undefined)?.picture ?? user?.image ?? null;
      const name = profile?.name ?? user?.name ?? null;
      try {
        await upsertUser({ email, name, avatar, role: "VC" });
      } catch (err) {
        console.error("[auth][upsertUser]", err);
      }

      void logAndNotify("VC_LOGIN", email, {
        name: displayName,
        role: "VC",
        subject: `👀 VC LOGIN: ${displayName}`,
        message: `${email} signed into the Aarka partner dashboard.`,
      });
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

/** For API routes: allows approved VC users (or "open" when auth isn't configured), rejects others with 401/403. */
export async function requireRole(
  allowed: Array<AppRole | AuthRole> = ["VC", "analyst", "partner"],
): Promise<{ ok: true; role: AuthRole | AppRole | "open" } | { ok: false; status: 401 | 403 }> {
  if (!authEnabled()) return { ok: true, role: "open" };
  const s = await auth();
  if (!s?.user) return { ok: false, status: 401 };
  const role = s.role ?? "FOUNDER";
  if (!allowed.includes(role)) return { ok: false, status: 403 };
  return { ok: true, role };
}
