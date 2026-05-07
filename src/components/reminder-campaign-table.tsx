"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReminderRow {
  id: string;
  companyName: string;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: string;
  email: string | null;
  totalClicks: number;
  lastClickAt: string | null;
  lastSentAt: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US");
}

export function ReminderCampaignTable({ rows }: { rows: ReminderRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function sendReminders() {
    if (selected.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: Array.from(selected) }),
      });
      const data = await res.json();
      setResult(
        `Sent: ${data.sent}, Failed: ${data.failed}${
          typeof data.skipped === "number" ? `, Skipped: ${data.skipped}` : ""
        }`
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setResult("Failed to send reminders");
    } finally {
      setSending(false);
    }
  }

  const count = selected.size;

  return (
    <div className="space-y-3">
      {result && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {result}
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <button
          onClick={sendReminders}
          disabled={sending || count === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending
            ? "Sending..."
            : `Send 2nd reminder to ${count} ${count === 1 ? "company" : "companies"}`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-3">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="pb-2 pr-4">Company</th>
              <th className="pb-2 pr-4">USDOT</th>
              <th className="pb-2 pr-4">Document</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Service date</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4 text-right">Clicks</th>
              <th className="pb-2 pr-4">Last click</th>
              <th className="pb-2">Last sent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="py-2 pr-4 font-medium">{r.companyName}</td>
                <td className="py-2 pr-4">{r.usdotNumber}</td>
                <td className="py-2 pr-4 font-mono text-xs">{r.documentNumber}</td>
                <td className="py-2 pr-4 text-xs">{r.documentType}</td>
                <td className="py-2 pr-4">
                  {new Date(r.serviceDate).toLocaleDateString("en-US", { timeZone: "UTC" })}
                </td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4 text-right font-semibold">{r.totalClicks}</td>
                <td className="py-2 pr-4 text-xs text-gray-600">{formatDateTime(r.lastClickAt)}</td>
                <td className="py-2 text-xs text-gray-600">{formatDateTime(r.lastSentAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
