"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AutomationConfig } from "@/lib/email-automation";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

export function EmailAutomationForm({
  initialConfig,
}: {
  initialConfig: AutomationConfig;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<AutomationConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function update<K extends keyof AutomationConfig>(key: K, value: AutomationConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function toggleDay(day: number) {
    const exists = config.activeDays.includes(day);
    update(
      "activeDays",
      exists
        ? config.activeDays.filter((d) => d !== day)
        : [...config.activeDays, day].sort((a, b) => a - b)
    );
  }

  function clientValidate(): string | null {
    if (config.activeDays.length === 0) return "Select at least one active day";
    if (!/^\d{2}:\d{2}$/.test(config.startTime)) return "Invalid start time";
    if (!/^\d{2}:\d{2}$/.test(config.endTime)) return "Invalid end time";
    if (config.startTime >= config.endTime) return "Start time must be before end time";
    if (config.maxPerDay < 1) return "Max emails per day must be at least 1";
    if (config.minDelaySec < 1) return "Min delay must be at least 1 second";
    if (config.maxDelaySec < config.minDelaySec) return "Max delay must be >= min delay";
    if (config.documentServiceDateFrom && config.documentServiceDateTo) {
      if (config.documentServiceDateFrom > config.documentServiceDateTo) {
        return "Service date 'From' must be <= 'To'";
      }
    }
    return null;
  }

  async function save() {
    const err = clientValidate();
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email-automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save" });
      } else {
        setMessage({ type: "ok", text: "Saved" });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    setToggling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email-automation/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const data = await res.json();
      if (res.ok) {
        update("enabled", data.enabled);
        setMessage({ type: "ok", text: data.enabled ? "Auto-send enabled" : "Auto-send disabled" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to toggle" });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            "p-3 rounded-lg text-sm " +
            (message.type === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700")
          }
        >
          {message.text}
        </div>
      )}

      {/* On/Off */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Auto Email Sending</h2>
            <p className="text-xs text-gray-500">
              {config.enabled ? "Currently ON" : "Currently OFF"}
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={toggling}
            className={
              "rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 " +
              (config.enabled ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700")
            }
          >
            {toggling ? "…" : config.enabled ? "Turn OFF" : "Turn ON"}
          </button>
        </div>
      </section>

      {/* Schedule */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Schedule</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Active Days</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <label
                key={d.value}
                className={
                  "inline-flex items-center gap-1 px-3 py-1 rounded border text-xs cursor-pointer " +
                  (config.activeDays.includes(d.value)
                    ? "bg-blue-50 border-blue-400 text-blue-800"
                    : "border-gray-300 text-gray-600")
                }
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={config.activeDays.includes(d.value)}
                  onChange={() => toggleDay(d.value)}
                />
                {d.label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={config.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              value={config.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={config.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Daily Limit */}
      <section>
        <h2 className="text-base font-semibold mb-2">Daily Limit</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Max emails per day (auto-send)
          </label>
          <input
            type="number"
            min={1}
            value={config.maxPerDay}
            onChange={(e) => update("maxPerDay", Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* Sending Interval */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Sending Interval</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min Delay (sec)</label>
            <input
              type="number"
              min={1}
              value={config.minDelaySec}
              onChange={(e) => update("minDelaySec", Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max Delay (sec)</label>
            <input
              type="number"
              min={1}
              value={config.maxDelaySec}
              onChange={(e) => update("maxDelaySec", Math.max(1, Number(e.target.value) || 1))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          A random delay between these bounds is applied between auto-send attempts.
        </p>
      </section>

      {/* Date Filter */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Document Service Date Filter</h2>
        <p className="text-xs text-gray-500">
          Restrict auto-send to companies whose service date falls within this range. Leave blank to send FIFO.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={config.documentServiceDateFrom ?? ""}
              onChange={(e) =>
                update("documentServiceDateFrom", e.target.value || null)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={config.documentServiceDateTo ?? ""}
              onChange={(e) =>
                update("documentServiceDateTo", e.target.value || null)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
