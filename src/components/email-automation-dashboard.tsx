"use client";

import { useEffect, useState } from "react";
import type { AutomationConfig, AutomationState } from "@/lib/email-automation";

interface DashboardData {
  config: AutomationConfig;
  state: AutomationState;
  eligibleCount: number;
  withinWindow: boolean;
}

export function EmailAutomationDashboard({
  initialConfig,
  initialState,
  initialEligibleCount,
  initialWithinWindow,
}: {
  initialConfig: AutomationConfig;
  initialState: AutomationState;
  initialEligibleCount: number;
  initialWithinWindow: boolean;
}) {
  const [data, setData] = useState<DashboardData>({
    config: initialConfig,
    state: initialState,
    eligibleCount: initialEligibleCount,
    withinWindow: initialWithinWindow,
  });

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/email-automation");
        if (res.ok) setData(await res.json());
      } catch {}
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const { config, state, eligibleCount, withinWindow } = data;
  const remaining = Math.max(0, config.maxPerDay - state.sentToday);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold mb-2">Dashboard</h2>

      <Row label="Auto-send status">
        <span
          className={
            "inline-block text-xs px-2 py-0.5 rounded " +
            (config.enabled
              ? "bg-green-100 text-green-800"
              : "bg-gray-200 text-gray-700")
          }
        >
          {config.enabled ? "ON" : "OFF"}
        </span>
      </Row>

      <Row label="In active window">
        <span
          className={
            "inline-block text-xs px-2 py-0.5 rounded " +
            (withinWindow
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-800")
          }
        >
          {withinWindow ? "Yes" : "No"}
        </span>
      </Row>

      <Row label="Paused reason">
        <span className="text-xs text-gray-700">
          {state.pausedReason || "—"}
        </span>
      </Row>

      <Row label="Emails sent today">{state.sentToday}</Row>
      <Row label="Daily limit">{config.maxPerDay}</Row>
      <Row label="Remaining capacity">{remaining}</Row>
      <Row label="Eligible companies">{eligibleCount.toLocaleString()}</Row>
      <Row label="Next send time">
        {state.nextSendAt ? new Date(state.nextSendAt).toLocaleTimeString() : "—"}
      </Row>
      <Row label="Last send">
        {state.lastSentAt ? new Date(state.lastSentAt).toLocaleString() : "—"}
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{children}</span>
    </div>
  );
}
