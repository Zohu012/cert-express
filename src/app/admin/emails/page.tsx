"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Company {
  id: string;
  companyName: string;
  documentNumber: string;
  documentType: string;
  email: string | null;
  emailStatus: string | null;
  serviceDate: string;
}

export default function EmailsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/email-candidates")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || []);
        setLoading(false);
      });
  }, []);

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
      // Refresh list
      const refreshed = await fetch("/api/admin/email-candidates");
      const refreshedData = await refreshed.json();
      setCompanies(refreshedData.companies || []);
      setSelected(new Set());
    } catch {
      setResult("Failed to send emails");
    }
    setSending(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Email Campaigns</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/emails/history"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            View History →
          </Link>
          <Button onClick={sendEmails} disabled={sending || selected.size === 0}>
            {sending
              ? "Sending..."
              : `Send to ${selected.size} ${selected.size === 1 ? "company" : "companies"}`}
          </Button>
        </div>
      </div>

      {result && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {result}
        </div>
      )}

      <Card>
        <p className="text-sm text-gray-500 mb-4">
          Companies with email addresses that haven&apos;t been contacted yet.
        </p>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : companies.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No companies ready to email. Add email addresses in the Companies
            page first.
          </p>
        ) : (
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
                    <td className="py-2 pr-4 font-mono text-xs">
                      {c.documentNumber}
                    </td>
                    <td className="py-2 pr-4">
                      {new Date(c.serviceDate).toLocaleDateString()}
                    </td>
                    <td className="py-2">{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
