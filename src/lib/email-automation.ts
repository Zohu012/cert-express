import { prisma } from "./db";
import { getSetting, setSetting } from "./settings";
import { getUnsubscribeList } from "./unsubscribe-list";
import type { Company, Prisma } from "@prisma/client";

const CONFIG_KEY = "email_automation_config";
const STATE_KEY = "email_automation_state";

export interface AutomationConfig {
  enabled: boolean;
  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  activeDays: number[];
  /** "HH:MM" 24h in the configured timezone */
  startTime: string;
  /** "HH:MM" 24h in the configured timezone */
  endTime: string;
  /** IANA tz name, e.g. "America/New_York" */
  timezone: string;
  maxPerDay: number;
  minDelaySec: number;
  maxDelaySec: number;
  /** ISO date string (YYYY-MM-DD) or null */
  documentServiceDateFrom: string | null;
  /** ISO date string (YYYY-MM-DD) or null */
  documentServiceDateTo: string | null;
}

export interface AutomationState {
  sentToday: number;
  /** YYYY-MM-DD in config timezone */
  dayKey: string | null;
  lastSentAt: string | null;
  nextSendAt: string | null;
  pausedReason: string | null;
  consecutiveFailures: number;
}

export const DEFAULT_CONFIG: AutomationConfig = {
  enabled: false,
  activeDays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "America/New_York",
  maxPerDay: 100,
  minDelaySec: 60,
  maxDelaySec: 180,
  documentServiceDateFrom: null,
  documentServiceDateTo: null,
};

export const DEFAULT_STATE: AutomationState = {
  sentToday: 0,
  dayKey: null,
  lastSentAt: null,
  nextSendAt: null,
  pausedReason: null,
  consecutiveFailures: 0,
};

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const raw = await getSetting(CONFIG_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setAutomationConfig(config: AutomationConfig): Promise<void> {
  await setSetting(CONFIG_KEY, JSON.stringify(config));
}

export async function getAutomationState(): Promise<AutomationState> {
  const raw = await getSetting(STATE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function setAutomationState(state: AutomationState): Promise<void> {
  await setSetting(STATE_KEY, JSON.stringify(state));
}

/** Validate config. Throws on error. */
export function validateConfig(config: AutomationConfig): string | null {
  if (!Array.isArray(config.activeDays) || config.activeDays.some((d) => d < 0 || d > 6)) {
    return "activeDays must contain numbers 0-6";
  }
  if (!/^\d{2}:\d{2}$/.test(config.startTime)) return "startTime must be HH:MM";
  if (!/^\d{2}:\d{2}$/.test(config.endTime)) return "endTime must be HH:MM";
  if (!config.timezone) return "timezone is required";
  if (config.maxPerDay < 1) return "maxPerDay must be at least 1";
  if (config.minDelaySec < 1) return "minDelaySec must be at least 1";
  if (config.maxDelaySec < config.minDelaySec) {
    return "maxDelaySec must be >= minDelaySec";
  }
  if (config.documentServiceDateFrom && config.documentServiceDateTo) {
    const from = new Date(config.documentServiceDateFrom);
    const to = new Date(config.documentServiceDateTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return "Invalid date format";
    if (from > to) return "documentServiceDateFrom must be <= documentServiceDateTo";
  }
  return null;
}

/** Return { dayKey: "YYYY-MM-DD", hhmm: "HH:MM", dayOfWeek: 0-6 } in the given tz. */
export function nowInTimezone(timezone: string, at: Date = new Date()) {
  const fmtDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const fmtTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });

  const dayKey = fmtDate.format(at); // YYYY-MM-DD
  const hhmm = fmtTime.format(at);   // HH:MM
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[fmtDay.format(at)] ?? 0;
  return { dayKey, hhmm, dayOfWeek };
}

export function isWithinWindow(
  config: AutomationConfig,
  at: Date = new Date()
): boolean {
  const { hhmm, dayOfWeek } = nowInTimezone(config.timezone, at);
  if (!config.activeDays.includes(dayOfWeek)) return false;
  return hhmm >= config.startTime && hhmm <= config.endTime;
}

/**
 * Convert a "YYYY-MM-DD" date string to the UTC instant that corresponds to
 * midnight (or end-of-day) in the given IANA timezone. This is needed because
 * serviceDate values are stored as UTC Date instants — a value stored as
 * 2026-04-24T04:00:00.000Z shows up as "4/23/2026" when rendered in
 * America/New_York via toLocaleDateString. Filtering with a naive
 * new Date("2026-04-23") (= 2026-04-23T00:00:00Z) would miss it.
 */
function zonedDateToUtc(
  dateStr: string,
  timezone: string,
  endOfDay: boolean,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const ms = endOfDay ? 999 : 0;

  // Start with the literal moment interpreted as UTC.
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute, second, ms));

  // Read back the guess through the requested timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(guess);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const tzY = get("year");
  const tzM = get("month");
  const tzD = get("day");
  let tzH = get("hour");
  if (tzH === 24) tzH = 0;
  const tzMin = get("minute");
  const tzS = get("second");

  const wantedMs = Date.UTC(y, m - 1, d, hour, minute, second, ms);
  const gotMs = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, tzS, ms);
  return new Date(guess.getTime() + (wantedMs - gotMs));
}

