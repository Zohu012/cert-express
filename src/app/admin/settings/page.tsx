"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Cron time-slot types & helpers ──────────────────────────────────────────
type CronSlot = { hourUTC: number; minute: number; enabled: boolean };

const DEFAULT_SLOTS: CronSlot[] = [
  { hourUTC: 19, minute: 7, enabled: true },
];

function parseCronSlots(raw: string | undefined): CronSlot[] {
  if (!raw) return DEFAULT_SLOTS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_SLOTS;
}

function utcToETLabel(hourUTC: number, minute: number): string {
  const etHour = ((hourUTC - 5) + 24) % 24;
  const ampm = etHour >= 12 ? "PM" : "AM";
  const h = etHour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${ampm} ET`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 7, 10, 15, 30, 45, 59];

function CronScheduleSection({
  settings,
  update,
}: {
  settings: Record<string, string>;
  update: (key: string, value: string) => void;
}) {
  const [slots, setSlots] = useState<CronSlot[]>(() =>
    parseCronSlots(settings.cron_schedules)
  );

  // Sync when settings load from server
  useEffect(() => {
    if (settings.cron_schedules) {
      setSlots(parseCronSlots(settings.cron_schedules));
    }
  }, [settings.cron_schedules]);

  function commit(next: CronSlot[]) {
    setSlots(next);
    update("cron_schedules", JSON.stringify(next));
  }

  function updateSlot(idx: number, patch: Partial<CronSlot>) {
    commit(slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    if (slots.length >= 3) return;
    commit([...slots, { hourUTC: 18, minute: 0, enabled: true }]);
  }

  function removeSlot(idx: number) {
    commit(slots.filter((_, i) => i !== idx));
  }

  const enabledCount = slots.filter((s) => s.enabled).length;

  return (
    <div className="border-t pt-4">
      <div className="flex items-start justify-between mb-1">
        <label className="block text-sm font-semibold">Auto-Fetch Schedule</label>
        <span className="text-xs text-gray-400">Weekdays only · Changes apply after restart</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Set up to 3 daily check times. If the PDF isn&apos;t available at the first
        time, the next slot will automatically retry.
      </p>

      <div className="space-y-3">
        {slots.map((slot, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              slot.enabled ? "bg-white border-blue-200" : "bg-gray-50 border-gray-200"
            }`}
          >
            {/* Enable toggle */}
            <input
              type="checkbox"
              checked={slot.enabled}
              onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 flex-shrink-0"
            />

            {/* Slot label */}
            <span className="text-xs font-medium text-gray-500 w-14 flex-shrink-0">
              Slot {idx + 1}
            </span>

            {/* Hour select */}
            <div className="flex items-center gap-1">
              <select
                value={slot.hourUTC}
                disabled={!slot.enabled}
                onChange={(e) => updateSlot(idx, { hourUTC: parseInt(e.target.value) })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-40 disabled:bg-gray-100"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">:</span>
              <select
                value={slot.minute}
                disabled={!slot.enabled}
                onChange={(e) => updateSlot(idx, { minute: parseInt(e.target.value) })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-40 disabled:bg-gray-100"
              >
                {MINUTE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400 ml-1">UTC</span>
            </div>

            {/* ET equivalent */}
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                slot.enabled
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              ≈ {utcToETLabel(slot.hourUTC, slot.minute)}
            </span>

            {/* Remove button */}
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlot(idx)}
                className="ml-auto text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                title="Remove slot"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add slot */}
      {slots.length < 3 && (
        <button
          type="button"
          onClick={addSlot}
          className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <span className="text-lg leading-none">+</span> Add another check time
        </button>
      )}

      {/* Status summary */}
      <p className="mt-3 text-xs text-gray-400">
        {enabledCount === 0
          ? "⚠ No slots enabled — auto-fetch is disabled."
          : `${enabledCount} check time${enabledCount > 1 ? "s" : ""} active. FMCSA PDFs are typically published 1–4 PM ET.`}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <form onSubmit={handleSave}>
        <Card className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              Initial Price ($){" "}
              <span className="text-xs font-normal text-gray-400">
                — shown crossed out on payment page (leave blank to hide)
              </span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 79.99"
              value={
                settings.initial_price_cents
                  ? (parseInt(settings.initial_price_cents) / 100).toFixed(2)
                  : ""
              }
              onChange={(e) => {
                const raw = e.target.value;
                update(
                  "initial_price_cents",
                  raw === "" ? "" : String(Math.round(parseFloat(raw) * 100))
                );
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Certificate Price ($){" "}
              <span className="text-xs font-normal text-gray-400">
                — actual charge shown as discounted price
              </span>
            </label>
            <Input
              type="number"
              step="0.01"
              value={(parseInt(settings.price_cents || "3000") / 100).toFixed(2)}
              onChange={(e) =>
                update(
                  "price_cents",
                  String(Math.round(parseFloat(e.target.value) * 100))
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Max Downloads per Purchase
            </label>
            <Input
              type="number"
              value={settings.max_downloads || "5"}
              onChange={(e) => update("max_downloads", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Download Link Expiry (hours)
            </label>
            <Input
              type="number"
              value={settings.download_expiry_hours || "72"}
              onChange={(e) => update("download_expiry_hours", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email Subject Line
            </label>
            <Input
              value={settings.email_subject || ""}
              onChange={(e) => update("email_subject", e.target.value)}
              placeholder="Your FMCSA {{documentType}} – Get Your Official Certificate"
            />
            <p className="text-xs text-gray-400 mt-1">
              Variables: {"{{companyName}}"}, {"{{documentType}}"},{"{{documentNumber}}"},{" "}
              {"{{serviceDate}}"}, {"{{price}}"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email Body Template
            </label>
            <textarea
              value={settings.email_body_template || ""}
              onChange={(e) => update("email_body_template", e.target.value)}
              rows={8}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Variables: {"{{companyName}}"}, {"{{documentType}}"},{" "}
              {"{{documentNumber}}"}, {"{{usdotNumber}}"}, {"{{serviceDate}}"},{" "}
              {"{{price}}"}, {"{{paymentLink}}"}, {"{{dbaName}}"},{" "}
              {"{{city}}"}, {"{{state}}"},{" "}
              {"{{previewImageUrl}}"}{" "}
              <span className="text-gray-300">(blurred document preview image)</span>
            </p>
          </div>

          {/* ── Legal Content ── */}
          <div className="border-t pt-4">
            <label className="block text-sm font-semibold mb-1">
              Legal Content Management
            </label>
            <p className="text-xs text-gray-500 mb-4">
              These values are displayed on the{" "}
              <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                /terms
              </a>{" "}
              page. Updating terms_version here will require users to re-accept
              on next checkout.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Terms Version
              </label>
              <Input
                value={settings.terms_version || "1.0"}
                onChange={(e) => update("terms_version", e.target.value)}
                placeholder="1.0"
                className="max-w-xs font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Increment (e.g. 1.1, 2.0) when you make significant changes to terms.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Terms Content (Markdown)
              </label>
              <textarea
                value={settings.terms_content || ""}
                onChange={(e) => update("terms_content", e.target.value)}
                rows={12}
                placeholder="Leave empty to use the default built-in terms. Supports ## headings, **bold**, and - bullet lists."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                If empty, the /terms page will display the default built-in terms. Supports basic Markdown: ## Heading, **bold**, - bullet list.
              </p>
            </div>
          </div>

          {/* ── Cron Schedule ── */}
          <CronScheduleSection settings={settings} update={update} />

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">
                Settings saved! Restart server to apply cron changes.
              </span>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
