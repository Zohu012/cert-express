import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
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
    take: 200,
  });

  return NextResponse.json({ companies });
}
