import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import {
  getAutomationConfig,
  setAutomationConfig,
  getAutomationState,
  setAutomationState,
} from "@/lib/email-automation";

export async function POST(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enabled } = await req.json();
  const config = await getAutomationConfig();
  config.enabled = Boolean(enabled);
  await setAutomationConfig(config);

  // Clear pause flag on (re)enable so admin isn't stuck.
  if (config.enabled) {
    const state = await getAutomationState();
    if (state.pausedReason) {
      await setAutomationState({
        ...state,
        pausedReason: null,
        consecutiveFailures: 0,
      });
    }
  }

  return NextResponse.json({ ok: true, enabled: config.enabled });
}
