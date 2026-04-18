"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UnsubscribedCompany {
  id: string;
  companyName: string;
  email: string | null;
  usdotNumber: string;
  documentType: string;
  emailSentAt: string | null;
}

export default function UnsubscribedPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<UnsubscribedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/unsubscribed-list")
      .then((r) => r.json())
      .then((data) => setCompanies(data))
      .finally(() => setLoading(false));
  }, [status]); // refetch after a successful add

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
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      const data = await res.json();
      setErrorMsg(data.error || "Failed");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Unsubscribed ({companies.length})</h1>
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
        ) : companies.length === 0 ? (
          <p className="text-gray-400 text-sm">No unsubscribed contacts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Company</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">USDOT</th>
                  <th className="pb-2 pr-4 font-medium">Document</th>
                  <th className="pb-2 font-medium">Last Emailed</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.companyName}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.email}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.usdotNumber}</td>
                    <td className="py-2 pr-4 text-gray-600">{c.documentType}</td>
                    <td className="py-2 text-gray-500">
                      {c.emailSentAt
                        ? new Date(c.emailSentAt).toLocaleDateString("en-US")
                        : "—"}
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
