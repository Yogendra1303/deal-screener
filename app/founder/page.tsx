import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FounderDashboard } from "@/components/founder-dashboard";
import { listFounderDeals, type FounderPitchSummary } from "@/lib/db/repository";
import { auth, authEnabled } from "@/lib/nextauth";

export default async function FounderPortalPage() {
  let user = {
    name: "Founder",
    email: "",
    image: null as string | null,
  };

  // 1. Check NextAuth
  if (authEnabled()) {
    try {
      const session = await auth();
      if (session?.user?.email) {
        user = {
          name: session.user.name?.trim() || session.user.email.split("@")[0],
          email: session.user.email,
          image: session.user.image ?? null,
        };
      }
    } catch {
      // ignore
    }
  }

  // 2. Check aarka_session cookie fallback
  if (!user.email) {
    const cookieStore = await cookies();
    const raw = cookieStore.get("aarka_session")?.value;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.email) {
          user = {
            name: data.name || data.email.split("@")[0],
            email: data.email,
            image: null,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  // If no user email, default to demo founder view or redirect
  if (!user.email) {
    user = {
      name: "Founder",
      email: "founder@sehatflow.io",
      image: null,
    };
  }

  let initialPitches: FounderPitchSummary[] = [];
  if (user.email) {
    try {
      initialPitches = await listFounderDeals(user.email);
    } catch {
      initialPitches = [];
    }
  }

  return <FounderDashboard user={user} initialPitches={initialPitches} />;
}
