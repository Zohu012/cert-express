import path from "path";
import { prisma } from "./db";
import { getSettings, getPriceCents } from "./settings";
import { sendEmail } from "./email";
import { getUnsubscribeList } from "./unsubscribe-list";
import type { Company } from "@prisma/client";

/** Render **bold** markers and linkify bare https?:// URLs in a plain-text line. */
function renderInline(line: string): string {
  let out = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" style="color:#2563eb;word-break:break-all;">$1</a>'
  );
  return out;
}

export function templateToHtml(
  text: string,
  displayLink: string,
  trackUrl: string,
  appUrl: string,
  openPixelUrl?: string,
  preheader?: string,
  unsubscribeUrl?: string,
): string {
  const logoUrl = `${appUrl}/logo.png`;

  const lines = text.split("\n");
  let bodyHtml = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "---") {
      if (inList) { bodyHtml += "</ul>"; inList = false; }
      bodyHtml += `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">`;
      continue;
    }

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

    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      if (!inList) { bodyHtml += '<ul style="margin:8px 0;padding-left:20px;">'; inList = true; }
      bodyHtml += `<li style="padding:3px 0;color:#374151;font-size:14px;">${renderInline(trimmed.replace(/^[•\-]\s*/, ""))}</li>`;
      continue;
    }

    if (inList) { bodyHtml += "</ul>"; inList = false; }

    if (!trimmed) {
      bodyHtml += '<div style="height:10px;"></div>';
      continue;
    }

    if (trimmed.endsWith(":") && trimmed.length < 40) {
      bodyHtml += `<p style="margin:14px 0 4px;font-weight:bold;color:#111827;font-size:14px;">${renderInline(trimmed)}</p>`;
      continue;
    }

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

        <tr>
          <td style="background:#1e3a5f;padding:16px 40px;text-align:center;">
            <img src="${logoUrl}" alt="CertExpress" width="180"
                 style="height:54px;width:auto;display:inline-block;" />
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">FMCSA Document Delivery Service</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            ${bodyHtml}
          </td>
        </tr>

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

export const DEFAULT_REMINDER2_TEMPLATE = `Hi {{companyName}} team,

Just following up on the FMCSA {{documentType}} ({{documentNumber}}) for USDOT {{usdotNumber}} issued on {{serviceDate}}.

We saw you took a look at our previous email — if you'd still like a PDF copy on file, you can grab one for {{price}}.

This is a **paid third-party document service** and is not affiliated with FMCSA. You can verify your authority status directly through official FMCSA systems.

---

{{previewImageUrl}}

{{paymentLink}}

---

Why companies keep a copy:
• Quick reference for brokers and insurance
• Internal recordkeeping
• Forwardable PDF format

What you'll receive:
• PDF copy matching your FMCSA registration
• Instant download after payment

---

Questions? Just reply to this email.

Best regards,
Ethan
CertExpress`;

