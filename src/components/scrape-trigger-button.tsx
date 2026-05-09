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
  const [days, setDays] = useState<string>("30");
  const [resetting, setResetting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function loadStatus() {
    try {
      const r = await fetch("/api/admin/otrucking/sync/status").catch(() => null);
      if (!r) return;
      // status route lives at /api/admin/otrucking/scrape/status
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetch("/api/admin/otrucking/scrape/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    loadStatus();
  }, []);

  async function handleReset() {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0) {
      setMessage({ kind: "err", text: "Enter a non-negative number of days." });
      return;
    }
    if (!confirm(`Reset all successfully-scraped rows older than ${n} day(s) back to pending?`)) {
      return;
    }
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/otrucking/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage({ kind: "ok", text: `Reset ${data.reset} row(s) older than ${n} day(s).` });
      // refresh counts
      const s = await fetch("/api/admin/otrucking/scrape/status");
      if (s.ok) setStatus(await s.json());
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Reset failed" });
    } finally {
      setResetting(false);
    }
  }

  async function handleScrape() {
    setScraping(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/otrucking/local-scrape", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage({
        kind: "ok",
        text: `Scrape started (pid ${data.pid}). Tail ${data.logFile} for progress.`,
      });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Scrape failed" });
    } finally {
      setScraping(false);
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
          min={0}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          aria-label="Days"
        />
        <span className="text-xs text-gray-500">days</span>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {resetting ? "Resetting..." : "Update (reset older)"}
        </button>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {scraping ? "Starting..." : "Scrape"}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-green-700" : "text-red-600"} max-w-sm`}>
          {message.text}
        </p>
      )}

      <div className="text-xs text-gray-500 max-w-sm">
        <span className="font-medium">Update:</span> flips successfully-scraped rows older than N
        days back to <code>pending</code> so the next scrape refreshes them.{" "}
        <span className="font-medium">Scrape:</span> spawns the local CLI (only works on a dev
        server with Chrome on :9222).
      </div>
    </div>
  );
}
