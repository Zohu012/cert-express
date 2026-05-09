import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPushToken } from "@/lib/otrucking-sync-auth";

const RESCRAPE_DAYS = 7;

export async function GET(req: NextRequest) {
  if (!verifyPushToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await prisma.$queryRawUnsafe<
    { usdotNumber: string; companyName: string }[]
  >(
    `SELECT DISTINCT c."usdotNumber", c."companyName"
     FROM "Company" c
     ORDER BY c."usdotNumber"`
  );

  const cutoff = new Date(Date.now() - RESCRAPE_DAYS * 24 * 60 * 60 * 1000);
  const fresh = await prisma.otruckingCompany.findMany({
    where: { scrapeStatus: "success", scrapedAt: { gte: cutoff } },
    select: { usdotNumber: true },
  });
  const skip = new Set(fresh.map((e) => e.usdotNumber));
  const pending = companies.filter((c) => !skip.has(c.usdotNumber));

  return NextResponse.json({ companies: pending, total: pending.length });
}
