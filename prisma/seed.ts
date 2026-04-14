import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hashSync("admin123", 10),
    },
  });

  // Create default settings
  const defaults: Record<string, string> = {
    price_cents: "3000",
    currency: "USD",
    max_downloads: "5",
    download_expiry_hours: "72",
    email_subject:
      "Your FMCSA Certificate of Authority is Ready - CertExpress",
    email_body_template:
      "Dear {{companyName}},\n\nCongratulations on receiving your FMCSA {{documentType}}! Your document ({{documentNumber}}) has been issued with a service date of {{serviceDate}}.\n\nGet your official certificate delivered instantly for just ${{price}}.\n\nClick here to get your certificate: {{paymentLink}}\n\nBest regards,\nCertExpress Team",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("Seed completed: admin user (admin/admin123) and default settings created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
