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
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
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
    `Thank you for your purchase!`,
    ``,
    `Your FMCSA ${documentType} for ${companyName} is ready to download.`,
    ``,
    `Document:    ${documentNumber}`,
    `Service Date: ${formattedDate}`,
    `Amount Paid: ${price}`,
    ``,
    `Download your certificate here:`,
    downloadUrl,
    ``,
    `This link allows up to ${maxDownloads} downloads and expires on ${expiryStr}.`,
    ``,
    `Thank you for using CertExpress.`,
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
          <td style="background:#1e3a5f;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;letter-spacing:-0.5px;">CertExpress</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">FMCSA Certificate Delivery</p>
          </td>
        </tr>

        <!-- Success banner -->
        <tr>
          <td style="background:#dcfce7;padding:16px 40px;text-align:center;border-bottom:1px solid #bbf7d0;">
            <p style="margin:0;color:#15803d;font-size:15px;font-weight:bold;">✅ Payment Confirmed – Your Certificate is Ready!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello,</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;">
              Thank you for your purchase. Your official FMCSA <strong>${documentType}</strong> for
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
                  ⬇ Download Your Certificate
                </a>
              </td></tr>
            </table>

            <!-- Download note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
              <tr><td style="padding:14px 20px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                  <strong>⚠ Download link details:</strong><br>
                  This link allows up to <strong>${maxDownloads} downloads</strong> and expires on
                  <strong>${expiryStr}</strong>. Please save your certificate before it expires.
                </p>
              </td></tr>
            </table>

            <!-- Backup link -->
            <p style="margin:20px 0 0;color:#6b7280;font-size:12px;word-break:break-all;">
              If the button doesn't work, copy this link:<br>
              <a href="${downloadUrl}" style="color:#2563eb;">${downloadUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              CertExpress &mdash; FMCSA Certificate Delivery<br>
              Questions? Reply to this email or visit
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
