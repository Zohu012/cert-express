import { parse as parseHTML } from "node-html-parser";
import type { Page } from "playwright-core";
import { prisma } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OtruckingScrapeResult {
  companyName: string | null;
  physicalAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  companyOfficer: string | null;
  dotStatus: string | null;
  entityType: string | null;
  estYear: string | null;
  powerUnits: string | null;
  drivers: string | null;
  safetyRating: string | null;
  authorityStatus: string | null;
  authoritySince: string | null;
  carrierType: string | null;
  hazmat: string | null;
  passengerCarrier: string | null;
  mcs150Update: string | null;
  county: string | null;
  fleetBreakdown: string | null;
  cargoTypes: string | null;
  equipmentTypes: string | null;
}

export type ScrapeStatus = "success" | "not_found" | "error";

export interface ScrapeOutcome {
  status: ScrapeStatus;
  data?: OtruckingScrapeResult;
  error?: string;
  url: string;
}

// ─── URL helpers ────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildOtruckingUrl(companyName: string, dotNumber: string): string {
  return `https://otrucking.com/carrier/${slugify(companyName)}-dot-${dotNumber}/`;
}

// ─── Cloudflare detection / wait ────────────────────────────────────────────

const CLOUDFLARE_TITLE_RE = /just a moment|verifying|checking your browser|attention required/i;
const CLOUDFLARE_BODY_MARKERS = [
  "challenge-platform",
  "cf_chl_opt",
  "cf-chl-bypass",
  "Just a moment",
  "Verifying you are human",
];

function looksLikeCloudflareChallenge(html: string): boolean {
  return CLOUDFLARE_BODY_MARKERS.some((m) => html.includes(m));
}

async function waitForCloudflare(page: Page, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let title = "";
    try {
      title = await page.title();
    } catch {
      return;
    }
    if (!CLOUDFLARE_TITLE_RE.test(title)) return;
    await page.waitForTimeout(2000);
  }
}

// ─── Browser fetch ──────────────────────────────────────────────────────────

export async function fetchPageWithBrowser(
  page: Page,
  url: string
): Promise<{ status: number; html: string } | null> {
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitForCloudflare(page, 60_000);
    const html = await page.content();
    const status = response?.status() ?? 200;
    return { status, html };
  } catch {
    return null;
  }
}

// ─── Parser (unchanged from previous fetch-based version) ───────────────────

function textAfterLabel(root: ReturnType<typeof parseHTML>, label: string): string | null {
  const allEls = root.querySelectorAll("*");
  for (const el of allEls) {
    const text = el.text.trim();
    if (text === label && el.childNodes.length <= 1) {
      const parent = el.parentNode;
      if (!parent) continue;
      const siblings = parent.childNodes;
      const idx = siblings.indexOf(el);
      for (let i = idx + 1; i < siblings.length; i++) {
        const sib = siblings[i];
        const sibText = sib.text?.trim();
        if (sibText) return sibText;
      }
    }
  }
  return null;
}

