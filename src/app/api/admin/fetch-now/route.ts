import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { verifySession } from "@/lib/auth";
import { fetchDailyPdf } from "@/lib/pdf-fetcher";
import { processPdf } from "@/lib/pdf-processor";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dateStr: string | undefined = body.date;

  let targetDate: Date;
  if (dateStr) {
    targetDate = new Date(`${dateStr}T12:00:00Z`);
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

  const existing = await prisma.sourcePdf.findFirst({ where: { filename } });

  if (existing) {
    // Already completed — nothing to do
    if (existing.status === "completed") {
      return NextResponse.json({
        status: "already_exists",
        sourcePdfId: existing.id,
        companyCount: existing.companyCount,
        pdfStatus: existing.status,
      });
    }

    // Failed or stuck — try to recover
    const filePath = path.join(process.cwd(), "data", "source", filename);

    if (existsSync(filePath)) {
      // PDF is on disk — reprocess it (upsert logic in processPdf prevents duplicate companies)
      console.log(`[fetch-now] Re-processing existing file: ${filename}`);
      processPdf(existing.id, filePath).catch((err) =>
        console.error("[fetch-now] Reprocess failed:", err)
      );
      return NextResponse.json({ status: "downloaded", sourcePdfId: existing.id });
    } else {
      // File missing from disk — delete the stale DB record and re-download
      console.log(`[fetch-now] Stale record for ${filename} (file missing) — re-downloading`);
      await prisma.sourcePdf.delete({ where: { id: existing.id } });
      // Fall through to fresh download below
    }
  }

  // Fresh download + auto-processing
  const sourcePdfId = await fetchDailyPdf(targetDate);

  if (sourcePdfId === null) {
    return NextResponse.json({ status: "not_found" });
  }

  return NextResponse.json({ status: "downloaded", sourcePdfId });
}
