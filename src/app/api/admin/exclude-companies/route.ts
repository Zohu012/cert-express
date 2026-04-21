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

  // Validate all IDs exist
  const existing = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true },
  });
  const validIds = existing.map((c) => c.id);

  let excluded = 0;
  for (const id of validIds) {
    try {
      await prisma.excludedCompany.upsert({
        where: { companyId: id },
        update: {},
        create: { companyId: id },
      });
      excluded++;
    } catch (err) {
      console.error(`Failed to exclude company ${id}:`, err);
    }
  }

  return NextResponse.json({ excluded });
}
