import { redirect } from "next/navigation";
import { FounderDashboard } from "@/components/founder-dashboard";
import { listFounderDeals, type FounderPitchSummary } from "@/lib/db/repository";
import { auth, authEnabled } from "@/lib/nextauth";

export default async function FounderPortalPage() {
  if (!authEnabled()) {
    return (
      <FounderDashboard
        user={{ name: "Founder", email: "", image: null }}
        initialPitches={[]}
      />
    );
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    redirect("/login");
  }

  const user = {
    name: session?.user?.name?.trim() || email.split("@")[0],
    email,
    image: session?.user?.image ?? null,
  };

  let initialPitches: FounderPitchSummary[] = [];
  try {
    initialPitches = await listFounderDeals(email);
  } catch {
    initialPitches = [];
  }

  return <FounderDashboard user={user} initialPitches={initialPitches} />;
}
