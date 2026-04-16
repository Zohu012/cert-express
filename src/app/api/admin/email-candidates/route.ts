import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1"));
  const perPage = 50;

  // 1. Build the "already successfully contacted" set from history.
  //    A history entry counts only if the corresponding Company is marked emailStatus="sent".
  //    This way, failed/pending past attempts do NOT exclude a company from candidates.
  const sentLogs = await prisma.emailLog.findMany({
    where: { company: { emailStatus: "sent" } },
    select: {
      toEmail: true,
      company: { select: { usdotNumber: true } },
    },
  });

  const contactedSet = new Set<string>();
  for (const log of sentLogs) {
    const dot = log.company?.usdotNumber;
    const email = log.toEmail;
    if (dot && email) {
      contactedSet.add(`${dot}:${email.toLowerCase().trim()}`);
    }
  }

  // 2. Load all companies with an email (excluding empty strings).
  const companiesWithEmail = await prisma.company.findMany({
    where: {
      AND: [{ email: { not: null } }, { email: { not: "" } }],
    },
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

  // 3. Filter out any (usdotNumber + email) pair that's already in the contacted set.
  const candidates = companiesWithEmail.filter((c) => {
    if (!c.email || !c.usdotNumber) return false;
    const key = `${c.usdotNumber}:${c.email.toLowerCase().trim()}`;
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
