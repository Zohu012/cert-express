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
    // PRAGMA journal_mode returns the new mode as a result row, so it must
    // use $queryRawUnsafe. The other two pragmas return nothing, so $executeRawUnsafe is fine.
    // Each is wrapped individually so one failure doesn't skip the others.
    try {
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    } catch (e) {
      console.error("[prisma] PRAGMA journal_mode failed:", e);
    }
    try {
      await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
    } catch (e) {
      console.error("[prisma] PRAGMA synchronous failed:", e);
    }
    try {
      await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 30000");
    } catch (e) {
      console.error("[prisma] PRAGMA busy_timeout failed:", e);
    }
  })();
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
