"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  id: string;
  companyName: string;
  email: string | null;
  usdotNumber: string;
  documentType: string;
  serviceDate: string;
  excludedAt: string;
}

export function ExcludedCompaniesTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function restore() {
    if (selected.size === 0) return;
    setRestoring(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/restore-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Failed to restore companies");
      } else {
        setResult(`${data.restored} companies restored to the send queue`);
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setResult("Failed to restore companies");
    } finally {
      setRestoring(false);
    }
  }

  const count = selected.size;

  return (
    <div className="space-y-3">
      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {result}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={restore}
          disabled={restoring || count === 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {restoring
            ? "Restoring..."
            : `Restore ${count} ${count === 1 ? "company" : "companies"}`}
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
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">USDOT</th>
              <th className="pb-2 pr-4">Document Type</th>
              <th className="pb-2 pr-4">Service Date</th>
              <th className="pb-2">Date Excluded</th>
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
                <td className="py-2 pr-4">{r.email || "—"}</td>
                <td className="py-2 pr-4 font-mono text-xs">{r.usdotNumber}</td>
                <td className="py-2 pr-4">{r.documentType}</td>
                <td className="py-2 pr-4">{new Date(r.serviceDate).toLocaleDateString()}</td>
                <td className="py-2">{new Date(r.excludedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
