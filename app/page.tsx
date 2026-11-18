import { HomeClientGate } from "@/components/home-client-gate";
import { LandingPage } from "@/components/landing-page";

export default function HomePage() {
  return <HomeClientGate landing={<LandingPage />} />;
}
