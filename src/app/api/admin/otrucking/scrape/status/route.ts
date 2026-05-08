import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [latest, success, notFound, errors, pending] = await Promise.all([
    prisma.otruckingCompany.findFirst({
      where: { scrapedAt: { not: null } },
      orderBy: { scrapedAt: "desc" },
      select: { scrapedAt: true },
    }),
    prisma.otruckingCompany.count({ where: { scrapeStatus: "success" } }),
    prisma.otruckingCompany.count({ where: { scrapeStatus: "not_found" } }),
    prisma.otruckingCompany.count({ where: { scrapeStatus: "error" } }),
    prisma.otruckingCompany.count({ where: { scrapeStatus: "pending" } }),
  ]);

  return NextResponse.json({
    lastScrapedAt: latest?.scrapedAt ?? null,
    counts: { success, notFound, errors, pending },
  });
}
