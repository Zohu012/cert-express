// Per-DOT FMCSA refresh CLI (formerly an otrucking.com Cloudflare scraper).
//
// In push mode it pulls the pending list from the running Next.js app and
// upserts each DOT through the existing /api/admin/otrucking/sync/upsert
// endpoint. In local mode it writes directly to the database via Prisma.
//
// The data source is now the FMCSA Company Census File (SODA) — no browser,
// no Cloudflare, no 3 s delay. For a full backfill use `npm run load:fmcsa`.

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../src/lib/db";
import { fetchCarrierByDot } from "../src/lib/fmcsa-soda";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

const LIMIT = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : undefined;
const PUSH_URL = process.env.SCRAPE_PUSH_URL?.replace(/\/+$/, "");
const PUSH_TOKEN = process.env.SCRAPE_PUSH_TOKEN;

interface PendingCompany {
  usdotNumber: string;
  companyName: string;
}

async function fetchPending(): Promise<PendingCompany[]> {
  const res = await fetch(`${PUSH_URL}/api/admin/otrucking/sync/pending`, {
    headers: { Authorization: `Bearer ${PUSH_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`pending failed: HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { companies: PendingCompany[] };
  return json.companies;
}

async function pushOne(payload: {
  usdotNumber: string;
  sourceUrl: string;
  status: "success" | "not_found" | "error";
  error: string | null;
  data?: unknown;
}): Promise<void> {
  const res = await fetch(`${PUSH_URL}/api/admin/otrucking/sync/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUSH_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`upsert failed: HTTP ${res.status} ${await res.text()}`);
  }
}

async function refreshOne(usdotNumber: string) {
  try {
    const mapped = await fetchCarrierByDot(usdotNumber);
    if (!mapped) {
      return {
        status: "not_found" as const,
        sourceUrl: `https://data.transportation.gov/resource/az4n-8mr2.json?dot_number=${usdotNumber}`,
        error: null,
        data: undefined,
      };
    }
    return {
      status: "success" as const,
      sourceUrl: mapped.sourceUrl,
      error: null,
      data: mapped.data,
    };
  } catch (e) {
    return {
      status: "error" as const,
      sourceUrl: `https://data.transportation.gov/resource/az4n-8mr2.json?dot_number=${usdotNumber}`,
      error: e instanceof Error ? e.message : String(e),
      data: undefined,
    };
  }
}

async function runPushMode() {
  console.log(`[refresh] push mode → ${PUSH_URL}`);
  let pending = await fetchPending();
  if (LIMIT && LIMIT > 0) pending = pending.slice(0, LIMIT);
  console.log(`[refresh] ${pending.length} companies to refresh`);

  let completed = 0,
    success = 0,
    notFound = 0,
    errors = 0;
  for (const company of pending) {
    const outcome = await refreshOne(company.usdotNumber);
    try {
      await pushOne({
        usdotNumber: company.usdotNumber,
        sourceUrl: outcome.sourceUrl,
        status: outcome.status,
        error: outcome.error,
        data: outcome.data,
      });
    } catch (e) {
      console.error(
        `\n[push] failed for ${company.usdotNumber}: ${e instanceof Error ? e.message : e}`
      );
      errors++;
      completed++;
      continue;
    }

    completed++;
    if (outcome.status === "success") success++;
    else if (outcome.status === "not_found") notFound++;
    else errors++;

    const pct = Math.round((completed / pending.length) * 100);
    process.stdout.write(
      `\r[${completed}/${pending.length}] ${pct}% — ${success} ok · ${notFound} 404 · ${errors} err — ${company.companyName.slice(0, 40)}`.padEnd(120) +
        "\r"
    );
  }
  console.log(
    `\n[refresh] done. total=${completed} success=${success} notFound=${notFound} errors=${errors}`
  );
}

async function runLocalMode() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. For local mode set it in .env.scrape, or set SCRAPE_PUSH_URL+SCRAPE_PUSH_TOKEN for push mode."
    );
    process.exit(1);
  }
  console.log(`[refresh] local mode → DATABASE_URL=${process.env.DATABASE_URL}`);

  // All distinct DOTs in the Company table, then drop any already marked success.
  const allCompanies = await prisma.$queryRawUnsafe<
    { usdotNumber: string; companyName: string }[]
  >(
    `SELECT DISTINCT c."usdotNumber", c."companyName" FROM "Company" c ORDER BY c."usdotNumber"`
  );
  const succeeded = new Set(
    (
      await prisma.otruckingCompany.findMany({
        where: { scrapeStatus: "success" },
        select: { usdotNumber: true },
      })
    ).map((r) => r.usdotNumber)
  );
  let pending = allCompanies.filter((c) => !succeeded.has(c.usdotNumber));
  if (LIMIT && LIMIT > 0) pending = pending.slice(0, LIMIT);
  console.log(`[refresh] ${pending.length} companies to refresh`);

  let completed = 0,
    success = 0,
    notFound = 0,
    errors = 0;

  for (const company of pending) {
    const outcome = await refreshOne(company.usdotNumber);
    if (outcome.status === "success" && outcome.data) {
      await prisma.otruckingCompany.upsert({
        where: { usdotNumber: company.usdotNumber },
        create: {
          usdotNumber: company.usdotNumber,
          sourceUrl: outcome.sourceUrl,
          ...outcome.data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
        update: {
          sourceUrl: outcome.sourceUrl,
          ...outcome.data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
      });
      success++;
    } else {
      await prisma.otruckingCompany.upsert({
        where: { usdotNumber: company.usdotNumber },
        create: {
          usdotNumber: company.usdotNumber,
          sourceUrl: outcome.sourceUrl,
          scrapeStatus: outcome.status,
          scrapeError: outcome.error,
          scrapedAt: null,
        },
        update: {
          sourceUrl: outcome.sourceUrl,
          scrapeStatus: outcome.status,
          scrapeError: outcome.error,
        },
      });
      if (outcome.status === "not_found") notFound++;
      else errors++;
    }

    completed++;
    const pct = Math.round((completed / pending.length) * 100);
    process.stdout.write(
      `\r[${completed}/${pending.length}] ${pct}% — ${success} ok · ${notFound} 404 · ${errors} err`.padEnd(120) +
        "\r"
    );
  }
  console.log(
    `\n[refresh] done. total=${completed} success=${success} notFound=${notFound} errors=${errors}`
  );
}

async function main() {
  if (PUSH_URL && !PUSH_TOKEN) {
    console.error("SCRAPE_PUSH_URL is set but SCRAPE_PUSH_TOKEN is missing.");
    process.exit(1);
  }

  if (PUSH_URL) {
    await runPushMode();
  } else {
    await runLocalMode();
  }
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\n[refresh] fatal:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
