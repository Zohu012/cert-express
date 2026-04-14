import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import path from "path";
import fs from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await verifySession();
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    select: { pdfFilename: true, companyName: true },
  });

  if (!company?.pdfFilename) {
    return NextResponse.json({ error: "No PDF for this company" }, { status: 404 });
  }

  const pdfPath = path.join(process.cwd(), "public", "pdfs", company.pdfFilename);

  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json(
      { error: `PDF file not found on disk: ${company.pdfFilename}` },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(pdfPath);
  const safeName = company.companyName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}.pdf"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
