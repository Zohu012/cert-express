import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const BASE = "https://www.certexpresss.com";

export const revalidate = 3600;

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

  // Only certified carriers — those with a Company row (~1,700 distinct DOTs).
  // The 4.4M FMCSA-only carriers are internal lookup data and 404 publicly.
  const carriers = await prisma.$queryRawUnsafe<
    { usdotNumber: string; updatedAt: Date | null }[]
  >(
    `SELECT o."usdotNumber", o."updatedAt"
     FROM "Company" c
     INNER JOIN "OtruckingCompany" o ON o."usdotNumber" = c."usdotNumber"
     WHERE o."scrapeStatus" = 'success'
     GROUP BY o."usdotNumber"`
  );

  const carrierEntries: MetadataRoute.Sitemap = carriers.map((c) => ({
    url: `${BASE}/companies/${encodeURIComponent(c.usdotNumber)}`,
    lastModified: c.updatedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...carrierEntries];
}
