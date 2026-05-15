import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchCarriersChangedSince, type FmcsaMapped } from "@/lib/fmcsa-soda";

const bodySchema = z.object({
  days: z.number().int().min(1).max(365).default(7),
});

const BATCH_SIZE = 1000;

function watermarkForDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function runUpdate(since: string, days: number) {
  console.log(`[update-recent] Starting FMCSA update since=${since} (last ${days} days)`);
  let upserted = 0;
  let batch: FmcsaMapped[] = [];

  for await (const mapped of fetchCarriersChangedSince(since)) {
    batch.push(mapped);
    if (batch.length >= BATCH_SIZE) {
      await prisma.$transaction(
        batch.map(({ usdotNumber, sourceUrl, data }) =>
          prisma.otruckingCompany.upsert({
            where: { usdotNumber },
            create: { usdotNumber, sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
            update: { sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
          })
        )
      );
      upserted += batch.length;
      console.log(`[update-recent] Upserted ${upserted} so far...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.$transaction(
      batch.map(({ usdotNumber, sourceUrl, data }) =>
        prisma.otruckingCompany.upsert({
          where: { usdotNumber },
          create: { usdotNumber, sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
          update: { sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
        })
      )
    );
    upserted += batch.length;
  }

  console.log(`[update-recent] Done. Total upserted: ${upserted}`);
}

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { days } = parsed.data;
  const since = watermarkForDaysAgo(days);

  // Fire-and-forget — returns immediately so the browser doesn't time out.
  // Watch progress with: pm2 logs cert-express
  runUpdate(since, days).catch((err) =>
    console.error("[update-recent] Failed:", err)
  );

  return NextResponse.json({ started: true, since, days });
}
