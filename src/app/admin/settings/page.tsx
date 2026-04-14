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
              Certificate Price ($)
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
            />
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
              {"{{documentNumber}}"}, {"{{serviceDate}}"}, {"{{price}}"},{" "}
              {"{{paymentLink}}"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Settings saved!</span>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
