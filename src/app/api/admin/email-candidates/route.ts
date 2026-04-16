import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
  const perPage = 50;

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where: {
        email: { not: null },
        emailStatus: null,
      },
      select: {
        id: true,
        companyName: true,
        documentNumber: true,
        documentType: true,
        email: true,
        emailStatus: true,
        serviceDate: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.company.count({
      where: {
        email: { not: null },
        emailStatus: null,
      },
    }),
  ]);

  return NextResponse.json({
    companies,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  });
}
