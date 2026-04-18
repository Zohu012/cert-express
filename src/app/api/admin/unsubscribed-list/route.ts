import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { getUnsubscribeList } from "@/lib/unsubscribe-list";

export const dynamic = "force-dynamic";

type Row = {
  email: string;
  companyName: string | null;
  usdotNumber: string | null;
  documentType: string | null;
  emailSentAt: string | null;
  source: "user" | "admin" | "company";
};

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Blocklist (source of truth — includes admin-added and user-unsubscribed emails)
  const blocklist = await getUnsubscribeList(); // lowercased

  // 2. Company rows flagged "unsubscribed" (for richer display info)
  const flaggedCompanies = await prisma.company.findMany({
    where: { emailStatus: "unsubscribed" },
    select: {
      companyName: true,
      email: true,
      usdotNumber: true,
      documentType: true,
      emailSentAt: true,
    },
    orderBy: { emailSentAt: "desc" },
  });

  // Build a map keyed by lowercased email → first matching Company row for display.
  const byEmail = new Map<string, (typeof flaggedCompanies)[number]>();
  for (const c of flaggedCompanies) {
    if (!c.email) continue;
    const k = c.email.toLowerCase();
    if (!byEmail.has(k)) byEmail.set(k, c);
  }

  // 3. Merge: every blocklist entry + any flagged Company not already in blocklist
  const seen = new Set<string>();
  const rows: Row[] = [];

  for (const email of blocklist) {
    const match = byEmail.get(email);
    rows.push({
      email,
      companyName: match?.companyName ?? null,
      usdotNumber: match?.usdotNumber ?? null,
      documentType: match?.documentType ?? null,
      emailSentAt: match?.emailSentAt ? match.emailSentAt.toISOString() : null,
      source: match ? "user" : "admin",
    });
    seen.add(email);
  }

  for (const c of flaggedCompanies) {
    if (!c.email) continue;
    const k = c.email.toLowerCase();
    if (seen.has(k)) continue;
    rows.push({
      email: c.email,
      companyName: c.companyName,
      usdotNumber: c.usdotNumber,
      documentType: c.documentType,
      emailSentAt: c.emailSentAt ? c.emailSentAt.toISOString() : null,
      source: "company",
    });
    seen.add(k);
  }

  return NextResponse.json(rows);
}
