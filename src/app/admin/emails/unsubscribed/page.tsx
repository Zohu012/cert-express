"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface UnsubRow {
  email: string;
  companyName: string | null;
  usdotNumber: string | null;
  documentType: string | null;
  emailSentAt: string | null;
  source: "user" | "admin" | "company";
}

export default function UnsubscribedPage() {
  const [rows, setRows] = useState<UnsubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    fetch("/api/admin/unsubscribed-list")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [reloadTick]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("saving");
    setErrorMsg("");
    const res = await fetch("/api/admin/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (res.ok) {
      setEmail("");
      setStatus("done");
      setReloadTick((n) => n + 1);
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      const data = await res.json();
      setErrorMsg(data.error || "Failed");
      setStatus("error");
    }
  }

  async function handleRemove(emailToRemove: string) {
    if (!confirm(`Resubscribe ${emailToRemove}?`)) return;
    const res = await fetch(
      `/api/admin/unsubscribe?email=${encodeURIComponent(emailToRemove)}`,
      { method: "DELETE" }
    );
    if (res.ok) setReloadTick((n) => n + 1);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Unsubscribed ({rows.length})</h1>
        <Link
          href="/admin/emails"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          ← Back to Campaigns
        </Link>
      </div>

      {/* Add email form */}
      <Card className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Add email to unsubscribe list</p>
        <form onSubmit={handleAdd} className="flex gap-2 items-start">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-md bg-gray-800 text-white px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {status === "saving" ? "Adding…" : "Add"}
          </button>
        </form>
        {status === "done" && (
          <p className="mt-2 text-sm text-green-600">Added successfully.</p>
        )}
        {status === "error" && (
          <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
        )}
      </Card>

      {/* List */}
      <Card>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-sm">No unsubscribed contacts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 pr-4 font-medium">USDOT</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Last Emailed</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.email}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.companyName || "—"}</td>
                    <td className="py-2 pr-4 text-gray-600">{r.usdotNumber || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={
                        "inline-block text-xs px-2 py-0.5 rounded " +
                        (r.source === "admin"
                          ? "bg-amber-100 text-amber-800"
                          : r.source === "user"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700")
                      }>
                        {r.source === "admin" ? "Admin-added" : r.source === "user" ? "User opt-out" : "Company"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">
                      {r.emailSentAt
                        ? new Date(r.emailSentAt).toLocaleDateString("en-US")
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRemove(r.email)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Resubscribe
                      </button>
                    </td>
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
