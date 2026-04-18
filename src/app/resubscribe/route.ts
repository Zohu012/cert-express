import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { removeFromUnsubscribeList } from "@/lib/unsubscribe-list";

const CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Resubscribed — CertExpress</title>
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, sans-serif; }
    .wrap { max-width: 480px; margin: 80px auto; background: #fff; border-radius: 12px;
            padding: 48px 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { color: #111827; font-size: 22px; margin: 0 0 12px; }
    p  { color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    a  { color: #2563eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>You've been resubscribed</h1>
    <p>You may receive future emails from CertExpress.</p>
    <p><a href="/">Go to CertExpress</a></p>
  </div>
</body>
</html>`;

/** GET /resubscribe?email=... */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (email) {
    await removeFromUnsubscribeList(email);
    await prisma.company.updateMany({
      where: { email, emailStatus: "unsubscribed" },
      data: { emailStatus: null },
    });
  }
  return new NextResponse(CONFIRMATION_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
