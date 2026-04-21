import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const BASE = "https://www.certexpresss.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/companies`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // One URL per successfully-scraped carrier.
  // Google caps sitemap files at 50,000 URLs — if the dataset grows past that,
  // switch to `generateSitemaps` (see node_modules/next/dist/docs/.../sitemap.md).
  const carriers = await prisma.otruckingCompany.findMany({
    where: { scrapeStatus: "success" },
    select: { usdotNumber: true, updatedAt: true },
    take: 45000,
  });

  const carrierEntries: MetadataRoute.Sitemap = carriers.map((c) => ({
    url: `${BASE}/companies/${encodeURIComponent(c.usdotNumber)}`,
    lastModified: c.updatedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...carrierEntries];
}