export const DEFAULT_TEMPLATE = `Hi {{companyName}} team,

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

export type SendSource = "manual" | "auto";
export type SkipReason =
  | "excluded"
  | "already_sent"
  | "outside_date_range"
  | "blocklist"
  | "invalid_email"
  | "unsubscribed";

export interface SendContext {
  source: SendSource;
  /** When true, excluded companies will be sent to AND stripped from the excluded list. */
  allowExcluded?: boolean;
  /** 1 = first reminder (default). 2 = follow-up. */
  reminderNumber?: 1 | 2;
}

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  skipReason?: SkipReason;
  emailLogId?: string;
  error?: string;
}

/** Send one email to one company. Centralized for manual + auto paths. */
export async function sendOneCompany(
  company: Company,
  ctx: SendContext
): Promise<SendResult> {
  const reminderNumber = ctx.reminderNumber ?? 1;

  // Validate email format
  if (!company.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) {
    await logSkip(company, "invalid_email", ctx.source, company.email || "", reminderNumber);
    return { status: "skipped", skipReason: "invalid_email" };
  }

  if (company.emailStatus === "unsubscribed") {
    await logSkip(company, "unsubscribed", ctx.source, company.email, reminderNumber);
    return { status: "skipped", skipReason: "unsubscribed" };
  }

  const blocklist = new Set(await getUnsubscribeList());
  if (blocklist.has(company.email.trim().toLowerCase())) {
    await logSkip(company, "blocklist", ctx.source, company.email, reminderNumber);
    return { status: "skipped", skipReason: "blocklist" };
  }

  // Excluded check
  const excluded = await prisma.excludedCompany.findUnique({
    where: { companyId: company.id },
  });
  if (excluded && !ctx.allowExcluded) {
    await logSkip(company, "excluded", ctx.source, company.email, reminderNumber);
    return { status: "skipped", skipReason: "excluded" };
  }

  // Already-purchased check by USDOT # (covers buyers who used a different email
  // or a different Company record sharing the same DOT).
  const purchased = await prisma.order.findFirst({
    where: { status: "completed", company: { usdotNumber: company.usdotNumber } },
    select: { id: true },
  });
  if (purchased) {
    await logSkip(company, "excluded", ctx.source, company.email, reminderNumber);
    return { status: "skipped", skipReason: "excluded" };
  }

  // Already sent check
  if (reminderNumber === 1) {
    // First reminder: company-level flag is the source of truth
    if (company.emailStatus === "sent") {
      await logSkip(company, "already_sent", ctx.source, company.email, reminderNumber);
      return { status: "skipped", skipReason: "already_sent" };
    }
  } else {
    // Reminder #2: check EmailLog directly
    const prior = await prisma.emailLog.findFirst({
      where: { companyId: company.id, reminderNumber: 2, status: "sent" },
      select: { id: true },
    });
    if (prior) {
      await logSkip(company, "already_sent", ctx.source, company.email, reminderNumber);
      return { status: "skipped", skipReason: "already_sent" };
    }
  }

  const subjectKey = reminderNumber === 2 ? "email_subject_reminder2" : "email_subject";
  const bodyKey = reminderNumber === 2 ? "email_body_template_reminder2" : "email_body_template";
  const settings = await getSettings([subjectKey, bodyKey]);
  const priceCents = await getPriceCents();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let emailLogId: string | undefined;

  try {
    const emailLog = await prisma.emailLog.create({
      data: {
        companyId: company.id,
        toEmail: company.email,
        subject: "",
        status: "sent",
        source: ctx.source,
        reminderNumber,
      },
    });
    emailLogId = emailLog.id;

    const trackingUrl = `${appUrl}/api/track/${emailLog.id}/${company.id}`;
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

    const defaultSubject =
      reminderNumber === 2
        ? "Following up — your FMCSA {{documentType}} ({{documentNumber}})"
        : "PDF copy of your FMCSA {{documentType}} ({{documentNumber}}) — {{price}}";
    const subject = interpolate(settings[subjectKey] || defaultSubject);

    const defaultTemplate =
      reminderNumber === 2 ? DEFAULT_REMINDER2_TEMPLATE : DEFAULT_TEMPLATE;
    const template = settings[bodyKey] || defaultTemplate;
    const textBody = interpolate(template);
    const preheader = interpolate(
      reminderNumber === 2
        ? "Quick follow-up on your FMCSA {{documentType}}. Paid third-party PDF copy for {{price}}."
        : "Paid third-party service. Convenience PDF copy for {{price}}. Not affiliated with FMCSA."
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

    if (reminderNumber === 1) {
      await prisma.$transaction([
        prisma.emailLog.update({
          where: { id: emailLog.id },
          data: { subject, status: "sent" },
        }),
        prisma.company.update({
          where: { id: company.id },
          data: { emailStatus: "sent", emailSentAt: new Date() },
        }),
      ]);
    } else {
      // Reminder #2: don't overwrite Company.emailSentAt — it tracks the 1st reminder.
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { subject, status: "sent" },
      });
    }

    // If send succeeded and company is in excluded list, remove it
    // (covers manual-send-overrides-exclusion case per spec)
    if (excluded) {
      await prisma.excludedCompany.deleteMany({ where: { companyId: company.id } });
    }

    return { status: "sent", emailLogId: emailLog.id };
  } catch (err) {
    console.error(`Failed to email ${company.email}:`, err);
    const errMsg = err instanceof Error ? err.message : String(err);
    try {
      if (emailLogId) {
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: { status: "failed" },
        });
      }
      if (reminderNumber === 1) {
        await prisma.company.update({
          where: { id: company.id },
          data: { emailStatus: "failed" },
        });
      }
    } catch (e) {
      console.error("Failed to mark failure state:", e);
    }
    return { status: "failed", emailLogId, error: errMsg };
  }
}

async function logSkip(
  company: Company,
  reason: SkipReason,
  source: SendSource,
  toEmail: string,
  reminderNumber: number = 1
) {
  try {
    await prisma.emailLog.create({
      data: {
        companyId: company.id,
        toEmail: toEmail || "",
        subject: "",
        status: "skipped",
        skipReason: reason,
        source,
        reminderNumber,
      },
    });
  } catch (e) {
    console.error("Failed to create skip log:", e);
  }
}
