import cron from "node-cron";
import { fetchDailyPdf } from "./pdf-fetcher";
import { getSetting } from "./settings";
import { runAutoSenderTick } from "./email-auto-sender";

export type CronTimeSlot = { hourUTC: number; minute: number; enabled: boolean };

const DEFAULT_SLOTS: CronTimeSlot[] = [
  { hourUTC: 19, minute: 7, enabled: true }, // 2:07 PM ET default
];

let initialized = false;
const activeTasks: ReturnType<typeof cron.schedule>[] = [];

function parseCronSlots(raw: string): CronTimeSlot[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  // Backward compat: legacy single "M H * * 1-5" string
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const m = parseInt(parts[0]);
    const h = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(h)) {
      return [{ hourUTC: h, minute: m, enabled: true }];
    }
  }
  return DEFAULT_SLOTS;
}

export async function startCronJobs() {
  if (initialized) return;
  initialized = true;

  let slots = DEFAULT_SLOTS;
  try {
    // Prefer new multi-slot setting, fall back to legacy single
    const stored =
      (await getSetting("cron_schedules")) ?? (await getSetting("cron_schedule"));
    if (stored) {
      const parsed = parseCronSlots(stored);
      if (parsed.length > 0) slots = parsed;
    }
  } catch (err) {
    console.warn("[CRON] Could not read schedule from DB, using default:", err);
  }

  const enabled = slots.filter((s) => s.enabled);
  for (const slot of enabled) {
    const expr = `${slot.minute} ${slot.hourUTC} * * 1-5`;
    if (!cron.validate(expr)) {
      console.warn(`[CRON] Invalid expression "${expr}", skipping`);
      continue;
    }
    const task = cron.schedule(expr, async () => {
      console.log(
        `[CRON] Starting daily PDF fetch (${slot.hourUTC}:${String(slot.minute).padStart(2, "0")} UTC)...`
      );
      try {
        await fetchDailyPdf();
      } catch (err) {
        console.error("[CRON] Daily fetch failed:", err);
      }
    });
    activeTasks.push(task);
    const etHour = ((slot.hourUTC - 5) + 24) % 24;
    const ampm = etHour >= 12 ? "PM" : "AM";
    const etH = etHour % 12 || 12;
    console.log(
      `[CRON] Scheduled: ${slot.hourUTC}:${String(slot.minute).padStart(2, "0")} UTC ` +
      `(≈ ${etH}:${String(slot.minute).padStart(2, "0")} ${ampm} ET) weekdays`
    );
  }

  if (enabled.length === 0) {
    console.warn("[CRON] No enabled time slots — auto-fetch is off.");
  }

  // Auto-email sender tick — runs every 30 seconds; the tick itself is a no-op
  // when automation is disabled or outside the configured window.
  const autoEmailExpr = "*/30 * * * * *";
  if (cron.validate(autoEmailExpr)) {
    const autoEmailTask = cron.schedule(autoEmailExpr, async () => {
      try {
        await runAutoSenderTick();
      } catch (err) {
        console.error("[CRON] Auto-email tick failed:", err);
      }
    });
    activeTasks.push(autoEmailTask);
    console.log("[CRON] Auto-email sender tick scheduled every 30s");
  } else {
    console.warn("[CRON] Invalid auto-email cron expression — skipping");
  }
}

export function stopCronJobs() {
  for (const task of activeTasks) task.stop();
  activeTasks.length = 0;
  initialized = false;
  console.log("[CRON] Stopped.");
}
