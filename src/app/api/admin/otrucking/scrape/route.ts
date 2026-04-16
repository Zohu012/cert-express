import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { scrapeAllCompanies, scrapeProgress } from "@/lib/otrucking-scraper";

export async function POST() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (scrapeProgress.running) {
    return NextResponse.json({ error: "Scrape already in progress" }, { status: 409 });
  }

  // Fire and forget
  scrapeAllCompanies().catch((err) => {
    console.error("[otrucking-scrape] Fatal error:", err);
  });

  return NextResponse.json({ started: true });
}
