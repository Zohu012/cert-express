import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find companies with no email that have a scraped email available
  const candidates = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
    `SELECT c.id, oc.email
     FROM "Company" c
     INNER JOIN "OtruckingCompany" oc ON oc."usdotNumber" = c."usdotNumber"
     WHERE (c.email IS NULL OR c.email = '')
       AND oc.email IS NOT NULL
       AND oc.email != ''`
  );

  let migrated = 0;
  for (const row of candidates) {
    await prisma.company.update({
      where: { id: row.id },
      data: { email: row.email },
    });
    migrated++;
  }

  return NextResponse.json({ migrated });
}
