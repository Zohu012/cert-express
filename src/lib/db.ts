import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaInit: boolean;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

// One-time SQLite tuning: WAL + long busy timeout so concurrent writers
// (document generator, email sender, scraper) don't race to the default 5s timeout.
if (!globalForPrisma.prismaInit) {
  globalForPrisma.prismaInit = true;
  (async () => {
    try {
      await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
      await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
      await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 30000");
    } catch (e) {
      console.error("[prisma] failed to apply SQLite pragmas:", e);
    }
  })();
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
