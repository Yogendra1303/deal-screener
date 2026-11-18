import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-18T00:00:00.000Z");

  return [
    {
      url: "https://www.aarkavc.xyz",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://www.aarkavc.xyz/pitch",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
