-- Change EmailLog FK from CASCADE to RESTRICT so company deletion does NOT silently wipe email history
-- SQLite does not support ALTER TABLE ... DROP CONSTRAINT, so we recreate the table.

-- 1. Rename old table
ALTER TABLE "EmailLog" RENAME TO "_EmailLog_old";

-- 2. Create new table with ON DELETE RESTRICT
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickAt" DATETIME,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenAt" DATETIME,
    CONSTRAINT "EmailLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Copy data
INSERT INTO "EmailLog" SELECT * FROM "_EmailLog_old";

-- 4. Drop old table
DROP TABLE "_EmailLog_old";

-- 5. Recreate indexes
CREATE INDEX "EmailLog_companyId_idx" ON "EmailLog"("companyId");
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");
