import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { processPdf } from "./pdf-processor";

/**
 * Attempts to download the daily FMCSA Certificate of Authority PDF.
 * The PDF URL follows a predictable pattern based on the date.
 */
export async function fetchDailyPdf(date?: Date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const pdfUrl = `https://li-public.fmcsa.dot.gov/lihtml/rptspdf/LI_CPL${dateStr}.PDF`;
  const filename = `LI_CPL${dateStr}.pdf`;

  console.log(`[PDF Fetcher] Attempting to download: ${pdfUrl}`);

  // Check if already downloaded
  const existing = await prisma.sourcePdf.findFirst({
    where: { filename },
  });
  if (existing) {
    console.log(`[PDF Fetcher] Already downloaded: ${filename}`);
    return null;
  }

  try {
    const res = await fetch(pdfUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/pdf,*/*",
        Referer: "https://www.fmcsa.dot.gov/",
      },
    });

    if (!res.ok) {
      console.error(`[PDF Fetcher] Download failed: HTTP ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Check if it's actually a PDF
    if (buffer.length < 1000 || !buffer.subarray(0, 5).toString().startsWith("%PDF")) {
      console.error("[PDF Fetcher] Response is not a valid PDF");
      return null;
    }

    const sourceDir = path.join(process.cwd(), "data", "source");
    await mkdir(sourceDir, { recursive: true });
    const filePath = path.join(sourceDir, filename);
    await writeFile(filePath, buffer);

    const sourcePdf = await prisma.sourcePdf.create({
      data: {
        filename,
        issueDate: new Date(`${year}-${month}-${day}`),
        downloadUrl: pdfUrl,
        status: "pending",
      },
    });

    console.log(`[PDF Fetcher] Downloaded ${filename}, starting processing...`);

    // Auto-process
    processPdf(sourcePdf.id, filePath).catch((err) => {
      console.error("[PDF Fetcher] Processing failed:", err);
    });

    return sourcePdf.id;
  } catch (err) {
    console.error("[PDF Fetcher] Error:", err);
    return null;
  }
}
