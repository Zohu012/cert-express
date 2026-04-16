"use client";

import { useState, useEffect, useCallback } from "react";

interface Progress {
  running: boolean;
  total: number;
  completed: number;
  success: number;
  notFound: number;
  errors: number;
  current: string;
}

export function ScrapeTriggerButton() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/otrucking/scrape/status");
      if (res.ok) {
        const data: Progress = await res.json();
        setProgress(data);
        return data.running;
      }
    } catch {
      // ignore poll errors
    }
    return false;
  }, []);

  // Poll while running
  useEffect(() => {
    if (!progress?.running) return;
    const interval = setInterval(async () => {
      const still = await poll();
      if (!still) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [progress?.running, poll]);

  // Check status on mount
  useEffect(() => {
    poll();
  }, [poll]);

  async function startScrape() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/otrucking/scrape", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      // Start polling
      setProgress({ running: true, total: 0, completed: 0, success: 0, notFound: 0, errors: 0, current: "Starting..." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setStarting(false);
    }
  }

  const running = progress?.running;
  const pct = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={startScrape}
          disabled={starting || !!running}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {running ? "Scraping..." : starting ? "Starting..." : "Trigger Scrape"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {running && progress && (
        <div className="max-w-md">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>
              {progress.completed} / {progress.total}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress.current && (
            <p className="text-xs text-gray-500 mt-1 truncate">Current: {progress.current}</p>
          )}
        </div>
      )}

      {progress && !running && progress.completed > 0 && (
        <p className="text-sm text-gray-600">
          Done: {progress.success} scraped, {progress.notFound} not found, {progress.errors} errors
        </p>
      )}
    </div>
  );
}
