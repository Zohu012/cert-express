import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { fetchEligibleCompanies } from "@/lib/email-automation";

// POST /api/admin/bulk-exclude-except-date
// Body: { keepFrom: "YYYY-MM-DD", keepTo: "YYYY-MM-DD" }
// Excludes all eligible (non-excluded, unsent) companies whose local-timezone
// service date falls OUTSIDE [keepFrom, keepTo]. Uses the same date-grouping
// logic as /admin/emails so the result matches what the user sees on that page.
export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const keepFrom: string | undefined = body.keepFrom;
  const keepTo: string | undefined = body.keepTo;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!keepFrom || !dateRe.test(keepFrom) || !keepTo || !dateRe.test(keepTo)) {
    return NextResponse.json({ error: "keepFrom and keepTo must be YYYY-MM-DD" }, { status: 400 });
  }
  if (keepFrom > keepTo) {
    return NextResponse.json({ error: "keepFrom must be <= keepTo" }, { status: 400 });
  }

  const candidates = await fetchEligibleCompanies({ orderBy: "newest" });

  const toExclude: string[] = [];
  for (const c of candidates) {
    const d = c.serviceDate instanceof Date ? c.serviceDate : new Date(c.serviceDate as never);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${y}-${mo}-${dd}`;
    if (dateKey < keepFrom || dateKey > keepTo) toExclude.push(c.id);
  }

  let excluded = 0;
  const BATCH = 500;
  for (let i = 0; i < toExclude.length; i += BATCH) {
    const chunk = toExclude.slice(i, i + BATCH);
    await Promise.all(
      chunk.map((id) =>
        prisma.excludedCompany.upsert({
          where: { companyId: id },
          update: {},
          create: { companyId: id },
        })
      )
    );
    excluded += chunk.length;
  }

  return NextResponse.json({ excluded, keepFrom, keepTo, total: candidates.length });
}
