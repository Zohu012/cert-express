import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import path from "path";
import fs from "fs";

export async function PATCH(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, email } = await req.json();

  await prisma.company.update({
    where: { id },
    data: { email },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();

  // Get company to optionally delete its PDF file
  const company = await prisma.company.findUnique({
    where: { id },
    select: { pdfFilename: true, orders: { select: { id: true } } },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Delete the company (orders will cascade-fail without FK cascade; delete orders first)
  if (company.orders.length > 0) {
    await prisma.order.deleteMany({ where: { companyId: id } });
  }

  await prisma.company.delete({ where: { id } });

  // Optionally remove the PDF file from disk
  if (company.pdfFilename) {
    const pdfPath = path.join(process.cwd(), "public", "pdfs", company.pdfFilename);
    if (fs.existsSync(pdfPath)) {
      try { fs.unlinkSync(pdfPath); } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ success: true });
}

// POST — reupload a PDF for an existing company
export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;
  const file = formData.get("pdf") as File | null;

  if (!id || !file) {
    return NextResponse.json({ error: "Missing id or pdf" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Save the new file, reuse same filename if exists, otherwise generate new name
  const filename = company.pdfFilename || `${id}.pdf`;
  const pdfDir = path.join(process.cwd(), "public", "pdfs");
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(pdfDir, filename), buffer);

  await prisma.company.update({
    where: { id },
    data: { pdfFilename: filename },
  });

  return NextResponse.json({ success: true, pdfFilename: filename });
}
