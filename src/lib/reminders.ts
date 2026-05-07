import { prisma } from "./db";
import { getUnsubscribeList } from "./unsubscribe-list";
import type { Company } from "@prisma/client";

export interface ReminderCandidate {
  company: Company;
  totalClicks: number;
  lastClickAt: Date | null;
  lastSentAt: Date;
}

export interface FetchReminderOpts {
  /** When true, includes companies in the ExcludedCompany list. */
  allowExcluded?: boolean;
}

/**
 * Companies eligible for a 2nd reminder email.
 *
 * Criteria:
 * - Has at least one prior EmailLog with clickCount > 0 (engaged with 1st reminder)
 * - Their most recent send is before today (don't double-up the same day)
 * - No reminder #2 has been sent yet (status === "sent")
 * - serviceDate falls on today's calendar date (FMCSA issued the document today)
 * - Has a usable email; not unsubscribed; not on blocklist
 * - Not in ExcludedCompany (unless allowExcluded)
 *
 * Sorted by total click count desc, then most recent click desc.
 */
export async function fetchReminderCandidates(
  opts: FetchReminderOpts = {}
): Promise<ReminderCandidate[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  // Companies whose serviceDate is today.
  const sameDayCompanies = await prisma.company.findMany({
    where: {
      serviceDate: { gte: startOfToday, lt: endOfToday },
      email: { not: null },
      emailStatus: { not: "unsubscribed" },
    },
  });
  if (sameDayCompanies.length === 0) return [];

  const ids = sameDayCompanies.map((c) => c.id);

  const [logs, excluded, blocklist] = await Promise.all([
    prisma.emailLog.findMany({
      where: { companyId: { in: ids }, status: { in: ["sent", "skipped"] } },
      select: {
        companyId: true,
        sentAt: true,
        clickCount: true,
        lastClickAt: true,
        reminderNumber: true,
        status: true,
      },
    }),
    opts.allowExcluded
      ? Promise.resolve([] as { companyId: string }[])
      : prisma.excludedCompany.findMany({
          where: { companyId: { in: ids } },
          select: { companyId: true },
        }),
    getUnsubscribeList(),
  ]);

  const excludedSet = new Set(excluded.map((e) => e.companyId));
  const blockSet = new Set(blocklist.map((e) => e.toLowerCase()));

  // Aggregate per company.
  type Agg = {
    totalClicks: number;
    lastClickAt: Date | null;
    lastSentAt: Date | null;
    hasReminder2Sent: boolean;
  };
  const agg = new Map<string, Agg>();
  for (const log of logs) {
    const a =
      agg.get(log.companyId) ??
      ({ totalClicks: 0, lastClickAt: null, lastSentAt: null, hasReminder2Sent: false } as Agg);
    if (log.status === "sent") {
      a.totalClicks += log.clickCount;
      if (!a.lastSentAt || log.sentAt > a.lastSentAt) a.lastSentAt = log.sentAt;
      if (log.lastClickAt && (!a.lastClickAt || log.lastClickAt > a.lastClickAt)) {
        a.lastClickAt = log.lastClickAt;
      }
      if (log.reminderNumber === 2) a.hasReminder2Sent = true;
    }
    agg.set(log.companyId, a);
  }

  const candidates: ReminderCandidate[] = [];
  for (const company of sameDayCompanies) {
    if (excludedSet.has(company.id)) continue;
    const email = company.email?.trim().toLowerCase();
    if (!email || blockSet.has(email)) continue;

    const a = agg.get(company.id);
    if (!a || !a.lastSentAt) continue; // never sent — not a reminder candidate
    if (a.hasReminder2Sent) continue; // already sent 2nd reminder
    if (a.totalClicks <= 0) continue; // no engagement
    if (a.lastSentAt >= startOfToday) continue; // already sent today

    candidates.push({
      company,
      totalClicks: a.totalClicks,
      lastClickAt: a.lastClickAt,
      lastSentAt: a.lastSentAt,
    });
  }

  candidates.sort((a, b) => {
    if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
    const aClick = a.lastClickAt ? a.lastClickAt.getTime() : 0;
    const bClick = b.lastClickAt ? b.lastClickAt.getTime() : 0;
    return bClick - aClick;
  });

  return candidates;
}
