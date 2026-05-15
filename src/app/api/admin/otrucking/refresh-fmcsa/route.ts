import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runPostPdfPipeline } from "@/lib/post-pdf-pipeline";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const sourcePdfId: string | undefined = json?.sourcePdfId;

  let pdfId = sourcePdfId;
  if (!pdfId) {
    const latest = await prisma.sourcePdf.findFirst({
      where: { status: "completed" },
      orderBy: { processedAt: "desc" },
      select: { id: true },
    });
    if (!latest) {
      return NextResponse.json({ error: "No completed PDFs found" }, { status: 404 });
    }
    pdfId = latest.id;
  }

  const result = await runPostPdfPipeline(pdfId);
  return NextResponse.json({ ...result, sourcePdfId: pdfId });
}
