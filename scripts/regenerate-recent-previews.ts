/**
 * One-off script: clear preview PNGs for companies added in the last 7 days
 * so they get regenerated at the new 144 DPI (smaller, faster LCP).
 *
 * Safe to re-run. Does NOT touch URLs — filenames are deterministic from
 * documentNumber, so regeneration produces identical paths.
 *
 * Usage (from cert-express/ directory):
 *   npx tsx scripts/regenerate-recent-previews.ts
 *
 * Then in /admin/upload click "Generate Now" to render the new previews.
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const DAYS = 7;
const PREVIEW_DIR = path.join(process.cwd(), "public", "previews");

async function main() {
  const prisma = new PrismaClient();

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const companies = await prisma.company.findMany({
    where: {
      createdAt: { gte: cutoff },
      previewFilename: { not: null },
    },
    select: { id: true, documentNumber: true, previewFilename: true, createdAt: true },
  });

  console.log(
    `Found ${companies.length} compan${companies.length === 1 ? "y" : "ies"} added in the last ${DAYS} days with a preview to regenerate.`,
  );

  if (companies.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let deletedFiles = 0;
  let missingFiles = 0;

  for (const c of companies) {
    if (!c.previewFilename) continue;
    const filePath = path.join(PREVIEW_DIR, c.previewFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deletedFiles++;
    } else {
      missingFiles++;
    }
  }

  // Null out previewFilename so /api/admin/generate-documents picks them up.
  // ID list is small enough (last 7 days) for a single updateMany call.
  const ids = companies.map((c) => c.id);
  const updated = await prisma.company.updateMany({
    where: { id: { in: ids } },
    data: { previewFilename: null },
  });

  console.log(`Deleted ${deletedFiles} PNG file${deletedFiles === 1 ? "" : "s"} from ${PREVIEW_DIR}.`);
  if (missingFiles > 0) {
    console.log(`(${missingFiles} previewFilename rows pointed to a missing PNG — DB row cleared anyway.)`);
  }
  console.log(`Cleared previewFilename on ${updated.count} Company row${updated.count === 1 ? "" : "s"}.`);
  console.log("");
  console.log("Next step: open /admin/upload → click 'Generate Now'.");
  console.log("The Python pipeline will regenerate at 144 DPI. URLs unchanged.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
