-- Disable FK checks so we can delete duplicates even if orders reference them
PRAGMA foreign_keys = OFF;

-- Step 1a: Delete orders that belong to duplicate companies (keep orders for the company we'll keep)
DELETE FROM "Order"
WHERE companyId IN (
  SELECT id FROM "Company"
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY usdotNumber, documentNumber
               ORDER BY createdAt DESC
             ) as rn
      FROM "Company"
    ) ranked
    WHERE rn = 1
  )
);

-- Step 1b: Remove duplicate (usdotNumber, documentNumber) pairs, keeping the most recent row
DELETE FROM "Company"
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY usdotNumber, documentNumber
             ORDER BY createdAt DESC
           ) as rn
    FROM "Company"
  ) ranked
  WHERE rn = 1
);

-- Step 2: Add composite unique constraint
CREATE UNIQUE INDEX "Company_usdotNumber_documentNumber_key"
  ON "Company"("usdotNumber", "documentNumber");

-- Re-enable FK checks
PRAGMA foreign_keys = ON;
