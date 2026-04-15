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
    return NextResponse.json({ generated: 0, message: "All companies already have previews." });
  }

  const previewMap = await generateDocuments(companies);

  if (previewMap.size > 0) {
    await prisma.$transaction(
      [...previewMap.entries()].map(([id, previewFilename]) =>
        prisma.company.update({ where: { id }, data: { previewFilename } })
      )
    );
  }

  return NextResponse.json({ generated: previewMap.size, total: companies.length });
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
