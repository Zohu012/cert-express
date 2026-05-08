import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function POST() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    {
      error:
        "Otrucking scraping has moved to a local CLI because otrucking.com is behind Cloudflare. " +
        "On the operator's laptop, run scripts/open_chrome.bat then `npm run scrape:otrucking`.",
    },
    { status: 501 }
  );
}
