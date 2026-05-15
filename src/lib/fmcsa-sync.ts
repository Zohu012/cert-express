import { prisma } from "./db";
import { fetchCarriersChangedSince, type FmcsaMapped } from "./fmcsa-soda";

const SYNC_KEY = "fmcsa_census";
const BATCH_SIZE = 1000;

function shiftWatermarkBack(w: string, days = 1): string {
  const datePart = w.slice(0, 8);
  const y = Number(datePart.slice(0, 4));
  const m = Number(datePart.slice(4, 6));
  const d = Number(datePart.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function upsertBatch(batch: FmcsaMapped[]) {
  await prisma.$transaction(
    batch.map(({ usdotNumber, sourceUrl, data }) =>
      prisma.otruckingCompany.upsert({
        where: { usdotNumber },
        create: { usdotNumber, sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
        update: { sourceUrl, ...data, scrapeStatus: "success", scrapeError: null, scrapedAt: new Date() },
      })
    )
  );
}

export async function runFmcsaDeltaSync(opts?: {
  since?: string;
  dryRun?: boolean;
}): Promise<{ upserted: number; newWatermark: string }> {
  let watermark: string;
  if (opts?.since) {
    watermark = opts.since;
  } else {
    const state = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } });
    if (!state?.lastWatermark) {
      throw new Error("No SyncState watermark found. Run `npm run load:fmcsa` first, or pass since option.");
    }
    watermark = shiftWatermarkBack(state.lastWatermark, 1);
  }

  console.log(`[fmcsa-sync] watermark=${watermark} dryRun=${opts?.dryRun ?? false}`);

  let total = 0;
  let latestWatermark = watermark;
  let batch: FmcsaMapped[] = [];

  for await (const mapped of fetchCarriersChangedSince(watermark)) {
    if (opts?.dryRun) {
      console.log(`[fmcsa-sync dry] ${mapped.usdotNumber} ${mapped.data.companyName}`);
    } else {
      batch.push(mapped);
      if (batch.length >= BATCH_SIZE) {
        await upsertBatch(batch);
        batch = [];
      }
    }
    if (mapped.mcs150Date && mapped.mcs150Date > latestWatermark) {
      latestWatermark = mapped.mcs150Date;
    }
    total++;
  }

  if (!opts?.dryRun) {
    if (batch.length > 0) await upsertBatch(batch);
    await prisma.syncState.upsert({
      where: { key: SYNC_KEY },
      create: { key: SYNC_KEY, lastRunAt: new Date(), lastWatermark: latestWatermark },
      update: { lastRunAt: new Date(), lastWatermark: latestWatermark },
    });
  }

  return { upserted: total, newWatermark: latestWatermark };
}
