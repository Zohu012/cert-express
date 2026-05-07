import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { sendOneCompany } from "@/lib/email-sender";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyIds } = await req.json();

  if (!Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json({ error: "companyIds required" }, { status: 400 });
  }

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, email: { not: null } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const company of companies) {
    const result = await sendOneCompany(company, {
      source: "manual",
      allowExcluded: true,
      reminderNumber: 2,
    });
    if (result.status === "sent") sent++;
    else if (result.status === "failed") failed++;
    else skipped++;
  }

  return NextResponse.json({ sent, failed, skipped });
}
