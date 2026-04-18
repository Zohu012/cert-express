import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { getSettings, getPriceCents } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { getUnsubscribeList } from "@/lib/unsubscribe-list";

/** Render **bold** markers and linkify bare https?:// URLs in a plain-text line. */
function renderInline(line: string): string {
  // **bold** → <strong>
  let out = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // bare URLs → clickable anchor
  out = out.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" style="color:#2563eb;word-break:break-all;">$1</a>'
  );
  return out;
}

function templateToHtml(
  text: string,
  displayLink: string,
  trackUrl: string,
  appUrl: string,
  openPixelUrl?: string,
  preheader?: string,
  unsubscribeUrl?: string,
): string {
  const logoUrl = `${appUrl}/logo.png`;

  // Split into lines and build HTML paragraphs
  const lines = text.split("\n");
  let bodyHtml = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Horizontal rule --- → visual divider
    if (trimmed === "---") {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">`;
      continue;
    }

    // Preview image URL line → email-safe centered image block using CID
    if (/^https?:\/\/.+\.(png|jpg|jpeg)$/i.test(trimmed)) {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td align="center">
            <p style="margin:0 0 8px;color:#374151;font-size:13px;font-weight:600;">
              Preview of your FMCSA document:
            </p>
            <img src="cid:previewImage" width="380"
                 style="border:1px solid #e5e7eb;border-radius:6px;display:block;
                        max-width:380px;width:100%;" alt="Document preview" />
            <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">
              This is a blurred preview — purchase below to get the full PDF.
            </p>
          </td></tr>
        </table>`;
      continue;
    }

    // Payment link line → green button + text fallback (captures image-blocked/Outlook users)
    if (trimmed.includes(displayLink)) {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `
        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${trackUrl}"
             style="display:inline-block;background:#16a34a;color:#ffffff;
                    text-decoration:none;padding:16px 48px;border-radius:8px;
                    font-size:16px;font-weight:bold;letter-spacing:0.2px;">
            Get PDF Copy
          </a>
        </div>
        <p style="text-align:center;margin:0 0 20px;color:#6b7280;font-size:12px;line-height:1.5;">
          Button not working? <a href="${trackUrl}" style="color:#2563eb;">Click here</a>
          or copy &amp; paste this link:<br>
          <a href="${displayLink}" style="color:#2563eb;word-break:break-all;">${displayLink}</a>
        </p>`;
      continue;
    }

    // Bullet point lines
    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      if (!inList) { bodyHtml += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
      bodyHtml += `<li style="padding:3px 0;color:#374151;font-size:14px;">${renderInline(trimmed.replace(/^[•\-]\s*/, ""))}</li>`;
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
      bodyHtml += `<p style="margin:14px 0 4px;font-weight:bold;color:#111827;font-size:14px;">${renderInline(trimmed)}</p>`;
      continue;
    }

    // Regular line (with inline bold + link rendering)
    bodyHtml += `<p style="margin:4px 0;color:#374151;font-size:14px;line-height:1.6;">${renderInline(trimmed)}</p>`;
  }

  if (inList) bodyHtml += "</ul>";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6;">${preheader}</div>` : ""}
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
            <p style="margin:0;color:#6b7280;font-size:12px;">
              CertExpress &mdash; FMCSA Document Delivery Service<br>
              <a href="${appUrl}" style="color:#2563eb;">${appUrl.replace(/https?:\/\//, "")}</a>
            </p>
            <p style="margin:8px 0 0;color:#6b7280;font-size:11px;">
              CertExpress is a private service and is not affiliated with any government agency.
            </p>
            ${unsubscribeUrl ? `
            <p style="margin:8px 0 0;font-size:11px;">
              <a href="${unsubscribeUrl}" style="color:#9ca3af;">Unsubscribe</a>
            </p>` : ""}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  ${openPixelUrl ? `<img src="${openPixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />` : ""}
</body>
</html>`;
}

const DEFAULT_TEMPLATE = `Hi {{companyName}} team,

We noticed that FMCSA issued your {{documentType}} ({{documentNumber}}) for USDOT {{usdotNumber}} on {{serviceDate}}.

If you need a PDF copy for your records, we offer an instant download for {{price}}.

This is a **paid third-party document service** and is not affiliated with FMCSA. You can verify your authority status directly through official FMCSA systems.

---

{{previewImageUrl}}

{{paymentLink}}

---

Why some companies choose a copy:
• Keep a PDF on file for internal records
• Share with brokers or insurance
• Avoid searching/downloading manually

What you'll receive:
• PDF copy matching your FMCSA registration
• Instant download after payment
• Easy to save, forward, and upload

---

Questions? Just reply to this email.

Best regards,
Ethan
CertExpress`;

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
  const blocklist = new Set(await getUnsubscribeList()); // lowercased

  let sent = 0;
  let failed = 0;

  for (const company of companies) {
    if (!company.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) continue;
    if (company.emailStatus === "unsubscribed") continue;
    if (blocklist.has(company.email.trim().toLowerCase())) continue;

    try {
      // 1. Create EmailLog record first to get tracking ID
      const emailLog = await prisma.emailLog.create({
        data: {
          companyId: company.id,
          toEmail: company.email,
          subject: "", // will update after interpolation
        },
      });

      // 2. Tracking URL (used only as the href on buttons/links so clicks log);
      //    payUrl is the clean, user-facing URL shown in visible text / plain-text body
      //    so the message doesn't look phishy. Open pixel handles read receipts.
      const trackingUrl = `${appUrl}/api/track/${emailLog.id}`;
      const payUrl = `${appUrl}/pay/${company.id}`;
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
          .replace(/\{\{paymentLink\}\}/g, payUrl)
          .replace(
            /\{\{previewImageUrl\}\}/g,
            company.previewFilename
              ? `${appUrl}/previews/${company.previewFilename}`
              : ""
          )
          .replace(
            /\{\{unsubscribeLink\}\}/g,
            `${appUrl}/unsubscribe?email=${encodeURIComponent(company.email!)}`
          )
          .replace(/\{\{companyAddress\}\}/g, process.env.COMPANY_ADDRESS || "");

      const subject = interpolate(
        settings.email_subject ||
          "PDF copy of your FMCSA {{documentType}} ({{documentNumber}}) — {{price}}"
      );

      const template = settings.email_body_template || DEFAULT_TEMPLATE;
      const textBody = interpolate(template);
      const preheader = interpolate(
        "Paid third-party service. Convenience PDF copy for {{price}}. Not affiliated with FMCSA."
      );
      const unsubscribeUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(company.email!)}`;
      const htmlBody = templateToHtml(textBody, payUrl, trackingUrl, appUrl, openPixelUrl, preheader, unsubscribeUrl);

      const attachments = company.previewFilename
        ? [{
            filename: `preview-${company.documentNumber}.png`,
            path: path.join(process.cwd(), "public", "previews", company.previewFilename),
            cid: "previewImage",
          }]
        : undefined;

      await sendEmail({
        to: company.email,
        subject,
        text: textBody,
        html: htmlBody,
        attachments,
        isBulk: true,
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
