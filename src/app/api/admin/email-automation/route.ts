import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import {
  getAutomationConfig,
  getAutomationState,
  setAutomationConfig,
  validateConfig,
  countEligibleCandidates,
  isWithinWindow,
  DEFAULT_CONFIG,
  type AutomationConfig,
} from "@/lib/email-automation";

export async function GET() {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAutomationConfig();
  const state = await getAutomationState();
  const eligibleCount = await countEligibleCandidates(config);
  const withinWindow = isWithinWindow(config);

  return NextResponse.json({
    config,
    state,
    eligibleCount,
    withinWindow,
  });
}

export async function PUT(req: NextRequest) {
  const adminId = await verifySession();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const config: AutomationConfig = {
    ...DEFAULT_CONFIG,
    ...body,
    activeDays: Array.isArray(body.activeDays)
      ? body.activeDays.map((d: unknown) => Number(d)).filter((d: number) => !isNaN(d))
      : DEFAULT_CONFIG.activeDays,
    maxPerDay: Number(body.maxPerDay ?? DEFAULT_CONFIG.maxPerDay),
    minDelaySec: Number(body.minDelaySec ?? DEFAULT_CONFIG.minDelaySec),
    maxDelaySec: Number(body.maxDelaySec ?? DEFAULT_CONFIG.maxDelaySec),
  };

  const err = validateConfig(config);
  if (err) {
    return NextResponse.json({ error: err }, { status: 400 });
  }

  await setAutomationConfig(config);
  return NextResponse.json({ ok: true, config });
}
