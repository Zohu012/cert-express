// One-time bulk loader: pulls every active/inactive FMCSA carrier from the
// Company Census File via SODA and upserts into OtruckingCompany.
//
// Usage:
//   npm run load:fmcsa                # full load
//   npm run load:fmcsa -- --limit=10  # smoke test
//   npm run load:fmcsa -- --dry-run   # print mapped rows without DB writes

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../src/lib/db";
import { fetchAllCarriers, type FmcsaMapped } from "../src/lib/fmcsa-soda";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = 1000;
const SYNC_KEY = "fmcsa_census";

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
    console.error("DATABASE_URL is not set. Set it in .env.scrape (e.g. file:./prisma/dev.db) or use --dry-run.");
    process.exit(1);
  }

  console.log(
    `[load] mode=${DRY_RUN ? "DRY RUN" : "DB UPSERT"} limit=${LIMIT ?? "(none)"} batch=${BATCH_SIZE}`
  );

  let total = 0;
  let latestMcs150 = "";
  let batch: FmcsaMapped[] = [];
  const start = Date.now();

  for await (const mapped of fetchAllCarriers({
    maxRows: LIMIT,
    onPage: ({ pageRows, offset }) => {
      console.log(`[load] page fetched offset=${offset} rows=${pageRows}`);
    },
  })) {
    if (DRY_RUN) {
      console.log(JSON.stringify(mapped, null, 2));
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
    if (total % 10_000 === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[load] processed=${total} elapsed=${elapsed}s`);
    }
  }

  if (!DRY_RUN && batch.length > 0) {
    await upsertBatch(batch);
  }

  if (!DRY_RUN) {
    await prisma.syncState.upsert({
      where: { key: SYNC_KEY },
      create: { key: SYNC_KEY, lastRunAt: new Date(), lastWatermark: latestMcs150 || null },
      update: { lastRunAt: new Date(), lastWatermark: latestMcs150 || null },
    });
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[load] done. processed=${total} watermark=${latestMcs150 || "(none)"} elapsed=${elapsed}s`
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n[load] fatal:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
