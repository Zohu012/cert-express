import { spawn } from "child_process";
import { createInterface } from "readline";
import path from "path";
import { prisma } from "./db";
import { generateDocuments } from "./document-generator";
import type { ParsedCompany } from "@/types";

const PYTHON_PATH = process.env.PYTHON_PATH || "python";
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "parse_pdf.py");
const OUTPUT_DIR = path.join(process.cwd(), "public", "pdfs");

const BATCH_SIZE = 20;
const SAFETY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function processPdf(sourcePdfId: string, filePath: string) {
  await prisma.sourcePdf.update({
    where: { id: sourcePdfId },
    data: { status: "processing", companyCount: 0, totalPages: 0 },
  });

  try {
    let totalInserted = 0;

    await runPythonParser(
      filePath,
      async (batch) => {
        // Single transaction = 1 SQLite fsync for all upserts in the batch
        await prisma.$transaction(
          batch.map((company) => {
            const commonData = {
              companyName: company.companyName,
              dbaName: company.dbaName ?? null,
              streetAddress: company.streetAddress ?? null,
              city: company.city ?? null,
              state: company.state ?? null,
              zipCode: company.zipCode ?? null,
              documentType: company.documentType,
              serviceDate: new Date(company.serviceDate),
              pdfFilename: company.pdfFilename,
              sourcePdfId,
            };
            return prisma.company.upsert({
              where: {
                usdotNumber_documentNumber: {
                  usdotNumber: company.usdotNumber,
                  documentNumber: company.documentNumber,
                },
              },
              update: commonData,
              create: {
                ...commonData,
                usdotNumber: company.usdotNumber,
                documentNumber: company.documentNumber,
              },
            });
          })
        );
        totalInserted += batch.length;
        // Update live progress so the UI polling can show %
        await prisma.sourcePdf.update({
          where: { id: sourcePdfId },
          data: { companyCount: totalInserted },
        });
        console.log(`[PDF Processor] Upserted ${totalInserted} companies so far...`);
      },
      (totalPages) => {
        prisma.sourcePdf
          .update({ where: { id: sourcePdfId }, data: { totalPages } })
          .catch((err) => console.error("[PDF Processor] Failed to store totalPages:", err));
      }
    );

    const companyCount = await prisma.company.count({ where: { sourcePdfId } });

    await prisma.sourcePdf.update({
      where: { id: sourcePdfId },
      data: {
        status: "completed",
        companyCount,
        processedAt: new Date(),
      },
    });

    console.log(`[PDF Processor] Done. ${companyCount} companies saved.`);

    // Fire-and-forget: generate clean PDFs + preview images in background
    prisma.company
      .findMany({ where: { sourcePdfId, previewFilename: null } })
      .then((companies) => generateDocuments(companies))
      .then((previewMap) => {
        if (previewMap.size === 0) return;
        return prisma.$transaction(
          [...previewMap.entries()].map(([id, previewFilename]) =>
            prisma.company.update({ where: { id }, data: { previewFilename } })
          )
        );
      })
      .then(() => console.log(`[PDF Processor] Previews generated for source ${sourcePdfId}`))
      .catch((err) => console.error("[Document Generator] Background generation failed:", err));

    return companyCount;
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

function runPythonParser(
  filePath: string,
  onBatch: (companies: ParsedCompany[]) => Promise<void>,
  onTotalPages?: (n: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, [SCRIPT_PATH, filePath, OUTPUT_DIR]);
    const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });

    let batch: ParsedCompany[] = [];
    let stderrBuf = "";
    let settled = false;

    // 30-minute safety kill
    const safetyTimer = setTimeout(() => {
      if (!settled) {
        console.error("[PDF Processor] Safety timeout reached (30 min) — killing parser");
        proc.kill();
        settled = true;
        reject(new Error("PDF parser timed out after 30 minutes"));
      }
    }, SAFETY_TIMEOUT_MS);

    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      stderrBuf += text;
      // Parse total page count emitted early by Python
      const match = text.match(/TOTAL_PAGES:(\d+)/);
      if (match && onTotalPages) {
        onTotalPages(parseInt(match[1], 10));
      }
      console.log("[PDF Parser]", text.trimEnd());
    });

    rl.on("line", (line: string) => {
      if (!line.trim()) return;
      try {
        const company = JSON.parse(line) as ParsedCompany;
        batch.push(company);
        if (batch.length >= BATCH_SIZE) {
          const toFlush = batch.splice(0, BATCH_SIZE);
          onBatch(toFlush).catch((err) =>
            console.error("[PDF Processor] Batch upsert error:", err)
          );
        }
      } catch {
        // skip non-JSON lines (e.g. warnings printed to stdout by mistake)
      }
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(safetyTimer);
      if (settled) return;
      settled = true;

      // Flush remaining
      const remaining = batch.splice(0);
      const flushTail = remaining.length > 0 ? onBatch(remaining) : Promise.resolve();

      flushTail
        .then(() => {
          if (code !== 0) {
            reject(new Error(`PDF parser exited with code ${code}\n${stderrBuf}`));
          } else {
            resolve();
          }
        })
        .catch(reject);
    });

    proc.on("error", (err: Error) => {
      clearTimeout(safetyTimer);
      if (!settled) {
        settled = true;
        reject(new Error(`Failed to start PDF parser: ${err.message}`));
      }
    });
  });
}