export function parseCarrierPage(html: string): OtruckingScrapeResult {
  const result: OtruckingScrapeResult = {
    companyName: null,
    physicalAddress: null,
    city: null,
    state: null,
    zipCode: null,
    phone: null,
    email: null,
    companyOfficer: null,
    dotStatus: null,
    entityType: null,
    estYear: null,
    powerUnits: null,
    drivers: null,
    safetyRating: null,
    authorityStatus: null,
    authoritySince: null,
    carrierType: null,
    hazmat: null,
    passengerCarrier: null,
    mcs150Update: null,
    county: null,
    fleetBreakdown: null,
    cargoTypes: null,
    equipmentTypes: null,
  };

  const root = parseHTML(html);

  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.text);
      if (data["@type"] === "Organization") {
        result.companyName = data.name || null;
        if (data.address) {
          result.physicalAddress = data.address.streetAddress || null;
          result.city = data.address.addressLocality || null;
          result.state = data.address.addressRegion || null;
          result.zipCode = data.address.postalCode || null;
        }
        result.phone = data.telephone || null;
        if (data.numberOfEmployees?.value != null) {
          result.drivers = String(data.numberOfEmployees.value);
        }
      }
    } catch {
      // skip invalid JSON-LD
    }
  }

  const mailtoLinks = root.querySelectorAll('a[href^="mailto:"]');
  for (const link of mailtoLinks) {
    const href = link.getAttribute("href") || "";
    const email = href.replace("mailto:", "").trim();
    if (email && email.includes("@") && !email.includes("otrucking.com")) {
      result.email = email;
      break;
    }
  }

  result.companyOfficer = textAfterLabel(root, "Company Officer");
  result.dotStatus = textAfterLabel(root, "Status") || textAfterLabel(root, "DOT Status");
  result.authoritySince = textAfterLabel(root, "Authority Since");
  result.safetyRating = textAfterLabel(root, "Safety Rating");
  result.carrierType = textAfterLabel(root, "Carrier Type");
  result.hazmat = textAfterLabel(root, "Hazmat");
  result.passengerCarrier = textAfterLabel(root, "Passenger Carrier");
  result.mcs150Update = textAfterLabel(root, "MCS-150 Update");
  result.county = textAfterLabel(root, "County");

  const heroText = root.text;
  const entityMatch = heroText.match(/(?:Carrier\s*&\s*Broker|Carrier|Broker)/);
  if (entityMatch) result.entityType = entityMatch[0];

  const powerMatch = heroText.match(/([\d,]+)\s*Power\s*Units/i);
  if (powerMatch) result.powerUnits = powerMatch[1].replace(/,/g, "");

  const estMatch = heroText.match(/Est\.\s*(\d{4}(?:\s*\([^)]+\))?)/i);
  if (estMatch) result.estYear = estMatch[1];

  const authStatusMatch = heroText.match(/Authority\s+Status[:\s]*(\w+)/i);
  if (authStatusMatch) result.authorityStatus = authStatusMatch[1];
  if (!result.authorityStatus && result.dotStatus) {
    result.authorityStatus = result.dotStatus;
  }

  const tables = root.querySelectorAll("table");
  for (const table of tables) {
    const headers = table.querySelectorAll("th").map((th) => th.text.trim().toLowerCase());
    if (headers.includes("owned") || headers.includes("total")) {
      const fleet: Record<string, Record<string, string>> = {};
      const rows = table.querySelectorAll("tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          const label = cells[0].text.trim();
          if (label && (label.toLowerCase().includes("truck") || label.toLowerCase().includes("tractor"))) {
            fleet[label] = {
              owned: cells[1]?.text.trim() || "0",
              termLeased: cells[2]?.text.trim() || "0",
              tripLeased: cells[3]?.text.trim() || "0",
              total: cells[4]?.text.trim() || "0",
            };
          }
        }
      }
      if (Object.keys(fleet).length > 0) {
        result.fleetBreakdown = JSON.stringify(fleet);
      }
      break;
    }
  }

  const cargoSection = html.match(/Authorized Cargo Types[\s\S]*?(?=<(?:h[2-6]|section|div class="[^"]*(?:mt-|mb-|pt-|pb-)[^"]*"))/i);
  if (cargoSection) {
    const cargoRoot = parseHTML(cargoSection[0]);
    const badges = cargoRoot.querySelectorAll("span");
    const types = badges
      .map((b) => b.text.trim())
      .filter((t) => t.length > 2 && t.length < 60 && !t.includes("Authorized"));
    if (types.length > 0) result.cargoTypes = JSON.stringify(types);
  }

  const equipSection = html.match(/Equipment Analysis[\s\S]*?(?=<(?:h[2-6]|section|div class="[^"]*(?:mt-|mb-|pt-|pb-)[^"]*"))/i);
  if (equipSection) {
    const equipRoot = parseHTML(equipSection[0]);
    const badges = equipRoot.querySelectorAll("span");
    const types = badges
      .map((b) => b.text.trim())
      .filter((t) => t.length > 2 && t.length < 40 && !t.includes("Equipment") && !t.includes("Based on"));
    if (types.length > 0) result.equipmentTypes = JSON.stringify(types);
  }

  return result;
}

// ─── Scrape single company ──────────────────────────────────────────────────

