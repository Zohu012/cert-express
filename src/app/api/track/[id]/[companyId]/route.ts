import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; companyId: string }> }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { id, companyId } = await ctx.params;

  prisma.emailLog
    .update({
      where: { id },
      data: {
        clickCount: { increment: 1 },
        lastClickAt: new Date(),
      },
    })
    .catch((err) => console.error("[track] click update failed:", err));

  return NextResponse.redirect(`${appUrl}/pay/${companyId}`);
}
