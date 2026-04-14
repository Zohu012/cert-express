import cron from "node-cron";
import { fetchDailyPdf } from "./pdf-fetcher";

let initialized = false;

export function startCronJobs() {
  if (initialized) return;
  initialized = true;

  // Run daily at 2:07 PM Eastern (19:07 UTC)
  // FMCSA typically publishes during business hours
  cron.schedule("7 19 * * 1-5", async () => {
    console.log("[CRON] Starting daily PDF fetch...");
    try {
      await fetchDailyPdf();
    } catch (err) {
      console.error("[CRON] Daily fetch failed:", err);
    }
  });

  console.log("[CRON] Daily PDF fetch scheduled (weekdays at ~2:07 PM ET)");
}
