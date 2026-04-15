import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { getSettings, getPriceCents } from "@/lib/settings";
import { sendEmail } from "@/lib/email";

/** Convert plain-text email template to HTML, turning the payment link into a button */
function templateToHtml(
  text: string,
  paymentLink: string,
  appUrl: string,
  openPixelUrl?: string,
): string {
  const logoUrl = `${appUrl}/logo.png`;

  // Split into lines and build HTML paragraphs
  const lines = text.split("\n");
  let bodyHtml = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Preview image URL line → email-safe centered image block
    if (/^https?:\/\/.+\.(png|jpg|jpeg)$/i.test(trimmed)) {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td align="center">
            <img src="${trimmed}" width="380"
                 style="border:1px solid #e5e7eb;border-radius:6px;display:block;
                        max-width:380px;width:100%;" alt="Document preview" />
            <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">
              Preview &mdash; click below to unlock the full document
            </p>
          </td></tr>
        </table>`;
      continue;
    }

    // Payment link line → green button
    if (trimmed.includes(paymentLink)) {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `
        <div style="text-align:center;margin:28px 0;">
          <a href="${paymentLink}"
             style="display:inline-block;background:#16a34a;color:#ffffff;
                    text-decoration:none;padding:16px 48px;border-radius:8px;
                    font-size:16px;font-weight:bold;letter-spacing:0.2px;">
            Get a Copy of Your Document
          </a>
        </div>`;
      continue;
    }

    // Bullet point lines
    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      if (!inList) { bodyHtml += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
      bodyHtml += `<li style="padding:3px 0;color:#374151;font-size:14px;">${trimmed.replace(/^[•\-]\s*/, "")}</li>`;
      continue;
    }

    if (inList) { bodyHtml += "</ul>"; inList = false; }

    // Empty line → spacing
    if (!trimmed) {
      bodyHtml += '<div style="height:10px;"></div>';
      continue;
    }

    // Section headings (e.g. "Document Details:")
    if (trimmed.endsWith(":") && trimmed.length < 40) {
      bodyHtml += `<p style="margin:14px 0 4px;font-weight:bold;color:#111827;font-size:14px;">${trimmed}</p>`;
      continue;
    }

    // Regular line
    bodyHtml += `<p style="margin:4px 0;color:#374151;font-size:14px;line-height:1.6;">${trimmed}</p>`;
  }

  if (inList) bodyHtml += "</ul>";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Header with logo -->
        <tr>
          <td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
            <img src="${logoUrl}" alt="CertExpress" width="180"
                 style="height:54px;width:auto;display:inline-block;" />
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">FMCSA Document Delivery Service</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              CertExpress &mdash; FMCSA Document Delivery Service<br>
              <a href="${appUrl}" style="color:#2563eb;">${appUrl.replace(/https?:\/\//, "")}</a>
            </p>
            <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
              CertExpress is a private service and is not affiliated with any government agency.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  ${openPixelUrl ? `<img src="${openPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />` : ""}
</body>
</html>`;
}

const DEFAULT_TEMPLATE = `Dear {{companyName}},

We identified that your FMCSA {{documentType}} has been successfully issued.

Document Details:
• Document Number: {{documentNumber}}
• Service Date: {{serviceDate}}

Your certificate is now available for immediate access.

{{previewImageUrl}}

You can securely retrieve a processed copy here:

{{paymentLink}}

Our service provides fast, structured delivery so you can access your document without delays.

If you have any questions, simply reply to this email.

Best regards,
CertExpress Team`;

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyIds } = await req.json();

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, email: { not: null } },
  });

  const settings = await getSettings(["email_subject", "email_body_template"]);
  const priceCents = await getPriceCents();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let sent = 0;
  let failed = 0;

  for (const company of companies) {
    if (!company.email) continue;

    try {
      // 1. Create EmailLog record first to get tracking ID
      const emailLog = await prisma.emailLog.create({
        data: {
          companyId: company.id,
          toEmail: company.email,
          subject: "", // will update after interpolation
        },
      });

      // 2. Use tracking URL so clicks are recorded; open pixel for read receipts
      const trackingUrl = `${appUrl}/api/track/${emailLog.id}`;
      const openPixelUrl = `${appUrl}/api/track/open/${emailLog.id}`;

      const interpolate = (tpl: string) =>
        tpl
          .replace(/\{\{companyName\}\}/g, company.companyName)
          .replace(/\{\{documentType\}\}/g, company.documentType)
          .replace(/\{\{documentNumber\}\}/g, company.documentNumber)
          .replace(/\{\{usdotNumber\}\}/g, company.usdotNumber)
          .replace(/\{\{dbaName\}\}/g, company.dbaName || "")
          .replace(/\{\{city\}\}/g, company.city || "")
          .replace(/\{\{state\}\}/g, company.state || "")
          .replace(
            /\{\{serviceDate\}\}/g,
            new Date(company.serviceDate).toLocaleDateString("en-US")
          )
          .replace(/\{\{price\}\}/g, `$${(priceCents / 100).toFixed(2)}`)
          .replace(/\{\{paymentLink\}\}/g, trackingUrl)
          .replace(
            /\{\{previewImageUrl\}\}/g,
            company.previewFilename
              ? `${appUrl}/previews/${company.previewFilename}`
              : ""
          );

      const subject = interpolate(
        settings.email_subject ||
          "Your FMCSA {{documentType}} is Ready – Get Your Copy"
      );

      const template = settings.email_body_template || DEFAULT_TEMPLATE;
      const textBody = interpolate(template);
      const htmlBody = templateToHtml(textBody, trackingUrl, appUrl, openPixelUrl);

      await sendEmail({
        to: company.email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      // 3. Update log with resolved subject + mark company as sent
      await Promise.all([
        prisma.emailLog.update({
          where: { id: emailLog.id },
          data: { subject },
        }),
        prisma.company.update({
          where: { id: company.id },
          data: { emailStatus: "sent", emailSentAt: new Date() },
        }),
      ]);
      sent++;
    } catch (err) {
      console.error(`Failed to email ${company.email}:`, err);
      await prisma.company.update({
        where: { id: company.id },
        data: { emailStatus: "failed" },
      });
      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
