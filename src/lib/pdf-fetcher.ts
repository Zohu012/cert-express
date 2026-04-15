import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { processPdf } from "./pdf-processor";

/** Return the previous business day (skips Saturday/Sunday) */
function prevBusinessDay(d: Date): Date {
  const prev = new Date(d);
  do {
    prev.setDate(prev.getDate() - 1);
  } while (prev.getDay() === 0 || prev.getDay() === 6); // 0=Sun, 6=Sat
  return prev;
}

/**
 * Attempts to download the daily FMCSA Certificate of Authority PDF.
 * The PDF URL follows a predictable pattern based on the date.
 * Falls back to the previous business day if today's file is not found.
 */
export async function fetchDailyPdf(date?: Date, _isFallback = false) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const pdfUrl = `https://li-public.fmcsa.dot.gov/lihtml/rptspdf/LI_CPL${dateStr}.PDF`;
  const filename = `LI_CPL${dateStr}.pdf`;

  console.log(`[PDF Fetcher] Attempting to download: ${pdfUrl}${_isFallback ? " (fallback)" : ""}`);

  // Check if already downloaded
  const existing = await prisma.sourcePdf.findFirst({ where: { filename } });
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

    console.log(`[PDF Fetcher] HTTP ${res.status} ${res.statusText} | Last-Modified: ${res.headers.get("last-modified") ?? "n/a"}`);

    if (!res.ok) {
      // Try previous business day once as fallback
      if (!_isFallback) {
        console.log(`[PDF Fetcher] Not found — retrying with previous business day...`);
        return fetchDailyPdf(prevBusinessDay(d), true);
      }
      console.error(`[PDF Fetcher] Download failed on fallback date too: HTTP ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    console.log(`[PDF Fetcher] Downloaded ${buffer.length} bytes`);

    // Check if it's actually a PDF
    if (buffer.length < 1000 || !buffer.subarray(0, 5).toString().startsWith("%PDF")) {
      console.error("[PDF Fetcher] Response is not a valid PDF");
      if (!_isFallback) {
        console.log(`[PDF Fetcher] Invalid PDF — retrying with previous business day...`);
        return fetchDailyPdf(prevBusinessDay(d), true);
      }
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

    console.log(`[PDF Fetcher] Saved ${filename} (${buffer.length} bytes), starting processing...`);

    // Auto-process (fire and forget)
    processPdf(sourcePdf.id, filePath).catch((err) => {
      console.error("[PDF Fetcher] Processing failed:", err);
    });

    return sourcePdf.id;
  } catch (err) {
    console.error("[PDF Fetcher] Error:", err);
    return null;
  }
}
