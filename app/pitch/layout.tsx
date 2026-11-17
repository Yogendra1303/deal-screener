import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit Your Pitch Deck",
  description:
    "Submit your early-stage pitch deck (up to $4M mandate) directly to the Aarka investment review queue. Confidential review with structured metric verification.",
  openGraph: {
    title: "Submit Your Pitch Deck | Aarka",
    description:
      "Early-stage mandate up to $4M. Upload your pitch deck PDF directly into our confidential investment review queue.",
    url: "https://www.aarkavc.xyz/pitch",
    images: [
      {
        url: "https://www.aarkavc.xyz/og-card.png",
        width: 1200,
        height: 630,
        alt: "Submit Your Pitch Deck | Aarka",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Submit Your Pitch Deck | Aarka",
    description:
      "Early-stage mandate up to $4M. Upload your pitch deck PDF directly into our confidential investment review queue.",
    images: ["https://www.aarkavc.xyz/og-card.png"],
  },
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
