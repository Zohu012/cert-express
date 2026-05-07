-- Add reminderNumber column + index to EmailLog for tracking 1st/2nd reminder rounds
ALTER TABLE "EmailLog" ADD COLUMN "reminderNumber" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX "EmailLog_companyId_reminderNumber_idx" ON "EmailLog"("companyId", "reminderNumber");
