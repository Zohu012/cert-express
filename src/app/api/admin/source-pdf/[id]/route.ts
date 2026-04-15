import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const sourcePdf = await prisma.sourcePdf.findUnique({
    where: { id },
  });

  if (!sourcePdf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: sourcePdf.status,
    companyCount: sourcePdf.companyCount,
    totalPages: sourcePdf.totalPages,
    error: sourcePdf.error,
  });
}
