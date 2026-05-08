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

  useEffect(() => {
    fetch("/api/admin/otrucking/scrape/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="text-sm text-gray-700">
        Last scrape: <span className="font-medium">{relativeTime(status?.lastScrapedAt ?? null)}</span>
      </div>
      {status && (
        <div className="text-xs text-gray-500">
          {status.counts.success} success · {status.counts.notFound} not found · {status.counts.errors} errors · {status.counts.pending} pending
        </div>
      )}
      <div className="text-xs text-gray-500 max-w-xs">
        Scraping runs locally. On the operator laptop, start <code className="bg-gray-100 px-1 rounded">scripts/open_chrome.bat</code> then run <code className="bg-gray-100 px-1 rounded">npm run scrape:otrucking</code>.
      </div>
    </div>
  );
}
