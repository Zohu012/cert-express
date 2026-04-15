import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchDailyPdf } from "@/lib/pdf-fetcher";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dateStr: string | undefined = body.date;

  // Parse the requested date (YYYY-MM-DD) or default to today
  let targetDate: Date;
  if (dateStr) {
    targetDate = new Date(`${dateStr}T12:00:00Z`); // noon UTC to avoid timezone shifts
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
  } else {
    targetDate = new Date();
  }

  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getUTCDate()).padStart(2, "0");
  const filename = `LI_CPL${year}${month}${day}.pdf`;

  // Check if already downloaded
  const existing = await prisma.sourcePdf.findFirst({ where: { filename } });
  if (existing) {
    return NextResponse.json({
      status: "already_exists",
      sourcePdfId: existing.id,
      companyCount: existing.companyCount,
      pdfStatus: existing.status,
    });
  }

  // Attempt download + auto-processing (fire-and-forget inside fetchDailyPdf)
  const sourcePdfId = await fetchDailyPdf(targetDate);

  if (sourcePdfId === null) {
    return NextResponse.json({ status: "not_found" });
  }

  return NextResponse.json({ status: "downloaded", sourcePdfId });
}