export async function scrapeCompany(
  page: Page,
  companyName: string,
  dotNumber: string
): Promise<ScrapeOutcome> {
  const url = buildOtruckingUrl(companyName, dotNumber);

  const response = await fetchPageWithBrowser(page, url);
  if (!response) {
    return { status: "error", error: "Failed to load page (timeout or navigation error)", url };
  }
  if (response.status === 404) {
    return { status: "not_found", url };
  }
  if (response.status !== 200) {
    return { status: "error", error: `HTTP ${response.status}`, url };
  }
  if (looksLikeCloudflareChallenge(response.html)) {
    return { status: "error", error: "cloudflare_blocked", url };
  }

  try {
    const data = parseCarrierPage(response.html);
    return { status: "success", data, url };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Parse error", url };
  }
}

// ─── Batch scrape ───────────────────────────────────────────────────────────

const DELAY_MS = 3000;
const RESCRAPE_DAYS = 7;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface BatchProgress {
  total: number;
  completed: number;
  success: number;
  notFound: number;
  errors: number;
  current: string;
}

export async function scrapeAllCompanies(
  page: Page,
  opts: { limit?: number; onProgress?: (p: BatchProgress) => void } = {}
): Promise<BatchProgress> {
  const progress: BatchProgress = {
    total: 0,
    completed: 0,
    success: 0,
    notFound: 0,
    errors: 0,
    current: "",
  };

  const companies = await prisma.$queryRawUnsafe<
    { usdotNumber: string; companyName: string }[]
  >(
    `SELECT DISTINCT c."usdotNumber", c."companyName"
     FROM "Company" c
     ORDER BY c."usdotNumber"`
  );

  const cutoff = new Date(Date.now() - RESCRAPE_DAYS * 24 * 60 * 60 * 1000);
  const existing = await prisma.otruckingCompany.findMany({
    where: { scrapeStatus: "success", scrapedAt: { gte: cutoff } },
    select: { usdotNumber: true },
  });
  const recentlyScraped = new Set(existing.map((e) => e.usdotNumber));

  let toScrape = companies.filter((c) => !recentlyScraped.has(c.usdotNumber));
  if (opts.limit && opts.limit > 0) toScrape = toScrape.slice(0, opts.limit);
  progress.total = toScrape.length;
  opts.onProgress?.(progress);

  for (const company of toScrape) {
    progress.current = company.companyName;
    opts.onProgress?.(progress);

    const result = await scrapeCompany(page, company.companyName, company.usdotNumber);

    if (result.status === "success" && result.data) {
      // Only overwrite fields that came back non-null. Preserves previously
      // scraped values when the new parse is partial.
      const nonNull: Partial<OtruckingScrapeResult> = {};
      for (const [k, v] of Object.entries(result.data) as [
        keyof OtruckingScrapeResult,
        string | null
      ][]) {
        if (v != null && v !== "") (nonNull as Record<string, string>)[k] = v;
      }

      await prisma.otruckingCompany.upsert({
        where: { usdotNumber: company.usdotNumber },
        create: {
          usdotNumber: company.usdotNumber,
          sourceUrl: result.url,
          ...result.data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
        update: {
          sourceUrl: result.url,
          ...nonNull,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
      });
    } else {
      // not_found / error: never wipe previously scraped data or scrapedAt.
      // Only record the new status + error reason.
      await prisma.otruckingCompany.upsert({
        where: { usdotNumber: company.usdotNumber },
        create: {
          usdotNumber: company.usdotNumber,
          sourceUrl: result.url,
          scrapeStatus: result.status,
          scrapeError: result.error || null,
          scrapedAt: null,
        },
        update: {
          sourceUrl: result.url,
          scrapeStatus: result.status,
          scrapeError: result.error || null,
        },
      });
    }

    progress.completed++;
    if (result.status === "success") progress.success++;
    else if (result.status === "not_found") progress.notFound++;
    else progress.errors++;
    opts.onProgress?.(progress);

    if (progress.completed < toScrape.length) {
      await sleep(DELAY_MS);
    }
  }

  progress.current = "";
  opts.onProgress?.(progress);
  return progress;
}
