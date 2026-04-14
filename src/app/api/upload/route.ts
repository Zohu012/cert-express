import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export const maxDuration = 300; // 5 minutes for large uploads

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;
    const issueDate = formData.get("issueDate") as string | null;

    if (!file || !issueDate) {
      return NextResponse.json(
        { error: "PDF file and issue date are required" },
        { status: 400 }
      );
    }

    const sourceDir = path.join(process.cwd(), "data", "source");
    await mkdir(sourceDir, { recursive: true });

    const filename = `LI_CPL${issueDate.replace(/-/g, "")}.pdf`;
    const filePath = path.join(sourceDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const sourcePdf = await prisma.sourcePdf.create({
      data: {
        filename,
        issueDate: new Date(issueDate),
        status: "pending",
      },
    });

    return NextResponse.json({
      id: sourcePdf.id,
      filename,
      message: "PDF uploaded. Click Process to parse it.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
