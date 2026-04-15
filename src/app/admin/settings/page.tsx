"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
              {"{{city}}"}, {"{{state}}"}
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
          <div className="border-t pt-4">
            <label className="block text-sm font-semibold mb-1">
              Auto-Fetch Cron Schedule
            </label>
            <p className="text-xs text-gray-500 mb-2">
              When to automatically download the daily FMCSA PDF (UTC time,
              weekdays). Default: <code>7 19 * * 1-5</code> = 2:07 PM Eastern.
              Changes take effect after server restart.
            </p>
            <Input
              value={settings.cron_schedule || "7 19 * * 1-5"}
              onChange={(e) => update("cron_schedule", e.target.value)}
              placeholder="7 19 * * 1-5"
              className="font-mono"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "2:07 PM ET (default)", value: "7 19 * * 1-5" },
                { label: "9:07 AM ET", value: "7 14 * * 1-5" },
                { label: "3:07 PM ET", value: "7 20 * * 1-5" },
                { label: "4:07 PM ET", value: "7 21 * * 1-5" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => update("cron_schedule", preset.value)}
                  className={`text-xs px-2 py-1 rounded border ${
                    (settings.cron_schedule || "7 19 * * 1-5") === preset.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

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
