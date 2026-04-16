import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const query = url.searchParams.get("q") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const perPage = 50;

  const where: Prisma.OtruckingCompanyWhereInput = {};
  if (query) {
    where.OR = [
      { companyName: { contains: query } },
      { usdotNumber: { contains: query } },
      { email: { contains: query } },
    ];
  }
  if (statusFilter) {
    where.scrapeStatus = statusFilter;
  }

  const [companies, total] = await Promise.all([
    prisma.otruckingCompany.findMany({
      where,
      orderBy: { scrapedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.otruckingCompany.count({ where }),
  ]);

  return NextResponse.json({ companies, total, page, perPage, totalPages: Math.ceil(total / perPage) });
}