/**
 * Single source of truth for "who is eligible to be emailed".
 *
 * Mirrors the exact filter used on /admin/emails (fetchCandidates in
 * src/app/admin/emails/page.tsx): email present, not excluded, not
 * unsubscribed, not on the blocklist, and no prior successful EmailLog row
 * for the same (usdotNumber, email) pair. Optionally restricted to a
 * service-date range interpreted in the given IANA timezone.
 *
 * `orderBy` controls result order:
 *  - "newest"   : createdAt DESC (matches /admin/emails display order)
 *  - "oldest"   : createdAt ASC  (FIFO)
 *  - "serviceAsc": serviceDate ASC then createdAt ASC (used when a date
 *                  range is active so the queue drains chronologically)
 */
export async function fetchEligibleCompanies(opts: {
  serviceDateFrom?: string | null;
  serviceDateTo?: string | null;
  timezone?: string;
  orderBy?: "newest" | "oldest" | "serviceAsc";
  limit?: number;
} = {}): Promise<Company[]> {
  const {
    serviceDateFrom,
    serviceDateTo,
    timezone = "America/New_York",
    orderBy = "oldest",
    limit,
  } = opts;

  // Pairs (usdot:email) that have already been successfully contacted.
  const sentLogs = await prisma.emailLog.findMany({
    where: { company: { emailStatus: "sent" } },
    select: {
      toEmail: true,
      company: { select: { usdotNumber: true } },
    },
  });
  const contactedSet = new Set<string>();
  for (const log of sentLogs) {
    const dot = log.company?.usdotNumber;
    if (dot && log.toEmail) {
      contactedSet.add(`${dot}:${log.toEmail.toLowerCase().trim()}`);
    }
  }

  const AND: Prisma.CompanyWhereInput[] = [
    { email: { not: null } },
    { email: { not: "" } },
    { excluded: { is: null } },
  ];

  const order: Prisma.CompanyOrderByWithRelationInput[] =
    orderBy === "newest"
      ? [{ createdAt: "desc" }]
      : orderBy === "serviceAsc"
        ? [{ serviceDate: "asc" }, { createdAt: "asc" }]
        : [{ createdAt: "asc" }];

  const companies = await prisma.company.findMany({
    where: { AND },
    orderBy: order,
  });

  // serviceDate is a calendar date (e.g. a PDF's issue date), not an instant.
  // PDF ingest stores it as UTC midnight of that date, so filter/display by
  // the UTC date component to match what the UI shows on /admin/emails and
  // the /admin dashboard. Using any local timezone here would shift the
  // boundary and miss rows the user can clearly see in the list.
  void timezone;
  const dateFmt = (serviceDateFrom || serviceDateTo)
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  const blocklist = new Set(await getUnsubscribeList());
  const filtered: Company[] = [];
  for (const c of companies) {
    if (!c.email || !c.usdotNumber) continue;
    if (c.emailStatus === "unsubscribed") continue;
    if (blocklist.has(c.email.toLowerCase().trim())) continue;
    const key = `${c.usdotNumber}:${c.email.toLowerCase().trim()}`;
    if (contactedSet.has(key)) continue;
    if (dateFmt && c.serviceDate) {
      const tzDate = dateFmt.format(c.serviceDate); // "2026-04-20"
      if (serviceDateFrom && tzDate < serviceDateFrom) continue;
      if (serviceDateTo && tzDate > serviceDateTo) continue;
    }
    filtered.push(c);
    if (limit && filtered.length >= limit) break;
  }
  return filtered;
}

export async function countEligibleCandidates(config: AutomationConfig): Promise<number> {
  const rows = await fetchEligibleCompanies({
    serviceDateFrom: config.documentServiceDateFrom,
    serviceDateTo: config.documentServiceDateTo,
    timezone: config.timezone,
    orderBy: "oldest",
  });
  return rows.length;
}

export async function getNextEligibleCandidate(
  config: AutomationConfig
): Promise<Company | null> {
  const hasDateRange =
    !!config.documentServiceDateFrom || !!config.documentServiceDateTo;
  const rows = await fetchEligibleCompanies({
    serviceDateFrom: config.documentServiceDateFrom,
    serviceDateTo: config.documentServiceDateTo,
    timezone: config.timezone,
    orderBy: hasDateRange ? "serviceAsc" : "oldest",
    limit: 1,
  });
  return rows[0] ?? null;
}

export function randomDelayMs(config: AutomationConfig): number {
  const minMs = config.minDelaySec * 1000;
  const maxMs = config.maxDelaySec * 1000;
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}
