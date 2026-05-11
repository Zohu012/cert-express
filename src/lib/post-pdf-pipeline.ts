import { prisma } from "./db";
import { fetchCarriersByDots } from "./fmcsa-soda";

/**
 * Runs after a PDF is fully parsed and Company rows are saved.
 *
 *   1. Pulls fresh FMCSA data for every DOT in this PDF (bulk SODA query)
 *      and upserts into OtruckingCompany — keeps email/officer/address current.
 *   2. Migrates email_address from OtruckingCompany.email → Company.email
 *      so the auto-sender picks them up on the next tick.
 *
 * Errors are logged but do not throw — the PDF is already saved and we don't
 * want a flaky network call to mark the source PDF as failed.
 */
export async function runPostPdfPipeline(sourcePdfId: string): Promise<{
  dotsRefreshed: number;
  emailsMigrated: number;
}> {
  const companies = await prisma.company.findMany({
    where: { sourcePdfId },
    select: { usdotNumber: true },
  });
  const dotNumbers = Array.from(new Set(companies.map((c) => c.usdotNumber)));
  if (dotNumbers.length === 0) {
    return { dotsRefreshed: 0, emailsMigrated: 0 };
  }

  console.log(`[Post-PDF] Refreshing ${dotNumbers.length} DOTs from FMCSA SODA...`);

  let dotsRefreshed = 0;
  try {
    const fresh = await fetchCarriersByDots(dotNumbers);
    for (const [usdotNumber, mapped] of fresh) {
      await prisma.otruckingCompany.upsert({
        where: { usdotNumber },
        create: {
          usdotNumber,
          sourceUrl: mapped.sourceUrl,
          ...mapped.data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
        update: {
          sourceUrl: mapped.sourceUrl,
          ...mapped.data,
          scrapeStatus: "success",
          scrapeError: null,
          scrapedAt: new Date(),
        },
      });
      dotsRefreshed++;
    }
    console.log(`[Post-PDF] Refreshed ${dotsRefreshed}/${dotNumbers.length} DOTs from FMCSA.`);
  } catch (e) {
    console.error("[Post-PDF] FMCSA refresh failed:", e);
  }

  // Migrate emails: copy OtruckingCompany.email → Company.email for any Company
  // row missing an email but whose OtruckingCompany sibling has one.
  let emailsMigrated = 0;
  try {
    const candidates = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      `SELECT c.id, oc.email
       FROM "Company" c
       INNER JOIN "OtruckingCompany" oc ON oc."usdotNumber" = c."usdotNumber"
       WHERE c."sourcePdfId" = ?
         AND (c.email IS NULL OR c.email = '')
         AND oc.email IS NOT NULL
         AND oc.email != ''`,
      sourcePdfId
    );
    for (const row of candidates) {
      await prisma.company.update({
        where: { id: row.id },
        data: { email: row.email },
      });
      emailsMigrated++;
    }
    console.log(`[Post-PDF] Migrated ${emailsMigrated} emails to Company.`);
  } catch (e) {
    console.error("[Post-PDF] Email migration failed:", e);
  }

  return { dotsRefreshed, emailsMigrated };
}
