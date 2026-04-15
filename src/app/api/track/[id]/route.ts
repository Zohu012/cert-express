import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/track/[id]
 * Increments click count on the EmailLog, then redirects to the payment page.
 * Used as the payment link in outbound sales emails.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { id } = await ctx.params;

  try {
    const log = await prisma.emailLog.findUnique({ where: { id } });

    if (!log) {
      return NextResponse.redirect(`${appUrl}/`);
    }

    // Increment click count (fire-and-forget style — don't block redirect)
    prisma.emailLog
      .update({
        where: { id },
        data: {
          clickCount: { increment: 1 },
          lastClickAt: new Date(),
        },
      })
      .catch((err) => console.error("[track] click update failed:", err));

    return NextResponse.redirect(`${appUrl}/pay/${log.companyId}`);
  } catch (err) {
    console.error("[track] error:", err);
    return NextResponse.redirect(`${appUrl}/`);
  }
}
