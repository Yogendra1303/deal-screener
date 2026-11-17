import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/auth-provider";
import { EvidenceProvider } from "@/components/evidence";
import { LinksProvider } from "@/components/links-store";
import { PortfolioProvider } from "@/components/portfolio-store";
import { Shell } from "@/components/shell";
import { StoreProvider } from "@/components/store";
import { WorkspaceProvider } from "@/components/workspace";

export const metadata: Metadata = {
  metadataBase: new URL("https://aarkavc.xyz"),
  title: "Aarka",
  description:
    "Aarka prototype: one record per company from first pitch to latest monthly report. Every number shows where it came from and whether anything checked it. AI sorts and explains; people decide.",
  alternates: {
    canonical: "https://aarkavc.xyz",
  },
  openGraph: {
    title: "Aarka",
    description:
      "Aarka prototype: one record per company from first pitch to latest monthly report. Every number shows where it came from and whether anything checked it. AI sorts and explains; people decide.",
    url: "https://aarkavc.xyz",
    siteName: "Aarka",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
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
