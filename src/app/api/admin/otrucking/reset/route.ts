import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  olderThanDays: z.number().int().min(0).max(3650),
});

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }
  const { olderThanDays } = parsed.data;

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.otruckingCompany.updateMany({
    where: {
      scrapeStatus: "success",
      OR: [{ scrapedAt: { lt: cutoff } }, { scrapedAt: null }],
    },
    data: {
      scrapeStatus: "pending",
      scrapedAt: null,
      scrapeError: `manual_reset_${olderThanDays}d`,
    },
  });

  return NextResponse.json({ reset: result.count, olderThanDays });
}
