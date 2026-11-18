import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { ScrollManager } from "@/components/scroll-manager";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true,
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aarkavc.xyz"),
  title: {
    default: "Aarka | Structured Workspace for Startup Pitches and Investor Review",
    template: "%s | Aarka",
  },
  description:
    "A structured workspace for startup pitches and investor review. Bring startup submissions and investment opportunities into a structured review process with source-cited extraction, deterministic financial cross-checks, and portfolio monitoring.",
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
    title: "Aarka | Structured Workspace for Startup Pitches and Investor Review",
    description:
      "Bring startup submissions and investment opportunities into a structured review process with source-cited extraction, deterministic financial cross-checks, and portfolio monitoring.",
    url: "https://www.aarkavc.xyz",
    siteName: "Aarka: Investment Review Workspace",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.aarkavc.xyz/og-card.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Aarka: Structured Workspace for Startup Pitches and Investor Review",
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
    title: "Aarka | Structured Workspace for Startup Pitches and Investor Review",
    description:
      "Bring startup submissions and investment opportunities into a structured review process with source-cited extraction, deterministic financial cross-checks, and portfolio monitoring.",
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
        <ScrollManager />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
