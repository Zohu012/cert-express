-- CreateTable
CREATE TABLE "ExcludedCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "excludedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExcludedCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtruckingCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usdotNumber" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "companyName" TEXT,
    "physicalAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "companyOfficer" TEXT,
    "dotStatus" TEXT,
    "entityType" TEXT,
    "estYear" TEXT,
    "powerUnits" TEXT,
    "drivers" TEXT,
    "safetyRating" TEXT,
    "authorityStatus" TEXT,
    "authoritySince" TEXT,
    "carrierType" TEXT,
    "hazmat" TEXT,
    "passengerCarrier" TEXT,
    "mcs150Update" TEXT,
    "county" TEXT,
    "fleetBreakdown" TEXT,
    "cargoTypes" TEXT,
    "equipmentTypes" TEXT,
    "scrapeStatus" TEXT NOT NULL DEFAULT 'pending',
    "scrapeError" TEXT,
    "scrapedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "lastRunAt" DATETIME NOT NULL,
    "lastWatermark" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "skipReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "reminderNumber" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "EmailLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("clickCount", "companyId", "firstOpenAt", "id", "lastClickAt", "openCount", "reminderNumber", "sentAt", "subject", "toEmail") SELECT "clickCount", "companyId", "firstOpenAt", "id", "lastClickAt", "openCount", "reminderNumber", "sentAt", "subject", "toEmail" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
CREATE INDEX "EmailLog_companyId_idx" ON "EmailLog"("companyId");
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_source_idx" ON "EmailLog"("source");
CREATE INDEX "EmailLog_companyId_reminderNumber_idx" ON "EmailLog"("companyId", "reminderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedCompany_companyId_key" ON "ExcludedCompany"("companyId");

-- CreateIndex
CREATE INDEX "ExcludedCompany_excludedAt_idx" ON "ExcludedCompany"("excludedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtruckingCompany_usdotNumber_key" ON "OtruckingCompany"("usdotNumber");

-- CreateIndex
CREATE INDEX "OtruckingCompany_usdotNumber_idx" ON "OtruckingCompany"("usdotNumber");

-- CreateIndex
CREATE INDEX "OtruckingCompany_scrapeStatus_idx" ON "OtruckingCompany"("scrapeStatus");

-- CreateIndex
CREATE INDEX "OtruckingCompany_email_idx" ON "OtruckingCompany"("email");
