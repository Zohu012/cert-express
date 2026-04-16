"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Company {
  id: string;
  companyName: string;
  documentNumber: string;
  documentType: string;
  email: string | null;
  emailStatus: string | null;
  serviceDate: string;
}

export function EmailCampaignTable({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === companies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function sendEmails() {
    if (selected.size === 0) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: Array.from(selected) }),
      });
      const data = await res.json();
      setResult(`Sent: ${data.sent}, Failed: ${data.failed}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      setResult("Failed to send emails");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {result && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {result}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={sendEmails}
          disabled={sending || selected.size === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending
            ? "Sending..."
            : `Send to ${selected.size} ${selected.size === 1 ? "company" : "companies"}`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-3">
                <input
                  type="checkbox"
                  checked={selected.size === companies.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="pb-2 pr-4">Company</th>
              <th className="pb-2 pr-4">Document</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                </td>
                <td className="py-2 pr-4 font-medium">{c.companyName}</td>
                <td className="py-2 pr-4 font-mono text-xs">{c.documentNumber}</td>
                <td className="py-2 pr-4">{new Date(c.serviceDate).toLocaleDateString()}</td>
                <td className="py-2">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
