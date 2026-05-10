// Daily incremental sync: fetches FMCSA carriers whose mcs150_date is at or
// after the last successful run watermark, and upserts into OtruckingCompany.
//
// Usage:
//   npm run sync:fmcsa
//   npm run sync:fmcsa -- --since=20260501   # override watermark
//   npm run sync:fmcsa -- --dry-run

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../src/lib/db";
import { fetchCarriersChangedSince, type FmcsaMapped } from "../src/lib/fmcsa-soda";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

const args = process.argv.slice(2);
const sinceArg = args.find((a) => a.startsWith("--since="));
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = 1000;
const SYNC_KEY = "fmcsa_census";

function shiftWatermarkBack(yyyymmddOrFull: string, days = 1): string {
  // Watermark format: "20260506" or "20260506 1125". Subtract `days` for safety overlap.
  const datePart = yyyymmddOrFull.slice(0, 8);
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
        create: {
          usdotNumber,
          sourceUrl,
          ...data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
        update: {
          sourceUrl,
          ...data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
      })
    )
  );
}

async function main() {
  if (!process.env.DATABASE_URL && !DRY_RUN) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  let watermark: string;
  if (sinceArg) {
    watermark = sinceArg.split("=")[1];
  } else {
    const state = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } });
    if (!state?.lastWatermark) {
      console.error(
        "[sync] no SyncState watermark found. Run `npm run load:fmcsa` first, or pass --since=YYYYMMDD."
      );
      process.exit(1);
    }
    watermark = shiftWatermarkBack(state.lastWatermark, 1);
  }

  console.log(`[sync] watermark=${watermark} dryRun=${DRY_RUN}`);

  let total = 0;
  let latestMcs150 = watermark;
  let batch: FmcsaMapped[] = [];
  const start = Date.now();

  for await (const mapped of fetchCarriersChangedSince(watermark, {
    onPage: ({ pageRows, offset }) => {
      console.log(`[sync] page fetched offset=${offset} rows=${pageRows}`);
    },
  })) {
    if (DRY_RUN) {
      console.log(`[dry] ${mapped.usdotNumber} ${mapped.data.companyName}`);
    } else {
      batch.push(mapped);
      if (batch.length >= BATCH_SIZE) {
        await upsertBatch(batch);
        batch = [];
      }
    }
    if (mapped.mcs150Date && mapped.mcs150Date > latestMcs150) {
      latestMcs150 = mapped.mcs150Date;
    }
    total++;
  }

  if (!DRY_RUN && batch.length > 0) {
    await upsertBatch(batch);
  }

  if (!DRY_RUN) {
    await prisma.syncState.upsert({
      where: { key: SYNC_KEY },
      create: { key: SYNC_KEY, lastRunAt: new Date(), lastWatermark: latestMcs150 },
      update: { lastRunAt: new Date(), lastWatermark: latestMcs150 },
    });
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[sync] done. upserts=${total} newWatermark=${latestMcs150} elapsed=${elapsed}s`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n[sync] fatal:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
