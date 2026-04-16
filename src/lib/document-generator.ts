import { spawn } from "child_process";
import path from "path";

const PYTHON_PATH  = process.env.PYTHON_PATH || "python";
const SCRIPT_PATH  = path.join(process.cwd(), "scripts", "generate_documents.py");
const PDF_DIR      = path.join(process.cwd(), "public", "pdfs");
const PREVIEW_DIR  = path.join(process.cwd(), "public", "previews");
const TIMEOUT_MS   = 60 * 60 * 1000; // 60 minutes

type CompanyInput = {
  id: string;
  companyName: string;
  dbaName?: string | null;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: Date;
  pdfFilename: string | null;
};

/**
 * Generate clean PDFs + blurred preview PNGs for a batch of companies.
 * Returns a Map of companyId → previewFilename for successful generations.
 */
export async function generateDocuments(
  companies: CompanyInput[]
): Promise<Map<string, string>> {
  if (companies.length === 0) return new Map();

  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, [SCRIPT_PATH, PDF_DIR, PREVIEW_DIR]);

    const results = new Map<string, string>();
    let stderrBuf = "";
    let settled = false;

    const safetyTimer = setTimeout(() => {
      if (!settled) {
        proc.kill();
        settled = true;
        reject(new Error("[Document Generator] Safety timeout after 60 minutes"));
      }
    }, TIMEOUT_MS);

    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      stderrBuf += text;
      console.log("[Document Generator]", text.trimEnd());
    });

    let stdoutBuf = "";
    proc.stdout.on("data", (d: Buffer) => {
      stdoutBuf += d.toString();
      // Process complete JSON lines
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? ""; // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const result = JSON.parse(trimmed) as { id: string; previewFilename: string | null };
          if (result.id && result.previewFilename) {
            results.set(result.id, result.previewFilename);
          }
        } catch {
          // skip malformed lines
        }
      }
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(safetyTimer);
      if (settled) return;
      settled = true;

      // Process any remaining stdout buffer
      if (stdoutBuf.trim()) {
        try {
          const result = JSON.parse(stdoutBuf.trim()) as { id: string; previewFilename: string | null };
          if (result.id && result.previewFilename) {
            results.set(result.id, result.previewFilename);
          }
        } catch { /* ignore */ }
      }

      if (code !== 0) {
        console.error(`[Document Generator] Process exited with code ${code}\n${stderrBuf}`);
      }
      resolve(results); // resolve even on non-zero exit — partial results are usable
    });

    proc.on("error", (err: Error) => {
      clearTimeout(safetyTimer);
      if (!settled) {
        settled = true;
        reject(new Error(`[Document Generator] Failed to start: ${err.message}`));
      }
    });

    // Serialize company data to ISO strings for serviceDate
    const payload = companies.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      dbaName: c.dbaName ?? null,
      usdotNumber: c.usdotNumber,
      documentNumber: c.documentNumber,
      documentType: c.documentType,
      pdfFilename: c.pdfFilename ?? null,
      serviceDate: c.serviceDate instanceof Date
        ? c.serviceDate.toISOString().slice(0, 10)
        : String(c.serviceDate),
    }));

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}
