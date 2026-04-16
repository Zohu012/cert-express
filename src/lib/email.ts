import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; path: string; cid?: string }[];
}) {
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    attachments,
  });

  console.log(`[EMAIL] Sent to ${to}, messageId: ${info.messageId}`);
  return info;
}

// ─── Order Confirmation ──────────────────────────────────────────────────────

export async function sendOrderConfirmationEmail({
  to,
  companyName,
  documentType,
  documentNumber,
  serviceDate,
  amountCents,
  downloadToken,
  maxDownloads,
  expiresAt,
}: {
  to: string;
  companyName: string;
  documentType: string;
  documentNumber: string;
  serviceDate: Date;
  amountCents: number;
  downloadToken: string;
  maxDownloads: number;
  expiresAt: Date;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://certexpresss.com";
  const downloadUrl = `${appUrl}/download/${downloadToken}`;
  const price = `$${(amountCents / 100).toFixed(2)}`;
  const formattedDate = new Date(serviceDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const expiryStr = new Date(expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Your FMCSA ${documentType} is Ready – Download Now`;

  const text = [
    `Hello,`,
    ``,
    `Thank you for your purchase. Your ${documentType} PDF copy for ${companyName} is ready for download.`,
    ``,
    `Document Details:`,
    `Company: ${companyName}`,
    `Document Type: ${documentType}`,
    `Document #: ${documentNumber}`,
    `Service Date: ${formattedDate}`,
    `Amount Paid: ${price}`,
    ``,
    `Download your document:`,
    downloadUrl,
    ``,
    `Download link details:`,
    `This link allows up to ${maxDownloads} downloads and expires on ${expiryStr}. Please save your document before it expires.`,
    ``,
    `If the button doesn't work, copy and paste this link into your browser:`,
    downloadUrl,
    ``,
    `This is an independent document delivery service providing a convenient PDF copy of your FMCSA record.`,
    `We are not affiliated with the Federal Motor Carrier Safety Administration (FMCSA) or the U.S. Department of Transportation.`,
    ``,
    `If you have any questions, simply reply to this email or visit certexpresss.com and we'll help.`,
    ``,
    `Best regards,`,
    `CertExpress Team`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
            <img src="${appUrl}/logo.png" alt="CertExpress" width="180" style="height:54px;width:auto;display:inline-block;" />
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">FMCSA Document Delivery Service</p>
          </td>
        </tr>

        <!-- Success banner -->
        <tr>
          <td style="background:#dcfce7;padding:16px 40px;text-align:center;border-bottom:1px solid #bbf7d0;">
            <p style="margin:0;color:#15803d;font-size:15px;font-weight:bold;">✅ Payment Confirmed – Your Document is Ready!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              Thank you for your purchase. Your <strong>${documentType}</strong> PDF copy for
              <strong>${companyName}</strong> is ready for download.
            </p>

            <!-- Order details box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;color:#6b7280;font-size:13px;width:130px;">Company</td>
                    <td style="padding:5px 0;color:#111827;font-size:13px;font-weight:600;">${companyName}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#6b7280;font-size:13px;">Document Type</td>
                    <td style="padding:5px 0;color:#111827;font-size:13px;font-weight:600;">${documentType}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#6b7280;font-size:13px;">Document #</td>
                    <td style="padding:5px 0;color:#111827;font-size:13px;font-weight:600;">${documentNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#6b7280;font-size:13px;">Service Date</td>
                    <td style="padding:5px 0;color:#111827;font-size:13px;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#6b7280;font-size:13px;">Amount Paid</td>
                    <td style="padding:5px 0;color:#111827;font-size:13px;font-weight:600;">${price}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Download button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${downloadUrl}"
                   style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;
                          padding:16px 48px;border-radius:8px;font-size:16px;font-weight:bold;
                          letter-spacing:0.2px;">
                  ⬇ Download Your Document
                </a>
              </td></tr>
            </table>

            <!-- Download note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
              <tr><td style="padding:14px 20px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                  <strong>⚠ Download link details:</strong><br>
                  This link allows up to <strong>${maxDownloads} downloads</strong> and expires on
                  <strong>${expiryStr}</strong>. Please save your document before it expires.
                </p>
              </td></tr>
            </table>

            <!-- Backup link -->
            <p style="margin:20px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${downloadUrl}" style="color:#2563eb;">${downloadUrl}</a>
            </p>

            <!-- Disclaimer -->
            <p style="margin:24px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">
              This is an independent document delivery service providing a convenient PDF copy of your FMCSA record.
              We are not affiliated with the Federal Motor Carrier Safety Administration (FMCSA) or the U.S. Department of Transportation.
            </p>

            <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">
              If you have any questions, simply reply to this email or visit
              <a href="${appUrl}" style="color:#2563eb;">certexpresss.com</a> and we'll help.
            </p>

            <p style="margin:16px 0 0;color:#374151;font-size:13px;">
              Best regards,<br>
              <strong>CertExpress Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              CertExpress &mdash; FMCSA Document Delivery Service<br>
              <a href="${appUrl}" style="color:#2563eb;">certexpresss.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({ to, subject, text, html });
  console.log(`[EMAIL] Order confirmation sent to ${to} (token: ${downloadToken})`);
}
