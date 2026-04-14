import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import path from "path";

async function main() {
  const prisma = new PrismaClient();

  // Check if already loaded
  const count = await prisma.company.count();
  if (count > 0) {
    console.log(`Already have ${count} companies in DB, skipping.`);
    await prisma.$disconnect();
    return;
  }

  const sourcePdf = await prisma.sourcePdf.create({
    data: {
      filename: "LI_CPL20260413.pdf",
      issueDate: new Date("2026-04-13"),
      downloadUrl:
        "https://li-public.fmcsa.dot.gov/lihtml/rptspdf/LI_CPL20260413.PDF",
      status: "pending",
    },
  });

  console.log("Created source PDF:", sourcePdf.id);

  const pythonPath =
    "C:/Users/info/AppData/Local/Python/pythoncore-3.14-64/python.exe";
  const scriptPath = path.join(process.cwd(), "scripts", "parse_pdf.py");
  const inputPath = path.join(
    process.cwd(),
    "data",
    "source",
    "LI_CPL20260413.pdf"
  );
  const outputDir = path.join(process.cwd(), "public", "pdfs");

  console.log("Running Python parser...");
  const output = execFileSync(pythonPath, [scriptPath, inputPath, outputDir], {
    maxBuffer: 50 * 1024 * 1024,
    timeout: 300000,
  });

  const companies = JSON.parse(output.toString());
  console.log("Parsed", companies.length, "companies");

  for (const c of companies) {
    await prisma.company.create({
      data: {
        companyName: c.companyName,
        dbaName: c.dbaName,
        streetAddress: c.streetAddress,
        city: c.city,
        state: c.state,
        zipCode: c.zipCode,
        usdotNumber: c.usdotNumber,
        documentNumber: c.documentNumber,
        documentType: c.documentType,
        serviceDate: new Date(c.serviceDate),
        pdfFilename: c.pdfFilename,
        sourcePdfId: sourcePdf.id,
      },
    });
  }

  await prisma.sourcePdf.update({
    where: { id: sourcePdf.id },
    data: {
      status: "completed",
      companyCount: companies.length,
      processedAt: new Date(),
    },
  });

  console.log("Done! Inserted", companies.length, "companies into database");
  await prisma.$disconnect();
}

main().catch(console.error);
