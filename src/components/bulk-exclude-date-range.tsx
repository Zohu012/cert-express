"use client";

import { useState } from "react";

export function BulkExcludeDateRange() {
  const [keepFrom, setKeepFrom] = useState("");
  const [keepTo, setKeepTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ excluded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keepFrom || !keepTo) return;
    if (
      !confirm(
        `Exclude all candidates OUTSIDE ${keepFrom} – ${keepTo}?\n\nThis cannot be undone from this page (you can restore from Excluded).`
      )
    )
      return;

    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/bulk-exclude-except-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepFrom, keepTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ excluded: data.excluded, total: data.total });
      if (data.excluded > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">From</label>
        <input
          type="date"
          value={keepFrom}
          onChange={(e) => setKeepFrom(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">To</label>
        <input
          type="date"
          value={keepTo}
          onChange={(e) => setKeepTo(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading || !keepFrom || !keepTo}
        className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "Excluding…" : "Keep only date range"}
      </button>
      {result && (
        <span className="text-sm text-green-700">
          Excluded {result.excluded.toLocaleString()} of {result.total.toLocaleString()} — reloading…
        </span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
