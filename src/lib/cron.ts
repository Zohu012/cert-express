import cron from "node-cron";
import { fetchDailyPdf } from "./pdf-fetcher";
import { getSetting } from "./settings";

let initialized = false;
let currentTask: ReturnType<typeof cron.schedule> | null = null;

const DEFAULT_SCHEDULE = "7 19 * * 1-5"; // 2:07 PM ET (19:07 UTC) weekdays

export async function startCronJobs() {
  if (initialized) return;
  initialized = true;

  // Read schedule from DB, fall back to default
  let schedule = DEFAULT_SCHEDULE;
  try {
    const stored = await getSetting("cron_schedule");
    if (stored && cron.validate(stored)) {
      schedule = stored;
    } else if (stored) {
      console.warn(`[CRON] Invalid cron expression in DB: "${stored}", using default`);
    }
  } catch (err) {
    console.warn("[CRON] Could not read schedule from DB, using default:", err);
  }

  currentTask = cron.schedule(schedule, async () => {
    console.log("[CRON] Starting daily PDF fetch...");
    try {
      await fetchDailyPdf();
    } catch (err) {
      console.error("[CRON] Daily fetch failed:", err);
    }
  });

  console.log(`[CRON] Daily PDF fetch scheduled: ${schedule}`);
}

export function stopCronJobs() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
    initialized = false;
    console.log("[CRON] Stopped.");
  }
}
