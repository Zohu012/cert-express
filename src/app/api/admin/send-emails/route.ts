import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { getSettings, getPriceCents } from "@/lib/settings";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyIds } = await req.json();

  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, email: { not: null } },
  });

  const settings = await getSettings([
    "email_subject",
    "email_body_template",
  ]);
  const priceCents = await getPriceCents();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let sent = 0;
  let failed = 0;

  for (const company of companies) {
    if (!company.email) continue;

    try {
      const paymentLink = `${appUrl}/pay/${company.id}`;

      // Shared interpolation — works for both subject and body
      const interpolate = (tpl: string) =>
        tpl
          .replace(/\{\{companyName\}\}/g, company.companyName)
          .replace(/\{\{documentType\}\}/g, company.documentType)
          .replace(/\{\{documentNumber\}\}/g, company.documentNumber)
          .replace(
            /\{\{serviceDate\}\}/g,
            new Date(company.serviceDate).toLocaleDateString("en-US")
          )
          .replace(/\{\{price\}\}/g, `$${(priceCents / 100).toFixed(2)}`)
          .replace(/\{\{paymentLink\}\}/g, paymentLink);

      const subject = interpolate(
        settings.email_subject ||
          "Your FMCSA {{documentType}} – Get Your Official Certificate"
      );

      const textBody = interpolate(settings.email_body_template || "");

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">CertExpress</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <p>Dear <strong>${company.companyName}</strong>,</p>
            <p>Congratulations on receiving your FMCSA <strong>${company.documentType}</strong>!</p>
            <p>Your document <strong>${company.documentNumber}</strong> has been issued with a service date of ${new Date(company.serviceDate).toLocaleDateString("en-US")}.</p>
            <p>Get your official certificate delivered instantly for just <strong>$${(priceCents / 100).toFixed(2)}</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${paymentLink}" style="background: #16a34a; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                Get Your Certificate
              </a>
            </div>
            <p style="color: #666; font-size: 13px;">This is a one-time payment. Your certificate PDF will be available for instant download after payment.</p>
          </div>
          <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #888;">
            CertExpress &mdash; FMCSA Certificate Delivery
          </div>
        </div>
      `;

      await sendEmail({
        to: company.email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      await prisma.company.update({
        where: { id: company.id },
        data: {
          emailStatus: "sent",
          emailSentAt: new Date(),
        },
      });
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
