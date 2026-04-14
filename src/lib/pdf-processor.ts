import { execFile } from "child_process";
import path from "path";
import { prisma } from "./db";
import type { ParsedCompany } from "@/types";

const PYTHON_PATH =
  process.env.PYTHON_PATH || "python";
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "parse_pdf.py");
const OUTPUT_DIR = path.join(process.cwd(), "public", "pdfs");

export async function processPdf(sourcePdfId: string, filePath: string) {
  // Mark as processing
  await prisma.sourcePdf.update({
    where: { id: sourcePdfId },
    data: { status: "processing" },
  });

  try {
    const companies = await runPythonParser(filePath);

    // Batch insert companies
    for (const company of companies) {
      await prisma.company.create({
        data: {
          companyName: company.companyName,
          dbaName: company.dbaName,
          streetAddress: company.streetAddress,
          city: company.city,
          state: company.state,
          zipCode: company.zipCode,
          usdotNumber: company.usdotNumber,
          documentNumber: company.documentNumber,
          documentType: company.documentType,
          serviceDate: new Date(company.serviceDate),
          pdfFilename: company.pdfFilename,
          sourcePdfId,
        },
      });
    }

    // Update source PDF status
    await prisma.sourcePdf.update({
      where: { id: sourcePdfId },
      data: {
        status: "completed",
        companyCount: companies.length,
        processedAt: new Date(),
      },
    });

    return companies.length;
  } catch (error) {
    await prisma.sourcePdf.update({
      where: { id: sourcePdfId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

function runPythonParser(filePath: string): Promise<ParsedCompany[]> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_PATH,
      [SCRIPT_PATH, filePath, OUTPUT_DIR],
      { maxBuffer: 50 * 1024 * 1024, timeout: 300000 },
      (error, stdout, stderr) => {
        if (stderr) {
          console.log("[PDF Parser]", stderr);
        }
        if (error) {
          reject(new Error(`PDF parser failed: ${error.message}\n${stderr}`));
          return;
        }
        try {
          const companies: ParsedCompany[] = JSON.parse(stdout);
          resolve(companies);
        } catch (e) {
          reject(new Error(`Failed to parse JSON output: ${e}`));
        }
      }
    );
  });
}
