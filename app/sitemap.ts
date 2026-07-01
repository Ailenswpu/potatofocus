import type { MetadataRoute } from "next";

const siteUrl = "https://potatofocus.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date("2026-07-01"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
