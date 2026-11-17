import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-provider";
import { EvidenceProvider } from "@/components/evidence";
import { LinksProvider } from "@/components/links-store";
import { PortfolioProvider } from "@/components/portfolio-store";
import { Shell } from "@/components/shell";
import { StoreProvider } from "@/components/store";
import { WorkspaceProvider } from "@/components/workspace";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RealtimeListener } from "@/components/realtime-listener";
import { ErrorMonitor } from "@/components/error-monitor";
import { ScrollManager } from "@/components/scroll-manager";
import { TrafficTracker } from "@/components/traffic-tracker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aarkavc.xyz"),
  title: {
    default: "Aarka — Investment Intelligence Platform",
    template: "%s | Aarka",
  },
  description:
    "Investment Intelligence Platform for Venture Capital. Screen, structure and validate early-stage investment opportunities with source-cited AI extraction, deterministic financial verification and portfolio monitoring.",
  applicationName: "Aarka",
  icons: {
    icon: "/aarka-logo.png",
    shortcut: "/aarka-logo.png",
    apple: "/aarka-logo.png",
  },
  alternates: {
    canonical: "https://www.aarkavc.xyz",
  },
  openGraph: {
    title: "Aarka — Investment Intelligence Platform",
    description:
      "Screen, structure and validate early-stage investment opportunities with source-cited AI extraction, deterministic financial verification and portfolio monitoring.",
    url: "https://www.aarkavc.xyz",
    siteName: "Aarka — Investment Intelligence Platform",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.aarkavc.xyz/og-card.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Aarka — Investment Intelligence Platform",
      },
      {
        url: "https://www.aarkavc.xyz/aarka-social-logo.png",
        width: 400,
        height: 400,
        type: "image/png",
        alt: "Aarka Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aarka — Investment Intelligence Platform",
    description:
      "Screen, structure and validate early-stage investment opportunities with source-cited AI extraction, deterministic financial verification and portfolio monitoring.",
    images: ["https://www.aarkavc.xyz/og-card.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-50 text-slate-900">
        <AuthSessionProvider>
          <ScrollManager />
          <TrafficTracker />
          <ErrorMonitor />
          <RealtimeListener />
          <StoreProvider>
            <PortfolioProvider>
              <WorkspaceProvider>
                <LinksProvider>
                  <EvidenceProvider>
                    <Shell>{children}</Shell>
                  </EvidenceProvider>
                </LinksProvider>
              </WorkspaceProvider>
            </PortfolioProvider>
          </StoreProvider>
        </AuthSessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
