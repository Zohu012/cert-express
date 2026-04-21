import {
  getAutomationConfig,
  getAutomationState,
  setAutomationState,
  isWithinWindow,
  nowInTimezone,
  getNextEligibleCandidate,
  randomDelayMs,
} from "./email-automation";
import { sendOneCompany } from "./email-sender";

const MAX_CONSECUTIVE_FAILURES = 5;

let tickRunning = false;

/**
 * One tick of the auto-sender. Intended to be invoked on a short interval
 * (e.g. every 30 seconds via node-cron). Sends at most ONE email per tick.
 * Returns a short status string for diagnostics / logging.
 */
export async function runAutoSenderTick(): Promise<string> {
  if (tickRunning) return "busy";
  tickRunning = true;
  try {
    const config = await getAutomationConfig();
    if (!config.enabled) return "disabled";

    let state = await getAutomationState();

    if (state.pausedReason) return `paused:${state.pausedReason}`;

    const now = new Date();
    const { dayKey } = nowInTimezone(config.timezone, now);

    // Reset daily counter
    if (state.dayKey !== dayKey) {
      state = { ...state, sentToday: 0, dayKey };
      await setAutomationState(state);
    }

    if (!isWithinWindow(config, now)) return "outside_window";
    if (state.sentToday >= config.maxPerDay) return "daily_cap_reached";

    if (state.nextSendAt && new Date(state.nextSendAt) > now) {
      return "waiting_delay";
    }

    const candidate = await getNextEligibleCandidate(config);
    if (!candidate) return "no_candidates";

    const result = await sendOneCompany(candidate, { source: "auto" });

    const delayMs = randomDelayMs(config);
    const nextSendAt = new Date(now.getTime() + delayMs).toISOString();

    if (result.status === "sent") {
      await setAutomationState({
        ...state,
        sentToday: state.sentToday + 1,
        lastSentAt: now.toISOString(),
        nextSendAt,
        consecutiveFailures: 0,
        pausedReason: null,
      });
      return "sent";
    }

    if (result.status === "failed") {
      const fails = state.consecutiveFailures + 1;
      const paused = fails >= MAX_CONSECUTIVE_FAILURES;
      await setAutomationState({
        ...state,
        nextSendAt,
        consecutiveFailures: fails,
        pausedReason: paused ? "consecutive_failures" : null,
      });
      return paused ? "auto_paused_on_failures" : "failed";
    }

    // skipped: advance nextSendAt but without a shorter backoff so we don't spin
    await setAutomationState({
      ...state,
      nextSendAt,
    });
    return `skipped:${result.skipReason ?? "unknown"}`;
  } catch (err) {
    console.error("[AUTO-SENDER] tick error:", err);
    return "error";
  } finally {
    tickRunning = false;
  }
}
