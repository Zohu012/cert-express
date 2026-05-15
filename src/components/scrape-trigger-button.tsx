"use client";

import { useEffect, useState } from "react";

interface StatusPayload {
  lastScrapedAt: string | null;
  counts: { success: number; notFound: number; errors: number; pending: number };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
}

export function ScrapeTriggerButton() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [days, setDays] = useState<string>("7");
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/otrucking/scrape/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function handleUpdateLast() {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 1) {
      setMessage({ kind: "err", text: "Enter a positive number of days." });
      return;
    }
    if (!confirm(`Fetch FMCSA data for carriers updated in the last ${n} day(s)?`)) return;
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/otrucking/update-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage({ kind: "ok", text: `Updated ${data.upserted} carrier(s) with MCS-150 date since ${data.since}.` });
      const s = await fetch("/api/admin/otrucking/scrape/status");
      if (s.ok) setStatus(await s.json());
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleRefresh() {
    if (!confirm("Re-fetch FMCSA data for all DOTs in the most recent PDF and migrate emails?")) return;
    setRefreshing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/otrucking/refresh-fmcsa", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage({
        kind: "ok",
        text: `Refreshed ${data.dotsRefreshed} DOTs, migrated ${data.emailsMigrated} emails.`,
      });
      const s = await fetch("/api/admin/otrucking/scrape/status");
      if (s.ok) setStatus(await s.json());
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Refresh failed" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 text-right">
      <div className="text-sm text-gray-700">
        Last scrape:{" "}
        <span className="font-medium">{relativeTime(status?.lastScrapedAt ?? null)}</span>
      </div>
      {status && (
        <div className="text-xs text-gray-500">
          {status.counts.success} success · {status.counts.notFound} not found ·{" "}
          {status.counts.errors} errors · {status.counts.pending} pending
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          aria-label="Days"
        />
        <span className="text-xs text-gray-500">days</span>
        <button
          onClick={handleUpdateLast}
          disabled={updating}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {updating ? "Updating..." : "Update Last"}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh from FMCSA"}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-green-700" : "text-red-600"} max-w-sm`}>
          {message.text}
        </p>
      )}

      <div className="text-xs text-gray-500 max-w-sm">
        <span className="font-medium">Update Last:</span> fetches carriers from FMCSA whose MCS-150
        date is within the last N days and upserts them.{" "}
        <span className="font-medium">Refresh from FMCSA:</span> re-fetches DOTs from the most
        recent PDF and migrates emails.
      </div>
    </div>
  );
}
