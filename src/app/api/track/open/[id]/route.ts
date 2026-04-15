import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 1×1 transparent GIF (base64-decoded at build time)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * GET /api/track/open/[id]
 * Serves a 1×1 transparent GIF tracking pixel.
 * On first request increments openCount and records firstOpenAt on the EmailLog.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  try {
    const log = await prisma.emailLog.findUnique({ where: { id } });

    if (log) {
      // Only set firstOpenAt once; always increment openCount
      prisma.emailLog
        .update({
          where: { id },
          data: {
            openCount: { increment: 1 },
            ...(log.firstOpenAt ? {} : { firstOpenAt: new Date() }),
          },
        })
        .catch((err) => console.error("[track/open] update failed:", err));
    }
  } catch (err) {
    console.error("[track/open] error:", err);
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
