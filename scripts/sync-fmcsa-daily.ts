// Daily incremental sync: fetches FMCSA carriers whose mcs150_date or add_date
// is at or after the last successful run watermark, and upserts into OtruckingCompany.
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
import { runFmcsaDeltaSync } from "../src/lib/fmcsa-sync";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

const args = process.argv.slice(2);
const sinceArg = args.find((a) => a.startsWith("--since="))?.split("=")[1];
const dryRun = args.includes("--dry-run");

const start = Date.now();
const { upserted, newWatermark } = await runFmcsaDeltaSync({ since: sinceArg, dryRun });
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`[sync] done. upserts=${upserted} newWatermark=${newWatermark} elapsed=${elapsed}s`);

await prisma.$disconnect();
process.exit(0);
