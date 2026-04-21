import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyIds } = await req.json();

  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json({ error: "companyIds required" }, { status: 400 });
  }

  const result = await prisma.excludedCompany.deleteMany({
    where: { companyId: { in: companyIds } },
  });

  return NextResponse.json({ restored: result.count });
}
