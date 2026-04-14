import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { downloadToken: token },
    include: { company: true },
  });

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  if (order.status !== "completed") {
    return new Response("Payment not completed", { status: 402 });
  }

  if (order.downloadCount >= order.maxDownloads) {
    return new Response("Download limit reached", { status: 410 });
  }

  if (new Date() > order.expiresAt) {
    return new Response("Download link expired", { status: 410 });
  }

  if (!order.company.pdfFilename) {
    return new Response("PDF not available", { status: 404 });
  }

  const pdfPath = path.join(
    process.cwd(),
    "public",
    "pdfs",
    order.company.pdfFilename
  );

  try {
    const fileBuffer = await readFile(pdfPath);

    await prisma.order.update({
      where: { id: order.id },
      data: { downloadCount: order.downloadCount + 1 },
    });

    const filename = `Certificate-${order.company.documentNumber}.pdf`;

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}
