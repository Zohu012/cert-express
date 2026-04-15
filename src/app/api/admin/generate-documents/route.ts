import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { generateDocuments } from "@/lib/document-generator";

export async function POST() {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find companies that have a PDF but no preview yet
  const companies = await prisma.company.findMany({
    where: { pdfFilename: { not: null }, previewFilename: null },
  });

  if (companies.length === 0) {
    return NextResponse.json({ started: false, message: "All companies already have previews.", pending: 0 });
  }

  // Fire-and-forget — returns immediately so the HTTP request doesn't time out
  generateDocuments(companies)
    .then((previewMap) => {
      if (previewMap.size === 0) return;
      return prisma.$transaction(
        [...previewMap.entries()].map(([id, previewFilename]) =>
          prisma.company.update({ where: { id }, data: { previewFilename } })
        )
      );
    })
    .then(() => console.log(`[Document Generator] Batch complete — ${companies.length} processed`))
    .catch((err) => console.error("[Document Generator] Batch failed:", err));

  return NextResponse.json({ started: true, total: companies.length });
}

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.company.count({
    where: { pdfFilename: { not: null }, previewFilename: null },
  });

  return NextResponse.json({ pending });
}
