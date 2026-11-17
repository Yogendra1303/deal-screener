"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing-page";

export function LoginScreen() {
  return <LandingPage />;
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <LandingPage />;
}
