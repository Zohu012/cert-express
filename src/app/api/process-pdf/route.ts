import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { processPdf } from "@/lib/pdf-processor";
import { verifySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sourcePdfId } = await req.json();

    const sourcePdf = await prisma.sourcePdf.findUnique({
      where: { id: sourcePdfId },
    });

    if (!sourcePdf) {
      return NextResponse.json(
        { error: "Source PDF not found" },
        { status: 404 }
      );
    }

    if (sourcePdf.status === "processing") {
      return NextResponse.json(
        { error: "Already processing" },
        { status: 409 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      "data",
      "source",
      sourcePdf.filename
    );

    // Process async - don't await
    processPdf(sourcePdfId, filePath).catch((err) => {
      console.error("PDF processing failed:", err);
    });

    return NextResponse.json({
      message: "Processing started",
      id: sourcePdfId,
    });
  } catch (error) {
    console.error("Process PDF error:", error);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
