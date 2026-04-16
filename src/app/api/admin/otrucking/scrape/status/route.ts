import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { scrapeProgress } from "@/lib/otrucking-scraper";

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(scrapeProgress);
}
