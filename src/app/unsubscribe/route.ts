import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — CertExpress</title>
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
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive promotional emails from CertExpress.</p>
    <p>If this was a mistake, <a href="/">visit our site</a> or reply to any previous email to re-enable.</p>
  </div>
</body>
</html>`;

async function unsubscribeEmail(email: string | null) {
  if (!email) return;
  await prisma.company.updateMany({
    where: { email },
    data: { emailStatus: "unsubscribed" },
  });
}

/** GET /unsubscribe?email=... — browser click from email body */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  await unsubscribeEmail(email);
  return new NextResponse(CONFIRMATION_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** POST /unsubscribe?email=... — Gmail one-click (RFC 8058) */
export async function POST(req: NextRequest) {
  // RFC 8058: body may contain List-Unsubscribe=One-Click, email may also be in body
  const email =
    req.nextUrl.searchParams.get("email") ||
    (await req.formData().then((f) => f.get("email") as string | null).catch(() => null));
  await unsubscribeEmail(email);
  return new NextResponse(null, { status: 200 });
}
