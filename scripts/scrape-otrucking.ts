import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  scrapeAllCompanies,
  scrapeCompany,
  type ScrapeOutcome,
} from "../src/lib/otrucking-scraper";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

const CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";
const LIMIT = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : undefined;
const PUSH_URL = process.env.SCRAPE_PUSH_URL?.replace(/\/+$/, "");
const PUSH_TOKEN = process.env.SCRAPE_PUSH_TOKEN;
const DELAY_MS = 3000;

async function connect(): Promise<{ browser: Browser; page: Page }> {
  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    console.error(
      `Could not connect to Chrome on ${CDP_URL}. Run scripts/open_chrome.bat first ` +
        `and visit https://otrucking.com/carrier/ once to clear Cloudflare.`
    );
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const contexts = browser.contexts();
  const context = contexts[0] ?? (await browser.newContext());
  const pages = context.pages();
  const page =
    pages.find((p) => p.url().includes("otrucking.com")) ??
    pages[0] ??
    (await context.newPage());
  return { browser, page };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPending(): Promise<{ usdotNumber: string; companyName: string }[]> {
  const res = await fetch(`${PUSH_URL}/api/admin/otrucking/sync/pending`, {
    headers: { Authorization: `Bearer ${PUSH_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`pending failed: HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { companies: { usdotNumber: string; companyName: string }[] };
  return json.companies;
}

async function pushOne(usdotNumber: string, outcome: ScrapeOutcome): Promise<void> {
  const res = await fetch(`${PUSH_URL}/api/admin/otrucking/sync/upsert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUSH_TOKEN}`,
    },
    body: JSON.stringify({
      usdotNumber,
      sourceUrl: outcome.url,
      status: outcome.status,
      error: outcome.error ?? null,
      data: outcome.data,
    }),
  });
  if (!res.ok) {
    throw new Error(`upsert failed: HTTP ${res.status} ${await res.text()}`);
  }
}

async function runPushMode(page: Page) {
  console.log(`[scrape] push mode → ${PUSH_URL}`);
  console.log(`[scrape] fetching pending list from server...`);
  let pending = await fetchPending();
  if (LIMIT && LIMIT > 0) pending = pending.slice(0, LIMIT);
  console.log(`[scrape] ${pending.length} companies to scrape`);

  let completed = 0,
    success = 0,
    notFound = 0,
    errors = 0;
  for (const company of pending) {
    const outcome = await scrapeCompany(page, company.companyName, company.usdotNumber);
    try {
      await pushOne(company.usdotNumber, outcome);
    } catch (e) {
      console.error(`\n[push] failed for ${company.usdotNumber}: ${e instanceof Error ? e.message : e}`);
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
      `\r[${completed}/${pending.length}] ${pct}% — ${success} ok · ${notFound} 404 · ${errors} err — ${company.companyName.slice(0, 40)}`.padEnd(120) + "\r"
    );

    if (completed < pending.length) await sleep(DELAY_MS);
  }
  console.log(`\n[scrape] done. total=${completed} success=${success} notFound=${notFound} errors=${errors}`);
}

async function runLocalMode(page: Page) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. For local mode set it (e.g. file:./prisma/dev.db) in .env.scrape, or set SCRAPE_PUSH_URL+SCRAPE_PUSH_TOKEN for push mode.");
    process.exit(1);
  }
  console.log(`[scrape] local mode → DATABASE_URL=${process.env.DATABASE_URL}`);
  const final = await scrapeAllCompanies(page, {
    limit: LIMIT,
    onProgress: (p) => {
      if (p.total === 0) return;
      const pct = Math.round((p.completed / p.total) * 100);
      process.stdout.write(
        `\r[${p.completed}/${p.total}] ${pct}% — ${p.success} ok · ${p.notFound} 404 · ${p.errors} err — ${p.current.slice(0, 40)}`.padEnd(120) + "\r"
      );
    },
  });
  console.log(`\n[scrape] done. total=${final.total} success=${final.success} notFound=${final.notFound} errors=${final.errors}`);
}

async function main() {
  if (PUSH_URL && !PUSH_TOKEN) {
    console.error("SCRAPE_PUSH_URL is set but SCRAPE_PUSH_TOKEN is missing.");
    process.exit(1);
  }

  console.log(`[scrape] connecting to Chrome at ${CDP_URL}...`);
  const { browser, page } = await connect();
  console.log(`[scrape] connected.`);

  try {
    if (PUSH_URL) {
      await runPushMode(page);
    } else {
      await runLocalMode(page);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("\n[scrape] fatal:", e);
  process.exit(1);
});
