-- Add compliance logging fields to Order table
ALTER TABLE "Order" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "termsVersion" TEXT;
