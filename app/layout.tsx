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
  metadataBase: new URL("https://aarkavc.xyz"),
  title: {
    default: "Aarka | Investment Intelligence & Deal-Flow Platform for Venture Capital",
    template: "%s | Aarka",
  },
  description:
    "See beyond the pitch. Aarka reduces the manual work of screening, structuring and validating investment opportunities—combining AI extraction, deterministic financial verification and portfolio monitoring in one workspace for modern venture capital teams.",
  applicationName: "Aarka",
  alternates: {
    canonical: "https://aarkavc.xyz",
  },
  openGraph: {
    title: "Aarka — Investment Intelligence for Venture Capital",
    description:
      "Turn incoming pitches into structured intelligence. Validate financial claims, track sector momentum and manage your venture pipeline and portfolio from one connected workspace.",
    url: "https://aarkavc.xyz",
    siteName: "Aarka",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Aarka — Investment Intelligence for Modern Venture Capital Teams",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aarka — Investment Intelligence for Venture Capital",
    description:
      "Turn incoming pitches into structured intelligence. Validate financial claims, track sector momentum and manage your venture pipeline from one connected workspace.",
    images: ["/og-image.png"],
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
      </body>
    </html>
  );
}
