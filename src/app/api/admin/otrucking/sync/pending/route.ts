import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPushToken } from "@/lib/otrucking-sync-auth";

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

  // Once a DOT is successfully scraped it stays done — never re-scraped automatically.
  // To force a rescrape, set its scrapeStatus to anything other than 'success'.
  const succeeded = await prisma.otruckingCompany.findMany({
    where: { scrapeStatus: "success" },
    select: { usdotNumber: true },
  });
  const skip = new Set(succeeded.map((e) => e.usdotNumber));
  const pending = companies.filter((c) => !skip.has(c.usdotNumber));

  return NextResponse.json({ companies: pending, total: pending.length });
}
