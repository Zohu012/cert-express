"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./confirm-dialog";

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
  const [excluding, setExcluding] = useState(false);
  const [confirmExclude, setConfirmExclude] = useState(false);
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
      setResult(`Sent: ${data.sent}, Failed: ${data.failed}${typeof data.skipped === "number" ? `, Skipped: ${data.skipped}` : ""}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      setResult("Failed to send emails");
    } finally {
      setSending(false);
    }
  }

  async function excludeCompanies() {
    if (selected.size === 0) return;
    setExcluding(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/exclude-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || "Failed to exclude companies");
      } else {
        setResult(`${data.excluded} companies moved to excluded list`);
      }
      setSelected(new Set());
      setConfirmExclude(false);
      router.refresh();
    } catch {
      setResult("Failed to exclude companies");
    } finally {
      setExcluding(false);
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={sendEmails}
            disabled={sending || excluding || count === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending
              ? "Sending..."
              : `Send to ${count} ${count === 1 ? "company" : "companies"}`}
          </button>
          <button
            onClick={() => setConfirmExclude(true)}
            disabled={sending || excluding || count === 0}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {excluding
              ? "Excluding..."
              : `Exclude ${count} ${count === 1 ? "company" : "companies"}`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-3">
                <input
                  type="checkbox"
                  checked={companies.length > 0 && selected.size === companies.length}
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
                <td className="py-2 pr-4">{new Date(c.serviceDate).toLocaleDateString("en-US", { timeZone: "UTC" })}</td>
                <td className="py-2">{c.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmExclude}
        title="Exclude selected companies?"
        message="These companies will be removed from the send queue and added to the excluded list. You can restore them later."
        confirmLabel="Confirm (Exclude)"
        cancelLabel="Cancel"
        variant="danger"
        loading={excluding}
        onConfirm={excludeCompanies}
        onCancel={() => setConfirmExclude(false)}
      />
    </div>
  );
}
