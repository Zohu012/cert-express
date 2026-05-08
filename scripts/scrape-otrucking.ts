import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { chromium, type Browser, type Page } from "playwright-core";
import { scrapeAllCompanies } from "../src/lib/otrucking-scraper";

const SCRAPE_ENV = path.join(process.cwd(), ".env.scrape");
if (fs.existsSync(SCRAPE_ENV)) {
  loadEnv({ path: SCRAPE_ENV, override: true });
  console.log(`[env] loaded ${SCRAPE_ENV}`);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.scrape (production DB) or .env.");
  process.exit(1);
}

const CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";
const LIMIT = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : undefined;

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
  const page = pages.find((p) => p.url().includes("otrucking.com")) ?? pages[0] ?? (await context.newPage());
  return { browser, page };
}

async function main() {
  console.log(`[scrape] connecting to Chrome at ${CDP_URL}...`);
  const { browser, page } = await connect();
  console.log(`[scrape] connected. starting batch${LIMIT ? ` (limit=${LIMIT})` : ""}...`);

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

  console.log("\n[scrape] done.");
  console.log(
    `  total=${final.total}  success=${final.success}  notFound=${final.notFound}  errors=${final.errors}`
  );

  // Don't close the browser — operator may want to keep the profile/session alive.
  // We just disconnect the CDP client.
  await browser.close().catch(() => {});
  process.exit(0);
}

main().catch((e) => {
  console.error("\n[scrape] fatal:", e);
  process.exit(1);
});
