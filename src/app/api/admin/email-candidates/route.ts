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

  // Get all companies with emails
  const companiesWithEmail = await prisma.company.findMany({
    where: { email: { not: null } },
    select: {
      id: true,
      companyName: true,
      documentNumber: true,
      documentType: true,
      email: true,
      emailStatus: true,
      serviceDate: true,
      usdotNumber: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Get all contacted (company, email) combinations from EmailLog
  const contacted = await prisma.emailLog.findMany({
    select: { companyId: true, toEmail: true },
    distinct: ["companyId", "toEmail"],
  });

  const contactedSet = new Set(
    contacted.map((c) => `${c.companyId}:${c.toEmail.toLowerCase()}`)
  );

  // Filter to only companies NOT in the contacted set
  const candidates = companiesWithEmail.filter((c) => {
    const key = `${c.id}:${c.email?.toLowerCase()}`;
    return !contactedSet.has(key);
  });

  const total = candidates.length;
  const paged = candidates.slice((page - 1) * perPage, page * perPage);

  return NextResponse.json({
    companies: paged,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  });
}
