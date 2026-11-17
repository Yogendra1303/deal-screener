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

  if (authEnabled()) {
    const session = await auth();
    if (!session?.user?.email) {
      redirect("/login?callbackUrl=/founder");
    }
    user = {
      name: session.user.name?.trim() || session.user.email.split("@")[0],
      email: session.user.email,
      image: session.user.image ?? null,
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
