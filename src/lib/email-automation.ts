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

/** Build a Prisma `where` clause covering all eligibility rules. */
async function buildEligibilityWhere(config: AutomationConfig): Promise<Prisma.CompanyWhereInput> {
  const blocklist = await getUnsubscribeList();

  // Companies already sent via successful EmailLog will have emailStatus = "sent"
  // plus we filter NOT excluded, NOT unsubscribed, email present.
  const AND: Prisma.CompanyWhereInput[] = [
    { email: { not: null } },
    { email: { not: "" } },
    { emailStatus: { not: "sent" } },
    { emailStatus: { not: "unsubscribed" } },
    { excluded: { is: null } },
  ];

  if (blocklist.length > 0) {
    AND.push({ email: { notIn: blocklist } });
  }

  if (config.documentServiceDateFrom) {
    AND.push({
      serviceDate: { gte: new Date(config.documentServiceDateFrom) },
    });
  }
  if (config.documentServiceDateTo) {
    const to = new Date(config.documentServiceDateTo);
    to.setUTCHours(23, 59, 59, 999);
    AND.push({ serviceDate: { lte: to } });
  }

  return { AND };
}

function pickOrderBy(config: AutomationConfig) {
  const hasDateRange =
    !!config.documentServiceDateFrom || !!config.documentServiceDateTo;
  if (hasDateRange) {
    return [{ serviceDate: "asc" as const }, { createdAt: "asc" as const }];
  }
  return [{ createdAt: "asc" as const }];
}

export async function countEligibleCandidates(config: AutomationConfig): Promise<number> {
  const where = await buildEligibilityWhere(config);
  return prisma.company.count({ where });
}

export async function getNextEligibleCandidate(
  config: AutomationConfig
): Promise<Company | null> {
  const where = await buildEligibilityWhere(config);
  return prisma.company.findFirst({
    where,
    orderBy: pickOrderBy(config),
  });
}

export function randomDelayMs(config: AutomationConfig): number {
  const minMs = config.minDelaySec * 1000;
  const maxMs = config.maxDelaySec * 1000;
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}
