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
      await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000");
    } catch (e) {
      console.error("[prisma] PRAGMA busy_timeout failed:", e);
    }
    try {
      // 256 MB SQLite page cache — large enough to hold hot indexes for the 4.4M-row
      // OtruckingCompany table in memory, cutting query latency dramatically.
      await prisma.$executeRawUnsafe("PRAGMA cache_size = -262144");
    } catch (e) {
      console.error("[prisma] PRAGMA cache_size failed:", e);
    }
    try {
      // 512 MB mmap — lets SQLite read indexes via page cache instead of read() syscalls.
      // Uses $queryRawUnsafe because mmap_size returns a result row.
      await prisma.$queryRawUnsafe("PRAGMA mmap_size = 536870912");
    } catch (e) {
      console.error("[prisma] PRAGMA mmap_size failed:", e);
    }
  })();
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
