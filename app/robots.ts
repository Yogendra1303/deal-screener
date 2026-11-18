import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pitch", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/deals",
          "/portfolio",
          "/fund",
          "/dataroom",
          "/team",
          "/compare",
          "/sectors",
          "/market",
          "/traffic",
          "/workspace",
          "/rules",
          "/sources",
          "/method",
          "/resources",
          "/results",
          "/new",
          "/upload",
          "/welcome",
          "/founder",
          "/pending",
          "/unauthorized",
          "/login",
        ],
      },
    ],
    sitemap: "https://www.aarkavc.xyz/sitemap.xml",
    host: "https://www.aarkavc.xyz",
  };
}
