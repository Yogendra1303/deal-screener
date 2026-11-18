"use client";

import { AuthSessionProvider } from "@/components/auth-provider";
import { EvidenceProvider } from "@/components/evidence";
import { LinksProvider } from "@/components/links-store";
import { PortfolioProvider } from "@/components/portfolio-store";
import { RealtimeListener } from "@/components/realtime-listener";
import { Shell } from "@/components/shell";
import { StoreProvider } from "@/components/store";
import { WorkspaceProvider } from "@/components/workspace";

export default function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
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
  );
}
