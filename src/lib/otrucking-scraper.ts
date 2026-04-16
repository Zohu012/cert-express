import { parse as parseHTML } from "node-html-parser";
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

export interface ScrapeProgress {
  running: boolean;
  total: number;
  completed: number;
  success: number;
  notFound: number;
  errors: number;
  current: string;
}

// Module-level progress tracker
export const scrapeProgress: ScrapeProgress = {
  running: false,
  total: 0,
  completed: 0,
  success: 0,
  notFound: 0,
  errors: 0,
  current: "",
};

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

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ status: number; html: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const html = await res.text();
    return { status: res.status, html };
  } catch {
    return null;
  }
}

// ─── Parser ─────────────────────────────────────────────────────────────────

function textAfterLabel(root: ReturnType<typeof parseHTML>, label: string): string | null {
  // Find elements containing the label text, then grab the next sibling's text
  const allEls = root.querySelectorAll("*");
  for (const el of allEls) {
    const text = el.text.trim();
    if (text === label && el.childNodes.length <= 1) {
      // Check next sibling element
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

  // 1. Extract JSON-LD Organization data
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

  // 2. Extract email from mailto: link
  const mailtoLinks = root.querySelectorAll('a[href^="mailto:"]');
  for (const link of mailtoLinks) {
    const href = link.getAttribute("href") || "";
    const email = href.replace("mailto:", "").trim();
    if (email && email.includes("@") && !email.includes("otrucking.com")) {
      result.email = email;
      break;
    }
  }

  // 3. Extract labeled fields from DOM
  result.companyOfficer = textAfterLabel(root, "Company Officer");
  result.dotStatus = textAfterLabel(root, "Status") || textAfterLabel(root, "DOT Status");
  result.authoritySince = textAfterLabel(root, "Authority Since");
  result.safetyRating = textAfterLabel(root, "Safety Rating");
  result.carrierType = textAfterLabel(root, "Carrier Type");
  result.hazmat = textAfterLabel(root, "Hazmat");
  result.passengerCarrier = textAfterLabel(root, "Passenger Carrier");
  result.mcs150Update = textAfterLabel(root, "MCS-150 Update");
  result.county = textAfterLabel(root, "County");

  // 4. Entity type from hero badge area (e.g., "Carrier & Broker")
  // Look for status badges near the company name
  const heroText = root.text;
  const entityMatch = heroText.match(/(?:Carrier\s*&\s*Broker|Carrier|Broker)/);
  if (entityMatch) result.entityType = entityMatch[0];

  // 5. Power units from hero area
  const powerMatch = heroText.match(/([\d,]+)\s*Power\s*Units/i);
  if (powerMatch) result.powerUnits = powerMatch[1].replace(/,/g, "");

  // Est year
  const estMatch = heroText.match(/Est\.\s*(\d{4}(?:\s*\([^)]+\))?)/i);
  if (estMatch) result.estYear = estMatch[1];

  // Authority status
  const authStatusMatch = heroText.match(/Authority\s+Status[:\s]*(\w+)/i);
  if (authStatusMatch) result.authorityStatus = authStatusMatch[1];
  if (!result.authorityStatus && result.dotStatus) {
    result.authorityStatus = result.dotStatus;
  }

  // 6. Fleet breakdown from table
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

  // 7. Cargo types - look for badges/pills after "Authorized Cargo Types"
  const cargoSection = html.match(/Authorized Cargo Types[\s\S]*?(?=<(?:h[2-6]|section|div class="[^"]*(?:mt-|mb-|pt-|pb-)[^"]*"))/i);
  if (cargoSection) {
    const cargoRoot = parseHTML(cargoSection[0]);
    const badges = cargoRoot.querySelectorAll("span");
    const types = badges
      .map((b) => b.text.trim())
      .filter((t) => t.length > 2 && t.length < 60 && !t.includes("Authorized"));
    if (types.length > 0) result.cargoTypes = JSON.stringify(types);
  }

  // 8. Equipment types
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
  companyName: string,
  dotNumber: string
): Promise<{ status: "success" | "not_found" | "error"; data?: OtruckingScrapeResult; error?: string; url: string }> {
  const url = buildOtruckingUrl(companyName, dotNumber);

  const response = await fetchPage(url);
  if (!response) {
    return { status: "error", error: "Failed to fetch page (timeout or network error)", url };
  }
  if (response.status === 404) {
    return { status: "not_found", url };
  }
  if (response.status !== 200) {
    return { status: "error", error: `HTTP ${response.status}`, url };
  }

  try {
    const data = parseCarrierPage(response.html);
    return { status: "success", data, url };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : "Parse error", url };
  }
}

// ─── Batch scrape ───────────────────────────────────────────────────────────

const DELAY_MS = 1500;
const RESCRAPE_DAYS = 7;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function scrapeAllCompanies(): Promise<void> {
  if (scrapeProgress.running) return;

  scrapeProgress.running = true;
  scrapeProgress.completed = 0;
  scrapeProgress.success = 0;
  scrapeProgress.notFound = 0;
  scrapeProgress.errors = 0;
  scrapeProgress.current = "";

  try {
    // Get distinct USDOT numbers with a representative company name
    const companies = await prisma.$queryRawUnsafe<
      { usdotNumber: string; companyName: string }[]
    >(
      `SELECT DISTINCT c."usdotNumber", c."companyName"
       FROM "Company" c
       ORDER BY c."usdotNumber"`
    );

    // Filter out recently scraped
    const cutoff = new Date(Date.now() - RESCRAPE_DAYS * 24 * 60 * 60 * 1000);
    const existing = await prisma.otruckingCompany.findMany({
      where: { scrapeStatus: "success", scrapedAt: { gte: cutoff } },
      select: { usdotNumber: true },
    });
    const recentlyScraped = new Set(existing.map((e) => e.usdotNumber));

    const toScrape = companies.filter((c) => !recentlyScraped.has(c.usdotNumber));
    scrapeProgress.total = toScrape.length;

    for (const company of toScrape) {
      scrapeProgress.current = company.companyName;

      const result = await scrapeCompany(company.companyName, company.usdotNumber);

      await prisma.otruckingCompany.upsert({
        where: { usdotNumber: company.usdotNumber },
        create: {
          usdotNumber: company.usdotNumber,
          sourceUrl: result.url,
          ...(result.data || {}),
          scrapeStatus: result.status,
          scrapeError: result.error || null,
          scrapedAt: result.status === "success" ? new Date() : null,
        },
        update: {
          sourceUrl: result.url,
          ...(result.data || {}),
          scrapeStatus: result.status,
          scrapeError: result.error || null,
          scrapedAt: result.status === "success" ? new Date() : null,
        },
      });

      scrapeProgress.completed++;
      if (result.status === "success") scrapeProgress.success++;
      else if (result.status === "not_found") scrapeProgress.notFound++;
      else scrapeProgress.errors++;

      if (scrapeProgress.completed < toScrape.length) {
        await sleep(DELAY_MS);
      }
    }
  } finally {
    scrapeProgress.running = false;
    scrapeProgress.current = "";
  }
}
