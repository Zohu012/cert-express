-- Add email open tracking fields to EmailLog
ALTER TABLE "EmailLog" ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailLog" ADD COLUMN "firstOpenAt" DATETIME;
